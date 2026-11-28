import { prisma } from '@december/database'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'bun:test'
import request from 'supertest'

import app from '../../src/app'
import { cleanupTestUser, createSignedInUser, getRandomIP } from '../helpers'

// connections page, hooks: user hooks saved on the account in the cli's hooks.json terms.
// the server only saves them; a cloud session runs them in its sandbox
describe('Connections: hooks', () => {
    const stamp = Date.now()
    let ownerId: string
    let otherId: string
    let ownerToken: string
    let otherToken: string

    const call = (token: string | null, method: 'get' | 'post' | 'put' | 'patch' | 'delete') => {
        return (path: string, body?: object) => {
            let req = request(app)
                [method](`/api/v1/connections/hooks${path}`)
                .set('x-forwarded-for', getRandomIP())
            if (token) req = req.set('Authorization', `Bearer ${token}`)
            return body === undefined ? req : req.send(body)
        }
    }
    const as = (token: string | null) => ({
        get: call(token, 'get'),
        post: call(token, 'post'),
        put: call(token, 'put'),
        patch: call(token, 'patch'),
        delete: call(token, 'delete'),
    })

    const preTool = { event: 'PreToolUse', matcher: 'bash', command: './check.sh', timeout: 30 }

    beforeAll(async () => {
        const owner = await createSignedInUser({
            email: `hooks-owner-${stamp}@example.com`,
            name: 'Hooks Owner',
        })
        ownerId = owner.userId
        ownerToken = owner.token
        const other = await createSignedInUser({
            email: `hooks-other-${stamp}@example.com`,
            name: 'Hooks Other',
        })
        otherId = other.userId
        otherToken = other.token
    })

    beforeEach(async () => {
        await prisma.userHook.deleteMany({ where: { userId: { in: [ownerId, otherId] } } })
    })

    afterAll(async () => {
        await cleanupTestUser({ id: ownerId })
        await cleanupTestUser({ id: otherId })
    })

    it('refuses every route without a token', async () => {
        const anon = as(null)
        const id = crypto.randomUUID()
        for (const res of await Promise.all([
            anon.get('/'),
            anon.post('/', preTool),
            anon.put('/', { hooks: [] }),
            anon.patch(`/${id}`, { enabled: false }),
            anon.delete(`/${id}`),
        ])) {
            expect(res.status).toBe(401)
        }
    })

    it('adds hooks in order and lists them', async () => {
        const first = await as(ownerToken).post('/', preTool)
        expect(first.status).toBe(201)
        expect(first.body.data.hook).toMatchObject({ ...preTool, enabled: true, position: 0 })
        const second = await as(ownerToken).post('/', { event: 'Stop', command: 'npm test' })
        expect(second.body.data.hook).toMatchObject({
            event: 'Stop',
            matcher: '',
            timeout: 60,
            position: 1,
        })

        const list = await as(ownerToken).get('/')
        expect(list.status).toBe(200)
        expect(list.body.data.hooks.map((h: { command: string }) => h.command)).toEqual([
            './check.sh',
            'npm test',
        ])
    })

    it('drops the matcher of an event that is not about tools', async () => {
        const res = await as(ownerToken).post('/', {
            event: 'SessionStart',
            matcher: 'bash',
            command: 'echo hi',
        })
        expect(res.status).toBe(201)
        expect(res.body.data.hook.matcher).toBe('')
    })

    it('refuses bad bodies', async () => {
        for (const body of [
            {},
            { ...preTool, event: 'OnBoot' },
            { ...preTool, command: '' },
            { ...preTool, command: 'x'.repeat(2001) },
            { ...preTool, timeout: 0 },
            { ...preTool, timeout: 601 },
            { ...preTool, timeout: 2.5 },
            { ...preTool, matcher: '(' },
            { ...preTool, matcher: '(a+)+' },
            { ...preTool, userId: otherId },
            { ...preTool, plugin: 'x' },
        ]) {
            const res = await as(ownerToken).post('/', body)
            expect(res.status).toBe(400)
        }
        expect(await prisma.userHook.count({ where: { userId: ownerId } })).toBe(0)
    })

    it('keeps the account at 50 hooks', async () => {
        await prisma.userHook.createMany({
            data: Array.from({ length: 50 }, (_, position) => ({
                userId: ownerId,
                event: 'Stop',
                command: `echo ${position}`,
                position,
            })),
        })
        expect((await as(ownerToken).post('/', preTool)).status).toBe(409)
    })

    it('edits a hook and turns it off', async () => {
        const created = await as(ownerToken).post('/', preTool)
        const id = created.body.data.hook.id
        const edited = await as(ownerToken).patch(`/${id}`, { command: './lint.sh', timeout: 10 })
        expect(edited.status).toBe(200)
        expect(edited.body.data.hook).toMatchObject({
            command: './lint.sh',
            timeout: 10,
            matcher: 'bash',
        })

        const moved = await as(ownerToken).patch(`/${id}`, { event: 'Stop' })
        expect(moved.body.data.hook).toMatchObject({ event: 'Stop', matcher: '' })

        const off = await as(ownerToken).patch(`/${id}`, { enabled: false })
        expect(off.body.data.hook.enabled).toBe(false)

        expect((await as(ownerToken).patch(`/${id}`, {})).status).toBe(400)
        expect((await as(ownerToken).patch(`/${id}`, { enabled: 'no' })).status).toBe(400)
        expect((await as(ownerToken).patch(`/${id}`, { position: 3 })).status).toBe(400)
        expect((await as(ownerToken).patch('/not-a-uuid', { enabled: true })).status).toBe(400)
        expect(
            (await as(ownerToken).patch(`/${crypto.randomUUID()}`, { enabled: true })).status
        ).toBe(404)
    })

    it('deletes a hook', async () => {
        const created = await as(ownerToken).post('/', preTool)
        const id = created.body.data.hook.id
        expect((await as(ownerToken).delete(`/${id}`)).status).toBe(200)
        expect((await as(ownerToken).delete(`/${id}`)).status).toBe(404)
        expect((await as(ownerToken).delete('/x')).status).toBe(400)
    })

    it('replaces all hooks at once (json view), in the given order', async () => {
        await as(ownerToken).post('/', preTool)
        const res = await as(ownerToken).put('/', {
            hooks: [
                { event: 'UserPromptSubmit', command: './prompt.sh' },
                {
                    event: 'PostToolUse',
                    matcher: 'edit_file|write_file',
                    command: 'npx prettier --write',
                    timeout: 20,
                    enabled: false,
                },
            ],
        })
        expect(res.status).toBe(200)
        expect(res.body.data.hooks).toMatchObject([
            { event: 'UserPromptSubmit', command: './prompt.sh', position: 0, enabled: true },
            { event: 'PostToolUse', matcher: 'edit_file|write_file', position: 1, enabled: false },
        ])
        expect(await prisma.userHook.count({ where: { userId: ownerId } })).toBe(2)

        const cleared = await as(ownerToken).put('/', { hooks: [] })
        expect(cleared.body.data.hooks).toEqual([])
    })

    it('refuses a bad list without changing the saved hooks', async () => {
        await as(ownerToken).post('/', preTool)
        for (const body of [
            { hooks: Array(51).fill({ event: 'Stop', command: 'x' }) },
            { hooks: [{ event: 'Stop' }] },
            { hooks: 'nope' },
            { hooks: [], extra: true },
        ]) {
            expect((await as(ownerToken).put('/', body)).status).toBe(400)
        }
        expect(await prisma.userHook.count({ where: { userId: ownerId } })).toBe(1)
    })

    it("never reads or changes another user's hook", async () => {
        const created = await as(ownerToken).post('/', preTool)
        const id = created.body.data.hook.id
        expect((await as(otherToken).get('/')).body.data.hooks).toEqual([])
        expect((await as(otherToken).patch(`/${id}`, { command: 'rm -rf /' })).status).toBe(404)
        expect((await as(otherToken).delete(`/${id}`)).status).toBe(404)
        // a replace of the other user's list touches only their own rows
        expect((await as(otherToken).put('/', { hooks: [] })).status).toBe(200)
        const row = await prisma.userHook.findUnique({ where: { id } })
        expect(row?.command).toBe('./check.sh')
    })
})
