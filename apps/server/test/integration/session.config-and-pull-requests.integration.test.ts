import crypto from 'crypto'

import { prisma } from '@december/database'
import { describe, it, expect, afterAll, beforeAll, beforeEach } from 'bun:test'
import request from 'supertest'

import app from '../../src/app'
import { env } from '../../src/env'
import { sessionService } from '../../src/modules/session/session.service'
import { authCookieToken, cleanupTestUser, getRandomIP, signInWithEmailCode } from '../helpers'

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

        ownerToken = authCookieToken(await signInWithEmailCode(app, ownerEmail))
        otherToken = authCookieToken(await signInWithEmailCode(app, otherEmail))
    })

    beforeEach(async () => {
        await prisma.session.deleteMany({ where: { userId: { in: [ownerId, otherId] } } })
        await prisma.user.update({
            where: { id: ownerId },
            data: { defaultPlanFirst: false, defaultOpenPullRequest: true },
        })
    })

    afterAll(async () => {
        await cleanupTestUser({ email: ownerEmail })
        await cleanupTestUser({ email: otherEmail })
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
            // "save as default" in the prompt box keeps only these two
            expect(saved.body.data).toEqual({
                defaultPlanFirst: true,
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

        it('starts on fast when no effort and no tier are sent', async () => {
            const res = await as(ownerToken).post('/session', { prompt: 'x' })
            expect(res.status).toBe(201)
            expect(res.body.data.session.config).toEqual({
                planFirst: false,
                effort: 'fast',
                openPullRequest: true,
            })
        })

        it('an old saved speed of deep no longer applies', async () => {
            await prisma.user.update({ where: { id: ownerId }, data: { defaultEffort: 'deep' } })
            const res = await as(ownerToken).post('/session', { prompt: 'x' })
            expect(res.body.data.session.config.effort).toBe('fast')
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
            // the speed is no longer a saved default
            const removed = await as(ownerToken).patch('/setting/defaults', {
                defaultEffort: 'fast',
            })
            expect(removed.status).toBe(400)
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
                // the + menu switches of the session: nothing turned off
                disabledPlugins: [],
                disabledMcps: [],
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

        // review A4: the same match as GET /session?repoName=
        it('finds a repository that a row knows only by its link', async () => {
            const linkOnly = await makePrSession(ownerId, {
                githubRepoOwner: null,
                githubRepoName: null,
                repoUrl: `https://gitlab.com/${repoOwner}/tools/importer.git`,
            })
            await makePrSession(ownerId, {
                githubRepoOwner: null,
                githubRepoName: null,
                repoUrl: `https://gitlab.com/${repoOwner}/tools/other`,
            })

            const ids = async (repo: string) => {
                const res = await as(ownerToken).get('/session/pull-requests').query({ repo })
                expect(res.status).toBe(200)
                return (res.body.data.pullRequests as Array<{ sessionId: string }>).map(
                    (row) => row.sessionId
                )
            }

            expect(await ids(`${repoOwner}/tools/importer`)).toEqual([linkOnly.id])
            expect(await ids(`${repoOwner.toUpperCase()}/Tools/Importer`)).toEqual([linkOnly.id])
            expect(await ids('importer')).toEqual([linkOnly.id])
            expect(await ids(`nobody-${stamp}/importer`)).toEqual([])
        })

        it('leaves an open pull request of an archived session out, as the Open count does', async () => {
            const open = await makePrSession(ownerId, { prState: 'open' })
            const draft = await makePrSession(ownerId, { prState: 'draft' })
            const archived = await makePrSession(ownerId, { prState: 'open', isArchived: true })
            // a merge archives the session: the merged pull request stays in the list
            const merged = await makePrSession(ownerId, { prState: 'merged', isArchived: true })
            // a search session is in no list and in no count
            await makePrSession(ownerId, { prState: 'open', type: 'SEARCH' })

            const list = await as(ownerToken).get('/session/pull-requests?state=open,draft')
            const ids = list.body.data.pullRequests.map((row: any) => row.sessionId)
            expect(ids.sort()).toEqual([open.id, draft.id].sort())
            expect(list.body.data.pagination.total).toBe(2)

            const counts = await as(ownerToken).get('/session/counts')
            expect(counts.body.data.openPullRequests).toBe(2)

            const all = await as(ownerToken).get('/session/pull-requests')
            expect(all.body.data.pullRequests.map((row: any) => row.sessionId).sort()).toEqual(
                [open.id, draft.id, merged.id].sort()
            )

            const onlyArchived = await as(ownerToken).get('/session/pull-requests?isArchived=true')
            expect(
                onlyArchived.body.data.pullRequests.map((row: any) => row.sessionId).sort()
            ).toEqual([archived.id, merged.id].sort())
        })

        it('sends the run state and the archived flag of each row, for the row menu', async () => {
            const running = await makePrSession(ownerId, { prState: 'open', vmStatus: 'RUNNING' })
            const idle = await makePrSession(ownerId, { prState: 'draft' })
            // archived on merge: still listed, so the menu must offer Unarchive
            const merged = await makePrSession(ownerId, { prState: 'merged', isArchived: true })

            const res = await as(ownerToken).get('/session/pull-requests')
            expect(res.status).toBe(200)
            const byId = new Map<string, any>(
                res.body.data.pullRequests.map((row: any) => [row.sessionId, row])
            )
            expect(byId.get(running.id)).toMatchObject({ vmStatus: 'RUNNING', isArchived: false })
            expect(byId.get(idle.id)).toMatchObject({ vmStatus: 'STOPPED', isArchived: false })
            expect(byId.get(merged.id)).toMatchObject({ isArchived: true })
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

        it('pages do not repeat or skip rows that have the same time', async () => {
            // the web loads this list 30 rows at a time: the id breaks a tie, newest id first
            const sameTime = new Date(Date.UTC(2026, 0, 2))
            const made = []
            for (let index = 0; index < 5; index += 1) {
                made.push(await makePrSession(ownerId, { updatedAt: sameTime }))
            }
            const idsNewestFirst = made
                .map((session) => session.id)
                .sort()
                .reverse()

            const paged: string[] = []
            for (const page of ['1', '2', '3']) {
                const res = await as(ownerToken)
                    .get('/session/pull-requests')
                    .query({ sortBy: 'updatedAt', limit: '2', page })
                paged.push(
                    ...res.body.data.pullRequests.map((row: { sessionId: string }) => row.sessionId)
                )
            }
            expect(paged).toEqual(idsNewestFirst)
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

        it('repairs an open pull request that was not checked for an hour (a missed webhook)', async () => {
            const hoursAgo = (hours: number) => new Date(Date.now() - hours * 60 * 60 * 1000)
            // merged on github two hours ago, and the webhook never came
            const stale = await makePrSession(ownerId, { prCheckedAt: hoursAgo(2) })
            // checked ten minutes ago: the host is not asked again
            const fresh = await makePrSession(ownerId, { prCheckedAt: hoursAgo(1 / 6) })

            // answers api.github.com and lets every other request through
            const realFetch = globalThis.fetch
            const githubCalls: { url: string; authorization?: string }[] = []
            globalThis.fetch = (async (input: any, init?: RequestInit) => {
                const url = String(input)
                if (!url.startsWith('https://api.github.com')) return realFetch(input, init)
                githubCalls.push({
                    url,
                    authorization: (init?.headers as Record<string, string>)?.Authorization,
                })
                return new Response(
                    JSON.stringify({
                        number: stale.prNumber,
                        html_url: `https://github.com/${repoOwner}/web/pull/${stale.prNumber}`,
                        title: 'feat: login page (final)',
                        state: 'closed',
                        draft: false,
                        merged_at: '2026-01-04T10:00:00Z',
                        closed_at: '2026-01-04T10:00:00Z',
                        created_at: '2026-01-03T10:00:00Z',
                        additions: 51,
                        deletions: 7,
                    }),
                    { status: 200, headers: { 'Content-Type': 'application/json' } }
                )
            }) as typeof fetch
            // the token the refresh reads the repository with
            await prisma.user.update({
                where: { id: ownerId },
                data: { githubToken: 'gh-test-token' },
            })

            try {
                const res = await as(ownerToken).get('/session/pull-requests')
                expect(res.status).toBe(200)

                // the list that was read already has the repaired state
                const listed = res.body.data.pullRequests.find(
                    (row: { sessionId: string }) => row.sessionId === stale.id
                )
                expect(listed).toMatchObject({
                    prState: 'merged',
                    prTitle: 'feat: login page (final)',
                    additions: 51,
                    deletions: 7,
                    prMergedAt: '2026-01-04T10:00:00.000Z',
                })
                expect(
                    res.body.data.pullRequests.find(
                        (row: { sessionId: string }) => row.sessionId === fresh.id
                    ).prState
                ).toBe('open')

                // one call, for the stale pull request only, with the user's token
                expect(githubCalls).toEqual([
                    {
                        url: `https://api.github.com/repos/${repoOwner}/web/pulls/${stale.prNumber}`,
                        authorization: 'Bearer gh-test-token',
                    },
                ])

                const saved = await prisma.session.findUnique({ where: { id: stale.id } })
                expect(saved?.prState).toBe('merged')
                expect(saved?.prMergedAt?.toISOString()).toBe('2026-01-04T10:00:00.000Z')
                expect(saved?.prOpenedAt?.toISOString()).toBe('2026-01-03T10:00:00.000Z')
                expect(saved?.prCheckedAt?.getTime()).toBeGreaterThan(hoursAgo(1 / 60).getTime())
                // a repair does not move the session up the sessions list
                expect(saved?.updatedAt.toISOString()).toBe(stale.updatedAt.toISOString())

                // merged now, so the next read does not ask the host again
                await as(ownerToken).get('/session/pull-requests')
                expect(githubCalls).toHaveLength(1)
            } finally {
                globalThis.fetch = realFetch
                await prisma.user.update({ where: { id: ownerId }, data: { githubToken: null } })
            }
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

    describe('pull requests page bug hunt', () => {
        it('a search for a number too long for a pull request number matches text, not a 500', async () => {
            const session = await makePrSession(ownerId, { prTitle: 'bump to 99999999999' })
            for (const search of ['99999999999', '#3000000000']) {
                const res = await as(ownerToken).get('/session/pull-requests').query({ search })
                expect(res.status).toBe(200)
            }
            const res = await as(ownerToken)
                .get('/session/pull-requests')
                .query({ search: '99999999999' })
            expect(
                res.body.data.pullRequests.map((row: { sessionId: string }) => row.sessionId)
            ).toEqual([session.id])
        })

        it('the filter menu lists only repositories and tags that can show a row', async () => {
            await makePrSession(ownerId, { githubRepoName: 'listed', tags: ['shown'] })
            // a search session and an archived session with an open pull request are not rows
            await makePrSession(ownerId, {
                githubRepoName: 'search-only',
                type: 'SEARCH',
                tags: ['search-tag'],
            })
            await makePrSession(ownerId, {
                githubRepoName: 'archived-open',
                isArchived: true,
                tags: ['archived-tag'],
            })
            // an archived session with a merged pull request is a row
            await makePrSession(ownerId, {
                githubRepoName: 'archived-merged',
                isArchived: true,
                prState: 'merged',
                tags: ['merged-tag'],
            })

            const res = await as(ownerToken).get('/session/facets?hasPr=true')
            expect(res.status).toBe(200)
            expect([...res.body.data.repos].sort()).toEqual(
                [`${repoOwner}/archived-merged`, `${repoOwner}/listed`].sort()
            )
            expect([...res.body.data.tags].sort()).toEqual(['merged-tag', 'shown'])

            // the Sessions page facets still list every session
            const all = await as(ownerToken).get('/session/facets')
            expect(all.body.data.repos).toContain(`${repoOwner}/search-only`)
        })

        it('Last updated sorts by the last change of the pull request, not the session', async () => {
            // the session of the first moved last, but its pull request changed long ago
            const old = await makePrSession(ownerId, {
                updatedAt: new Date(Date.UTC(2026, 5, 1)),
                prUpdatedAt: new Date(Date.UTC(2026, 0, 2)),
            })
            const recent = await makePrSession(ownerId, {
                updatedAt: new Date(Date.UTC(2026, 0, 3)),
                prUpdatedAt: new Date(Date.UTC(2026, 4, 1)),
            })
            const res = await as(ownerToken)
                .get('/session/pull-requests')
                .query({ sortBy: 'prUpdatedAt', sortOrder: 'desc' })
            expect(res.status).toBe(200)
            expect(
                res.body.data.pullRequests.map((row: { sessionId: string }) => row.sessionId)
            ).toEqual([recent.id, old.id])
            expect(res.body.data.pullRequests[0].prUpdatedAt).toBe('2026-05-01T00:00:00.000Z')
        })

        it('the webhook saves when the pull request last changed, and keeps the session date', async () => {
            const session = await makePrSession(ownerId)
            const body = JSON.stringify({
                action: 'synchronize',
                repository: { name: 'web', owner: { login: repoOwner } },
                pull_request: {
                    number: session.prNumber,
                    title: 'feat: login page',
                    state: 'open',
                    draft: false,
                    merged_at: null,
                    closed_at: null,
                    created_at: '2026-01-03T10:00:00Z',
                    updated_at: '2026-01-06T12:00:00Z',
                },
            })
            const secret = env.GITHUB_APP_WEBHOOK_SECRET || 'secret'
            const signature = `sha256=${crypto.createHmac('sha256', secret).update(body).digest('hex')}`
            await request(app)
                .post('/api/v1/githubapp/webhook')
                .set('Content-Type', 'application/json')
                .set('x-hub-signature-256', signature)
                .set('x-github-event', 'pull_request')
                .send(body)

            const row = await prisma.session.findUnique({ where: { id: session.id } })
            expect(row?.prUpdatedAt?.toISOString()).toBe('2026-01-06T12:00:00.000Z')
            expect(row?.updatedAt.toISOString()).toBe(session.updatedAt.toISOString())
        })

        it('sends only web links', async () => {
            const bad = await makePrSession(ownerId, { prUrl: 'javascript:alert(1)' })
            const good = await makePrSession(ownerId, {
                prUrl: `https://github.com/${repoOwner}/web/pull/2`,
            })
            const res = await as(ownerToken).get('/session/pull-requests')
            const urlOf = (id: string) =>
                res.body.data.pullRequests.find(
                    (row: { sessionId: string }) => row.sessionId === id
                ).prUrl
            expect(urlOf(bad.id)).toBeNull()
            expect(urlOf(good.id)).toBe(`https://github.com/${repoOwner}/web/pull/2`)
        })

        describe('asking the host for stale pull requests', () => {
            const realFetch = globalThis.fetch
            let githubCalls = 0
            let answer: () => Promise<Response>

            beforeEach(async () => {
                githubCalls = 0
                answer = async () => new Response('{}', { status: 404 })
                globalThis.fetch = (async (input: any, init?: RequestInit) => {
                    if (!String(input).startsWith('https://api.github.com')) {
                        return realFetch(input, init)
                    }
                    githubCalls += 1
                    return answer()
                }) as typeof fetch
                await prisma.user.update({
                    where: { id: ownerId },
                    data: { githubToken: 'gh-test-token' },
                })
            })

            afterAll(async () => {
                globalThis.fetch = realFetch
                await prisma.user.update({ where: { id: ownerId }, data: { githubToken: null } })
            })

            const hourAgo = () => new Date(Date.now() - 2 * 60 * 60 * 1000)

            it('the next pages do not ask the host', async () => {
                await makePrSession(ownerId, { prCheckedAt: hourAgo() })
                const res = await as(ownerToken).get('/session/pull-requests').query({ page: 2 })
                expect(res.status).toBe(200)
                expect(githubCalls).toBe(0)

                await as(ownerToken).get('/session/pull-requests').query({ page: 1 })
                expect(githubCalls).toBe(1)
            })

            it('two reads at the same time ask the host once', async () => {
                await makePrSession(ownerId, { prCheckedAt: hourAgo() })
                const [first, second] = await Promise.all([
                    as(ownerToken).get('/session/pull-requests'),
                    as(ownerToken).get('/session/pull-requests'),
                ])
                expect(first.status).toBe(200)
                expect(second.status).toBe(200)
                expect(githubCalls).toBe(1)
            })

            it('a slow host does not hold the list for long', async () => {
                await makePrSession(ownerId, { prCheckedAt: hourAgo() })
                let release: () => void = () => {}
                answer = () =>
                    new Promise<Response>((resolve) => {
                        release = () => resolve(new Response('{}', { status: 404 }))
                    })

                const started = Date.now()
                const res = await as(ownerToken).get('/session/pull-requests')
                expect(res.status).toBe(200)
                expect(Date.now() - started).toBeLessThan(4000)
                expect(res.body.data.pullRequests).toHaveLength(1)
                // the refresh ends in the background
                release()
                await new Promise((resolve) => setTimeout(resolve, 100))
            })
        })
    })
})
