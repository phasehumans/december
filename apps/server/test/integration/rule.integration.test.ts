import { prisma } from '@december/database'
import { describe, it, expect, afterAll, beforeAll, beforeEach } from 'bun:test'
import request from 'supertest'

import app from '../../src/app'
import { cleanupTestUser, createSignedInUser, getRandomIP } from '../helpers'

// account rules (connections, rules tab): GET/PUT/PATCH/DELETE /connections/rules
describe('Connections: account rules', () => {
    const stamp = Date.now()
    const ownerEmail = `rule-owner-${stamp}@example.com`
    const otherEmail = `rule-other-${stamp}@example.com`

    let ownerId: string
    let otherId: string
    let ownerToken: string
    let otherToken: string

    const call =
        (token: string | null, method: 'get' | 'put' | 'patch' | 'delete') =>
        (path: string, body?: unknown) => {
            let req = request(app)
                [method](`/api/v1/connections/rules${path}`)
                .set('x-forwarded-for', getRandomIP())
            if (token) req = req.set('Authorization', `Bearer ${token}`)
            return body === undefined ? req : req.send(body as object)
        }
    const as = (token: string | null) => ({
        get: call(token, 'get'),
        put: call(token, 'put'),
        patch: call(token, 'patch'),
        delete: call(token, 'delete'),
    })

    beforeAll(async () => {
        const owner = await createSignedInUser({ email: ownerEmail, name: 'Rule Owner' })
        ownerId = owner.userId
        ownerToken = owner.token
        const other = await createSignedInUser({ email: otherEmail, name: 'Rule Other' })
        otherId = other.userId
        otherToken = other.token
    })

    beforeEach(async () => {
        await prisma.userRule.deleteMany({ where: { userId: { in: [ownerId, otherId] } } })
    })

    afterAll(async () => {
        await cleanupTestUser({ id: ownerId })
        await cleanupTestUser({ id: otherId })
    })

    describe('sign-in', () => {
        it('answers 401 on every route without a token', async () => {
            const anon = as(null)
            expect((await anon.get('')).status).toBe(401)
            expect((await anon.put('/a', { name: 'a', body: 'x' })).status).toBe(401)
            expect((await anon.patch('/a', { enabled: false })).status).toBe(401)
            expect((await anon.delete('/a')).status).toBe(401)
        })
    })

    describe('save', () => {
        it('creates a rule, lists it, and renames it in place', async () => {
            const created = await as(ownerToken).put('/code-style', {
                name: 'code-style',
                body: '- use arrow functions',
            })
            expect(created.status).toBe(200)
            expect(created.body.data.rule).toMatchObject({
                name: 'code-style',
                body: '- use arrow functions',
                enabled: true,
            })

            const renamed = await as(ownerToken).put('/code-style', {
                name: 'style',
                body: '- no em dashes',
                enabled: false,
            })
            expect(renamed.status).toBe(200)
            const list = await as(ownerToken).get('')
            expect(list.body.data.rules).toHaveLength(1)
            expect(list.body.data.rules[0]).toMatchObject({
                name: 'style',
                body: '- no em dashes',
                enabled: false,
            })
            expect(Object.keys(list.body.data.rules[0]).sort()).toEqual(
                ['body', 'enabled', 'name', 'updatedAt'].sort()
            )
        })

        it('refuses a rename onto a name that is taken', async () => {
            await as(ownerToken).put('/one', { name: 'one', body: 'x' })
            await as(ownerToken).put('/two', { name: 'two', body: 'y' })
            const res = await as(ownerToken).put('/one', { name: 'two', body: 'x' })
            expect(res.status).toBe(409)
        })

        it('refuses bad bodies: unknown fields, bad names, empty or too long rules', async () => {
            const owner = as(ownerToken)
            const bad = [
                { name: 'ok', body: 'x', extra: true },
                { name: 'Bad Name', body: 'x' },
                { name: '-dash', body: 'x' },
                { name: 'a'.repeat(65), body: 'x' },
                { name: 'ok', body: '   ' },
                { name: 'ok', body: 'x'.repeat(16 * 1024 + 1) },
                // multi-byte text is counted in bytes
                { name: 'ok', body: 'é'.repeat(8 * 1024 + 1) },
                { name: 'ok', body: 42 },
                { name: 'ok', body: 'x', enabled: 'yes' },
                {},
            ]
            for (const body of bad) {
                const res = await owner.put('/ok', body)
                expect(res.status).toBe(400)
            }
            expect((await owner.put('/BAD', { name: 'ok', body: 'x' })).status).toBe(400)
            expect(await prisma.userRule.count({ where: { userId: ownerId } })).toBe(0)
        })

        it('keeps the limit of 20 rules', async () => {
            await prisma.userRule.createMany({
                data: Array.from({ length: 20 }, (_, i) => ({
                    userId: ownerId,
                    name: `rule-${i}`,
                    body: 'x',
                })),
            })
            const res = await as(ownerToken).put('/one-more', { name: 'one-more', body: 'x' })
            expect(res.status).toBe(409)
            // a saved rule can still change
            const edit = await as(ownerToken).put('/rule-1', { name: 'rule-1', body: 'y' })
            expect(edit.status).toBe(200)
        })

        it('keeps the 32 KiB limit of all rules together', async () => {
            await as(ownerToken).put('/a', { name: 'a', body: 'a'.repeat(16 * 1024) })
            await as(ownerToken).put('/b', { name: 'b', body: 'b'.repeat(16 * 1024 - 10) })
            const over = await as(ownerToken).put('/c', { name: 'c', body: 'c'.repeat(11) })
            expect(over.status).toBe(400)
            const fits = await as(ownerToken).put('/c', { name: 'c', body: 'c'.repeat(10) })
            expect(fits.status).toBe(200)
            // a rule that is saved counts once, with its new text
            const shrink = await as(ownerToken).put('/a', { name: 'a', body: 'short' })
            expect(shrink.status).toBe(200)
        })
    })

    describe('switch and delete', () => {
        it('turns a rule off and on, and deletes it', async () => {
            await as(ownerToken).put('/r', { name: 'r', body: 'x' })
            const off = await as(ownerToken).patch('/r', { enabled: false })
            expect(off.status).toBe(200)
            expect(off.body.data.rule.enabled).toBe(false)
            const extra = await as(ownerToken).patch('/r', { enabled: true, body: 'y' })
            expect(extra.status).toBe(400)
            expect((await as(ownerToken).patch('/r', {})).status).toBe(400)
            const gone = await as(ownerToken).delete('/r')
            expect(gone.status).toBe(200)
            expect((await as(ownerToken).delete('/r')).status).toBe(404)
            expect((await as(ownerToken).patch('/r', { enabled: true })).status).toBe(404)
        })
    })

    describe('other users', () => {
        it("never shows, changes or deletes another user's rule", async () => {
            await as(ownerToken).put('/private', { name: 'private', body: 'owner only' })

            const list = await as(otherToken).get('')
            expect(list.body.data.rules).toEqual([])
            expect((await as(otherToken).patch('/private', { enabled: false })).status).toBe(404)
            expect((await as(otherToken).delete('/private')).status).toBe(404)

            // the same name for the other user is a new rule of their own
            const own = await as(otherToken).put('/private', { name: 'private', body: 'mine' })
            expect(own.status).toBe(200)
            const ownerRow = await prisma.userRule.findUnique({
                where: { userId_name: { userId: ownerId, name: 'private' } },
            })
            expect(ownerRow).toMatchObject({ body: 'owner only', enabled: true })
        })
    })
})
