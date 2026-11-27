import crypto from 'crypto'

import { prisma } from '@december/database'
import { describe, it, expect, afterAll, afterEach, beforeAll, beforeEach } from 'bun:test'
import request from 'supertest'

import app from '../../src/app'
import { env } from '../../src/env'
import { sessionRepository } from '../../src/modules/session/session.repository'
import {
    PULL_REQUEST_REFRESH_TIMING,
    encodePullRequestCursor,
} from '../../src/modules/session/session.utils'
import { appCache } from '../../src/shared/cache'
import { authCookieToken, cleanupTestUser, getRandomIP, signInWithEmailCode } from '../helpers'

import type { Prisma } from '@december/database'

// the server code of the Pull requests page: GET /session/pull-requests (rows, filters,
// search, sorts, cursor pages, the Open count), the facets of its filter menu, the read of
// stale states from the host, the pull_request webhook, and GET /session/:id/pull-requests
describe('Pull requests page server', () => {
    const stamp = Date.now()
    const ownerEmail = `prs-owner-${stamp}@example.com`
    const otherEmail = `prs-other-${stamp}@example.com`
    // repositories only this file uses, so the webhook touches no other rows
    const repoOwner = `prs-acme-${stamp}`

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
    })
    const list = (query: Record<string, string | number> = {}, token = ownerToken) =>
        as(token).get('/session/pull-requests').query(query)
    const idsOf = (res: request.Response): string[] =>
        res.body.data.pullRequests.map((row: { sessionId: string }) => row.sessionId)
    const rowOf = (res: request.Response, id: string) =>
        res.body.data.pullRequests.find((row: { sessionId: string }) => row.sessionId === id)

    let minute = 0
    /** a session with a pull request; each one a minute after the one before */
    const makePr = async (data: Partial<Prisma.SessionUncheckedCreateInput> = {}) => {
        minute += 1
        const at = new Date(Date.UTC(2026, 0, 1, 0, minute))
        return prisma.session.create({
            data: {
                userId: ownerId,
                title: `session ${minute}`,
                createdAt: at,
                updatedAt: at,
                githubRepoOwner: repoOwner,
                githubRepoName: 'web',
                prNumber: minute,
                prState: 'open',
                prOpenedAt: at,
                prUpdatedAt: at,
                // checked just now, so the read of the list does not ask the host
                prCheckedAt: new Date(),
                ...data,
            },
        })
    }
    const at = (day: number, hour = 0) => new Date(Date.UTC(2026, 1, day, hour))

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
    const prPayload = (
        number: number,
        repository: Record<string, unknown>,
        pr: Record<string, unknown> = {}
    ) => ({
        action: 'edited',
        repository: { name: 'web', owner: { login: repoOwner }, ...repository },
        pull_request: {
            number,
            title: 'feat: from the webhook',
            state: 'open',
            draft: false,
            merged_at: null,
            closed_at: null,
            created_at: '2026-01-03T10:00:00Z',
            updated_at: '2026-03-01T10:00:00Z',
            ...pr,
        },
    })

    beforeAll(async () => {
        const owner = await prisma.user.create({
            data: { email: ownerEmail, name: 'PRs Owner', emailVerified: true },
        })
        ownerId = owner.id
        const other = await prisma.user.create({
            data: { email: otherEmail, name: 'PRs Other', emailVerified: true },
        })
        otherId = other.id
        ownerToken = authCookieToken(await signInWithEmailCode(app, ownerEmail))
        otherToken = authCookieToken(await signInWithEmailCode(app, otherEmail))
    })

    beforeEach(async () => {
        await prisma.session.deleteMany({ where: { userId: { in: [ownerId, otherId] } } })
        await prisma.pullRequestSettings.deleteMany({ where: { userId: ownerId } })
        await prisma.user.update({ where: { id: ownerId }, data: { githubToken: null } })
        // the rows are written straight to the database: the cached lists of the user go
        await appCache.delPattern(appCache.key('sessions', 'recent', ownerId, '*'))
        await appCache.delPattern(appCache.key('sessions', 'recent', otherId, '*'))
    })

    afterAll(async () => {
        await cleanupTestUser({ email: ownerEmail })
        await cleanupTestUser({ email: otherEmail })
    })

    describe('who can read', () => {
        it('needs a signed-in user', async () => {
            const res = await request(app)
                .get('/api/v1/session/pull-requests')
                .set('x-forwarded-for', getRandomIP())
            expect(res.status).toBe(401)
        })

        it('lists only the pull requests of the user', async () => {
            const mine = await makePr()
            await makePr({ userId: otherId })
            const res = await list()
            expect(res.status).toBe(200)
            expect(idsOf(res)).toEqual([mine.id])
            expect((await list({}, otherToken)).body.data.pullRequests).toHaveLength(1)
        })

        it('a cursor made from another user row shows no row of that user', async () => {
            await makePr({ userId: otherId })
            const theirs = await makePr({ userId: otherId })
            const cursor = encodePullRequestCursor({
                sortBy: 'updatedAt',
                sortOrder: 'desc',
                value: theirs.updatedAt.toISOString(),
                fallback: null,
                id: theirs.id,
            })
            const res = await list({ sortBy: 'updatedAt', cursor })
            expect(res.status).toBe(200)
            expect(res.body.data.pullRequests).toEqual([])
        })

        it('the filter menu lists only the repositories and tags of the user', async () => {
            await makePr({ githubRepoName: 'mine', tags: ['mine-tag'] })
            await makePr({ userId: otherId, githubRepoName: 'theirs', tags: ['their-tag'] })
            const res = await as(ownerToken).get('/session/facets?hasPr=true')
            expect(res.body.data.repos).toEqual([`${repoOwner}/mine`])
            expect(res.body.data.tags).toEqual(['mine-tag'])
        })

        it('the pull request of one session: only for its user', async () => {
            const theirs = await makePr({ userId: otherId })
            const res = await as(ownerToken).get(`/session/${theirs.id}/pull-requests`)
            expect(res.status).toBe(404)
            const bad = await as(ownerToken).get('/session/not-a-uuid/pull-requests')
            expect(bad.status).toBe(400)
        })
    })

    describe('bad requests', () => {
        const cursorFor = (sortBy: string, sortOrder: string) =>
            encodePullRequestCursor({
                sortBy: sortBy as any,
                sortOrder: sortOrder as any,
                value: '2026-01-01T00:00:00.000Z',
                fallback:
                    sortBy === 'prOpenedAt' || sortBy === 'prUpdatedAt'
                        ? '2026-01-01T00:00:00.000Z'
                        : null,
                id: crypto.randomUUID(),
            })

        it.each([
            ['an unknown state', { state: 'gone' }],
            ['too many states', { state: 'open,open,open,open,open' }],
            ['a page of 0', { page: 0 }],
            ['a page that is not a number', { page: 'abc' }],
            ['a page past the safe numbers', { page: '1e300' }],
            ['a limit of 0', { limit: 0 }],
            ['a limit over 100', { limit: 101 }],
            ['a search over 200 characters', { search: 'x'.repeat(201) }],
            ['a tag over 30 characters', { tag: 't'.repeat(31) }],
            ['a repository over 200 characters', { repo: 'r'.repeat(201) }],
            ['an unknown sort', { sortBy: 'userId' }],
            ['an unknown order', { sortOrder: 'sideways' }],
            ['a cursor that is not one', { cursor: 'nope' }],
            ['a cursor over 600 characters', { cursor: 'a'.repeat(601) }],
        ])('refuses %s', async (_name, query) => {
            const res = await list(query as Record<string, string | number>)
            expect(res.status).toBe(400)
        })

        it('refuses a cursor made for another sort or order', async () => {
            const forNewest = cursorFor('prOpenedAt', 'desc')
            expect((await list({ sortBy: 'prUpdatedAt', cursor: forNewest })).status).toBe(400)
            expect(
                (await list({ sortBy: 'prOpenedAt', sortOrder: 'asc', cursor: forNewest })).status
            ).toBe(400)
            // no sort sent is updatedAt, desc
            expect((await list({ cursor: cursorFor('updatedAt', 'desc') })).status).toBe(200)
            expect((await list({ cursor: cursorFor('updatedAt', 'asc') })).status).toBe(400)
        })

        it('refuses the same field twice', async () => {
            const res = await as(ownerToken).get('/session/pull-requests?search=a&search=b')
            expect(res.status).toBe(400)
        })

        it('a page past the end is empty, not an error', async () => {
            await makePr()
            const res = await list({ page: 99_999_999 })
            expect(res.status).toBe(200)
            expect(res.body.data.pullRequests).toEqual([])
            expect(res.body.data.pagination.nextCursor).toBeNull()
        })
    })

    describe('which sessions are rows', () => {
        it('a session with no pull request, or a search session, is no row', async () => {
            const row = await makePr()
            await prisma.session.create({ data: { userId: ownerId, title: 'no pr' } })
            await makePr({ type: 'SEARCH' })
            expect(idsOf(await list())).toEqual([row.id])
        })

        it('an archived session is a row only when its pull request is merged or closed', async () => {
            const open = await makePr({ isArchived: true, prState: 'open' })
            const draft = await makePr({ isArchived: true, prState: 'draft' })
            const noState = await makePr({ isArchived: true, prState: null })
            const merged = await makePr({ isArchived: true, prState: 'merged' })
            const closed = await makePr({ isArchived: true, prState: 'closed' })
            const ids = idsOf(await list())
            expect(ids).toContain(merged.id)
            expect(ids).toContain(closed.id)
            for (const hidden of [open, draft, noState]) expect(ids).not.toContain(hidden.id)

            // isArchived asks for one side only
            const archived = idsOf(await list({ isArchived: 'true' }))
            expect(archived.sort()).toEqual(
                [open.id, draft.id, noState.id, merged.id, closed.id].sort()
            )
            expect(await list({ isArchived: 'false' }).then(idsOf)).toEqual([])
        })
    })

    describe('state filter', () => {
        it('keeps the asked states; a row with no state is open', async () => {
            const open = await makePr({ prState: 'open' })
            const noState = await makePr({ prState: null })
            const draft = await makePr({ prState: 'draft' })
            const merged = await makePr({ prState: 'merged' })
            const closed = await makePr({ prState: 'closed' })
            const sorted = (res: request.Response) => idsOf(res).sort()

            expect(sorted(await list({ state: 'open' }))).toEqual([open.id, noState.id].sort())
            expect(sorted(await list({ state: 'draft' }))).toEqual([draft.id])
            expect(sorted(await list({ state: 'open,draft' }))).toEqual(
                [open.id, noState.id, draft.id].sort()
            )
            expect(sorted(await list({ state: 'merged, closed' }))).toEqual(
                [merged.id, closed.id].sort()
            )
            expect(sorted(await list({ state: '' }))).toHaveLength(5)
            expect(rowOf(await list(), noState.id).prState).toBe('open')
        })
    })

    describe('repository and tag filters', () => {
        it('finds a repository by owner/name or by name, in any case', async () => {
            const web = await makePr({ githubRepoName: 'web' })
            await makePr({ githubRepoName: 'api' })
            await makePr({ githubRepoOwner: `${repoOwner}-other`, githubRepoName: 'web' })

            expect(idsOf(await list({ repo: `${repoOwner}/web` }))).toEqual([web.id])
            expect(idsOf(await list({ repo: `${repoOwner.toUpperCase()}/WEB` }))).toEqual([web.id])
            expect(idsOf(await list({ repo: 'web' }))).toHaveLength(2)
        })

        it('an underscore in the name is no wildcard', async () => {
            const exact = await makePr({ githubRepoName: 'my_repo' })
            await makePr({ githubRepoName: 'myXrepo' })
            expect(idsOf(await list({ repo: `${repoOwner}/my_repo` }))).toEqual([exact.id])
        })

        it('finds an old row that knows the repository only by its link', async () => {
            const old = await makePr({
                githubRepoOwner: null,
                githubRepoName: null,
                repoUrl: `https://github.com/${repoOwner}/legacy.git`,
            })
            expect(idsOf(await list({ repo: `${repoOwner}/legacy` }))).toEqual([old.id])
        })

        it('a tag matches exactly', async () => {
            const bug = await makePr({ tags: ['bug', 'ui'] })
            await makePr({ tags: ['bugs'] })
            expect(idsOf(await list({ tag: 'bug' }))).toEqual([bug.id])
            expect(idsOf(await list({ tag: 'BUG' }))).toEqual([])
        })
    })

    describe('search', () => {
        it('matches the session title, the pull request title, the branch and the repository', async () => {
            const byTitle = await makePr({ title: 'Fix the Login loop' })
            const byPrTitle = await makePr({ prTitle: 'feat: Dark Mode' })
            const byBranch = await makePr({ prBranch: 'december/billing-fix' })
            const byRepo = await makePr({ githubRepoName: 'searchable-repo' })
            await makePr({ title: 'unrelated' })

            expect(idsOf(await list({ search: 'login LOOP' }))).toEqual([byTitle.id])
            expect(idsOf(await list({ search: 'dark mode' }))).toEqual([byPrTitle.id])
            expect(idsOf(await list({ search: 'billing-fix' }))).toEqual([byBranch.id])
            expect(idsOf(await list({ search: 'searchable' }))).toEqual([byRepo.id])
            // spaces around the search do not count
            expect(idsOf(await list({ search: '   dark mode  ' }))).toEqual([byPrTitle.id])
        })

        it('finds a pull request by its number, with or without #', async () => {
            const row = await makePr({ prNumber: 4242, title: 'numbered' })
            expect(idsOf(await list({ search: '4242' }))).toEqual([row.id])
            expect(idsOf(await list({ search: '#4242' }))).toEqual([row.id])
        })

        it('a number too long for a pull request number matches text, not a 500', async () => {
            const row = await makePr({ prTitle: 'bump to 99999999999' })
            for (const search of ['99999999999', '#3000000000', '9'.repeat(200)]) {
                expect((await list({ search })).status).toBe(200)
            }
            expect(idsOf(await list({ search: '99999999999' }))).toEqual([row.id])
        })

        it('% _ and \\ are plain characters', async () => {
            const percent = await makePr({ title: 'raise to 50% faster' })
            await makePr({ title: 'raise to 500 faster' })
            const underscore = await makePr({ title: 'snake_case rename' })
            await makePr({ title: 'snakeXcase rename' })
            const slash = await makePr({ title: 'path a\\b' })

            expect(idsOf(await list({ search: '50%' }))).toEqual([percent.id])
            expect(idsOf(await list({ search: 'snake_case' }))).toEqual([underscore.id])
            expect(idsOf(await list({ search: 'a\\b' }))).toEqual([slash.id])
            expect((await list({ search: '\\' })).status).toBe(200)
        })

        it('# alone is no filter', async () => {
            await makePr()
            await makePr()
            expect(idsOf(await list({ search: '#' }))).toHaveLength(2)
        })
    })

    describe('sorts', () => {
        it('Last updated (prUpdatedAt): newest change first, rows with no date last by the session date', async () => {
            const old = await makePr({ prUpdatedAt: at(1), updatedAt: at(20) })
            const recent = await makePr({ prUpdatedAt: at(5), updatedAt: at(2) })
            const undatedNew = await makePr({ prUpdatedAt: null, updatedAt: at(9) })
            const undatedOld = await makePr({ prUpdatedAt: null, updatedAt: at(3) })

            const desc = await list({ sortBy: 'prUpdatedAt', sortOrder: 'desc' })
            expect(idsOf(desc)).toEqual([recent.id, old.id, undatedNew.id, undatedOld.id])
            expect(rowOf(desc, recent.id).prUpdatedAt).toBe(at(5).toISOString())

            const asc = await list({ sortBy: 'prUpdatedAt', sortOrder: 'asc' })
            // no date is still last
            expect(idsOf(asc)).toEqual([old.id, recent.id, undatedOld.id, undatedNew.id])
        })

        it('Newest and Oldest (prOpenedAt): rows with no opened date last by the session date', async () => {
            const a = await makePr({ prOpenedAt: at(2), createdAt: at(1) })
            const b = await makePr({ prOpenedAt: at(4), createdAt: at(1) })
            const c = await makePr({ prOpenedAt: null, createdAt: at(8) })
            const d = await makePr({ prOpenedAt: null, createdAt: at(7) })
            expect(idsOf(await list({ sortBy: 'prOpenedAt', sortOrder: 'desc' }))).toEqual([
                b.id,
                a.id,
                c.id,
                d.id,
            ])
            expect(idsOf(await list({ sortBy: 'prOpenedAt', sortOrder: 'asc' }))).toEqual([
                a.id,
                b.id,
                d.id,
                c.id,
            ])
        })

        it('the session dates sort too', async () => {
            const a = await makePr({ createdAt: at(1), updatedAt: at(9) })
            const b = await makePr({ createdAt: at(2), updatedAt: at(8) })
            expect(idsOf(await list({ sortBy: 'createdAt' }))).toEqual([b.id, a.id])
            expect(idsOf(await list({ sortBy: 'updatedAt' }))).toEqual([a.id, b.id])
            // no sort sent is the session updatedAt, newest first
            expect(idsOf(await list())).toEqual([a.id, b.id])
        })

        it('rows with the same time are ordered by id, the same on every read', async () => {
            const same = at(3)
            const rows = await Promise.all(
                [1, 2, 3, 4].map(() => makePr({ prUpdatedAt: same, updatedAt: same }))
            )
            const expected = rows.map((row) => row.id).sort((x, y) => (x < y ? 1 : -1))
            expect(idsOf(await list({ sortBy: 'prUpdatedAt' }))).toEqual(expected)
            expect(idsOf(await list({ sortBy: 'prUpdatedAt', sortOrder: 'asc' }))).toEqual(expected)
        })
    })

    describe('pages', () => {
        /** reads every page after the first with nextCursor, limit rows each */
        const walk = async (query: Record<string, string | number>, limit: number) => {
            const ids: string[] = []
            let res = await list({ ...query, limit })
            for (let guard = 0; guard < 50; guard++) {
                expect(res.status).toBe(200)
                ids.push(...idsOf(res))
                const next = res.body.data.pagination.nextCursor
                if (!next) return ids
                res = await list({ ...query, limit, cursor: next })
            }
            throw new Error('the pages never ended')
        }

        it('page numbers and the limit', async () => {
            for (let i = 0; i < 5; i++) await makePr()
            const first = await list({ limit: 2 })
            expect(first.body.data.pullRequests).toHaveLength(2)
            expect(first.body.data.pagination).toMatchObject({
                page: 1,
                limit: 2,
                total: 5,
                totalPages: 3,
            })
            expect(typeof first.body.data.pagination.nextCursor).toBe('string')
            const last = await list({ limit: 2, page: 3 })
            expect(last.body.data.pullRequests).toHaveLength(1)
            expect(last.body.data.pagination.nextCursor).toBeNull()
        })

        it('with no limit a page holds 50 rows', async () => {
            await makePr()
            expect((await list()).body.data.pagination.limit).toBe(50)
        })

        it('cursor pages give every row once, in the order of one big page, for every sort', async () => {
            // equal times, empty dates and equal fallbacks, so every tie rule is used
            const shapes: Array<Partial<Prisma.SessionUncheckedCreateInput>> = [
                { prUpdatedAt: at(1), prOpenedAt: at(1), createdAt: at(1), updatedAt: at(4) },
                { prUpdatedAt: at(1), prOpenedAt: at(1), createdAt: at(1), updatedAt: at(4) },
                { prUpdatedAt: at(2), prOpenedAt: null, createdAt: at(5), updatedAt: at(1) },
                { prUpdatedAt: null, prOpenedAt: null, createdAt: at(5), updatedAt: at(1) },
                { prUpdatedAt: null, prOpenedAt: at(3), createdAt: at(2), updatedAt: at(6) },
                { prUpdatedAt: at(3), prOpenedAt: at(3), createdAt: at(2), updatedAt: at(6) },
                { prUpdatedAt: null, prOpenedAt: null, createdAt: at(5), updatedAt: at(1) },
                { prUpdatedAt: at(2), prOpenedAt: at(1), createdAt: at(3), updatedAt: at(2) },
            ]
            for (const shape of shapes) await makePr(shape)

            for (const sortBy of ['prUpdatedAt', 'prOpenedAt', 'updatedAt', 'createdAt']) {
                for (const sortOrder of ['desc', 'asc']) {
                    const query = { sortBy, sortOrder }
                    const all = idsOf(await list({ ...query, limit: 100 }))
                    for (const limit of [1, 2, 3]) {
                        const walked = await walk(query, limit)
                        expect({ sortBy, sortOrder, limit, ids: walked }).toEqual({
                            sortBy,
                            sortOrder,
                            limit,
                            ids: all,
                        })
                    }
                }
            }
        })

        it('a row that moves up between two pages is not shown twice', async () => {
            const rows = []
            for (let day = 5; day >= 1; day--) rows.push(await makePr({ prUpdatedAt: at(day) }))
            const [a, b, c, d, e] = rows
            const first = await list({ sortBy: 'prUpdatedAt', limit: 2 })
            expect(idsOf(first)).toEqual([a.id, b.id])

            // the pull request of d changes: it is now the newest
            await prisma.session.update({ where: { id: d.id }, data: { prUpdatedAt: at(10) } })

            const second = await list({
                sortBy: 'prUpdatedAt',
                limit: 2,
                cursor: first.body.data.pagination.nextCursor,
            })
            // a page by number would have shown b again
            expect(idsOf(second)).toEqual([c.id, e.id])
            expect(second.body.data.pagination.nextCursor).toBeNull()
        })

        it('the next page still comes when the last row of the page before is gone', async () => {
            const rows = []
            for (let day = 4; day >= 1; day--) rows.push(await makePr({ prUpdatedAt: at(day) }))
            const first = await list({ sortBy: 'prUpdatedAt', limit: 2 })
            await prisma.session.delete({ where: { id: rows[1].id } })
            const second = await list({
                sortBy: 'prUpdatedAt',
                limit: 2,
                cursor: first.body.data.pagination.nextCursor,
            })
            expect(idsOf(second)).toEqual([rows[2].id, rows[3].id])
        })

        it('a cursor keeps the filters of the request', async () => {
            for (let i = 0; i < 3; i++) await makePr({ prState: 'merged' })
            for (let i = 0; i < 3; i++) await makePr({ prState: 'open' })
            const ids = await walk({ state: 'merged' }, 1)
            expect(ids).toHaveLength(3)
            const res = await list({ state: 'merged', limit: 100 })
            expect(ids).toEqual(idsOf(res))
        })
    })

    describe('what a row holds', () => {
        it('the saved details, and only a web link', async () => {
            const row = await makePr({
                githubRepoName: 'web',
                prTitle: 'feat: login page',
                prUrl: `https://github.com/${repoOwner}/web/pull/1`,
                prBranch: 'december/x',
                prAdditions: 12,
                prDeletions: 3,
                prState: 'draft',
                tags: ['auth'],
            })
            const bad = await makePr({ prUrl: 'javascript:alert(1)' })
            const res = await list()
            expect(rowOf(res, row.id)).toMatchObject({
                sessionId: row.id,
                gitProvider: 'GITHUB',
                repo: `${repoOwner}/web`,
                prNumber: row.prNumber,
                prState: 'draft',
                prTitle: 'feat: login page',
                prUrl: `https://github.com/${repoOwner}/web/pull/1`,
                prBranch: 'december/x',
                additions: 12,
                deletions: 3,
                tags: ['auth'],
            })
            expect(rowOf(res, bad.id).prUrl).toBeNull()
        })

        it('never names the base branch as the branch of the pull request', async () => {
            const row = await makePr({ branch: 'main', prBranch: null })
            expect(rowOf(await list(), row.id).prBranch).toBeNull()
        })

        it('the name alone when the owner is not known', async () => {
            const row = await makePr({ githubRepoOwner: null, githubRepoName: 'lonely' })
            expect(rowOf(await list(), row.id).repo).toBe('lonely')
        })
    })

    describe('the Open count', () => {
        it('comes with the first page, the same as /session/counts, whatever the filter', async () => {
            await makePr({ prState: 'open' })
            await makePr({ prState: null })
            await makePr({ prState: 'draft' })
            await makePr({ prState: 'merged' })
            await makePr({ prState: 'open', isArchived: true })
            await makePr({ prState: 'open', type: 'SEARCH' })

            const res = await list({ state: 'merged' })
            expect(res.body.data.openCount).toBe(3)
            const counts = await as(ownerToken).get('/session/counts')
            expect(counts.body.data.openPullRequests).toBe(3)
        })

        it('is not sent with a next page', async () => {
            await makePr()
            await makePr()
            const first = await list({ limit: 1 })
            const second = await list({ limit: 1, cursor: first.body.data.pagination.nextCursor })
            expect(second.body.data).not.toHaveProperty('openCount')
            expect((await list({ page: 2, limit: 1 })).body.data).not.toHaveProperty('openCount')
        })
    })

    describe('facets of the filter menu', () => {
        it('only repositories and tags that can show a row', async () => {
            await makePr({ githubRepoName: 'listed', tags: ['shown'] })
            await makePr({ githubRepoName: 'search-only', type: 'SEARCH', tags: ['search-tag'] })
            await makePr({
                githubRepoName: 'archived-open',
                isArchived: true,
                tags: ['archived-tag'],
            })
            await makePr({
                githubRepoName: 'archived-merged',
                isArchived: true,
                prState: 'merged',
                tags: ['merged-tag'],
            })
            await prisma.session.create({
                data: {
                    userId: ownerId,
                    title: 'no pr',
                    githubRepoOwner: repoOwner,
                    githubRepoName: 'no-pr',
                    tags: ['no-pr-tag'],
                },
            })

            const res = await as(ownerToken).get('/session/facets?hasPr=true')
            expect([...res.body.data.repos].sort()).toEqual(
                [`${repoOwner}/archived-merged`, `${repoOwner}/listed`].sort()
            )
            expect([...res.body.data.tags].sort()).toEqual(['merged-tag', 'shown'])
            // the Sessions page facets still list every session
            const all = await as(ownerToken).get('/session/facets')
            expect(all.body.data.repos).toContain(`${repoOwner}/no-pr`)
            expect(all.body.data.tags).toContain('no-pr-tag')
        })
    })

    describe('reading stale states from the host', () => {
        const realFetch = globalThis.fetch
        const timing = { ...PULL_REQUEST_REFRESH_TIMING }
        let githubCalls: string[] = []
        let answer: (url: string) => Promise<Response>
        const releases: Array<() => void> = []

        const hostPr = (number: number, fields: Record<string, unknown> = {}) =>
            new Response(
                JSON.stringify({
                    number,
                    html_url: `https://github.com/${repoOwner}/web/pull/${number}`,
                    title: 'feat: read from github',
                    state: 'open',
                    draft: false,
                    merged_at: null,
                    closed_at: null,
                    created_at: '2026-01-03T10:00:00Z',
                    updated_at: '2026-04-01T10:00:00Z',
                    additions: 51,
                    deletions: 7,
                    base: { repo: { id: 777 } },
                    ...fields,
                }),
                { status: 200, headers: { 'Content-Type': 'application/json' } }
            )
        /** a host that does not answer until the test lets it */
        const hangingHost = () => () =>
            new Promise<Response>((resolve) => {
                releases.push(() => resolve(new Response('{}', { status: 404 })))
            })
        const stale = (data: Partial<Prisma.SessionUncheckedCreateInput> = {}) =>
            makePr({ prCheckedAt: new Date(Date.now() - 2 * 60 * 60 * 1000), ...data })

        beforeEach(async () => {
            githubCalls = []
            answer = async () => new Response('{}', { status: 404 })
            globalThis.fetch = (async (input: any, init?: RequestInit) => {
                const url = String(input)
                if (!url.startsWith('https://api.github.com')) return realFetch(input, init)
                githubCalls.push(url)
                return answer(url)
            }) as typeof fetch
            await prisma.user.update({
                where: { id: ownerId },
                data: { githubToken: 'gh-test-token' },
            })
        })

        afterEach(async () => {
            for (const release of releases.splice(0)) release()
            // the refreshes that ended in the background finish their writes
            await new Promise((resolve) => setTimeout(resolve, 50))
            Object.assign(PULL_REQUEST_REFRESH_TIMING, timing)
        })

        afterAll(() => {
            globalThis.fetch = realFetch
        })

        it('saves the state, the title, the link, the counts and the last change', async () => {
            const row = await stale()
            answer = async () =>
                hostPr(row.prNumber as number, {
                    state: 'closed',
                    merged_at: '2026-04-01T10:00:00Z',
                    closed_at: '2026-04-01T10:00:00Z',
                })
            const res = await list()
            expect(rowOf(res, row.id)).toMatchObject({
                prState: 'merged',
                prTitle: 'feat: read from github',
                additions: 51,
                deletions: 7,
                prUpdatedAt: '2026-04-01T10:00:00.000Z',
                prMergedAt: '2026-04-01T10:00:00.000Z',
            })
            const saved = await prisma.session.findUnique({ where: { id: row.id } })
            // a state read does not move the session in the Sessions list
            expect(saved?.updatedAt.toISOString()).toBe(row.updatedAt.toISOString())
            // the repository id is saved only when December opens the pull request
            expect(saved?.githubRepoId).toBeNull()
        })

        it('a merge found here archives the session, unless the user turned that off', async () => {
            const row = await stale()
            answer = async () =>
                hostPr(row.prNumber as number, { merged_at: '2026-04-01T10:00:00Z' })
            await list()
            expect((await prisma.session.findUnique({ where: { id: row.id } }))?.isArchived).toBe(
                true
            )

            await prisma.pullRequestSettings.create({
                data: { userId: ownerId, archiveOnMerge: false },
            })
            const kept = await stale()
            answer = async () =>
                hostPr(kept.prNumber as number, { merged_at: '2026-04-01T10:00:00Z' })
            await list()
            expect((await prisma.session.findUnique({ where: { id: kept.id } }))?.isArchived).toBe(
                false
            )
        })

        it('a pull request the host refuses is marked checked and keeps its state', async () => {
            const row = await stale()
            await list()
            const saved = await prisma.session.findUnique({ where: { id: row.id } })
            expect(saved?.prState).toBe('open')
            expect(saved?.prCheckedAt?.getTime()).toBeGreaterThan(Date.now() - 60_000)
            // checked: the next read does not ask again
            await list()
            expect(githubCalls).toHaveLength(1)
        })

        it('with no token the host is not asked, and the row is marked checked', async () => {
            await prisma.user.update({ where: { id: ownerId }, data: { githubToken: null } })
            const row = await stale()
            await list()
            expect(githubCalls).toHaveLength(0)
            const saved = await prisma.session.findUnique({ where: { id: row.id } })
            expect(saved?.prCheckedAt?.getTime()).toBeGreaterThan(Date.now() - 60_000)
        })

        it('only open and draft pull requests are asked, at most 10 per read', async () => {
            for (let i = 0; i < 12; i++) await stale()
            await stale({ prState: 'merged' })
            await stale({ prState: 'closed' })
            await list()
            expect(githubCalls).toHaveLength(10)
            await list()
            expect(githubCalls).toHaveLength(12)
        })

        it('the next pages do not ask the host', async () => {
            await stale()
            await stale()
            const first = await list({ limit: 1, page: 2 })
            expect(first.status).toBe(200)
            expect(githubCalls).toHaveLength(0)

            const cursor = encodePullRequestCursor({
                sortBy: 'updatedAt',
                sortOrder: 'desc',
                value: new Date().toISOString(),
                fallback: null,
                id: crypto.randomUUID(),
            })
            expect((await list({ cursor })).status).toBe(200)
            expect(githubCalls).toHaveLength(0)

            await list()
            expect(githubCalls).toHaveLength(2)
        })

        it('two reads at the same time ask the host once', async () => {
            await stale()
            const [a, b, c] = await Promise.all([list(), list(), list()])
            for (const res of [a, b, c]) expect(res.status).toBe(200)
            expect(githubCalls).toHaveLength(1)
        })

        it('a slow host does not hold the list: it answers after the wait', async () => {
            PULL_REQUEST_REFRESH_TIMING.waitMs = 100
            await stale()
            answer = hangingHost()
            const started = Date.now()
            const res = await list()
            expect(res.status).toBe(200)
            expect(Date.now() - started).toBeLessThan(2000)
            expect(res.body.data.pullRequests).toHaveLength(1)
        })

        it('a host that hangs holds the place of the next refresh only for a while', async () => {
            PULL_REQUEST_REFRESH_TIMING.waitMs = 50
            PULL_REQUEST_REFRESH_TIMING.lockMs = 300
            await stale()
            answer = hangingHost()

            await list()
            expect(githubCalls).toHaveLength(1)
            // the first refresh still hangs: this read joins it
            await list()
            expect(githubCalls).toHaveLength(1)

            await new Promise((resolve) => setTimeout(resolve, 400))
            // its place is free: a new refresh asks the host again
            await list()
            expect(githubCalls).toHaveLength(2)
        })
    })

    describe('the pull_request webhook', () => {
        it('a row with the repository id matches by it, also after the repository was renamed', async () => {
            const row = await makePr({ githubRepoId: '1001', githubRepoName: 'old-name' })
            const res = await sendWebhook(
                prPayload(row.prNumber as number, { id: 1001, name: 'new-name' })
            )
            expect(res.status).toBe(200)
            const saved = await prisma.session.findUnique({ where: { id: row.id } })
            expect(saved?.prTitle).toBe('feat: from the webhook')
            // the row follows the new name, so the read from the host finds it
            expect(saved?.githubRepoName).toBe('new-name')
            expect(saved?.prUpdatedAt?.toISOString()).toBe('2026-03-01T10:00:00.000Z')
        })

        it('another repository with the same name (a new one, after a rename) changes nothing', async () => {
            const row = await makePr({ githubRepoId: '1001' })
            await sendWebhook(
                prPayload(
                    row.prNumber as number,
                    { id: 2002 },
                    { state: 'closed', merged_at: '2026-03-01T10:00:00Z' }
                )
            )
            const saved = await prisma.session.findUnique({ where: { id: row.id } })
            expect(saved?.prState).toBe('open')
            expect(saved?.isArchived).toBe(false)
            expect(saved?.prTitle).toBeNull()
        })

        it('a row saved before the repository id matches by owner and name', async () => {
            const row = await makePr({ githubRepoId: null })
            await sendWebhook(
                prPayload(row.prNumber as number, {
                    id: 3003,
                    owner: { login: repoOwner.toUpperCase() },
                })
            )
            const saved = await prisma.session.findUnique({ where: { id: row.id } })
            expect(saved?.prTitle).toBe('feat: from the webhook')
        })

        it('an event with no repository id changes only rows saved before the id', async () => {
            const withId = await makePr({ githubRepoId: '1001' })
            const withoutId = await makePr({ githubRepoId: null, prNumber: withId.prNumber })
            const payload = prPayload(withId.prNumber as number, {})
            delete (payload.repository as Record<string, unknown>).id
            await sendWebhook(payload)
            expect(
                (await prisma.session.findUnique({ where: { id: withId.id } }))?.prTitle
            ).toBeNull()
            expect(
                (await prisma.session.findUnique({ where: { id: withoutId.id } }))?.prTitle
            ).toBe('feat: from the webhook')
        })

        it('an underscore in the name is no wildcard, and a GitLab row is left alone', async () => {
            const lookalike = await makePr({ githubRepoName: 'myXrepo' })
            const gitlab = await makePr({
                gitProvider: 'GITLAB',
                githubRepoName: 'my_repo',
                prNumber: lookalike.prNumber,
            })
            await sendWebhook(
                prPayload(lookalike.prNumber as number, { id: 4004, name: 'my_repo' })
            )
            for (const id of [lookalike.id, gitlab.id]) {
                expect((await prisma.session.findUnique({ where: { id } }))?.prTitle).toBeNull()
            }
        })

        it('keeps the session date, and saves now when the event has no change date', async () => {
            const row = await makePr({ githubRepoId: '5005' })
            const before = Date.now()
            await sendWebhook(
                prPayload(row.prNumber as number, { id: 5005 }, { updated_at: undefined })
            )
            const saved = await prisma.session.findUnique({ where: { id: row.id } })
            expect(saved?.updatedAt.toISOString()).toBe(row.updatedAt.toISOString())
            expect(saved?.prUpdatedAt?.getTime()).toBeGreaterThanOrEqual(before - 1000)
        })

        it('a merge archives the session once; a later event leaves an unarchived session alone', async () => {
            const row = await makePr({ githubRepoId: '6006' })
            const merged = prPayload(
                row.prNumber as number,
                { id: 6006 },
                { state: 'closed', merged_at: '2026-03-01T10:00:00Z' }
            )
            await sendWebhook(merged)
            expect((await prisma.session.findUnique({ where: { id: row.id } }))?.isArchived).toBe(
                true
            )
            await prisma.session.update({ where: { id: row.id }, data: { isArchived: false } })
            await sendWebhook(merged)
            expect((await prisma.session.findUnique({ where: { id: row.id } }))?.isArchived).toBe(
                false
            )
        })
    })

    describe('saving a pull request state while the session changes', () => {
        const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

        /**
         * runs `change` in a transaction that holds the session row, starts the state write
         * while it holds it, and lets the row go after a moment: the write reads the old row
         * and its update waits for the change, as when a message comes in at the same time
         */
        const writeWhileRowChanges = async (
            sessionId: string,
            change: (tx: Prisma.TransactionClient) => Promise<unknown>,
            data: Prisma.SessionUpdateManyMutationInput
        ) => {
            let write: ReturnType<typeof sessionRepository.updatePullRequestFields> | undefined
            await prisma.$transaction(async (tx) => {
                await change(tx)
                write = sessionRepository.updatePullRequestFields({ id: sessionId }, data)
                // the write reads the committed row, then waits on the lock
                await sleep(300)
            })
            return write as ReturnType<typeof sessionRepository.updatePullRequestFields>
        }

        it('a message that comes between the read and the write keeps its newer date', async () => {
            const row = await makePr({ updatedAt: at(1) })
            const newer = at(9)
            const written = await writeWhileRowChanges(
                row.id,
                (tx) =>
                    tx.$executeRaw`UPDATE "Session" SET "updatedAt" = ${newer} WHERE "id" = ${row.id}`,
                { prState: 'merged' }
            )
            expect(written).toEqual([{ id: row.id, userId: ownerId, previousState: 'open' }])
            const saved = await prisma.session.findUnique({ where: { id: row.id } })
            expect(saved?.prState).toBe('merged')
            // before the fix the write put back at(1), and the session fell down the list
            expect(saved?.updatedAt.toISOString()).toBe(newer.toISOString())
        })

        it('the state before the write is the newest one read', async () => {
            const row = await makePr({ updatedAt: at(1), prState: 'open' })
            const written = await writeWhileRowChanges(
                row.id,
                (tx) =>
                    tx.$executeRaw`UPDATE "Session" SET "updatedAt" = ${at(9)}, "prState" = 'draft' WHERE "id" = ${row.id}`,
                { prState: 'merged' }
            )
            expect(written[0]?.previousState).toBe('draft')
        })

        it('a session deleted between the read and the write is skipped', async () => {
            const row = await makePr()
            const written = await writeWhileRowChanges(
                row.id,
                (tx) => tx.$executeRaw`DELETE FROM "Session" WHERE "id" = ${row.id}`,
                { prState: 'merged' }
            )
            expect(written).toEqual([])
        })

        it('a write with no change in between keeps the session date', async () => {
            const row = await makePr({ updatedAt: at(3) })
            await sessionRepository.updatePullRequestFields({ id: row.id }, { prState: 'closed' })
            const saved = await prisma.session.findUnique({ where: { id: row.id } })
            expect(saved?.prState).toBe('closed')
            expect(saved?.updatedAt.toISOString()).toBe(at(3).toISOString())
        })
    })

    describe('the pull request of one session', () => {
        it('the saved pull request, with its host', async () => {
            const row = await makePr({
                prTitle: 'Add dark mode',
                prUrl: `https://github.com/${repoOwner}/web/pull/21`,
                prState: 'merged',
                prBranch: 'december/dark-mode',
                prAdditions: 40,
                prDeletions: 3,
                prOpenedAt: at(1),
                prUpdatedAt: at(2),
            })
            const res = await as(ownerToken).get(`/session/${row.id}/pull-requests`)
            expect(res.status).toBe(200)
            expect(res.body.data.pullRequest).toEqual({
                prNumber: row.prNumber,
                gitProvider: 'GITHUB',
                url: `https://github.com/${repoOwner}/web/pull/21`,
                title: 'Add dark mode',
                state: 'merged',
                headRef: 'december/dark-mode',
                diffSummary: { additions: 40, deletions: 3 },
                createdAt: at(1).toISOString(),
                updatedAt: at(2).toISOString(),
            })
        })

        it('no link that is not a web link, no GitLab counts, no base branch as the branch', async () => {
            const row = await makePr({
                gitProvider: 'GITLAB',
                prTitle: 'Fix login',
                prUrl: 'javascript:alert(1)',
                branch: 'main',
                prBranch: null,
                prAdditions: 0,
                prDeletions: 0,
                prOpenedAt: null,
                prUpdatedAt: null,
            })
            const res = await as(ownerToken).get(`/session/${row.id}/pull-requests`)
            expect(res.body.data.pullRequest).toEqual({
                prNumber: row.prNumber,
                gitProvider: 'GITLAB',
                title: 'Fix login',
                state: 'open',
                headRef: '',
            })
        })

        it('null for a session that opened none', async () => {
            const session = await prisma.session.create({ data: { userId: ownerId, title: 'x' } })
            const res = await as(ownerToken).get(`/session/${session.id}/pull-requests`)
            expect(res.body.data).toEqual({ pullRequest: null })
        })
    })
})
