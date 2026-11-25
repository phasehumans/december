import crypto from 'crypto'

import { prisma } from '@december/database'
import { describe, it, expect, afterAll, beforeAll, beforeEach } from 'bun:test'
import request from 'supertest'

import app from '../../src/app'
import { env } from '../../src/env'
import { cleanupTestUser, getRandomIP, signInWithEmailCode } from '../helpers'

import type { Prisma } from '@december/database'

// issue 637 section 3: the "opening" settings of the pull requests page. "create the pull
// request" and the "open pull request" default are one stored value, and a merged pull
// request archives its session
describe('Pull request opening settings (#637)', () => {
    const stamp = Date.now()
    const email = `pr-opening-${stamp}@example.com`
    // a repository only this test uses, so the webhook touches no other rows
    const repoOwner = `opening-${stamp}`

    let userId: string
    let token: string

    const api = {
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
    }

    let prNumber = 0
    const makePrSession = async (data: Partial<Prisma.SessionUncheckedCreateInput> = {}) => {
        prNumber += 1
        const at = new Date(Date.UTC(2026, 0, 1, 0, prNumber))
        return prisma.session.create({
            data: {
                userId,
                title: `session ${prNumber}`,
                createdAt: at,
                updatedAt: at,
                githubRepoOwner: repoOwner,
                githubRepoName: 'web',
                prNumber,
                prState: 'open',
                // checked just now, so the refresh on read leaves the row alone
                prCheckedAt: new Date(),
                ...data,
            },
        })
    }

    const sendMerged = (number: number, action = 'closed') => {
        const body = JSON.stringify({
            action,
            repository: { name: 'web', full_name: `${repoOwner}/web`, owner: { login: repoOwner } },
            pull_request: {
                number,
                title: 'feat: login page',
                state: 'closed',
                draft: false,
                merged_at: '2026-01-04T10:00:00Z',
                closed_at: '2026-01-04T10:00:00Z',
                created_at: '2026-01-03T10:00:00Z',
            },
        })
        const secret = env.GITHUB_APP_WEBHOOK_SECRET || 'secret'
        const signature = `sha256=${crypto.createHmac('sha256', secret).update(body).digest('hex')}`
        return request(app)
            .post('/api/v1/githubapp/webhook')
            .set('Content-Type', 'application/json')
            .set('x-hub-signature-256', signature)
            .set('x-github-event', 'pull_request')
            .send(body)
    }

    const rowOf = (id: string) => prisma.session.findUnique({ where: { id } })

    beforeAll(async () => {
        const user = await prisma.user.create({
            data: { email, name: 'PR Opening', emailVerified: true, creditBalance: 10_000 },
        })
        userId = user.id
        token = (await signInWithEmailCode(app, email)).body.data.accessToken
    })

    beforeEach(async () => {
        await prisma.session.deleteMany({ where: { userId } })
        await prisma.pullRequestSettings.deleteMany({ where: { userId } })
        await api.patch('/setting/defaults', { defaultOpenPullRequest: true })
    })

    afterAll(async () => {
        await cleanupTestUser({ email })
    })

    it('a new user gets the opening defaults', async () => {
        const res = await api.get('/setting/pull-requests')
        expect(res.status).toBe(200)
        expect(res.body.data).toMatchObject({
            branchPrefix: 'december/',
            prDraft: false,
            prCreate: 'auto',
            prAuthor: 'december',
            commitAuthor: 'both',
            archiveOnMerge: true,
        })
    })

    it('saves the opening settings one row at a time', async () => {
        const saved = await api.patch('/setting/pull-requests', { branchPrefix: 'feat/ai-' })
        expect(saved.status).toBe(200)
        expect(saved.body.data.branchPrefix).toBe('feat/ai-')

        await api.patch('/setting/pull-requests', { prDraft: true })
        await api.patch('/setting/pull-requests', { prAuthor: 'user', commitAuthor: 'december' })

        const read = await api.get('/setting/pull-requests')
        expect(read.body.data).toMatchObject({
            branchPrefix: 'feat/ai-',
            prDraft: true,
            prCreate: 'auto',
            prAuthor: 'user',
            commitAuthor: 'december',
            archiveOnMerge: true,
        })
    })

    // review E2: git refuses these names, so the prefix is refused when it is saved
    it('refuses a branch prefix that gives a branch name git does not allow', async () => {
        for (const branchPrefix of ['wip/.', 'a.lock/', '.x/', 'a..b/', '/a/', '-a/']) {
            const res = await api.patch('/setting/pull-requests', { branchPrefix })
            expect(res.status).toBe(400)
        }
        const read = await api.get('/setting/pull-requests')
        expect(read.body.data.branchPrefix).not.toContain('.lock')
    })

    describe('"create the pull request" and the "open pull request" default are one value', () => {
        it('"ask" on the pull requests page turns the default off for new sessions', async () => {
            const saved = await api.patch('/setting/pull-requests', { prCreate: 'ask' })
            expect(saved.status).toBe(200)
            expect(saved.body.data.prCreate).toBe('ask')

            const profile = await api.get('/setting')
            expect(profile.body.data.defaultOpenPullRequest).toBe(false)

            const session = await api.post('/session', { prompt: 'add a login page' })
            expect(session.status).toBe(201)
            expect(session.body.data.session.config.openPullRequest).toBe(false)
        })

        it('"auto" turns it on again', async () => {
            await api.patch('/setting/pull-requests', { prCreate: 'ask' })
            await api.patch('/setting/pull-requests', { prCreate: 'auto' })

            expect((await api.get('/setting')).body.data.defaultOpenPullRequest).toBe(true)
            expect((await api.get('/setting/pull-requests')).body.data.prCreate).toBe('auto')
        })

        it('the default saved from the prompt box shows on the pull requests page', async () => {
            const off = await api.patch('/setting/defaults', { defaultOpenPullRequest: false })
            expect(off.status).toBe(200)
            expect((await api.get('/setting/pull-requests')).body.data.prCreate).toBe('ask')

            await api.patch('/setting/defaults', { defaultOpenPullRequest: true })
            expect((await api.get('/setting/pull-requests')).body.data.prCreate).toBe('auto')
        })

        it('a save of another row does not change it', async () => {
            await api.patch('/setting/defaults', { defaultOpenPullRequest: false })
            const saved = await api.patch('/setting/pull-requests', { prDraft: true })
            expect(saved.body.data.prCreate).toBe('ask')
            expect((await api.get('/setting')).body.data.defaultOpenPullRequest).toBe(false)
        })
    })

    describe('archive the session when the pull request merges', () => {
        it('archives the session on the merged event, and its pin goes', async () => {
            const session = await makePrSession({ pinnedAt: new Date() })

            const res = await sendMerged(session.prNumber as number)
            expect(res.status).toBe(200)

            const row = await rowOf(session.id)
            expect(row?.prState).toBe('merged')
            expect(row?.isArchived).toBe(true)
            expect(row?.pinnedAt).toBeNull()
            // an archive does not move the session in the list
            expect(row?.updatedAt.toISOString()).toBe(session.updatedAt.toISOString())
        })

        it('leaves the session when the setting is off', async () => {
            await api.patch('/setting/pull-requests', { archiveOnMerge: false })
            const pinnedAt = new Date()
            const session = await makePrSession({ pinnedAt })

            await sendMerged(session.prNumber as number)

            const row = await rowOf(session.id)
            expect(row?.prState).toBe('merged')
            expect(row?.isArchived).toBe(false)
            expect(row?.pinnedAt?.toISOString()).toBe(pinnedAt.toISOString())
        })

        it('does not archive a closed pull request that was not merged', async () => {
            const session = await makePrSession()
            const body = JSON.stringify({
                action: 'closed',
                repository: { name: 'web', owner: { login: repoOwner } },
                pull_request: {
                    number: session.prNumber,
                    state: 'closed',
                    merged_at: null,
                    closed_at: '2026-01-04T10:00:00Z',
                },
            })
            const secret = env.GITHUB_APP_WEBHOOK_SECRET || 'secret'
            await request(app)
                .post('/api/v1/githubapp/webhook')
                .set('Content-Type', 'application/json')
                .set(
                    'x-hub-signature-256',
                    `sha256=${crypto.createHmac('sha256', secret).update(body).digest('hex')}`
                )
                .set('x-github-event', 'pull_request')
                .send(body)

            const row = await rowOf(session.id)
            expect(row?.prState).toBe('closed')
            expect(row?.isArchived).toBe(false)
        })

        it('archives once: a later event of the merged pull request leaves an unarchived session', async () => {
            const session = await makePrSession()
            await sendMerged(session.prNumber as number)
            expect((await rowOf(session.id))?.isArchived).toBe(true)

            const undo = await api.patch(`/session/${session.id}/unarchive`)
            expect(undo.status).toBe(200)

            // github sends "edited" when someone changes the title of the merged pull request
            await sendMerged(session.prNumber as number, 'edited')
            expect((await rowOf(session.id))?.isArchived).toBe(false)
        })

        it('does not archive a session that works right now', async () => {
            const session = await makePrSession({ vmStatus: 'RUNNING' })
            await sendMerged(session.prNumber as number)

            const row = await rowOf(session.id)
            expect(row?.prState).toBe('merged')
            expect(row?.isArchived).toBe(false)
        })

        it('archives when the merge is found on a read (a missed webhook)', async () => {
            const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000)
            const session = await makePrSession({ prCheckedAt: twoHoursAgo })

            // answers api.github.com and lets every other request through
            const realFetch = globalThis.fetch
            globalThis.fetch = (async (input: any, init?: RequestInit) => {
                if (!String(input).startsWith('https://api.github.com')) {
                    return realFetch(input, init)
                }
                return new Response(
                    JSON.stringify({
                        number: session.prNumber,
                        html_url: `https://github.com/${repoOwner}/web/pull/${session.prNumber}`,
                        title: 'feat: login page',
                        state: 'closed',
                        merged_at: '2026-01-04T10:00:00Z',
                        closed_at: '2026-01-04T10:00:00Z',
                    }),
                    { status: 200, headers: { 'Content-Type': 'application/json' } }
                )
            }) as typeof fetch
            await prisma.user.update({ where: { id: userId }, data: { githubToken: 'gh-test' } })

            try {
                const res = await api.get('/session/pull-requests')
                expect(res.status).toBe(200)

                const row = await rowOf(session.id)
                expect(row?.prState).toBe('merged')
                expect(row?.isArchived).toBe(true)
            } finally {
                globalThis.fetch = realFetch
                await prisma.user.update({ where: { id: userId }, data: { githubToken: null } })
            }
        })
    })
})
