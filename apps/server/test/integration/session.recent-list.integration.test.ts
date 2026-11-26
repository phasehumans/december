import { prisma } from '@december/database'
import { describe, it, expect, afterAll, beforeAll } from 'bun:test'
import request from 'supertest'

import app from '../../src/app'
import { sessionService } from '../../src/modules/session/session.service'
import { appCache } from '../../src/shared/cache'
import { authCookieToken, cleanupTestUser, getRandomIP, signInWithEmailCode } from '../helpers'

import type { Prisma } from '@december/database'

// issue 644: pinned sessions, sessions that wait for an answer, archive merged
describe('Session recent list (pin, needs answer, archive merged)', () => {
    const stamp = Date.now()
    const ownerEmail = `recentlist-owner-${stamp}@example.com`
    const otherEmail = `recentlist-other-${stamp}@example.com`

    let ownerId: string
    let otherId: string
    let ownerToken: string
    let otherToken: string

    const as = (token: string) => ({
        get: (path: string) =>
            request(app)
                .get(`/api/v1/session${path}`)
                .set('x-forwarded-for', getRandomIP())
                .set('Authorization', `Bearer ${token}`),
        patch: (path: string) =>
            request(app)
                .patch(`/api/v1/session${path}`)
                .set('x-forwarded-for', getRandomIP())
                .set('Authorization', `Bearer ${token}`),
        post: (path: string, body?: object) =>
            request(app)
                .post(`/api/v1/session${path}`)
                .set('x-forwarded-for', getRandomIP())
                .set('Authorization', `Bearer ${token}`)
                .send(body ?? {}),
    })

    // each session gets its own minute, so "newest first" has a known order
    let minute = 0
    const makeSession = async (
        userId: string,
        data: Partial<Prisma.SessionUncheckedCreateInput> = {}
    ) => {
        minute += 1
        const at = new Date(Date.UTC(2026, 0, 1, 0, minute))
        return prisma.session.create({
            data: {
                userId,
                title: `session ${minute}`,
                createdAt: at,
                updatedAt: at,
                ...data,
            },
        })
    }

    const listIds = async (token: string, query: Record<string, string> = {}) => {
        const res = await as(token).get('').query(query)
        expect(res.status).toBe(200)
        return res.body.data.sessions.map((s: { id: string }) => s.id) as string[]
    }

    const clearOwnerSessions = () => prisma.session.deleteMany({ where: { userId: ownerId } })

    beforeAll(async () => {
        const owner = await prisma.user.create({
            data: { email: ownerEmail, name: 'Recent List Owner', emailVerified: true },
        })
        ownerId = owner.id
        const other = await prisma.user.create({
            data: { email: otherEmail, name: 'Recent List Other', emailVerified: true },
        })
        otherId = other.id

        ownerToken = authCookieToken(await signInWithEmailCode(app, ownerEmail))
        otherToken = authCookieToken(await signInWithEmailCode(app, otherEmail))
    })

    afterAll(async () => {
        if (ownerId) await cleanupTestUser({ id: ownerId })
        if (otherId) await cleanupTestUser({ id: otherId })
    })

    describe('pin and unpin (L1)', () => {
        it('pins a session, returns isPinned on each row, and unpins it', async () => {
            await clearOwnerSessions()
            const session = await makeSession(ownerId)

            const pin = await as(ownerToken).patch(`/${session.id}/pin`)
            expect(pin.status).toBe(200)
            expect(pin.body.data.session.id).toBe(session.id)

            let rows = (await as(ownerToken).get('')).body.data.sessions
            expect(rows.find((s: any) => s.id === session.id).isPinned).toBe(true)

            const unpin = await as(ownerToken).patch(`/${session.id}/unpin`)
            expect(unpin.status).toBe(200)

            rows = (await as(ownerToken).get('')).body.data.sessions
            expect(rows.find((s: any) => s.id === session.id).isPinned).toBe(false)
        })

        it('pinnedFirst puts pinned sessions first, newest pin first, with any sort', async () => {
            await clearOwnerSessions()
            const a = await makeSession(ownerId)
            const b = await makeSession(ownerId)
            const c = await makeSession(ownerId)
            const d = await makeSession(ownerId)

            // pin a, then c: c is the newest pin
            expect((await as(ownerToken).patch(`/${a.id}/pin`)).status).toBe(200)
            expect((await as(ownerToken).patch(`/${c.id}/pin`)).status).toBe(200)

            expect(await listIds(ownerToken, { pinnedFirst: 'true' })).toEqual([
                c.id,
                a.id,
                d.id,
                b.id,
            ])
            expect(
                await listIds(ownerToken, {
                    pinnedFirst: 'true',
                    sortBy: 'createdAt',
                    sortOrder: 'asc',
                })
            ).toEqual([c.id, a.id, b.id, d.id])
            // without pinnedFirst the list keeps its plain order
            expect(await listIds(ownerToken)).toEqual([d.id, c.id, b.id, a.id])
            // paging keeps the pinned rows on the first page
            expect(await listIds(ownerToken, { pinnedFirst: 'true', limit: '2' })).toEqual([
                c.id,
                a.id,
            ])
        })

        it('another user cannot pin or unpin the session (404)', async () => {
            await clearOwnerSessions()
            const session = await makeSession(ownerId)

            expect((await as(otherToken).patch(`/${session.id}/pin`)).status).toBe(404)
            expect((await as(otherToken).patch(`/${session.id}/unpin`)).status).toBe(404)
            const saved = await prisma.session.findUnique({ where: { id: session.id } })
            expect(saved?.pinnedAt).toBeNull()
        })

        it('allows at most 10 pinned sessions', async () => {
            await clearOwnerSessions()
            const sessions = []
            for (let i = 0; i < 11; i++) sessions.push(await makeSession(ownerId))

            for (const session of sessions.slice(0, 10)) {
                expect((await as(ownerToken).patch(`/${session.id}/pin`)).status).toBe(200)
            }
            const eleventh = await as(ownerToken).patch(`/${sessions[10]!.id}/pin`)
            expect(eleventh.status).toBe(409)
        })

        it('archive clears the pin, and an archived session cannot be pinned', async () => {
            await clearOwnerSessions()
            const session = await makeSession(ownerId)
            await as(ownerToken).patch(`/${session.id}/pin`)

            expect((await as(ownerToken).patch(`/${session.id}/archive`)).status).toBe(200)
            const rows = (await as(ownerToken).get('').query({ isArchived: 'true' })).body.data
                .sessions
            expect(rows.find((s: any) => s.id === session.id).isPinned).toBe(false)

            expect((await as(ownerToken).patch(`/${session.id}/pin`)).status).toBe(409)
        })
    })

    describe('needs answer (L2)', () => {
        it('marks and filters sessions that wait for an answer, and an answer clears it', async () => {
            await clearOwnerSessions()
            const waiting = await makeSession(ownerId)
            const idle = await makeSession(ownerId)

            // the server sees the worker's AskQuestionPrompt event
            await sessionService.markQuestionAsked({ sessionId: waiting.id })

            let rows = (await as(ownerToken).get('')).body.data.sessions
            expect(rows.find((s: any) => s.id === waiting.id).needsAnswer).toBe(true)
            expect(rows.find((s: any) => s.id === idle.id).needsAnswer).toBe(false)
            expect(await listIds(ownerToken, { needsAnswer: 'true' })).toEqual([waiting.id])

            const answer = await as(ownerToken).post(`/${waiting.id}/question-answer`, {
                answer: 'yes',
            })
            expect(answer.status).toBe(200)

            rows = (await as(ownerToken).get('')).body.data.sessions
            expect(rows.find((s: any) => s.id === waiting.id).needsAnswer).toBe(false)
            expect(await listIds(ownerToken, { needsAnswer: 'true' })).toEqual([])
        })

        it('stop clears the mark only for the owner', async () => {
            await clearOwnerSessions()
            const waiting = await makeSession(ownerId)
            await sessionService.markQuestionAsked({ sessionId: waiting.id })

            await sessionService.clearPendingQuestion({ userId: otherId, sessionId: waiting.id })
            expect(await listIds(ownerToken, { needsAnswer: 'true' })).toEqual([waiting.id])

            await sessionService.clearPendingQuestion({ userId: ownerId, sessionId: waiting.id })
            expect(await listIds(ownerToken, { needsAnswer: 'true' })).toEqual([])
        })
    })

    describe('archive merged (L3)', () => {
        it('archives only merged, not running sessions of the user, and undo restores them', async () => {
            await clearOwnerSessions()
            const merged = await makeSession(ownerId, { prNumber: 1, prState: 'merged' })
            const mergedPinned = await makeSession(ownerId, {
                prNumber: 2,
                prState: 'merged',
                pinnedAt: new Date(),
            })
            const mergedRunning = await makeSession(ownerId, {
                prNumber: 3,
                prState: 'merged',
                vmStatus: 'RUNNING',
            })
            const mergedStarting = await makeSession(ownerId, {
                prNumber: 4,
                prState: 'merged',
                vmStatus: 'PROVISIONING',
            })
            const open = await makeSession(ownerId, { prNumber: 5, prState: 'open' })
            const othersMerged = await makeSession(otherId, { prNumber: 6, prState: 'merged' })

            const counts = await as(ownerToken).get('/counts')
            expect(counts.status).toBe(200)
            expect(counts.body.data.merged).toBe(2)

            const res = await as(ownerToken).post('/archive-merged')
            expect(res.status).toBe(200)
            expect([...res.body.data.sessionIds].sort()).toEqual(
                [merged.id, mergedPinned.id].sort()
            )

            const active = await listIds(ownerToken, { isArchived: 'false' })
            expect(active).not.toContain(merged.id)
            expect(active).not.toContain(mergedPinned.id)
            expect(active).toContain(mergedRunning.id)
            expect(active).toContain(mergedStarting.id)
            expect(active).toContain(open.id)
            expect((await as(ownerToken).get('/counts')).body.data.merged).toBe(0)

            const undo = await as(ownerToken).post('/unarchive', {
                sessionIds: res.body.data.sessionIds,
            })
            expect(undo.status).toBe(200)
            // archive and undo keep updatedAt, so the sessions return to their place
            const saved = await prisma.session.findUnique({ where: { id: merged.id } })
            expect(saved?.updatedAt.toISOString()).toBe(merged.updatedAt.toISOString())
            const restored = await listIds(ownerToken, { isArchived: 'false' })
            expect(restored).toContain(merged.id)
            expect(restored).toContain(mergedPinned.id)
            const others = await prisma.session.findUnique({ where: { id: othersMerged.id } })
            expect(others?.isArchived).toBe(false)
        })

        it('undo brings back the pins that archive merged removed, in their old order', async () => {
            await clearOwnerSessions()
            const pinnedAt = new Date(Date.UTC(2026, 0, 2))
            const merged = await makeSession(ownerId, {
                prNumber: 1,
                prState: 'merged',
                pinnedAt,
            })

            const res = await as(ownerToken).post('/archive-merged')
            expect(res.body.data.sessionIds).toEqual([merged.id])
            expect(res.body.data.pins).toEqual([
                { sessionId: merged.id, pinnedAt: pinnedAt.toISOString() },
            ])

            const undo = await as(ownerToken).post('/unarchive', {
                sessionIds: res.body.data.sessionIds,
                pins: res.body.data.pins,
            })
            expect(undo.status).toBe(200)
            const rows = (await as(ownerToken).get('')).body.data.sessions
            expect(rows.find((s: any) => s.id === merged.id).isPinned).toBe(true)
            const saved = await prisma.session.findUnique({ where: { id: merged.id } })
            expect(saved?.pinnedAt?.toISOString()).toBe(pinnedAt.toISOString())
        })

        it('undo restores pins only for the unarchived sessions and within the limit', async () => {
            await clearOwnerSessions()
            // 9 pinned sessions stay; two archived ones were pinned before
            for (let i = 0; i < 9; i++) await makeSession(ownerId, { pinnedAt: new Date() })
            const first = await makeSession(ownerId, { isArchived: true })
            const second = await makeSession(ownerId, { isArchived: true })
            const notInUndo = await makeSession(ownerId, { isArchived: true })
            const at = new Date(Date.UTC(2026, 0, 3)).toISOString()

            const res = await as(ownerToken).post('/unarchive', {
                sessionIds: [first.id, second.id],
                pins: [
                    { sessionId: first.id, pinnedAt: at },
                    { sessionId: second.id, pinnedAt: at },
                    { sessionId: notInUndo.id, pinnedAt: at },
                ],
            })
            expect(res.status).toBe(200)
            const pinned = await prisma.session.count({
                where: { userId: ownerId, pinnedAt: { not: null } },
            })
            expect(pinned).toBe(10)
            const other = await prisma.session.findUnique({ where: { id: notInUndo.id } })
            expect(other?.pinnedAt).toBeNull()
            expect(other?.isArchived).toBe(true)
        })

        it('bulk unarchive changes only sessions of the signed-in user', async () => {
            await clearOwnerSessions()
            const mine = await makeSession(ownerId, { isArchived: true })

            const res = await as(otherToken).post('/unarchive', { sessionIds: [mine.id] })
            expect(res.status).toBe(200)
            expect(res.body.data.sessionIds).toEqual([])
            expect(await listIds(ownerToken, { isArchived: 'true' })).toEqual([mine.id])
        })

        it('bulk unarchive takes at most 100 ids', async () => {
            const ids = Array.from({ length: 101 }, () => crypto.randomUUID())
            const res = await as(ownerToken).post('/unarchive', { sessionIds: ids })
            expect(res.status).toBe(400)
        })

        it('counts running sessions and open pull requests, archived left out', async () => {
            await clearOwnerSessions()
            await makeSession(ownerId, { vmStatus: 'RUNNING' })
            await makeSession(ownerId, { vmStatus: 'PROVISIONING', prNumber: 1, prState: 'draft' })
            await makeSession(ownerId, { vmStatus: 'RUNNING', isArchived: true })
            await makeSession(ownerId, { prNumber: 2, prState: 'open' })
            await makeSession(ownerId, { prNumber: 3, prState: 'closed' })
            await makeSession(ownerId, { prNumber: 4, prState: 'open', isArchived: true })

            const res = await as(ownerToken).get('/counts')
            expect(res.status).toBe(200)
            expect(res.body.data).toEqual({ running: 2, openPullRequests: 2, merged: 0 })
        })

        it('counts every session of a user with more than 100, not one page of them', async () => {
            await clearOwnerSessions()
            // the rows change without the service, so the counts cached above are old
            await appCache.delPattern(appCache.key('sessions', 'recent', ownerId, '*'))

            const rows = (count: number, data: Partial<Prisma.SessionCreateManyInput>) =>
                Array.from({ length: count }, (_, index) => ({
                    userId: ownerId,
                    title: `many ${index}`,
                    ...data,
                }))
            let prNumber = 0
            const withPr = (count: number, data: Partial<Prisma.SessionCreateManyInput>) =>
                rows(count, data).map((row) => ({ ...row, prNumber: (prNumber += 1) }))

            await prisma.session.createMany({
                data: [
                    // running: 120 + 15 + the 4 merged ones below = 139
                    ...rows(120, { vmStatus: 'RUNNING' }),
                    ...rows(15, { vmStatus: 'PROVISIONING' }),
                    ...rows(7, { vmStatus: 'RUNNING', isArchived: true }),
                    // open pull requests: 101 + 12 + 5 = 118
                    ...withPr(101, { prState: 'open' }),
                    ...withPr(12, { prState: 'draft' }),
                    ...withPr(5, { prState: null }),
                    ...withPr(9, { prState: 'open', isArchived: true }),
                    ...withPr(6, { prState: 'closed' }),
                    // merged and not running: 103
                    ...withPr(103, { prState: 'merged' }),
                    ...withPr(4, { prState: 'merged', vmStatus: 'RUNNING' }),
                    ...withPr(8, { prState: 'merged', isArchived: true }),
                    ...rows(110, {}),
                ],
            })

            const res = await as(ownerToken).get('/counts')
            expect(res.status).toBe(200)
            expect(res.body.data).toEqual({ running: 139, openPullRequests: 118, merged: 103 })
        })
    })
})
