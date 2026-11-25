import crypto from 'crypto'

import { prisma } from '@december/database'
import { describe, it, expect, afterAll, beforeAll, beforeEach } from 'bun:test'
import request from 'supertest'

import app from '../../src/app'
import { env } from '../../src/env'
import { sessionService } from '../../src/modules/session/session.service'
import { cleanupTestUser, getRandomIP, signInWithEmailCode } from '../helpers'

import type { Prisma } from '@december/database'

// issue 632: session configuration (plan first, effort, open pull request), the user's
// defaults, fast and deep on credits, and the pull requests list with its state sync
describe('Session configuration and the pull requests list (#632)', () => {
    const stamp = Date.now()
    const ownerEmail = `prlist-owner-${stamp}@example.com`
    const otherEmail = `prlist-other-${stamp}@example.com`
    // a repository only this test uses, so the webhook touches no other rows
    const repoOwner = `acme-${stamp}`

    let ownerId: string
    let otherId: string
    let ownerToken: string
    let otherToken: string

    const as = (token: string) => ({
        get: (path: string) =>
            request(app)
                .get(`/api/v1${path}`)
                .set('x-forwarded-for', getRandomIP())
                .set('Authorization', `Bearer ${token}`),
        post: (path: string, body?: object) =>
            request(app)
                .post(`/api/v1${path}`)
                .set('x-forwarded-for', getRandomIP())
                .set('Authorization', `Bearer ${token}`)
                .send(body ?? {}),
        patch: (path: string, body?: object) =>
            request(app)
                .patch(`/api/v1${path}`)
                .set('x-forwarded-for', getRandomIP())
                .set('Authorization', `Bearer ${token}`)
                .send(body ?? {}),
    })

    let minute = 0
    const makePrSession = async (
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
                githubRepoOwner: repoOwner,
                githubRepoName: 'web',
                prNumber: minute,
                prState: 'open',
                // checked just now, so the refresh on read leaves the row alone
                prCheckedAt: new Date(),
                ...data,
            },
        })
    }

    const savedConfig = async (sessionId: string) =>
        (await prisma.sessionSettings.findUnique({ where: { sessionId } }))?.config as Record<
            string,
            unknown
        >

    beforeAll(async () => {
        const owner = await prisma.user.create({
            data: {
                email: ownerEmail,
                name: 'PR List Owner',
                emailVerified: true,
                creditBalance: 10_000,
            },
        })
        ownerId = owner.id
        const other = await prisma.user.create({
            data: { email: otherEmail, name: 'PR List Other', emailVerified: true },
        })
        otherId = other.id

        ownerToken = (await signInWithEmailCode(app, ownerEmail)).body.data.accessToken
        otherToken = (await signInWithEmailCode(app, otherEmail)).body.data.accessToken
    })

    beforeEach(async () => {
        await prisma.session.deleteMany({ where: { userId: { in: [ownerId, otherId] } } })
        await prisma.user.update({
            where: { id: ownerId },
            data: { defaultPlanFirst: false, defaultEffort: 'deep', defaultOpenPullRequest: true },
        })
    })

    afterAll(async () => {
        await cleanupTestUser(ownerEmail)
        await cleanupTestUser(otherEmail)
    })

    describe('session configuration', () => {
        it('saves the configuration sent with a new session', async () => {
            const res = await as(ownerToken).post('/session', {
                prompt: 'add a login page',
                planFirst: true,
                effort: 'fast',
                openPullRequest: false,
            })
            expect(res.status).toBe(201)
            expect(res.body.data.session.config).toEqual({
                planFirst: true,
                effort: 'fast',
                openPullRequest: false,
            })
            expect(await savedConfig(res.body.data.session.id)).toEqual({
                planFirst: true,
                effort: 'fast',
                openPullRequest: false,
            })

            const read = await as(ownerToken).get(`/session/${res.body.data.session.id}`)
            expect(read.status).toBe(200)
            expect(read.body.data.session.config.openPullRequest).toBe(false)
        })

        it('fills a field the request leaves out from the user defaults', async () => {
            const saved = await as(ownerToken).patch('/setting/defaults', {
                defaultPlanFirst: true,
                defaultOpenPullRequest: false,
            })
            expect(saved.status).toBe(200)
            expect(saved.body.data).toEqual({
                defaultPlanFirst: true,
                defaultEffort: 'deep',
                defaultOpenPullRequest: false,
            })

            const profile = await as(ownerToken).get('/setting')
            expect(profile.body.data.defaultPlanFirst).toBe(true)
            expect(profile.body.data.defaultOpenPullRequest).toBe(false)

            const res = await as(ownerToken).post('/session', { prompt: 'x', effort: 'fast' })
            expect(res.status).toBe(201)
            expect(res.body.data.session.config).toEqual({
                planFirst: true,
                effort: 'fast',
                openPullRequest: false,
            })
        })

        it('takes the credit tier as the effort when no effort is sent', async () => {
            const res = await as(ownerToken).post('/session', { prompt: 'x', tier: 'fast' })
            expect(res.body.data.session.config.effort).toBe('fast')
        })

        it('rejects bad values', async () => {
            const badEffort = await as(ownerToken).post('/session', { prompt: 'x', effort: 'max' })
            expect(badEffort.status).toBe(400)
            const emptyDefaults = await as(ownerToken).patch('/setting/defaults', {})
            expect(emptyDefaults.status).toBe(400)
            const badDefault = await as(ownerToken).patch('/setting/defaults', {
                defaultEffort: 'slow',
            })
            expect(badDefault.status).toBe(400)
        })

        it('keeps plan first and effort sent with a message for the next turns', async () => {
            const created = await as(ownerToken).post('/session', { prompt: 'x' })
            const sessionId = created.body.data.session.id

            const first = await sessionService.resolveTurnConfig({
                userId: ownerId,
                sessionId,
                billingSource: 'CREDITS',
                tier: 'fast',
                planFirst: true,
            })
            expect(first).toEqual({
                planFirst: true,
                effort: 'fast',
                openPullRequest: true,
                model: 'gemini-2.5-flash',
                provider: 'gemini',
            })

            // nothing sent: the saved values hold
            const next = await sessionService.resolveTurnConfig({
                userId: ownerId,
                sessionId,
                billingSource: 'CREDITS',
            })
            expect(next.planFirst).toBe(true)
            expect(next.effort).toBe('fast')
            expect(next.model).toBe('gemini-2.5-flash')
        })

        it('maps any credit model to a tier and keeps own-key models', async () => {
            const created = await as(ownerToken).post('/session', { prompt: 'x' })
            const sessionId = created.body.data.session.id

            const oldClient = await sessionService.resolveTurnConfig({
                userId: ownerId,
                sessionId,
                billingSource: 'CREDITS',
                model: 'gpt-4o',
                provider: 'openai',
            })
            expect(oldClient.model).toBe('gemini-2.5-pro')
            expect(oldClient.effort).toBe('deep')

            const ownKey = await sessionService.resolveTurnConfig({
                userId: ownerId,
                sessionId,
                billingSource: 'OWN_KEY',
                model: 'claude-sonnet-4-5',
                provider: 'anthropic',
                effort: 'fast',
            })
            expect(ownKey).toMatchObject({
                model: 'claude-sonnet-4-5',
                provider: 'anthropic',
                effort: 'fast',
            })
        })

        it('never changes the config of another user session', async () => {
            const created = await as(ownerToken).post('/session', { prompt: 'x' })
            const sessionId = created.body.data.session.id

            await sessionService.resolveTurnConfig({
                userId: otherId,
                sessionId,
                billingSource: 'CREDITS',
                planFirst: true,
            })
            expect((await savedConfig(sessionId)).planFirst).toBe(false)
        })
    })

    describe('GET /session/pull-requests', () => {
        it('lists only the pull requests of the user, with the saved details', async () => {
            const mine = await makePrSession(ownerId, {
                prTitle: 'feat: login page',
                prUrl: `https://github.com/${repoOwner}/web/pull/1`,
                prBranch: 'december/x',
                prAdditions: 12,
                prDeletions: 3,
                prOpenedAt: new Date(Date.UTC(2026, 0, 5)),
                tags: ['auth'],
            })
            await makePrSession(otherId)
            // a session with no pull request is left out
            await prisma.session.create({ data: { userId: ownerId, title: 'no pr' } })

            const res = await as(ownerToken).get('/session/pull-requests')
            expect(res.status).toBe(200)
            expect(res.body.data.pullRequests).toHaveLength(1)
            expect(res.body.data.pullRequests[0]).toMatchObject({
                sessionId: mine.id,
                repo: `${repoOwner}/web`,
                prNumber: mine.prNumber,
                prState: 'open',
                prTitle: 'feat: login page',
                prBranch: 'december/x',
                additions: 12,
                deletions: 3,
                tags: ['auth'],
            })
            expect(res.body.data.pagination).toMatchObject({ page: 1, total: 1, totalPages: 1 })

            const other = await as(otherToken).get('/session/pull-requests')
            expect(other.body.data.pullRequests).toHaveLength(1)
            expect(other.body.data.pullRequests[0].sessionId).not.toBe(mine.id)
        })

        it('filters by state, repository, tag and search, and pages', async () => {
            const open = await makePrSession(ownerId)
            const unsaved = await makePrSession(ownerId, { prState: null })
            const draft = await makePrSession(ownerId, { prState: 'draft' })
            const merged = await makePrSession(ownerId, {
                prState: 'merged',
                tags: ['bug'],
                githubRepoName: 'api',
                prTitle: 'fix: crash on empty cart',
            })
            const closed = await makePrSession(ownerId, { prState: 'closed' })

            const ids = async (query: Record<string, string>) => {
                const res = await as(ownerToken).get('/session/pull-requests').query(query)
                expect(res.status).toBe(200)
                return (res.body.data.pullRequests as Array<{ sessionId: string }>)
                    .map((row) => row.sessionId)
                    .sort()
            }

            expect(await ids({ state: 'open' })).toEqual([open.id, unsaved.id].sort())
            expect(await ids({ state: 'open,draft' })).toEqual(
                [open.id, unsaved.id, draft.id].sort()
            )
            expect(await ids({ state: 'merged,closed' })).toEqual([merged.id, closed.id].sort())
            expect(await ids({ repo: `${repoOwner}/api` })).toEqual([merged.id])
            expect(await ids({ repo: 'api' })).toEqual([merged.id])
            expect(await ids({ tag: 'bug' })).toEqual([merged.id])
            expect(await ids({ search: 'empty cart' })).toEqual([merged.id])
            expect(await ids({ search: `#${draft.prNumber}` })).toEqual([draft.id])

            const page2 = await as(ownerToken)
                .get('/session/pull-requests')
                .query({ limit: '2', page: '2' })
            expect(page2.body.data.pullRequests).toHaveLength(2)
            expect(page2.body.data.pagination).toMatchObject({ total: 5, totalPages: 3 })

            const bad = await as(ownerToken).get('/session/pull-requests').query({ state: 'gone' })
            expect(bad.status).toBe(400)
        })

        it('sorts by the opened date, rows without one last', async () => {
            const older = await makePrSession(ownerId, {
                prOpenedAt: new Date(Date.UTC(2026, 0, 2)),
            })
            const undated = await makePrSession(ownerId)
            const newer = await makePrSession(ownerId, {
                prOpenedAt: new Date(Date.UTC(2026, 0, 9)),
            })

            const res = await as(ownerToken)
                .get('/session/pull-requests')
                .query({ sortBy: 'prOpenedAt', sortOrder: 'desc' })
            expect(
                res.body.data.pullRequests.map((row: { sessionId: string }) => row.sessionId)
            ).toEqual([newer.id, older.id, undated.id])
        })

        it('marks a stale pull request as checked when the host cannot be asked', async () => {
            // no github connection for this user: the refresh gets no token
            const stale = await makePrSession(ownerId, { prCheckedAt: null })

            const res = await as(ownerToken).get('/session/pull-requests')
            expect(res.status).toBe(200)
            const row = await prisma.session.findUnique({ where: { id: stale.id } })
            expect(row?.prCheckedAt).not.toBeNull()
            expect(row?.prState).toBe('open')
            // a check does not move the session up the sessions list
            expect(row?.updatedAt.toISOString()).toBe(stale.updatedAt.toISOString())
        })
    })

    describe('pull request state from the github app webhook', () => {
        const sendWebhook = (payload: object) => {
            const body = JSON.stringify(payload)
            const secret = env.GITHUB_APP_WEBHOOK_SECRET || 'secret'
            const signature = `sha256=${crypto.createHmac('sha256', secret).update(body).digest('hex')}`
            return request(app)
                .post('/api/v1/githubapp/webhook')
                .set('Content-Type', 'application/json')
                .set('x-hub-signature-256', signature)
                .set('x-github-event', 'pull_request')
                .send(body)
        }

        const prPayload = (action: string, number: number, pr: Record<string, unknown>) => ({
            action,
            repository: { name: 'web', full_name: `${repoOwner}/web`, owner: { login: repoOwner } },
            pull_request: {
                number,
                title: 'feat: login page',
                state: 'open',
                draft: false,
                merged_at: null,
                closed_at: null,
                created_at: '2026-01-03T10:00:00Z',
                additions: 40,
                deletions: 2,
                ...pr,
            },
        })

        it('saves merged, closed, reopened and draft', async () => {
            const session = await makePrSession(ownerId)
            const number = session.prNumber as number
            const stateOf = async () => prisma.session.findUnique({ where: { id: session.id } })

            const merged = await sendWebhook(
                prPayload('closed', number, {
                    state: 'closed',
                    merged_at: '2026-01-04T10:00:00Z',
                    closed_at: '2026-01-04T10:00:00Z',
                })
            )
            expect(merged.status).toBe(200)
            let row = await stateOf()
            expect(row?.prState).toBe('merged')
            expect(row?.prMergedAt?.toISOString()).toBe('2026-01-04T10:00:00.000Z')
            expect(row?.prOpenedAt?.toISOString()).toBe('2026-01-03T10:00:00.000Z')
            expect(row?.prAdditions).toBe(40)
            expect(row?.updatedAt.toISOString()).toBe(session.updatedAt.toISOString())

            await sendWebhook(prPayload('reopened', number, {}))
            row = await stateOf()
            expect(row?.prState).toBe('open')
            expect(row?.prMergedAt).toBeNull()

            await sendWebhook(prPayload('converted_to_draft', number, { draft: true }))
            expect((await stateOf())?.prState).toBe('draft')

            await sendWebhook(prPayload('ready_for_review', number, { draft: false }))
            expect((await stateOf())?.prState).toBe('open')

            await sendWebhook(
                prPayload('closed', number, { state: 'closed', closed_at: '2026-01-05T00:00:00Z' })
            )
            row = await stateOf()
            expect(row?.prState).toBe('closed')
            expect(row?.prClosedAt?.toISOString()).toBe('2026-01-05T00:00:00.000Z')
        })

        it('leaves pull requests of other repositories alone', async () => {
            const session = await makePrSession(ownerId)
            await sendWebhook({
                ...prPayload('closed', session.prNumber as number, {
                    state: 'closed',
                    merged_at: '2026-01-04T10:00:00Z',
                }),
                repository: { name: 'web', owner: { login: `someone-else-${stamp}` } },
            })
            expect((await prisma.session.findUnique({ where: { id: session.id } }))?.prState).toBe(
                'open'
            )
        })
    })
})
