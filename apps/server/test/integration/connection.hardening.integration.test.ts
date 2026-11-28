import { prisma } from '@december/database'
import { describe, it, expect, afterAll, beforeAll, beforeEach } from 'bun:test'
import request from 'supertest'

import app from '../../src/app'
import { cleanupTestUser, createSignedInUser, getRandomIP } from '../helpers'

// the connections audit of 2026-11-28: strict bodies on every skill and mcp route, header
// names and values an mcp server can save, names an import brings in, and the routes
// without a token
describe('Connections: strict bodies and mcp headers', () => {
    const stamp = Date.now()
    const email = `conn-hard-${stamp}@example.com`
    let userId: string
    let token: string

    const send = (
        method: 'put' | 'patch' | 'post' | 'get' | 'delete',
        path: string,
        body?: object
    ) => {
        const req = request(app)
            [method](`/api/v1/connections${path}`)
            .set('x-forwarded-for', getRandomIP())
            .set('Authorization', `Bearer ${token}`)
        return body === undefined ? req : req.send(body)
    }

    const mcp = (extra: Record<string, unknown> = {}) => ({
        name: 'linear',
        url: 'https://mcp.linear.app/mcp',
        auth: 'header',
        headers: [{ key: 'Authorization', value: 'Bearer abc' }],
        ...extra,
    })

    beforeAll(async () => {
        const user = await createSignedInUser({ email, name: 'Conn Hard' })
        userId = user.userId
        token = user.token
    })

    beforeEach(async () => {
        await prisma.userSkill.deleteMany({ where: { userId } })
        await prisma.userMcpServer.deleteMany({ where: { userId } })
    })

    afterAll(async () => {
        await cleanupTestUser({ id: userId })
    })

    it('answers 401 on every route without a token', async () => {
        const anon = (method: 'get' | 'put' | 'patch' | 'post' | 'delete', path: string) =>
            request(app)[method](`/api/v1/connections${path}`).set('x-forwarded-for', getRandomIP())
        const routes: Array<['get' | 'put' | 'patch' | 'post' | 'delete', string]> = [
            ['get', '/prompt-box'],
            ['get', '/skills'],
            ['put', '/skills/a'],
            ['patch', '/skills/a'],
            ['delete', '/skills/a'],
            ['get', '/mcps'],
            ['put', '/mcps/a'],
            ['patch', '/mcps/a'],
            ['delete', '/mcps/a'],
            ['post', '/import/preview'],
            ['post', '/import'],
        ]
        for (const [method, path] of routes) {
            expect((await anon(method, path)).status).toBe(401)
        }
    })

    it('refuses unknown fields on skill bodies', async () => {
        const body = { name: 'a', description: 'd', body: 'b' }
        expect((await send('put', '/skills/a', { ...body, plugin: 'x' })).status).toBe(400)
        expect((await send('put', '/skills/a', body)).status).toBe(200)
        expect((await send('patch', '/skills/a', { enabled: false, runs: 'user' })).status).toBe(
            400
        )
        expect((await send('put', '/skills/a', { ...body, body: 'x'.repeat(20_001) })).status).toBe(
            400
        )
        expect(
            (await send('put', '/skills/a', { ...body, description: 'x'.repeat(301) })).status
        ).toBe(400)
    })

    it('refuses unknown fields on mcp bodies and header items', async () => {
        expect((await send('put', '/mcps/linear', mcp({ status: 'connected' }))).status).toBe(400)
        expect(
            (
                await send(
                    'put',
                    '/mcps/linear',
                    mcp({ headers: [{ key: 'Authorization', value: 'x', secret: true }] })
                )
            ).status
        ).toBe(400)
        expect((await send('put', '/mcps/linear', mcp())).status).toBe(200)
        expect(
            (await send('patch', '/mcps/linear', { enabled: false, url: 'https://x.dev' })).status
        ).toBe(400)
    })

    it('refuses headers the connection sets itself', async () => {
        for (const key of ['Host', 'content-length', 'Transfer-Encoding', 'Proxy-Authorization']) {
            const res = await send(
                'put',
                '/mcps/linear',
                mcp({ headers: [{ key, value: 'evil.internal' }] })
            )
            expect(res.status).toBe(400)
        }
        expect(await prisma.userMcpServer.count({ where: { userId } })).toBe(0)
    })

    it('refuses a header value with a line break, and the same header twice', async () => {
        const crlf = await send(
            'put',
            '/mcps/linear',
            mcp({ headers: [{ key: 'Authorization', value: 'Bearer a\r\nX-Evil: 1' }] })
        )
        expect(crlf.status).toBe(400)
        const twice = await send(
            'put',
            '/mcps/linear',
            mcp({
                headers: [
                    { key: 'Authorization', value: 'a' },
                    { key: 'authorization', value: 'b' },
                ],
            })
        )
        expect(twice.status).toBe(400)
        const many = await send(
            'put',
            '/mcps/linear',
            mcp({ headers: Array.from({ length: 11 }, (_, i) => ({ key: `X-H${i}`, value: 'v' })) })
        )
        expect(many.status).toBe(400)
    })

    it('refuses internal and plain http addresses written in other forms', async () => {
        for (const url of [
            'http://mcp.linear.app/mcp',
            'https://127.1/mcp',
            'https://0x7f000001/mcp',
            'https://2130706433/mcp',
            'https://[::1]/mcp',
            'https://[::ffff:169.254.169.254]/mcp',
            'https://metadata.google.internal/mcp',
            'https://localhost./mcp',
            'https://user:pass@mcp.linear.app/mcp',
            'ftp://mcp.linear.app/mcp',
            `https://mcp.linear.app/${'a'.repeat(500)}`,
        ]) {
            const res = await send('put', '/mcps/linear', mcp({ url }))
            expect(res.status).toBe(400)
        }
        expect(await prisma.userMcpServer.count({ where: { userId } })).toBe(0)
    })

    it('refuses unknown fields on the import routes', async () => {
        const preview = await send('post', '/import/preview', {
            repoFullName: 'acme/app',
            token: 'gh-x',
        })
        expect(preview.status).toBe(400)
        const bad = await send('post', '/import', {
            repoFullName: 'acme/app',
            rules: ['AGENTS.md', 'AGENTS.md', 'CLAUDE.md'],
        })
        expect(bad.status).toBe(400)
    })
})
