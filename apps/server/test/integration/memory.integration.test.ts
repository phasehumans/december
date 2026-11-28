import { prisma } from '@december/database'
import { describe, it, expect, afterAll, beforeAll, beforeEach } from 'bun:test'
import request from 'supertest'

import app from '../../src/app'
import { cleanupTestUser, createSignedInUser, getRandomIP } from '../helpers'

// agent memory (connections, memory tab): /connections/memory
describe('Connections: agent memory', () => {
    const stamp = Date.now()
    const ownerEmail = `memory-owner-${stamp}@example.com`
    const otherEmail = `memory-other-${stamp}@example.com`

    let ownerId: string
    let otherId: string
    let ownerToken: string
    let otherToken: string

    const call =
        (token: string | null, method: 'get' | 'put' | 'post' | 'patch' | 'delete') =>
        (path: string, body?: unknown) => {
            let req = request(app)
                [method](`/api/v1/connections/memory${path}`)
                .set('x-forwarded-for', getRandomIP())
            if (token) req = req.set('Authorization', `Bearer ${token}`)
            return body === undefined ? req : req.send(body as object)
        }
    const as = (token: string | null) => ({
        get: call(token, 'get'),
        put: call(token, 'put'),
        post: call(token, 'post'),
        patch: call(token, 'patch'),
        delete: call(token, 'delete'),
    })

    const missingId = '00000000-0000-4000-8000-000000000000'

    beforeAll(async () => {
        const owner = await createSignedInUser({ email: ownerEmail, name: 'Memory Owner' })
        ownerId = owner.userId
        ownerToken = owner.token
        const other = await createSignedInUser({ email: otherEmail, name: 'Memory Other' })
        otherId = other.userId
        otherToken = other.token
    })

    beforeEach(async () => {
        const userId = { in: [ownerId, otherId] }
        await prisma.userMemory.deleteMany({ where: { userId } })
        await prisma.user.updateMany({ where: { id: userId }, data: { memoryEnabled: true } })
    })

    afterAll(async () => {
        await cleanupTestUser({ id: ownerId })
        await cleanupTestUser({ id: otherId })
    })

    it('answers 401 on every route without a token', async () => {
        const anon = as(null)
        expect((await anon.get('')).status).toBe(401)
        expect((await anon.put('/settings', { enabled: false })).status).toBe(401)
        expect((await anon.post('', { content: 'x' })).status).toBe(401)
        expect((await anon.patch(`/${missingId}`, { content: 'x' })).status).toBe(401)
        expect((await anon.delete(`/${missingId}`)).status).toBe(401)
        expect((await anon.delete('')).status).toBe(401)
    })

    it('starts on and empty, and turns memory off and on', async () => {
        const first = await as(ownerToken).get('')
        expect(first.status).toBe(200)
        expect(first.body.data).toEqual({ enabled: true, memories: [] })

        const off = await as(ownerToken).put('/settings', { enabled: false })
        expect(off.status).toBe(200)
        expect(off.body.data).toEqual({ enabled: false })
        expect((await as(ownerToken).get('')).body.data.enabled).toBe(false)
        const user = await prisma.user.findUnique({ where: { id: ownerId } })
        expect(user?.memoryEnabled).toBe(false)

        expect((await as(ownerToken).put('/settings', { enabled: 'no' })).status).toBe(400)
        expect((await as(ownerToken).put('/settings', { enabled: true, x: 1 })).status).toBe(400)
    })

    it('adds, edits and deletes memories, newest first', async () => {
        const one = await as(ownerToken).post('', { content: '  prefers bun  ' })
        expect(one.status).toBe(201)
        expect(one.body.data.memory).toMatchObject({
            content: 'prefers bun',
            source: 'user',
            sessionId: null,
            sessionTitle: null,
        })
        const two = await as(ownerToken).post('', { content: 'lowercase commits' })
        const list = await as(ownerToken).get('')
        expect(list.body.data.memories.map((row: any) => row.content)).toEqual([
            'lowercase commits',
            'prefers bun',
        ])

        const edited = await as(ownerToken).patch(`/${one.body.data.memory.id}`, {
            content: 'prefers bun over npm',
        })
        expect(edited.status).toBe(200)
        expect(edited.body.data.memory.content).toBe('prefers bun over npm')
        // an edited memory is the newest
        const after = await as(ownerToken).get('')
        expect(after.body.data.memories[0].content).toBe('prefers bun over npm')

        expect((await as(ownerToken).delete(`/${two.body.data.memory.id}`)).status).toBe(200)
        expect((await as(ownerToken).delete(`/${two.body.data.memory.id}`)).status).toBe(404)
        expect((await as(ownerToken).get('')).body.data.memories).toHaveLength(1)
    })

    it('refuses bad bodies and ids', async () => {
        const owner = as(ownerToken)
        for (const body of [
            {},
            { content: '' },
            { content: '   ' },
            { content: 'x'.repeat(501) },
            { content: 5 },
            { content: 'ok', source: 'agent' },
        ]) {
            expect((await owner.post('', body)).status).toBe(400)
        }
        expect((await owner.patch('/not-a-uuid', { content: 'x' })).status).toBe(400)
        expect((await owner.delete('/not-a-uuid')).status).toBe(400)
        expect((await owner.patch(`/${missingId}`, { content: 'x' })).status).toBe(404)
        expect(await prisma.userMemory.count({ where: { userId: ownerId } })).toBe(0)
    })

    it('keeps the limit of 100 memories', async () => {
        await prisma.userMemory.createMany({
            data: Array.from({ length: 100 }, (_, i) => ({ userId: ownerId, content: `m${i}` })),
        })
        const res = await as(ownerToken).post('', { content: 'one more' })
        expect(res.status).toBe(409)
        const list = await as(ownerToken).get('')
        expect(list.body.data.memories).toHaveLength(100)
    })

    it('deletes all memories of the user only', async () => {
        await as(ownerToken).post('', { content: 'a' })
        await as(ownerToken).post('', { content: 'b' })
        await as(otherToken).post('', { content: 'theirs' })
        const res = await as(ownerToken).delete('')
        expect(res.status).toBe(200)
        expect(res.body.data).toEqual({ deleted: 2 })
        expect(await prisma.userMemory.count({ where: { userId: ownerId } })).toBe(0)
        expect(await prisma.userMemory.count({ where: { userId: otherId } })).toBe(1)
    })

    it("never shows, edits or deletes another user's memory", async () => {
        const mine = await as(ownerToken).post('', { content: 'owner secret plan' })
        const id = mine.body.data.memory.id

        const list = await as(otherToken).get('')
        expect(list.body.data.memories).toEqual([])
        expect((await as(otherToken).patch(`/${id}`, { content: 'changed' })).status).toBe(404)
        expect((await as(otherToken).delete(`/${id}`)).status).toBe(404)
        const row = await prisma.userMemory.findUnique({ where: { id } })
        expect(row?.content).toBe('owner secret plan')
    })

    it('shows the session a memory came from', async () => {
        await prisma.userMemory.create({
            data: {
                userId: ownerId,
                content: 'uses pnpm in acme/web',
                source: 'agent',
                sessionId: missingId,
                sessionTitle: 'fix the build',
            },
        })
        const list = await as(ownerToken).get('')
        expect(list.body.data.memories[0]).toMatchObject({
            source: 'agent',
            sessionId: missingId,
            sessionTitle: 'fix the build',
        })
    })
})
