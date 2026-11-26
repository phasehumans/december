import { prisma } from '@december/database'
import { describe, it, expect, afterAll, beforeAll, beforeEach } from 'bun:test'
import request from 'supertest'

import app from '../../src/app'
import { appCache } from '../../src/shared/cache'
import { cleanupTestUser, createSignedInUser, getRandomIP } from '../helpers'

import type { Prisma } from '@december/database'

// issue 641: the tag and repository filters of the sessions list, and the lists of
// repositories and tags for the sort and filter menu
describe('Sessions list filters and facets (#641)', () => {
    const stamp = Date.now()
    const ownerEmail = `listfilters-owner-${stamp}@example.com`
    const otherEmail = `listfilters-other-${stamp}@example.com`

    let ownerId: string
    let otherId: string
    let ownerToken: string
    let otherToken: string

    const get = (token: string, path: string, query: Record<string, string> = {}) =>
        request(app)
            .get(`/api/v1/session${path}`)
            .query(query)
            .set('x-forwarded-for', getRandomIP())
            .set('Authorization', `Bearer ${token}`)

    // each session gets its own minute, so "last updated first" has a known order
    let minute = 0
    const makeSession = async (
        userId: string,
        data: Partial<Prisma.SessionUncheckedCreateInput> = {}
    ) => {
        minute += 1
        const at = new Date(Date.UTC(2026, 0, 1, 0, minute))
        return prisma.session.create({
            data: { userId, title: `session ${minute}`, createdAt: at, updatedAt: at, ...data },
        })
    }

    const listIds = async (query: Record<string, string> = {}, token = ownerToken) => {
        const res = await get(token, '', query)
        expect(res.status).toBe(200)
        return res.body.data.sessions.map((s: { id: string }) => s.id) as string[]
    }

    beforeAll(async () => {
        const owner = await createSignedInUser({ email: ownerEmail, name: 'List Filters Owner' })
        ownerId = owner.userId
        ownerToken = owner.token
        const other = await createSignedInUser({ email: otherEmail, name: 'List Filters Other' })
        otherId = other.userId
        otherToken = other.token
    })

    beforeEach(async () => {
        await prisma.session.deleteMany({ where: { userId: { in: [ownerId, otherId] } } })
        // the rows changed without the service, so the lists cached for these users are old
        for (const userId of [ownerId, otherId]) {
            await appCache.delPattern(appCache.key('sessions', 'recent', userId, '*'))
        }
    })

    afterAll(async () => {
        if (ownerId) await cleanupTestUser({ id: ownerId })
        if (otherId) await cleanupTestUser({ id: otherId })
    })

    describe('tags and the list cache', () => {
        it('a tag list read first does not answer the full list', async () => {
            const plain = await makeSession(ownerId)
            const bug = await makeSession(ownerId, { tags: ['bug'] })

            expect(await listIds({ tags: 'bug' })).toEqual([bug.id])
            expect(await listIds()).toEqual([bug.id, plain.id])
            // and again, now that both are cached
            expect(await listIds({ tags: 'bug' })).toEqual([bug.id])
        })

        it('the full list read first does not answer a tag list', async () => {
            const plain = await makeSession(ownerId)
            const bug = await makeSession(ownerId, { tags: ['bug'] })
            const copy = await makeSession(ownerId, { tags: ['copy'] })

            expect(await listIds()).toEqual([copy.id, bug.id, plain.id])
            expect(await listIds({ tags: 'bug' })).toEqual([bug.id])
            expect(await listIds({ tags: 'copy' })).toEqual([copy.id])
            expect(await listIds()).toEqual([copy.id, bug.id, plain.id])
        })
    })

    describe('GET /session?repoName=', () => {
        const repo = (owner: string, name: string) => ({
            githubRepoOwner: owner,
            githubRepoName: name,
            repoUrl: `https://github.com/${owner}/${name}`,
        })

        it('a short name matches that repository under every owner', async () => {
            const acmeWeb = await makeSession(ownerId, repo('acme', 'web'))
            const betaWeb = await makeSession(ownerId, repo('beta', 'web'))
            await makeSession(ownerId, repo('acme', 'api'))
            await makeSession(ownerId)
            await makeSession(otherId, repo('acme', 'web'))

            expect(await listIds({ repoName: 'web' })).toEqual([betaWeb.id, acmeWeb.id])
            expect(await listIds({ repoName: 'WEB' })).toEqual([betaWeb.id, acmeWeb.id])
        })

        it('owner/name matches the owner and the name', async () => {
            const acmeWeb = await makeSession(ownerId, repo('acme', 'web'))
            await makeSession(ownerId, repo('beta', 'web'))
            await makeSession(ownerId, repo('acme', 'api'))
            // an old row: only the link was saved
            const linkOnly = await makeSession(ownerId, {
                repoUrl: 'https://github.com/acme/web.git',
            })
            // a gitlab project in a group: the owner has a slash
            const grouped = await makeSession(ownerId, {
                gitProvider: 'GITLAB',
                ...repo('acme/tools', 'importer'),
            })

            expect(await listIds({ repoName: 'acme/web' })).toEqual([linkOnly.id, acmeWeb.id])
            expect(await listIds({ repoName: 'Acme/Web' })).toEqual([linkOnly.id, acmeWeb.id])
            expect(await listIds({ repoName: 'acme/tools/importer' })).toEqual([grouped.id])
            expect(await listIds({ repoName: 'nobody/web' })).toEqual([])
        })

        it('each row has the owner and the name, so the web can match its repository', async () => {
            const withRepo = await makeSession(ownerId, repo('acme', 'web'))
            const noRepo = await makeSession(ownerId)

            const res = await get(ownerToken, '')
            const rows = res.body.data.sessions as Array<Record<string, unknown>>
            expect(rows.find((row) => row.id === withRepo.id)).toMatchObject({
                githubRepoOwner: 'acme',
                githubRepoName: 'web',
            })
            expect(rows.find((row) => row.id === noRepo.id)).toMatchObject({
                githubRepoOwner: null,
                githubRepoName: null,
            })
        })

        it('keeps paging and the other filters', async () => {
            const first = await makeSession(ownerId, repo('acme', 'web'))
            const tagged = await makeSession(ownerId, { ...repo('acme', 'web'), tags: ['bug'] })
            const archived = await makeSession(ownerId, {
                ...repo('acme', 'web'),
                isArchived: true,
            })
            const withPr = await makeSession(ownerId, { ...repo('acme', 'web'), prNumber: 7 })
            await makeSession(ownerId, { ...repo('acme', 'api'), tags: ['bug'], prNumber: 8 })

            const page2 = await get(ownerToken, '', {
                repoName: 'acme/web',
                isArchived: 'false',
                limit: '2',
                page: '2',
            })
            expect(page2.status).toBe(200)
            expect(page2.body.data.sessions.map((s: { id: string }) => s.id)).toEqual([first.id])
            expect(page2.body.data.pagination).toEqual({
                total: 3,
                page: 2,
                limit: 2,
                totalPages: 2,
            })

            expect(await listIds({ repoName: 'acme/web', tags: 'bug' })).toEqual([tagged.id])
            expect(await listIds({ repoName: 'acme/web', isArchived: 'true' })).toEqual([
                archived.id,
            ])
            expect(await listIds({ repoName: 'acme/web', hasPr: 'true' })).toEqual([withPr.id])
            expect(
                await listIds({
                    repoName: 'acme/web',
                    isArchived: 'false',
                    sortBy: 'createdAt',
                    sortOrder: 'asc',
                })
            ).toEqual([first.id, tagged.id, withPr.id])
        })

        it('is not cached, and rejects an empty name', async () => {
            const one = await makeSession(ownerId, repo('acme', 'web'))
            expect(await listIds({ repoName: 'acme/web' })).toEqual([one.id])

            // saved without the service, so no cache is cleared
            const two = await makeSession(ownerId, repo('acme', 'web'))
            expect(await listIds({ repoName: 'acme/web' })).toEqual([two.id, one.id])

            expect((await get(ownerToken, '', { repoName: ' ' })).status).toBe(400)
        })
    })

    describe('GET /session/facets', () => {
        const repo = (owner: string | null, name: string) => ({
            githubRepoOwner: owner,
            githubRepoName: name,
        })

        const facets = async (token = ownerToken) => {
            const res = await get(token, '/facets')
            expect(res.status).toBe(200)
            return res.body.data as { repos: string[]; tags: string[] }
        }

        it('needs a signed-in user', async () => {
            const res = await request(app)
                .get('/api/v1/session/facets')
                .set('x-forwarded-for', getRandomIP())
            expect(res.status).toBe(401)
        })

        it('is empty for a user with no sessions', async () => {
            expect(await facets()).toEqual({ repos: [], tags: [] })
        })

        it('lists each repository and tag of the user once, sorted by name', async () => {
            await makeSession(ownerId, { ...repo('beta', 'web'), tags: ['copy'] })
            await makeSession(ownerId, { ...repo('acme', 'web'), tags: ['bug'] })
            await makeSession(ownerId, { ...repo('acme', 'web'), tags: ['bug'] })
            // the same repository saved with other letters is still one repository
            await makeSession(ownerId, repo('Acme', 'Web'))
            // the owner is not known: the name alone
            await makeSession(ownerId, { ...repo(null, 'solo'), tags: ['Api'] })
            // an old row: only the link was saved
            await makeSession(ownerId, { repoUrl: 'https://github.com/acme/legacy.git' })
            await makeSession(ownerId)
            await makeSession(otherId, { ...repo('other', 'secret'), tags: ['private'] })

            expect(await facets()).toEqual({
                repos: ['acme/legacy', 'acme/web', 'beta/web', 'solo'],
                tags: ['Api', 'bug', 'copy'],
            })
            expect(await facets(otherToken)).toEqual({
                repos: ['other/secret'],
                tags: ['private'],
            })
        })

        it('reads archived sessions and sessions past the first page, not deleted ones', async () => {
            // the oldest session: 60 newer ones push it off the first page of the list
            await makeSession(ownerId, { ...repo('acme', 'old'), tags: ['first'] })
            await makeSession(ownerId, {
                ...repo('acme', 'shelved'),
                tags: ['done'],
                isArchived: true,
            })
            await makeSession(ownerId, {
                ...repo('acme', 'gone'),
                tags: ['removed'],
                deletedAt: new Date(),
            })
            await prisma.session.createMany({
                data: Array.from({ length: 60 }, (_, index) => ({
                    userId: ownerId,
                    title: `filler ${index}`,
                    githubRepoOwner: 'acme',
                    githubRepoName: 'web',
                    tags: ['bug'],
                })),
            })

            expect(await facets()).toEqual({
                repos: ['acme/old', 'acme/shelved', 'acme/web'],
                tags: ['bug', 'done', 'first'],
            })
        })

        it('hasPr keeps only the sessions that opened a pull request', async () => {
            await makeSession(ownerId, { ...repo('acme', 'web'), tags: ['bug'], prNumber: 7 })
            await makeSession(ownerId, { ...repo('acme', 'api'), tags: ['copy'] })

            const res = await get(ownerToken, '/facets', { hasPr: 'true' })
            expect(res.status).toBe(200)
            expect(res.body.data).toEqual({ repos: ['acme/web'], tags: ['bug'] })
            // the two answers do not share a cache entry
            expect(await facets()).toEqual({
                repos: ['acme/api', 'acme/web'],
                tags: ['bug', 'copy'],
            })
            expect((await get(ownerToken, '/facets', { hasPr: 'true' })).body.data).toEqual({
                repos: ['acme/web'],
                tags: ['bug'],
            })
        })

        it('is cached like the list, and a tag change, a new session and a delete clear it', async () => {
            await prisma.user.update({ where: { id: ownerId }, data: { creditBalance: 10_000 } })
            const session = await makeSession(ownerId, { ...repo('acme', 'web'), tags: ['bug'] })
            expect(await facets()).toEqual({ repos: ['acme/web'], tags: ['bug'] })

            // saved without the service: the cached answer stays
            await makeSession(ownerId, { ...repo('acme', 'api'), tags: ['copy'] })
            expect(await facets()).toEqual({ repos: ['acme/web'], tags: ['bug'] })

            const tagged = await request(app)
                .put(`/api/v1/session/${session.id}/tags`)
                .set('x-forwarded-for', getRandomIP())
                .set('Authorization', `Bearer ${ownerToken}`)
                .send({ tags: ['urgent'] })
            expect(tagged.status).toBe(200)
            expect(await facets()).toEqual({
                repos: ['acme/api', 'acme/web'],
                tags: ['copy', 'urgent'],
            })

            const created = await request(app)
                .post('/api/v1/session')
                .set('x-forwarded-for', getRandomIP())
                .set('Authorization', `Bearer ${ownerToken}`)
                .send({ repoUrl: 'https://github.com/acme/docs', title: 'docs run' })
            expect(created.status).toBe(201)
            expect((await facets()).repos).toEqual(['acme/api', 'acme/docs', 'acme/web'])

            const deleted = await request(app)
                .delete(`/api/v1/session/${created.body.data.session.id}`)
                .set('x-forwarded-for', getRandomIP())
                .set('Authorization', `Bearer ${ownerToken}`)
            expect(deleted.status).toBe(200)
            expect((await facets()).repos).toEqual(['acme/api', 'acme/web'])
        })
    })
    // bad query values are a 400 with a reason, never a 500 from the database
    describe('refused input', () => {
        it('an unknown vmStatus is a 400', async () => {
            const res = await get(ownerToken, '', { vmStatus: 'foo' })
            expect(res.status).toBe(400)
        })

        it('a search longer than 200 characters is a 400', async () => {
            const res = await get(ownerToken, '', { search: 'a'.repeat(201) })
            expect(res.status).toBe(400)
        })

        it('vmStatus=running still lists working sessions', async () => {
            const working = await makeSession(ownerId, { vmStatus: 'RUNNING' })
            await makeSession(ownerId, { vmStatus: 'STOPPED' })
            expect(await listIds({ vmStatus: 'running' })).toEqual([working.id])
        })

        it('message paging refuses a limit that is not a number or over 100', async () => {
            const session = await makeSession(ownerId)
            for (const query of [{ limit: 'abc' }, { limit: '101' }, { beforeSequence: '-1' }]) {
                const res = await get(ownerToken, `/${session.id}/messages`, query)
                expect(res.status).toBe(400)
            }
            const ok = await get(ownerToken, `/${session.id}/messages`, { limit: '10' })
            expect(ok.status).toBe(200)
        })

        it('a tag with a comma is a 400: the list filter splits on commas', async () => {
            const session = await makeSession(ownerId)
            const res = await request(app)
                .put(`/api/v1/session/${session.id}/tags`)
                .set('x-forwarded-for', getRandomIP())
                .set('Authorization', `Bearer ${ownerToken}`)
                .send({ tags: ['a,b'] })
            expect(res.status).toBe(400)
        })
    })
})
