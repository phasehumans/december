import { prisma } from '@december/database'
import { getRedisClient, setAgentQueue } from '@december/shared/queue'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'bun:test'
import request from 'supertest'

import app from '../../src/app'
import { sessionService } from '../../src/modules/session/session.service'
import { appCache } from '../../src/shared/cache'
import { cleanupTestUser, createSignedInUser, getRandomIP } from '../helpers'

/**
 * The Sessions page: every route it calls, for the list, the counts, the filter menu, the
 * row menu (rename, tag, pin, archive, delete) and archive merged with its undo.
 * Each test starts with no sessions and an empty cache, and seeds rows with prisma.
 */
describe('Sessions page routes', () => {
    const stamp = Date.now()
    const redis = getRedisClient()
    const savedPublish = redis.publish
    const queued: Array<{ name: string; data: any }> = []

    let owner: { userId: string; token: string }
    let stranger: { userId: string; token: string }

    const call = (
        method: 'get' | 'post' | 'patch' | 'put' | 'delete',
        path: string,
        token?: string
    ) => {
        const req = request(app)[method](`/api/v1${path}`).set('x-forwarded-for', getRandomIP())
        return token ? req.set('Authorization', `Bearer ${token}`) : req
    }
    const as = (token: string) => ({
        get: (path: string) => call('get', path, token),
        post: (path: string, body?: object) => call('post', path, token).send(body ?? {}),
        patch: (path: string, body?: object) => call('patch', path, token).send(body ?? {}),
        put: (path: string, body?: object) => call('put', path, token).send(body ?? {}),
        delete: (path: string, body?: object) => call('delete', path, token).send(body ?? {}),
    })

    /** a session of the owner (or of `userId`), with `updatedAt` days ago when given */
    const seed = async (data: Record<string, unknown> & { daysAgo?: number } = {}) => {
        const { daysAgo, ...fields } = data
        const at = daysAgo !== undefined ? new Date(Date.now() - daysAgo * 86_400_000) : undefined
        return prisma.session.create({
            data: {
                userId: owner.userId,
                title: `session ${stamp}`,
                ...(at ? { createdAt: at, updatedAt: at } : {}),
                ...fields,
            } as any,
        })
    }

    const addMessage = (
        sessionId: string,
        role: 'USER' | 'ASSISTANT',
        content: string,
        sequence: number
    ) => prisma.message.create({ data: { sessionId, role, content, sequence } })

    const list = async (query = '', token = owner.token) => {
        const res = await as(token).get(`/session${query ? `?${query}` : ''}`)
        expect(res.status).toBe(200)
        return res.body.data as { sessions: any[]; pagination: any }
    }
    const listIds = async (query = '') => (await list(query)).sessions.map((row) => row.id)

    const readSession = (id: string) => prisma.session.findUnique({ where: { id } })

    beforeAll(async () => {
        // no worker here: what the server publishes and queues is kept
        redis.publish = (async () => 1) as any
        setAgentQueue({
            add: async (name: string, data: any) => {
                queued.push({ name, data })
                return { id: `job-${queued.length}` }
            },
        } as any)
        owner = await createSignedInUser({ email: `sessions-page-${stamp}@example.com` })
        stranger = await createSignedInUser({ email: `sessions-page-other-${stamp}@example.com` })
        await prisma.user.update({
            where: { id: owner.userId },
            data: { githubUsername: 'Page-Owner', name: 'Page Owner' },
        })
    })

    afterAll(async () => {
        redis.publish = savedPublish
        setAgentQueue(null)
        const ids = [owner.userId, stranger.userId]
        await prisma.session.deleteMany({ where: { userId: { in: ids } } })
        for (const id of ids) {
            await cleanupTestUser({ id })
        }
    })

    beforeEach(async () => {
        queued.length = 0
        await prisma.session.deleteMany({
            where: { userId: { in: [owner.userId, stranger.userId] } },
        })
        await appCache.clearAll()
    })

    describe('access', () => {
        const fakeId = '00000000-0000-4000-8000-000000000000'
        const routes: Array<[string, 'get' | 'post' | 'patch' | 'put' | 'delete', string]> = [
            ['list', 'get', '/session'],
            ['counts', 'get', '/session/counts'],
            ['facets', 'get', '/session/facets'],
            ['pull requests', 'get', '/session/pull-requests'],
            ['archive merged', 'post', '/session/archive-merged'],
            ['bulk unarchive', 'post', '/session/unarchive'],
            ['delete all', 'delete', '/session'],
            ['rename', 'patch', `/session/${fakeId}/rename`],
            ['archive', 'patch', `/session/${fakeId}/archive`],
            ['unarchive', 'patch', `/session/${fakeId}/unarchive`],
            ['pin', 'patch', `/session/${fakeId}/pin`],
            ['unpin', 'patch', `/session/${fakeId}/unpin`],
            ['tags', 'put', `/session/${fakeId}/tags`],
            ['delete', 'delete', `/session/${fakeId}`],
        ]

        for (const [name, method, path] of routes) {
            it(`${name} needs a signed-in user`, async () => {
                const res = await call(method, path)
                expect(res.status).toBe(401)
            })
        }

        const idRoutes: Array<[string, 'patch' | 'put' | 'delete', string, object?]> = [
            ['rename', 'patch', 'rename', { title: 'x' }],
            ['archive', 'patch', 'archive'],
            ['unarchive', 'patch', 'unarchive'],
            ['pin', 'patch', 'pin'],
            ['unpin', 'patch', 'unpin'],
            ['tags', 'put', 'tags', { tags: ['x'] }],
            ['delete', 'delete', ''],
        ]

        for (const [name, method, action, body] of idRoutes) {
            const path = (id: string) => `/session/${id}${action ? `/${action}` : ''}`

            it(`${name} refuses an id that is not a uuid (400)`, async () => {
                const res = await as(owner.token)[method](path('not-a-uuid'), body)
                expect(res.status).toBe(400)
            })

            it(`${name} answers 404 for a session that does not exist`, async () => {
                const res = await as(owner.token)[method](path(fakeId), body)
                expect(res.status).toBe(404)
            })

            it(`${name} answers 404 for another user's session and changes nothing`, async () => {
                const theirs = await seed({
                    userId: stranger.userId,
                    title: 'theirs',
                    tags: ['keep'],
                    isArchived: action === 'unarchive',
                    pinnedAt: action === 'unpin' ? new Date('2026-01-01') : null,
                })

                const res = await as(owner.token)[method](path(theirs.id), body)

                expect(res.status).toBe(404)
                // no field of their session in the answer
                expect(JSON.stringify(res.body)).not.toContain('theirs')
                const after = await readSession(theirs.id)
                expect(after).not.toBeNull()
                expect(after?.title).toBe('theirs')
                expect(after?.tags).toEqual(['keep'])
                expect(after?.isArchived).toBe(theirs.isArchived)
                expect(after?.pinnedAt?.getTime()).toBe(theirs.pinnedAt?.getTime())
                expect(after?.updatedAt.getTime()).toBe(theirs.updatedAt.getTime())
            })
        }

        it("the list, counts and facets never show another user's sessions", async () => {
            await seed({
                userId: stranger.userId,
                title: 'stranger session',
                tags: ['secret-tag'],
                vmStatus: 'RUNNING',
                prNumber: 9,
                prState: 'open',
                githubRepoOwner: 'stranger',
                githubRepoName: 'private-repo',
            })
            const mine = await seed({ title: 'my session' })

            expect(await listIds()).toEqual([mine.id])
            expect(await listIds('search=stranger')).toEqual([])
            expect(await listIds('tags=secret-tag')).toEqual([])
            expect(await listIds('repoName=stranger/private-repo')).toEqual([])

            const counts = await as(owner.token).get('/session/counts')
            expect(counts.body.data).toEqual({
                running: 0,
                needsAnswer: 0,
                needsYou: 0,
                openPullRequests: 0,
                merged: 0,
            })

            const facets = await as(owner.token).get('/session/facets')
            expect(facets.body.data).toEqual({ repos: [], tags: [] })
        })
    })

    describe('GET /session (the list)', () => {
        it('is empty with a zero total for a user with no sessions', async () => {
            const data = await list()
            expect(data.sessions).toEqual([])
            expect(data.pagination).toEqual({ total: 0, page: 1, limit: 50, totalPages: 0 })
        })

        it('returns each row with the fields the page shows', async () => {
            const session = await seed({
                title: 'Fix login',
                tags: ['auth'],
                vmStatus: 'RUNNING',
                branch: 'fix/login',
                githubRepoOwner: 'acme',
                githubRepoName: 'web',
                gitProvider: 'GITLAB',
                repoUrl: 'https://gitlab.com/acme/web',
                prNumber: 12,
                prState: 'draft',
                prTitle: 'Fix the login form',
                prUrl: 'https://gitlab.com/acme/web/-/merge_requests/12',
                prBranch: 'december/fix-login',
                pendingQuestionAt: new Date(),
            })
            await addMessage(session.id, 'USER', 'fix the login form', 1)
            await addMessage(session.id, 'ASSISTANT', 'Done, the form works now.', 2)

            const [row] = (await list()).sessions

            expect(row).toMatchObject({
                id: session.id,
                title: 'Fix login',
                type: 'WEB',
                isArchived: false,
                isPinned: false,
                pinnedAt: null,
                needsAnswer: true,
                tags: ['auth'],
                lastMessage: 'Done, the form works now.',
                createdBy: '@page-owner',
                createdByName: 'Page Owner',
                vmStatus: 'RUNNING',
                branch: 'fix/login',
                prNumber: 12,
                prState: 'draft',
                prTitle: 'Fix the login form',
                prUrl: 'https://gitlab.com/acme/web/-/merge_requests/12',
                prBranch: 'december/fix-login',
                githubRepoOwner: 'acme',
                githubRepoName: 'web',
                gitProvider: 'GITLAB',
                repoUrl: 'https://gitlab.com/acme/web',
            })
        })

        it('keeps every pull request field null when the session has no pull request number', async () => {
            await seed({ prState: 'merged', prTitle: 'old', prUrl: 'https://x', prBranch: 'b' })

            const [row] = (await list()).sessions

            expect(row.prNumber).toBeNull()
            expect(row.prState).toBeNull()
            expect(row.prTitle).toBeNull()
            expect(row.prUrl).toBeNull()
            expect(row.prBranch).toBeNull()
        })

        it('names an untitled row by the first prompt, not by the newest message', async () => {
            const untitled = await seed({ title: null })
            await addMessage(untitled.id, 'USER', 'add a dark mode toggle', 1)
            await addMessage(untitled.id, 'ASSISTANT', 'I added the toggle.', 2)
            await addMessage(untitled.id, 'USER', 'thanks', 3)
            const long = await seed({ title: '   ', daysAgo: 1 })
            await addMessage(long.id, 'USER', `${'a'.repeat(60)}`, 1)
            const empty = await seed({ title: null, daysAgo: 2 })

            const rows = (await list()).sessions
            const byId = (id: string) => rows.find((row) => row.id === id)

            expect(byId(untitled.id).title).toBe('add a dark mode toggle')
            expect(byId(untitled.id).lastMessage).toBe('thanks')
            expect(byId(long.id).title).toBe(`${'a'.repeat(50)}...`)
            expect(byId(empty.id).title).toBe('New Chat')
            expect(byId(empty.id).lastMessage).toBeNull()
        })

        it('falls back to the email name for the author when there is no GitHub name', async () => {
            await prisma.session.create({ data: { userId: stranger.userId, title: 'x' } })
            const [row] = (await list('', stranger.token)).sessions
            expect(row.createdBy).toBe(`@sessions-page-other-${stamp}`)
        })

        describe('sort', () => {
            it('is newest update first by default', async () => {
                const old = await seed({ daysAgo: 3 })
                const mid = await seed({ daysAgo: 2 })
                const recent = await seed({ daysAgo: 1 })

                expect(await listIds()).toEqual([recent.id, mid.id, old.id])
            })

            it('sorts by created date and by updated date, both ways', async () => {
                // created long ago, updated just now
                const a = await seed({
                    createdAt: new Date(Date.now() - 10 * 86_400_000),
                    updatedAt: new Date(),
                })
                // created yesterday, updated two days ago is not possible, so updated yesterday
                const b = await seed({ daysAgo: 1 })

                expect(await listIds('sortBy=createdAt&sortOrder=asc')).toEqual([a.id, b.id])
                expect(await listIds('sortBy=createdAt&sortOrder=desc')).toEqual([b.id, a.id])
                expect(await listIds('sortBy=updatedAt&sortOrder=asc')).toEqual([b.id, a.id])
                expect(await listIds('sortBy=updatedAt&sortOrder=desc')).toEqual([a.id, b.id])
            })

            it('pinnedFirst puts pins on top with any sort', async () => {
                const old = await seed({ daysAgo: 5, pinnedAt: new Date() })
                const recent = await seed({ daysAgo: 1 })

                expect(await listIds('pinnedFirst=true')).toEqual([old.id, recent.id])
                expect(await listIds('pinnedFirst=true&sortOrder=asc')).toEqual([old.id, recent.id])
                expect(await listIds()).toEqual([recent.id, old.id])
            })
        })

        describe('paging', () => {
            it('pages with the total and the page count', async () => {
                for (let day = 0; day < 5; day++) await seed({ daysAgo: day })

                const first = await list('limit=2&page=1')
                const third = await list('limit=2&page=3')
                const past = await list('limit=2&page=4')

                expect(first.sessions).toHaveLength(2)
                expect(first.pagination).toEqual({ total: 5, page: 1, limit: 2, totalPages: 3 })
                expect(third.sessions).toHaveLength(1)
                expect(past.sessions).toEqual([])
            })

            it('does not repeat or skip rows that have the same time', async () => {
                const at = new Date('2026-06-01T10:00:00Z')
                const ids: string[] = []
                for (let i = 0; i < 7; i++) {
                    ids.push((await seed({ createdAt: at, updatedAt: at })).id)
                }

                const seen: string[] = []
                for (let page = 1; page <= 4; page++) {
                    seen.push(...(await listIds(`limit=2&page=${page}`)))
                }

                expect(seen).toHaveLength(7)
                expect([...seen].sort()).toEqual([...ids].sort())
            })
        })

        describe('filters', () => {
            it('isArchived true, false, or left out for both', async () => {
                const active = await seed({ daysAgo: 1 })
                const archived = await seed({ daysAgo: 2, isArchived: true })

                expect(await listIds('isArchived=false')).toEqual([active.id])
                expect(await listIds('isArchived=true')).toEqual([archived.id])
                expect(await listIds()).toEqual([active.id, archived.id])
            })

            it('type keeps web or search sessions', async () => {
                const web = await seed({ type: 'WEB' })
                const search = await seed({ type: 'SEARCH', daysAgo: 1 })

                expect(await listIds('type=WEB')).toEqual([web.id])
                expect(await listIds('type=SEARCH')).toEqual([search.id])
            })

            it('tags keep sessions that have every tag, with spaces around commas', async () => {
                const both = await seed({ tags: ['api', 'bug'] })
                const one = await seed({ tags: ['api'], daysAgo: 1 })
                await seed({ tags: [], daysAgo: 2 })

                expect(await listIds('tags=api')).toEqual([both.id, one.id])
                expect(await listIds('tags=api,%20bug')).toEqual([both.id])
                expect(await listIds('tags=nope')).toEqual([])
            })

            it('vmStatus keeps working, stopped or failed sessions', async () => {
                const provisioning = await seed({ vmStatus: 'PROVISIONING' })
                const running = await seed({ vmStatus: 'RUNNING', daysAgo: 1 })
                const stopped = await seed({ vmStatus: 'STOPPED', daysAgo: 2 })
                const failed = await seed({ vmStatus: 'FAILED', daysAgo: 3 })

                expect(await listIds('vmStatus=active')).toEqual([provisioning.id, running.id])
                expect(await listIds('vmStatus=running')).toEqual([provisioning.id, running.id])
                expect(await listIds('vmStatus=RUNNING')).toEqual([running.id])
                expect(await listIds('vmStatus=STOPPED')).toEqual([stopped.id])
                expect(await listIds('vmStatus=FAILED')).toEqual([failed.id])
            })

            it('hasPr and needsAnswer', async () => {
                const pr = await seed({ prNumber: 4 })
                const asking = await seed({ pendingQuestionAt: new Date(), daysAgo: 1 })
                await seed({ daysAgo: 2 })

                expect(await listIds('hasPr=true')).toEqual([pr.id])
                expect(await listIds('needsAnswer=true')).toEqual([asking.id])
            })

            it('filters join: archived, tagged and with a pull request', async () => {
                const match = await seed({ isArchived: true, tags: ['ops'], prNumber: 1 })
                await seed({ isArchived: false, tags: ['ops'], prNumber: 2 })
                await seed({ isArchived: true, tags: ['ops'] })
                await seed({ isArchived: true, tags: ['web'], prNumber: 3 })

                expect(await listIds('isArchived=true&tags=ops&hasPr=true')).toEqual([match.id])
            })
        })

        describe('search', () => {
            it('matches the title or any message, in any case', async () => {
                const byTitle = await seed({ title: 'Refactor PAYMENTS module' })
                const byMessage = await seed({ title: 'other', daysAgo: 1 })
                await addMessage(byMessage.id, 'ASSISTANT', 'the payments table has a new index', 1)
                await seed({ title: 'unrelated', daysAgo: 2 })

                expect(await listIds('search=payments')).toEqual([byTitle.id, byMessage.id])
                expect(await listIds('search=payments&searchIn=title')).toEqual([byTitle.id])
            })

            it('trims the search, and an empty search lists everything', async () => {
                const a = await seed({ title: 'alpha' })
                const b = await seed({ title: 'beta', daysAgo: 1 })

                expect(await listIds('search=%20%20alpha%20')).toEqual([a.id])
                expect(await listIds('search=')).toEqual([a.id, b.id])
                expect(await listIds('search=%20%20')).toEqual([a.id, b.id])
            })

            it('reads % and _ as plain characters, not as wildcards', async () => {
                const percent = await seed({ title: 'cut costs by 50% now' })
                await seed({ title: 'cut costs by 500 now', daysAgo: 1 })
                const underscore = await seed({ title: 'rename user_id', daysAgo: 2 })
                await seed({ title: 'rename userXid', daysAgo: 3 })

                expect(await listIds('search=50%25')).toEqual([percent.id])
                expect(await listIds('search=user_id')).toEqual([underscore.id])
            })

            it('a repository filter with _ matches that name only', async () => {
                const exact = await seed({ githubRepoOwner: 'acme', githubRepoName: 'my_repo' })
                await seed({ githubRepoOwner: 'acme', githubRepoName: 'myXrepo', daysAgo: 1 })
                const byLink = await seed({
                    repoUrl: 'https://github.com/acme/my_repo.git',
                    daysAgo: 2,
                })
                await seed({ repoUrl: 'https://github.com/acme/myXrepo.git', daysAgo: 3 })

                expect(await listIds('repoName=acme/my_repo')).toEqual([exact.id, byLink.id])
                expect(await listIds('repoName=my_repo')).toEqual([exact.id, byLink.id])
            })

            it('a search is not cached: a new matching session shows on the next read', async () => {
                await seed({ title: 'needle one' })
                expect(await listIds('search=needle')).toHaveLength(1)
                await seed({ title: 'needle two' })
                expect(await listIds('search=needle')).toHaveLength(2)
            })
        })

        describe('refused query values (400)', () => {
            const bad = [
                ['limit over 100', 'limit=101'],
                ['limit of 0', 'limit=0'],
                ['limit that is not a number', 'limit=ten'],
                ['page of 0', 'page=0'],
                ['page that is not whole', 'page=1.5'],
                ['unknown sortBy', 'sortBy=title'],
                ['unknown sortOrder', 'sortOrder=up'],
                ['unknown type', 'type=CLI'],
                ['unknown searchIn', 'searchIn=body'],
                ['tags list over 500 characters', `tags=${'t'.repeat(501)}`],
                ['empty repoName', 'repoName=%20'],
            ]
            for (const [name, query] of bad) {
                it(name, async () => {
                    const res = await as(owner.token).get(`/session?${query}`)
                    expect(res.status).toBe(400)
                })
            }
        })
    })

    describe('the list cache', () => {
        it('a write shows on the next read of the list, the counts and the facets', async () => {
            const session = await seed({
                title: 'before',
                prNumber: 3,
                prState: 'open',
                githubRepoOwner: 'acme',
                githubRepoName: 'api',
            })

            // fill the caches
            expect((await list()).sessions[0].title).toBe('before')
            expect((await as(owner.token).get('/session/counts')).body.data.openPullRequests).toBe(
                1
            )
            expect((await as(owner.token).get('/session/facets')).body.data.tags).toEqual([])

            await as(owner.token).patch(`/session/${session.id}/rename`, { title: 'after' })
            expect((await list()).sessions[0].title).toBe('after')

            await as(owner.token).put(`/session/${session.id}/tags`, { tags: ['fresh'] })
            expect((await as(owner.token).get('/session/facets')).body.data.tags).toEqual(['fresh'])

            await as(owner.token).patch(`/session/${session.id}/archive`)
            expect(await listIds('isArchived=false')).toEqual([])
            expect((await as(owner.token).get('/session/counts')).body.data.openPullRequests).toBe(
                0
            )

            await as(owner.token).delete(`/session/${session.id}`)
            expect(await listIds()).toEqual([])
        })

        it("one user's write does not serve stale rows to the other, and the caches are per user", async () => {
            await seed({ title: 'mine' })
            await prisma.session.create({ data: { userId: stranger.userId, title: 'theirs' } })

            expect((await list()).sessions.map((row) => row.title)).toEqual(['mine'])
            expect((await list('', stranger.token)).sessions.map((row) => row.title)).toEqual([
                'theirs',
            ])
        })
    })

    describe('PATCH /session/:id/rename', () => {
        it('renames, trims the title, and keeps the place in the list', async () => {
            const session = await seed({ title: 'old', daysAgo: 4 })
            const newer = await seed({ daysAgo: 1 })

            const res = await as(owner.token).patch(`/session/${session.id}/rename`, {
                title: '  New name  ',
            })

            expect(res.status).toBe(200)
            expect(res.body.data.session.title).toBe('New name')
            const after = await readSession(session.id)
            expect(after?.title).toBe('New name')
            expect(after?.updatedAt.getTime()).toBe(session.updatedAt.getTime())
            expect(await listIds()).toEqual([newer.id, session.id])
        })

        it('takes a title of exactly 100 characters', async () => {
            const session = await seed()
            const res = await as(owner.token).patch(`/session/${session.id}/rename`, {
                title: 'x'.repeat(100),
            })
            expect(res.status).toBe(200)
        })

        const bad: Array<[string, unknown]> = [
            ['no title', {}],
            ['an empty title', { title: '' }],
            ['spaces alone', { title: '    ' }],
            ['over 100 characters', { title: 'x'.repeat(101) }],
            ['a title that is not text', { title: 42 }],
        ]
        for (const [name, body] of bad) {
            it(`refuses ${name} (400) and keeps the old title`, async () => {
                const session = await seed({ title: 'kept' })
                const res = await as(owner.token).patch(
                    `/session/${session.id}/rename`,
                    body as object
                )
                expect(res.status).toBe(400)
                expect((await readSession(session.id))?.title).toBe('kept')
            })
        }
    })

    describe('PUT /session/:id/tags', () => {
        it('sets one tag, trimmed, keeps the place in the list, and the filter finds it', async () => {
            const session = await seed({ daysAgo: 4 })
            const newer = await seed({ daysAgo: 1 })

            const res = await as(owner.token).put(`/session/${session.id}/tags`, {
                tags: ['  backend '],
            })

            expect(res.status).toBe(200)
            expect(res.body.data.session.tags).toEqual(['backend'])
            const after = await readSession(session.id)
            expect(after?.updatedAt.getTime()).toBe(session.updatedAt.getTime())
            expect(await listIds()).toEqual([newer.id, session.id])
            expect(await listIds('tags=backend')).toEqual([session.id])
        })

        it('an empty list clears the tag', async () => {
            const session = await seed({ tags: ['old'] })
            const res = await as(owner.token).put(`/session/${session.id}/tags`, { tags: [] })
            expect(res.status).toBe(200)
            expect((await readSession(session.id))?.tags).toEqual([])
        })

        it('replaces the tag that was there', async () => {
            const session = await seed({ tags: ['old'] })
            await as(owner.token).put(`/session/${session.id}/tags`, { tags: ['new'] })
            expect((await readSession(session.id))?.tags).toEqual(['new'])
        })

        const bad: Array<[string, unknown]> = [
            ['no tags field', {}],
            ['two tags', { tags: ['a', 'b'] }],
            ['an empty tag', { tags: [''] }],
            ['a tag of spaces', { tags: ['   '] }],
            ['a tag over 30 characters', { tags: ['x'.repeat(31)] }],
            ['a tag with a comma', { tags: ['a,b'] }],
            ['tags that are not a list', { tags: 'a' }],
        ]
        for (const [name, body] of bad) {
            it(`refuses ${name} (400) and keeps the old tag`, async () => {
                const session = await seed({ tags: ['kept'] })
                const res = await as(owner.token).put(`/session/${session.id}/tags`, body as object)
                expect(res.status).toBe(400)
                expect((await readSession(session.id))?.tags).toEqual(['kept'])
            })
        }
    })

    describe('archive and unarchive one session', () => {
        it('archive keeps the updated time, drops the pin, and moves the row to Archived', async () => {
            const session = await seed({ daysAgo: 3, pinnedAt: new Date() })

            const res = await as(owner.token).patch(`/session/${session.id}/archive`)

            expect(res.status).toBe(200)
            expect(res.body.data.session.isArchived).toBe(true)
            const after = await readSession(session.id)
            expect(after?.pinnedAt).toBeNull()
            expect(after?.updatedAt.getTime()).toBe(session.updatedAt.getTime())
            expect(await listIds('isArchived=false')).toEqual([])
            expect(await listIds('isArchived=true')).toEqual([session.id])
        })

        it('unarchive keeps the updated time and does not bring a pin back', async () => {
            const session = await seed({ daysAgo: 3, isArchived: true })

            const res = await as(owner.token).patch(`/session/${session.id}/unarchive`)

            expect(res.status).toBe(200)
            const after = await readSession(session.id)
            expect(after?.isArchived).toBe(false)
            expect(after?.pinnedAt).toBeNull()
            expect(after?.updatedAt.getTime()).toBe(session.updatedAt.getTime())
        })

        it('archive twice and unarchive twice are both fine', async () => {
            const session = await seed()
            expect((await as(owner.token).patch(`/session/${session.id}/archive`)).status).toBe(200)
            expect((await as(owner.token).patch(`/session/${session.id}/archive`)).status).toBe(200)
            expect((await as(owner.token).patch(`/session/${session.id}/unarchive`)).status).toBe(
                200
            )
            expect((await as(owner.token).patch(`/session/${session.id}/unarchive`)).status).toBe(
                200
            )
            expect((await readSession(session.id))?.isArchived).toBe(false)
        })
    })

    describe('pin and unpin', () => {
        it('pin twice keeps the first pin time', async () => {
            const session = await seed()
            await as(owner.token).patch(`/session/${session.id}/pin`)
            const first = (await readSession(session.id))?.pinnedAt
            const res = await as(owner.token).patch(`/session/${session.id}/pin`)
            expect(res.status).toBe(200)
            expect((await readSession(session.id))?.pinnedAt?.getTime()).toBe(first?.getTime())
        })

        it('unpin of a session with no pin is fine and changes nothing', async () => {
            const session = await seed({ daysAgo: 2 })
            const res = await as(owner.token).patch(`/session/${session.id}/unpin`)
            expect(res.status).toBe(200)
            const after = await readSession(session.id)
            expect(after?.pinnedAt).toBeNull()
            expect(after?.updatedAt.getTime()).toBe(session.updatedAt.getTime())
        })

        it('pins of another user do not count toward the limit of 10', async () => {
            for (let i = 0; i < 10; i++) {
                await prisma.session.create({
                    data: { userId: stranger.userId, title: `p${i}`, pinnedAt: new Date() },
                })
            }
            const session = await seed()
            expect((await as(owner.token).patch(`/session/${session.id}/pin`)).status).toBe(200)
        })

        it('ten pins at once never pass the limit', async () => {
            for (let i = 0; i < 8; i++) await seed({ pinnedAt: new Date() })
            const free = await Promise.all(Array.from({ length: 6 }, () => seed()))

            const results = await Promise.all(
                free.map((session) => as(owner.token).patch(`/session/${session.id}/pin`))
            )

            expect(results.filter((res) => res.status === 200)).toHaveLength(2)
            expect(results.filter((res) => res.status === 409)).toHaveLength(4)
            expect(
                await prisma.session.count({
                    where: { userId: owner.userId, pinnedAt: { not: null } },
                })
            ).toBe(10)
        })
    })

    describe('archive merged and its undo', () => {
        it('with nothing merged archives nothing', async () => {
            await seed({ prNumber: 1, prState: 'open' })
            const res = await as(owner.token).post('/session/archive-merged')
            expect(res.status).toBe(200)
            expect(res.body.data).toEqual({ sessionIds: [], pins: [] })
        })

        it('keeps the updated time of the sessions it archives', async () => {
            const merged = await seed({ prNumber: 1, prState: 'merged', daysAgo: 6 })
            await as(owner.token).post('/session/archive-merged')
            const after = await readSession(merged.id)
            expect(after?.isArchived).toBe(true)
            expect(after?.updatedAt.getTime()).toBe(merged.updatedAt.getTime())
        })

        it('a pin time in the future from the undo is saved as now at the latest', async () => {
            const session = await seed({ isArchived: true })
            const future = new Date(Date.now() + 365 * 86_400_000)

            const res = await as(owner.token).post('/session/unarchive', {
                sessionIds: [session.id],
                pins: [{ sessionId: session.id, pinnedAt: future.toISOString() }],
            })

            expect(res.status).toBe(200)
            const pinnedAt = (await readSession(session.id))?.pinnedAt
            expect(pinnedAt).not.toBeNull()
            expect(pinnedAt!.getTime()).toBeLessThanOrEqual(Date.now())
        })

        it('a past pin time from the undo is kept as sent', async () => {
            const session = await seed({ isArchived: true })
            const past = new Date('2026-03-01T08:00:00Z')
            await as(owner.token).post('/session/unarchive', {
                sessionIds: [session.id],
                pins: [{ sessionId: session.id, pinnedAt: past.toISOString() }],
            })
            expect((await readSession(session.id))?.pinnedAt?.toISOString()).toBe(
                past.toISOString()
            )
        })

        const bad: Array<[string, unknown]> = [
            ['no ids', {}],
            ['an empty id list', { sessionIds: [] }],
            ['an id that is not a uuid', { sessionIds: ['nope'] }],
            [
                'a pin without a date',
                {
                    sessionIds: ['00000000-0000-4000-8000-000000000000'],
                    pins: [{ sessionId: '00000000-0000-4000-8000-000000000000', pinnedAt: 'soon' }],
                },
            ],
        ]
        for (const [name, body] of bad) {
            it(`bulk unarchive refuses ${name} (400)`, async () => {
                const res = await as(owner.token).post('/session/unarchive', body as object)
                expect(res.status).toBe(400)
            })
        }

        it('bulk unarchive of sessions that are not archived changes nothing', async () => {
            const session = await seed()
            const res = await as(owner.token).post('/session/unarchive', {
                sessionIds: [session.id],
            })
            expect(res.status).toBe(200)
            expect(res.body.data).toEqual({ sessionIds: [] })
        })
    })

    describe('pull requests and _ in names', () => {
        it('the pull requests search reads % and _ as plain characters', async () => {
            const match = await seed({ prNumber: 1, prTitle: 'drop user_id column' })
            await seed({ prNumber: 2, prTitle: 'drop userXid column', daysAgo: 1 })

            const res = await as(owner.token).get('/session/pull-requests?search=user_id')

            expect(res.status).toBe(200)
            expect(res.body.data.pullRequests.map((row: any) => row.sessionId)).toEqual([match.id])
        })

        it('a webhook for my_repo leaves the same pull request number of myXrepo alone', async () => {
            const target = await seed({
                githubRepoOwner: 'acme',
                githubRepoName: 'my_repo',
                prNumber: 3,
                prState: 'open',
            })
            const lookalike = await prisma.session.create({
                data: {
                    userId: stranger.userId,
                    githubRepoOwner: 'acme',
                    githubRepoName: 'myXrepo',
                    prNumber: 3,
                    prState: 'open',
                },
            })

            const result = await sessionService.applyPullRequestEvent({
                gitProvider: 'GITHUB',
                repoOwner: 'ACME',
                repoName: 'My_Repo',
                number: 3,
                state: 'closed',
            })

            expect(result).toEqual({ updated: 1 })
            expect((await readSession(target.id))?.prState).toBe('closed')
            expect((await readSession(lookalike.id))?.prState).toBe('open')
        })
    })

    describe('GET /session/counts', () => {
        it('counts running (starting too), open pull requests and merged idle sessions', async () => {
            await seed({ vmStatus: 'PROVISIONING' })
            await seed({ vmStatus: 'RUNNING' })
            await seed({ vmStatus: 'STOPPED' })
            await seed({ prNumber: 1, prState: 'open' })
            await seed({ prNumber: 2, prState: 'draft' })
            await seed({ prNumber: 3, prState: null })
            await seed({ prNumber: 4, prState: 'closed' })
            await seed({ prNumber: 5, prState: 'merged' })
            // merged, but the agent still works: not for "Archive merged"
            await seed({ prNumber: 6, prState: 'merged', vmStatus: 'RUNNING' })
            // archived rows count for nothing
            await seed({ isArchived: true, vmStatus: 'RUNNING', prNumber: 7, prState: 'open' })

            const res = await as(owner.token).get('/session/counts')

            expect(res.status).toBe(200)
            expect(res.body.data).toEqual({
                running: 3,
                needsAnswer: 0,
                needsYou: 3,
                openPullRequests: 3,
                merged: 1,
            })
        })

        it('counts sessions that wait for an answer, and needs you counts each session once', async () => {
            await seed({ vmStatus: 'RUNNING' })
            // waits and runs: one session in needsYou
            await seed({ vmStatus: 'RUNNING', pendingQuestionAt: new Date() })
            // a spend limit stops the run and waits for an answer
            await seed({ vmStatus: 'STOPPED', pendingQuestionAt: new Date() })
            await seed({ vmStatus: 'STOPPED' })
            // archived rows count for nothing
            await seed({ isArchived: true, pendingQuestionAt: new Date() })

            const res = await as(owner.token).get('/session/counts')

            expect(res.status).toBe(200)
            expect(res.body.data).toMatchObject({ running: 2, needsAnswer: 2, needsYou: 3 })
        })

        it('archive merged leaves the merged count at zero', async () => {
            await seed({ prNumber: 5, prState: 'merged' })
            expect((await as(owner.token).get('/session/counts')).body.data.merged).toBe(1)
            await as(owner.token).post('/session/archive-merged')
            expect((await as(owner.token).get('/session/counts')).body.data.merged).toBe(0)
        })
    })

    describe('GET /session/facets', () => {
        it('drops blank tags and lists each repository once in any case', async () => {
            await seed({ tags: ['ui'], githubRepoOwner: 'Acme', githubRepoName: 'Web' })
            await seed({ tags: ['ui'], githubRepoOwner: 'acme', githubRepoName: 'web' })
            await seed({ tags: [''] })

            const res = await as(owner.token).get('/session/facets')

            expect(res.status).toBe(200)
            expect(res.body.data.tags).toEqual(['ui'])
            expect(res.body.data.repos).toHaveLength(1)
            expect(res.body.data.repos[0].toLowerCase()).toBe('acme/web')
        })
    })

    describe('DELETE /session/:id', () => {
        it('deletes the session with its messages, and a second delete is a 404', async () => {
            const session = await seed()
            await addMessage(session.id, 'USER', 'hello', 1)

            const res = await as(owner.token).delete(`/session/${session.id}`)

            expect(res.status).toBe(200)
            expect(await readSession(session.id)).toBeNull()
            expect(await prisma.message.count({ where: { sessionId: session.id } })).toBe(0)
            expect((await as(owner.token).delete(`/session/${session.id}`)).status).toBe(404)
        })

        it('a session without a sandbox queues no stop', async () => {
            const session = await seed()
            await as(owner.token).delete(`/session/${session.id}`)
            expect(queued).toEqual([])
        })

        it('a sandbox of unknown status is stopped to be safe', async () => {
            const session = await seed({ vmId: `vm-unknown-${stamp}`, sandboxStatus: null })
            await as(owner.token).delete(`/session/${session.id}`)
            expect(queued.map((job) => job.data.action)).toEqual(['stop'])
        })

        it('a paused sandbox is stopped too', async () => {
            const session = await seed({ vmId: `vm-paused-${stamp}`, sandboxStatus: 'PAUSED' })
            await as(owner.token).delete(`/session/${session.id}`)
            expect(queued).toEqual([
                {
                    name: 'sandbox_control',
                    data: {
                        taskType: 'sandbox_control',
                        action: 'stop',
                        sessionId: session.id,
                        sandboxId: `vm-paused-${stamp}`,
                    },
                },
            ])
        })

        it('leaves the other sessions alone', async () => {
            const keep = await seed({ title: 'keep' })
            const drop = await seed({ title: 'drop' })
            await as(owner.token).delete(`/session/${drop.id}`)
            expect(await listIds()).toEqual([keep.id])
        })
    })

    describe('DELETE /session (delete all)', () => {
        it('needs the typed confirm word (400) and deletes nothing without it', async () => {
            await seed()
            for (const body of [{}, { confirm: 'yes' }, { confirm: 'DELETE' }]) {
                const res = await as(owner.token).delete('/session', body)
                expect(res.status).toBe(400)
            }
            expect(await prisma.session.count({ where: { userId: owner.userId } })).toBe(1)
        })

        it("deletes every session of the user, archived ones too, and none of another user's", async () => {
            await seed()
            await seed({ isArchived: true })
            const theirs = await prisma.session.create({
                data: { userId: stranger.userId, title: 'theirs' },
            })

            const res = await as(owner.token).delete('/session', { confirm: 'delete' })

            expect(res.status).toBe(200)
            expect(res.body.data).toEqual({ deleted: 2, sandboxesStopped: 0 })
            expect(await prisma.session.count({ where: { userId: owner.userId } })).toBe(0)
            expect(await readSession(theirs.id)).not.toBeNull()
            expect(await listIds()).toEqual([])
        })
    })

    describe('previews do not change the Running status', () => {
        it('starting a preview leaves a stopped session out of Running', async () => {
            const session = await seed({ vmStatus: 'STOPPED' })

            const res = await as(owner.token).post('/runtime/previews/start', {
                projectId: session.id,
            })

            expect(res.status).toBe(200)
            expect((await readSession(session.id))?.vmStatus).toBe('STOPPED')
            expect((await as(owner.token).get('/session/counts')).body.data.running).toBe(0)
        })

        it('closing a preview leaves a working run as Running', async () => {
            const session = await seed({ vmStatus: 'RUNNING' })
            await as(owner.token).post('/runtime/previews/start', { projectId: session.id })

            const res = await as(owner.token).delete(`/runtime/previews/${session.id}`)

            expect(res.status).toBe(200)
            expect((await readSession(session.id))?.vmStatus).toBe('RUNNING')
            expect(await listIds('vmStatus=running')).toEqual([session.id])
        })
    })
})
