import { prisma } from '@december/database'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'bun:test'

import { githubAppRepository } from '../../src/modules/githubapp/githubapp.repository'
import { cleanupTestUser } from '../helpers'

/**
 * inbox notices (replies, reviews, failed checks) find the session of a pull request the
 * same way the pull request state does (#632): by the repository id when the session saved
 * it, so a renamed repository keeps its notices and a new repository with the old name
 * does not take them
 */
describe('the session of a pull request for inbox notices', () => {
    const stamp = Date.now()
    const owner = `inbox-acme-${stamp}`
    let first: { id: string }
    let second: { id: string }

    beforeAll(async () => {
        first = await prisma.user.create({
            data: { email: `inbox-first-${stamp}@example.com`, name: 'First', emailVerified: true },
        })
        second = await prisma.user.create({
            data: {
                email: `inbox-second-${stamp}@example.com`,
                name: 'Second',
                emailVerified: true,
            },
        })
    })

    beforeEach(async () => {
        await prisma.session.deleteMany({ where: { userId: { in: [first.id, second.id] } } })
    })

    afterAll(async () => {
        await prisma.session.deleteMany({ where: { userId: { in: [first.id, second.id] } } })
        await cleanupTestUser({ id: first.id })
        await cleanupTestUser({ id: second.id })
    })

    const find = (data: { repoId?: string; repoName: string }) =>
        githubAppRepository.findSessionByPullRequest({ repoOwner: owner, prNumber: 7, ...data })

    it('a renamed repository still finds the session by its id', async () => {
        await prisma.session.create({
            data: {
                userId: first.id,
                githubRepoOwner: owner,
                githubRepoName: 'old-name',
                githubRepoId: '9001',
                prNumber: 7,
            },
        })
        expect(await find({ repoId: '9001', repoName: 'new-name' })).toEqual({ userId: first.id })
    })

    it('a new repository with the old name does not take the notices', async () => {
        await prisma.session.create({
            data: {
                userId: first.id,
                githubRepoOwner: owner,
                githubRepoName: 'web',
                githubRepoId: '9001',
                prNumber: 7,
            },
        })
        expect(await find({ repoId: '9002', repoName: 'web' })).toBeNull()
    })

    it('a session saved before the id was kept matches by owner and name', async () => {
        await prisma.session.create({
            data: { userId: second.id, githubRepoOwner: owner, githubRepoName: 'web', prNumber: 7 },
        })
        expect(await find({ repoId: '9003', repoName: 'WEB' })).toEqual({ userId: second.id })
        // no id in the webhook: owner and name, as before
        expect(await find({ repoName: 'web' })).toEqual({ userId: second.id })
    })

    it('a GitLab session with the same owner, name and number is not a GitHub one', async () => {
        await prisma.session.create({
            data: {
                userId: second.id,
                gitProvider: 'GITLAB',
                githubRepoOwner: owner,
                githubRepoName: 'web',
                prNumber: 7,
            },
        })
        expect(await find({ repoId: '9004', repoName: 'web' })).toBeNull()
    })
})
