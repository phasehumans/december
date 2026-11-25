import { prisma } from '@december/database'
import { decryptText } from '@december/shared/crypto'
import { describe, it, expect, afterAll, beforeAll, beforeEach } from 'bun:test'
import request from 'supertest'

import app from '../../src/app'
import { env } from '../../src/env'
import { sessionService } from '../../src/modules/session/session.service'
import { cleanupTestUser, createSignedInUser, getRandomIP } from '../helpers'

// issue 632 section 2: the user's saved skills and remote mcp servers, the prompt box
// lists, and the plugin and mcp switches a session saves
describe('Connections: skills and mcp servers (#632)', () => {
    const stamp = Date.now()
    const ownerEmail = `conn-owner-${stamp}@example.com`
    const otherEmail = `conn-other-${stamp}@example.com`

    let ownerId: string
    let otherId: string
    let ownerToken: string
    let otherToken: string

    const call = (token: string, method: 'get' | 'put' | 'patch' | 'delete' | 'post') => {
        return (path: string, body?: object) => {
            const req = request(app)
                [method](`/api/v1${path}`)
                .set('x-forwarded-for', getRandomIP())
                .set('Authorization', `Bearer ${token}`)
            return body === undefined ? req : req.send(body)
        }
    }
    const as = (token: string) => ({
        get: call(token, 'get'),
        put: call(token, 'put'),
        patch: call(token, 'patch'),
        delete: call(token, 'delete'),
        post: call(token, 'post'),
    })

    const skillBody = (name: string, extra: Record<string, unknown> = {}) => ({
        name,
        description: `what ${name} does`,
        body: `steps of ${name}`,
        ...extra,
    })

    const mcpBody = (name: string, extra: Record<string, unknown> = {}) => ({
        name,
        url: 'https://mcp.example.com/mcp',
        auth: 'none',
        ...extra,
    })

    const savedHeaders = async (userId: string, name: string) => {
        const row = await prisma.userMcpServer.findUnique({
            where: { userId_name: { userId, name } },
        })
        if (!row?.encryptedHeaders) return null
        return JSON.parse(
            decryptText({ encryptedText: row.encryptedHeaders, keyHex: env.SECRETS_ENC_KEY })
        )
    }

    beforeAll(async () => {
        const owner = await createSignedInUser({ email: ownerEmail, name: 'Conn Owner' })
        ownerId = owner.userId
        ownerToken = owner.token
        const other = await createSignedInUser({ email: otherEmail, name: 'Conn Other' })
        otherId = other.userId
        otherToken = other.token
        await prisma.user.update({ where: { id: ownerId }, data: { creditBalance: 10_000 } })
    })

    beforeEach(async () => {
        const userId = { in: [ownerId, otherId] }
        await prisma.userSkill.deleteMany({ where: { userId } })
        await prisma.userMcpServer.deleteMany({ where: { userId } })
        await prisma.session.deleteMany({ where: { userId } })
    })

    afterAll(async () => {
        await prisma.session.deleteMany({ where: { userId: { in: [ownerId, otherId] } } })
        await cleanupTestUser({ id: ownerId })
        await cleanupTestUser({ id: otherId })
    })

    it('needs a signed-in user', async () => {
        const res = await request(app)
            .get('/api/v1/connections/skills')
            .set('x-forwarded-for', getRandomIP())
        expect(res.status).toBe(401)
    })

    describe('skills', () => {
        it('creates a skill and lists it', async () => {
            const created = await as(ownerToken).put('/connections/skills/release-notes', {
                name: 'release-notes',
                description: 'write the release notes',
                body: 'read the merged pull requests, then write the notes',
            })
            expect(created.status).toBe(200)
            expect(created.body.data.skill).toMatchObject({
                name: 'release-notes',
                description: 'write the release notes',
                body: 'read the merged pull requests, then write the notes',
                runs: 'agent',
                enabled: true,
            })

            const list = await as(ownerToken).get('/connections/skills')
            expect(list.status).toBe(200)
            expect(list.body.data.skills.map((skill: { name: string }) => skill.name)).toEqual([
                'release-notes',
            ])
        })

        it('saves a skill again under the same name and keeps one row', async () => {
            await as(ownerToken).put('/connections/skills/deploy', skillBody('deploy'))
            const saved = await as(ownerToken).put(
                '/connections/skills/deploy',
                skillBody('deploy', { body: 'the new steps', runs: 'user' })
            )
            expect(saved.status).toBe(200)
            expect(saved.body.data.skill.body).toBe('the new steps')
            expect(saved.body.data.skill.runs).toBe('user')
            expect(await prisma.userSkill.count({ where: { userId: ownerId } })).toBe(1)
        })

        it('renames a skill through a new name in the body', async () => {
            await as(ownerToken).put('/connections/skills/deploy', skillBody('deploy'))
            const before = await prisma.userSkill.findFirst({ where: { userId: ownerId } })

            const renamed = await as(ownerToken).put(
                '/connections/skills/deploy',
                skillBody('ship-it')
            )
            expect(renamed.status).toBe(200)
            expect(renamed.body.data.skill.name).toBe('ship-it')

            const rows = await prisma.userSkill.findMany({ where: { userId: ownerId } })
            expect(rows.map((row) => row.name)).toEqual(['ship-it'])
            // the same row, so nothing that points at it is lost
            expect(rows[0]?.id).toBe(before?.id)
        })

        it('refuses a rename to a name that is taken', async () => {
            await as(ownerToken).put('/connections/skills/deploy', skillBody('deploy'))
            await as(ownerToken).put('/connections/skills/review', skillBody('review'))

            const res = await as(ownerToken).put('/connections/skills/deploy', skillBody('review'))
            expect(res.status).toBe(409)
            const names = (await prisma.userSkill.findMany({ where: { userId: ownerId } }))
                .map((row) => row.name)
                .sort()
            expect(names).toEqual(['deploy', 'review'])
        })

        it('refuses a bad name, an empty description and an empty body', async () => {
            const badName = await as(ownerToken).put(
                '/connections/skills/deploy',
                skillBody('Deploy Now')
            )
            expect(badName.status).toBe(400)
            const noDescription = await as(ownerToken).put(
                '/connections/skills/deploy',
                skillBody('deploy', { description: '  ' })
            )
            expect(noDescription.status).toBe(400)
            const noBody = await as(ownerToken).put(
                '/connections/skills/deploy',
                skillBody('deploy', { body: '' })
            )
            expect(noBody.status).toBe(400)
            expect(await prisma.userSkill.count({ where: { userId: ownerId } })).toBe(0)
        })

        it('turns a skill off and on', async () => {
            await as(ownerToken).put('/connections/skills/deploy', skillBody('deploy'))

            const off = await as(ownerToken).patch('/connections/skills/deploy', {
                enabled: false,
            })
            expect(off.status).toBe(200)
            expect(off.body.data.skill.enabled).toBe(false)
            const listed = await as(ownerToken).get('/connections/skills')
            expect(listed.body.data.skills[0].enabled).toBe(false)

            const on = await as(ownerToken).patch('/connections/skills/deploy', { enabled: true })
            expect(on.status).toBe(200)
            expect(on.body.data.skill.enabled).toBe(true)

            const missing = await as(ownerToken).patch('/connections/skills/nope', {
                enabled: false,
            })
            expect(missing.status).toBe(404)
        })

        it('deletes a skill', async () => {
            await as(ownerToken).put('/connections/skills/deploy', skillBody('deploy'))

            const deleted = await as(ownerToken).delete('/connections/skills/deploy')
            expect(deleted.status).toBe(200)
            expect(await prisma.userSkill.count({ where: { userId: ownerId } })).toBe(0)

            const again = await as(ownerToken).delete('/connections/skills/deploy')
            expect(again.status).toBe(404)
        })

        it('stops at 100 skills, and still saves one of the 100', async () => {
            await prisma.userSkill.createMany({
                data: Array.from({ length: 100 }, (_, index) => ({
                    userId: ownerId,
                    name: `skill-${index}`,
                    description: 'd',
                    body: 'b',
                })),
            })

            const oneMore = await as(ownerToken).put(
                '/connections/skills/one-more',
                skillBody('one-more')
            )
            expect(oneMore.status).toBe(409)
            expect(await prisma.userSkill.count({ where: { userId: ownerId } })).toBe(100)

            const edit = await as(ownerToken).put(
                '/connections/skills/skill-7',
                skillBody('skill-7', { body: 'edited' })
            )
            expect(edit.status).toBe(200)
            expect(edit.body.data.skill.body).toBe('edited')
        })
    })

    describe('mcp servers', () => {
        it('saves a server with no sign-in and lists it', async () => {
            const created = await as(ownerToken).put('/connections/mcps/linear', {
                name: 'linear',
                url: 'https://mcp.linear.app/mcp',
                auth: 'none',
            })
            expect(created.status).toBe(200)
            expect(created.body.data.mcp).toEqual({
                name: 'linear',
                url: 'https://mcp.linear.app/mcp',
                transport: 'http',
                auth: 'none',
                headerKeys: [],
                enabled: true,
                disabledTools: [],
                status: 'unknown',
                lastError: null,
                tools: [],
                checkedAt: null,
            })

            const list = await as(ownerToken).get('/connections/mcps')
            expect(list.status).toBe(200)
            expect(list.body.data.mcps.map((mcp: { name: string }) => mcp.name)).toEqual(['linear'])
        })

        it('takes https only', async () => {
            const http = await as(ownerToken).put(
                '/connections/mcps/plain',
                mcpBody('plain', { url: 'http://mcp.example.com/mcp' })
            )
            expect(http.status).toBe(400)
            expect(http.body.message).toContain('https://')
            expect(await prisma.userMcpServer.count({ where: { userId: ownerId } })).toBe(0)
        })

        it('refuses private and local addresses', async () => {
            const urls = [
                'https://localhost/mcp',
                'https://127.0.0.1/mcp',
                'https://10.0.0.8/mcp',
                'https://172.16.4.1/mcp',
                'https://192.168.1.10/mcp',
                'https://169.254.169.254/latest/meta-data',
                'https://[::1]/mcp',
                'https://redis.internal/mcp',
                'https://token@mcp.example.com/mcp',
            ]
            for (const url of urls) {
                const res = await as(ownerToken).put(
                    '/connections/mcps/inside',
                    mcpBody('inside', { url })
                )
                expect({ url, status: res.status }).toEqual({ url, status: 400 })
            }
            expect(await prisma.userMcpServer.count({ where: { userId: ownerId } })).toBe(0)
        })

        it('refuses sign-in with oauth', async () => {
            const res = await as(ownerToken).put(
                '/connections/mcps/notion',
                mcpBody('notion', { auth: 'oauth' })
            )
            expect(res.status).toBe(400)
            expect(await prisma.userMcpServer.count({ where: { userId: ownerId } })).toBe(0)
        })

        it('never returns a header value', async () => {
            const created = await as(ownerToken).put(
                '/connections/mcps/sentry',
                mcpBody('sentry', {
                    auth: 'header',
                    headers: [
                        { key: 'Authorization', value: 'Bearer top-secret-1' },
                        { key: 'X-Org', value: 'org-secret-2' },
                    ],
                })
            )
            expect(created.status).toBe(200)
            expect(created.body.data.mcp.auth).toBe('header')
            expect(created.body.data.mcp.headerKeys).toEqual(['Authorization', 'X-Org'])

            const list = await as(ownerToken).get('/connections/mcps')
            const promptBox = await as(ownerToken).get('/connections/prompt-box')
            const patched = await as(ownerToken).patch('/connections/mcps/sentry', {
                enabled: false,
            })
            for (const res of [created, list, promptBox, patched]) {
                const text = JSON.stringify(res.body)
                expect(text).not.toContain('top-secret-1')
                expect(text).not.toContain('org-secret-2')
                expect(text).not.toContain('encryptedHeaders')
            }

            // the database holds the headers encrypted, never as plain text
            const row = await prisma.userMcpServer.findFirst({ where: { userId: ownerId } })
            expect(row?.encryptedHeaders).toBeTruthy()
            expect(row?.encryptedHeaders).not.toContain('top-secret-1')
            expect(await savedHeaders(ownerId, 'sentry')).toEqual({
                Authorization: 'Bearer top-secret-1',
                'X-Org': 'org-secret-2',
            })
        })

        it('keeps the saved value of a header sent empty, and drops a header left out', async () => {
            await as(ownerToken).put(
                '/connections/mcps/sentry',
                mcpBody('sentry', {
                    auth: 'header',
                    headers: [
                        { key: 'Authorization', value: 'Bearer top-secret-1' },
                        { key: 'X-Org', value: 'org-secret-2' },
                        { key: 'X-Old', value: 'old-3' },
                    ],
                })
            )

            const saved = await as(ownerToken).put(
                '/connections/mcps/sentry',
                mcpBody('sentry', {
                    auth: 'header',
                    headers: [
                        { key: 'Authorization', value: '' },
                        { key: 'X-Org', value: 'org-new-4' },
                    ],
                })
            )
            expect(saved.status).toBe(200)
            expect(saved.body.data.mcp.headerKeys).toEqual(['Authorization', 'X-Org'])
            expect(await savedHeaders(ownerId, 'sentry')).toEqual({
                Authorization: 'Bearer top-secret-1',
                'X-Org': 'org-new-4',
            })
        })

        it('needs a header value when the server signs in with a header', async () => {
            const noHeaders = await as(ownerToken).put(
                '/connections/mcps/sentry',
                mcpBody('sentry', { auth: 'header' })
            )
            expect(noHeaders.status).toBe(400)

            // an empty value with nothing saved is no header at all
            const emptyValue = await as(ownerToken).put(
                '/connections/mcps/sentry',
                mcpBody('sentry', {
                    auth: 'header',
                    headers: [{ key: 'Authorization', value: '' }],
                })
            )
            expect(emptyValue.status).toBe(400)
            expect(await prisma.userMcpServer.count({ where: { userId: ownerId } })).toBe(0)
        })

        it('removes the saved headers when the sign-in changes to none', async () => {
            await as(ownerToken).put(
                '/connections/mcps/sentry',
                mcpBody('sentry', {
                    auth: 'header',
                    headers: [{ key: 'Authorization', value: 'Bearer top-secret-1' }],
                })
            )
            const saved = await as(ownerToken).put('/connections/mcps/sentry', mcpBody('sentry'))
            expect(saved.status).toBe(200)
            expect(saved.body.data.mcp.auth).toBe('none')
            expect(saved.body.data.mcp.headerKeys).toEqual([])
            expect(await savedHeaders(ownerId, 'sentry')).toBeNull()
        })

        it('renames a server through a new name in the body and keeps its headers', async () => {
            await as(ownerToken).put(
                '/connections/mcps/sentry',
                mcpBody('sentry', {
                    auth: 'header',
                    headers: [{ key: 'Authorization', value: 'Bearer top-secret-1' }],
                })
            )
            await as(ownerToken).put('/connections/mcps/linear', mcpBody('linear'))

            const renamed = await as(ownerToken).put(
                '/connections/mcps/sentry',
                mcpBody('sentry_eu', {
                    auth: 'header',
                    headers: [{ key: 'Authorization', value: '' }],
                })
            )
            expect(renamed.status).toBe(200)
            expect(renamed.body.data.mcp.name).toBe('sentry_eu')
            expect(await savedHeaders(ownerId, 'sentry_eu')).toEqual({
                Authorization: 'Bearer top-secret-1',
            })

            const taken = await as(ownerToken).put(
                '/connections/mcps/sentry_eu',
                mcpBody('linear', {
                    auth: 'header',
                    headers: [{ key: 'Authorization', value: '' }],
                })
            )
            expect(taken.status).toBe(409)
            const names = (await prisma.userMcpServer.findMany({ where: { userId: ownerId } }))
                .map((row) => row.name)
                .sort()
            expect(names).toEqual(['linear', 'sentry_eu'])
        })

        it('keeps what the last run found until the address or a header changes', async () => {
            await as(ownerToken).put(
                '/connections/mcps/sentry',
                mcpBody('sentry', {
                    auth: 'header',
                    headers: [{ key: 'Authorization', value: 'Bearer top-secret-1' }],
                })
            )
            const checkedAt = new Date('2026-11-20T10:00:00.000Z')
            const markChecked = () =>
                prisma.userMcpServer.updateMany({
                    where: { userId: ownerId, name: 'sentry' },
                    data: { status: 'error', lastError: 'HTTP 401', checkedAt, tools: ['search'] },
                })
            const sameHeader = { auth: 'header', headers: [{ key: 'Authorization', value: '' }] }

            await markChecked()
            const sameTarget = await as(ownerToken).put(
                '/connections/mcps/sentry',
                mcpBody('sentry', { ...sameHeader, disabledTools: ['search'] })
            )
            expect(sameTarget.body.data.mcp).toMatchObject({
                status: 'error',
                lastError: 'HTTP 401',
                checkedAt: '2026-11-20T10:00:00.000Z',
                disabledTools: ['search'],
            })

            const newUrl = await as(ownerToken).put(
                '/connections/mcps/sentry',
                mcpBody('sentry', { ...sameHeader, url: 'https://mcp.sentry.dev/mcp' })
            )
            expect(newUrl.body.data.mcp).toMatchObject({
                status: 'unknown',
                lastError: null,
                checkedAt: null,
            })

            await markChecked()
            const newKey = await as(ownerToken).put(
                '/connections/mcps/sentry',
                mcpBody('sentry', {
                    url: 'https://mcp.sentry.dev/mcp',
                    auth: 'header',
                    headers: [{ key: 'Authorization', value: 'Bearer top-secret-5' }],
                })
            )
            expect(newKey.body.data.mcp.status).toBe('unknown')

            await markChecked()
            const noSignIn = await as(ownerToken).put(
                '/connections/mcps/sentry',
                mcpBody('sentry', { url: 'https://mcp.sentry.dev/mcp' })
            )
            expect(noSignIn.body.data.mcp.status).toBe('unknown')
            expect(noSignIn.body.data.mcp.lastError).toBeNull()
        })

        it('turns a server off and on', async () => {
            await as(ownerToken).put('/connections/mcps/linear', mcpBody('linear'))

            const off = await as(ownerToken).patch('/connections/mcps/linear', { enabled: false })
            expect(off.status).toBe(200)
            expect(off.body.data.mcp.enabled).toBe(false)
            const listed = await as(ownerToken).get('/connections/mcps')
            expect(listed.body.data.mcps[0].enabled).toBe(false)

            const on = await as(ownerToken).patch('/connections/mcps/linear', { enabled: true })
            expect(on.status).toBe(200)
            expect(on.body.data.mcp.enabled).toBe(true)

            const missing = await as(ownerToken).patch('/connections/mcps/nope', {
                enabled: false,
            })
            expect(missing.status).toBe(404)
            const nothing = await as(ownerToken).patch('/connections/mcps/linear', {})
            expect(nothing.status).toBe(400)
        })

        it('saves the tools turned off, and leaves the on switch alone', async () => {
            await as(ownerToken).put('/connections/mcps/linear', mcpBody('linear'))
            await as(ownerToken).patch('/connections/mcps/linear', { enabled: false })

            const tools = await as(ownerToken).patch('/connections/mcps/linear', {
                disabledTools: ['delete_issue', 'create_issue'],
            })
            expect(tools.status).toBe(200)
            expect(tools.body.data.mcp.disabledTools).toEqual(['delete_issue', 'create_issue'])
            expect(tools.body.data.mcp.enabled).toBe(false)

            const none = await as(ownerToken).patch('/connections/mcps/linear', {
                disabledTools: [],
            })
            expect(none.body.data.mcp.disabledTools).toEqual([])
        })

        it('deletes a server', async () => {
            await as(ownerToken).put('/connections/mcps/linear', mcpBody('linear'))

            const deleted = await as(ownerToken).delete('/connections/mcps/linear')
            expect(deleted.status).toBe(200)
            expect(await prisma.userMcpServer.count({ where: { userId: ownerId } })).toBe(0)

            const again = await as(ownerToken).delete('/connections/mcps/linear')
            expect(again.status).toBe(404)
        })

        it('stops at 20 servers, and still saves one of the 20', async () => {
            await prisma.userMcpServer.createMany({
                data: Array.from({ length: 20 }, (_, index) => ({
                    userId: ownerId,
                    name: `server-${index}`,
                    url: 'https://mcp.example.com/mcp',
                })),
            })

            const oneMore = await as(ownerToken).put(
                '/connections/mcps/one-more',
                mcpBody('one-more')
            )
            expect(oneMore.status).toBe(409)
            expect(await prisma.userMcpServer.count({ where: { userId: ownerId } })).toBe(20)

            const edit = await as(ownerToken).put(
                '/connections/mcps/server-7',
                mcpBody('server-7', { url: 'https://mcp.example.org/mcp' })
            )
            expect(edit.status).toBe(200)
            expect(edit.body.data.mcp.url).toBe('https://mcp.example.org/mcp')
        })
    })

    describe('the prompt box lists', () => {
        it('lists the skills that are on, and every mcp server with its status', async () => {
            await as(ownerToken).put('/connections/skills/deploy', skillBody('deploy'))
            await as(ownerToken).put(
                '/connections/skills/audit',
                skillBody('audit', { runs: 'user' })
            )
            await as(ownerToken).put('/connections/skills/retired', skillBody('retired'))
            await as(ownerToken).patch('/connections/skills/retired', { enabled: false })

            await as(ownerToken).put('/connections/mcps/linear', mcpBody('linear'))
            await as(ownerToken).put('/connections/mcps/sentry', mcpBody('sentry'))
            await as(ownerToken).put('/connections/mcps/figma', mcpBody('figma'))
            await as(ownerToken).patch('/connections/mcps/figma', { enabled: false })
            await prisma.userMcpServer.updateMany({
                where: { userId: ownerId, name: 'linear' },
                data: { status: 'connected', tools: ['list_issues'], checkedAt: new Date() },
            })
            await prisma.userMcpServer.updateMany({
                where: { userId: ownerId, name: 'sentry' },
                data: { status: 'error', lastError: 'HTTP 401', checkedAt: new Date() },
            })

            const res = await as(ownerToken).get('/connections/prompt-box')
            expect(res.status).toBe(200)
            expect(res.body.data).toEqual({
                skills: [
                    { name: 'audit', description: 'what audit does', plugin: null },
                    { name: 'deploy', description: 'what deploy does', plugin: null },
                ],
                plugins: [],
                mcps: [
                    { name: 'figma', enabled: false, status: 'unknown', lastError: null },
                    { name: 'linear', enabled: true, status: 'connected', lastError: null },
                    { name: 'sentry', enabled: true, status: 'error', lastError: 'HTTP 401' },
                ],
            })
        })

        it('is empty for a user with nothing saved', async () => {
            const res = await as(otherToken).get('/connections/prompt-box')
            expect(res.status).toBe(200)
            expect(res.body.data).toEqual({ skills: [], plugins: [], mcps: [] })
        })
    })

    describe("another user's rows", () => {
        beforeEach(async () => {
            await as(ownerToken).put(
                '/connections/skills/deploy',
                skillBody('deploy', { body: 'the steps of the owner' })
            )
            await as(ownerToken).put(
                '/connections/mcps/sentry',
                mcpBody('sentry', {
                    auth: 'header',
                    headers: [{ key: 'Authorization', value: 'Bearer top-secret-1' }],
                })
            )
        })

        it('are never visible', async () => {
            const skills = await as(otherToken).get('/connections/skills')
            expect(skills.body.data.skills).toEqual([])
            const mcps = await as(otherToken).get('/connections/mcps')
            expect(mcps.body.data.mcps).toEqual([])
            const promptBox = await as(otherToken).get('/connections/prompt-box')
            expect(promptBox.body.data).toEqual({ skills: [], plugins: [], mcps: [] })
        })

        it('cannot be turned off, changed or deleted', async () => {
            const results = await Promise.all([
                as(otherToken).patch('/connections/skills/deploy', { enabled: false }),
                as(otherToken).delete('/connections/skills/deploy'),
                as(otherToken).patch('/connections/mcps/sentry', { enabled: false }),
                as(otherToken).patch('/connections/mcps/sentry', { disabledTools: ['search'] }),
                as(otherToken).delete('/connections/mcps/sentry'),
            ])
            expect(results.map((res) => res.status)).toEqual([404, 404, 404, 404, 404])

            const skill = await prisma.userSkill.findFirst({ where: { userId: ownerId } })
            expect(skill).toMatchObject({ name: 'deploy', enabled: true })
            const mcp = await prisma.userMcpServer.findFirst({ where: { userId: ownerId } })
            expect(mcp).toMatchObject({ name: 'sentry', enabled: true, disabledTools: [] })
        })

        it('are not touched by a save under the same name', async () => {
            const skill = await as(otherToken).put(
                '/connections/skills/deploy',
                skillBody('deploy', { body: 'the steps of the other user' })
            )
            expect(skill.status).toBe(200)
            const mcp = await as(otherToken).put(
                '/connections/mcps/sentry',
                mcpBody('sentry', {
                    url: 'https://other.example.com/mcp',
                    auth: 'header',
                    // an empty value must not pick up the owner's saved header
                    headers: [
                        { key: 'Authorization', value: '' },
                        { key: 'X-Mine', value: 'mine' },
                    ],
                })
            )
            expect(mcp.status).toBe(200)
            expect(mcp.body.data.mcp.headerKeys).toEqual(['X-Mine'])
            expect(await savedHeaders(otherId, 'sentry')).toEqual({ 'X-Mine': 'mine' })

            const ownerSkill = await prisma.userSkill.findFirst({ where: { userId: ownerId } })
            expect(ownerSkill?.body).toBe('the steps of the owner')
            const ownerMcp = await prisma.userMcpServer.findFirst({ where: { userId: ownerId } })
            expect(ownerMcp?.url).toBe('https://mcp.example.com/mcp')
            expect(await savedHeaders(ownerId, 'sentry')).toEqual({
                Authorization: 'Bearer top-secret-1',
            })
        })
    })

    describe('the switches a session saves', () => {
        const savedConfig = async (sessionId: string) =>
            (await prisma.sessionSettings.findUnique({ where: { sessionId } }))?.config as Record<
                string,
                unknown
            >

        it('saves the plugins and mcp servers turned off with a new session', async () => {
            const res = await as(ownerToken).post('/session', {
                prompt: 'fix the build',
                disabledPlugins: ['frontend-design'],
                disabledMcps: ['sentry', 'linear'],
            })
            expect(res.status).toBe(201)
            expect(await savedConfig(res.body.data.session.id)).toMatchObject({
                disabledPlugins: ['frontend-design'],
                disabledMcps: ['sentry', 'linear'],
            })

            const turn = await sessionService.resolveTurnConfig({
                userId: ownerId,
                sessionId: res.body.data.session.id,
                billingSource: 'CREDITS',
            })
            expect(turn.disabledPlugins).toEqual(['frontend-design'])
            expect(turn.disabledMcps).toEqual(['sentry', 'linear'])
        })

        it('has no switches when the session sends none', async () => {
            const res = await as(ownerToken).post('/session', { prompt: 'fix the build' })
            expect(res.status).toBe(201)

            const turn = await sessionService.resolveTurnConfig({
                userId: ownerId,
                sessionId: res.body.data.session.id,
                billingSource: 'CREDITS',
            })
            expect(turn.disabledPlugins).toEqual([])
            expect(turn.disabledMcps).toEqual([])
        })

        it('keeps the switches sent with a message for the next turns', async () => {
            const created = await as(ownerToken).post('/session', {
                prompt: 'fix the build',
                disabledMcps: ['sentry'],
            })
            const sessionId = created.body.data.session.id

            const changed = await sessionService.resolveTurnConfig({
                userId: ownerId,
                sessionId,
                billingSource: 'CREDITS',
                disabledPlugins: ['frontend-design'],
                disabledMcps: ['linear'],
            })
            expect(changed.disabledPlugins).toEqual(['frontend-design'])
            expect(changed.disabledMcps).toEqual(['linear'])
            expect(await savedConfig(sessionId)).toMatchObject({
                disabledPlugins: ['frontend-design'],
                disabledMcps: ['linear'],
            })

            // nothing sent: the saved switches hold
            const next = await sessionService.resolveTurnConfig({
                userId: ownerId,
                sessionId,
                billingSource: 'CREDITS',
            })
            expect(next.disabledPlugins).toEqual(['frontend-design'])
            expect(next.disabledMcps).toEqual(['linear'])

            // an empty list turns every one on again, and leaves the other list alone
            const cleared = await sessionService.resolveTurnConfig({
                userId: ownerId,
                sessionId,
                billingSource: 'CREDITS',
                disabledMcps: [],
            })
            expect(cleared.disabledMcps).toEqual([])
            expect(cleared.disabledPlugins).toEqual(['frontend-design'])
            expect(await savedConfig(sessionId)).toMatchObject({
                disabledPlugins: ['frontend-design'],
                disabledMcps: [],
            })
        })

        it("does not save switches on another user's session", async () => {
            const created = await as(ownerToken).post('/session', {
                prompt: 'fix the build',
                disabledMcps: ['sentry'],
            })
            const sessionId = created.body.data.session.id

            await sessionService.resolveTurnConfig({
                userId: otherId,
                sessionId,
                billingSource: 'CREDITS',
                disabledMcps: [],
            })
            expect((await savedConfig(sessionId)).disabledMcps).toEqual(['sentry'])
        })

        it('takes a new session that also names picked skills', async () => {
            // the web sends one run config to POST /session and to the socket. the skills
            // of the first message travel with the socket prompt, not with the session.
            const res = await as(ownerToken).post('/session', {
                prompt: 'fix the build',
                skills: ['deploy'],
                disabledMcps: ['sentry'],
            })
            expect(res.status).toBe(201)
            expect(await savedConfig(res.body.data.session.id)).toEqual({
                planFirst: false,
                effort: 'deep',
                openPullRequest: true,
                disabledMcps: ['sentry'],
            })
        })

        it('refuses switches that are not lists of names', async () => {
            const res = await as(ownerToken).post('/session', {
                prompt: 'fix the build',
                disabledMcps: 'sentry',
            })
            expect(res.status).toBe(400)
        })
    })
})
