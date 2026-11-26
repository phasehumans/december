import { prisma } from '@december/database'
import { afterAll, beforeAll, describe, expect, it } from 'bun:test'

import { adminRepository } from '../../src/modules/admin/admin.repository'
import { githubAppRepository } from '../../src/modules/githubapp/githubapp.repository'
import { notificationRepository } from '../../src/modules/notification/notification.repository'
import { teamRepository } from '../../src/modules/team/team.repository'
import { cleanupTestUser } from '../helpers'

/**
 * Prisma turns `contains`, `endsWith` and insensitive `equals` into LIKE or ILIKE without
 * escaping, so `_` matched any character. Each lookup here must find the exact name only.
 */
describe('lookups read _ and % as plain characters', () => {
    const stamp = Date.now()
    // the same letters, with "_" in one and "X" in the other
    const realEmail = `like_${stamp}@example.com`
    const lookalikeEmail = `likeX${stamp}@example.com`

    let real: { id: string }
    let lookalike: { id: string }

    beforeAll(async () => {
        real = await prisma.user.create({
            data: { email: realEmail, name: 'Real', emailVerified: true },
        })
        lookalike = await prisma.user.create({
            data: { email: lookalikeEmail, name: 'Lookalike', emailVerified: true },
        })
    })

    afterAll(async () => {
        await prisma.session.deleteMany({ where: { userId: { in: [real.id, lookalike.id] } } })
        await prisma.team.deleteMany({ where: { ownerId: { in: [real.id, lookalike.id] } } })
        await cleanupTestUser({ id: real.id })
        await cleanupTestUser({ id: lookalike.id })
    })

    it('admin inbox emails find only that account', async () => {
        const ids = await notificationRepository.findUserIdsByEmails([realEmail.toUpperCase()])
        expect(ids).toEqual([real.id])
    })

    it('a team member is found by the exact email only', async () => {
        const team = await prisma.team.create({ data: { name: 't', ownerId: lookalike.id } })
        await prisma.teamMember.create({ data: { teamId: team.id, userId: lookalike.id } })

        expect(await teamRepository.findMemberByEmail(team.id, realEmail)).toBeNull()
        expect(await teamRepository.findMemberByEmail(team.id, lookalikeEmail)).toEqual({
            userId: lookalike.id,
        })
    })

    it('a pull request webhook finds the session of that repository only', async () => {
        await prisma.session.create({
            data: {
                userId: lookalike.id,
                githubRepoOwner: 'acme',
                githubRepoName: `repoX${stamp}`,
                prNumber: 7,
            },
        })

        expect(
            await githubAppRepository.findSessionByPullRequest({
                repoOwner: 'acme',
                repoName: `repo_${stamp}`,
                prNumber: 7,
            })
        ).toBeNull()

        await prisma.session.create({
            data: {
                userId: real.id,
                githubRepoOwner: 'acme',
                githubRepoName: `repo_${stamp}`,
                prNumber: 7,
            },
        })
        expect(
            await githubAppRepository.findSessionByPullRequest({
                repoOwner: 'ACME',
                repoName: `REPO_${stamp}`,
                prNumber: 7,
            })
        ).toEqual({ userId: real.id })
    })

    it('the admin user search reads _ as a plain character', async () => {
        const [rows] = await adminRepository.listUsersPage({
            q: `like_${stamp}`,
            page: 1,
            pageSize: 10,
            filter: 'all',
        })
        expect(rows.map((row: { id: string }) => row.id)).toEqual([real.id])
    })
})
