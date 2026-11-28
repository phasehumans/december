import { prisma } from '@december/database'

import { escapeLike } from '../../shared/escape-like'

import type { ProcessInstallation } from './githubapp.types'
import type { Prisma } from '@december/database'

const upsertInstallation = async (data: ProcessInstallation) => {
    const { installationId, userId, accountLogin, accountType, targetType, permissions } = data

    const existing = await prisma.githubAppInstallation.findUnique({
        where: { installationId },
    })

    const effectiveUserId =
        userId && userId !== 'system'
            ? userId
            : existing?.userId && existing.userId !== 'system'
              ? existing.userId
              : null

    const installation = await prisma.githubAppInstallation.upsert({
        where: { installationId },
        update: {
            userId: effectiveUserId,
            accountLogin: accountLogin ?? undefined,
            accountType: accountType ?? undefined,
            targetType: targetType ?? undefined,
            permissions: permissions ? (permissions as any) : undefined,
        },
        create: {
            installationId,
            userId: effectiveUserId,
            accountLogin,
            accountType,
            targetType,
            permissions: permissions ? (permissions as any) : undefined,
        },
    })

    // githubUsername stays as set at github login: the installation account
    // can be an organisation, whose name is not the user's username
    if (effectiveUserId) {
        await prisma.user.update({
            where: { id: effectiveUserId },
            data: {
                githubAppInstall: true,
                githubConnected: true,
            },
        })
    }

    return installation
}

const deleteInstallation = async (installationId: string) => {
    const installation = await prisma.githubAppInstallation.findUnique({
        where: { installationId },
        select: { userId: true },
    })

    if (!installation) {
        return null
    }

    const deleted = await prisma.githubAppInstallation.delete({
        where: { installationId },
    })

    if (installation.userId) {
        const count = await prisma.githubAppInstallation.count({
            where: { userId: installation.userId },
        })
        if (count === 0) {
            await prisma.user.update({
                where: { id: installation.userId },
                data: { githubAppInstall: false },
            })
        }
    }

    return deleted
}

const findByUserId = async (userId: string) => {
    return prisma.githubAppInstallation.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' },
    })
}

const findAllByUserId = async (userId: string) => {
    return prisma.githubAppInstallation.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
    })
}

const findByOwnerAndUser = async (owner: string, userId?: string) => {
    if (userId) {
        const userInstallation = await prisma.githubAppInstallation.findFirst({
            where: {
                userId,
                accountLogin: { equals: escapeLike(owner), mode: 'insensitive' },
            },
        })
        if (userInstallation) {
            return userInstallation
        }
    }

    return prisma.githubAppInstallation.findFirst({
        where: {
            accountLogin: { equals: escapeLike(owner), mode: 'insensitive' },
        },
    })
}

const findByInstallationId = async (installationId: string) => {
    return prisma.githubAppInstallation.findUnique({
        where: { installationId },
    })
}

const findUserGithubId = async (userId: string) => {
    return prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, githubId: true, isDeleted: true },
    })
}

// Deleted accounts keep their github id, so skip them: never link an install to one
const findUserIdByGithubId = async (githubId: string) => {
    const user = await prisma.user.findFirst({
        where: { githubId, isDeleted: false },
        select: { id: true },
    })
    return user?.id ?? null
}

// saves the github id a user proved during an install, only when they have none and no
// other account holds it (the column is unique). false when it was not saved
const saveUserGithubId = async (data: { userId: string; githubId: string }) => {
    const { userId, githubId } = data
    const holder = await prisma.user.findFirst({ where: { githubId }, select: { id: true } })
    if (holder) return false
    try {
        const result = await prisma.user.updateMany({
            where: { id: userId, githubId: null },
            data: { githubId },
        })
        return result.count > 0
    } catch {
        // Intentionally swallowed: another request saved the same id first (unique column)
        return false
    }
}

// the session whose pull request this is (December saves prNumber on the session)
const findSessionByPullRequest = async (data: {
    repoId?: string
    repoOwner: string
    repoName: string
    prNumber: number
}) => {
    const { repoId, repoOwner, repoName, prNumber } = data
    // escaped: else the pull request of "my_repo" is found on "myXrepo"
    const byName: Prisma.SessionWhereInput = {
        githubRepoOwner: { equals: escapeLike(repoOwner), mode: 'insensitive' },
        githubRepoName: { equals: escapeLike(repoName), mode: 'insensitive' },
    }
    return prisma.session.findFirst({
        where: {
            gitProvider: 'GITHUB',
            prNumber,
            // like the pull request state (#632): a session that saved the repository id
            // matches only by it, so a new repository with the old name of a renamed one
            // does not take its notices. a session saved before the id was kept matches
            // by owner and name
            ...(repoId
                ? { OR: [{ githubRepoId: repoId }, { githubRepoId: null, ...byName }] }
                : byName),
        },
        select: { userId: true },
        orderBy: { updatedAt: 'desc' },
    })
}

const findUserGithubUsername = async (userId: string) => {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { githubUsername: true },
    })
    return user?.githubUsername ?? null
}

// several check suites can fail for one push; one unread notice per pull request is enough
const hasUnreadNotification = async (data: { userId: string; title: string; since: Date }) => {
    const { userId, title, since } = data
    const found = await prisma.notification.findFirst({
        where: { userId, title, isRead: false, createdAt: { gte: since } },
        select: { id: true },
    })
    return Boolean(found)
}

const findPullRequestSettings = async (userId: string) => {
    return prisma.pullRequestSettings.findUnique({ where: { userId } })
}

// what a github run needs to know about the installer
const findRunOwner = async (userId: string) => {
    return prisma.user.findFirst({
        where: { id: userId, isDeleted: false, deletedAt: null },
        select: { id: true, githubUsername: true, creditBalance: true },
    })
}

// the saved keys a github run can fall back to, the one the user used last first
const findOwnKeys = async (userId: string) => {
    return prisma.providerCredential.findMany({
        where: { userId },
        select: { provider: true, defaultModel: true, models: true },
        orderBy: [{ lastUsedAt: { sort: 'desc', nulls: 'last' } }, { updatedAt: 'desc' }],
    })
}

const setSessionGithubRun = async (sessionId: string, githubRun: Record<string, unknown>) => {
    return prisma.session.update({
        where: { id: sessionId },
        data: { githubRun: githubRun as any },
        select: { id: true },
    })
}

// github runs for one issue or pull request, newest first (to skip duplicates)
const findGithubRuns = async (data: {
    userId: string
    repoFullName: string
    number: number
    since: Date
}) => {
    const { userId, repoFullName, number, since } = data
    return prisma.session.findMany({
        where: {
            userId,
            createdAt: { gte: since },
            AND: [
                { githubRun: { path: ['repoFullName'], equals: repoFullName } },
                { githubRun: { path: ['number'], equals: number } },
            ],
        },
        select: { id: true, status: true, githubRun: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 20,
    })
}

export const githubAppRepository = {
    upsertInstallation,
    deleteInstallation,
    findByUserId,
    findAllByUserId,
    findByOwnerAndUser,
    findByInstallationId,
    findUserGithubId,
    findUserIdByGithubId,
    saveUserGithubId,
    findSessionByPullRequest,
    findUserGithubUsername,
    hasUnreadNotification,
    findPullRequestSettings,
    findRunOwner,
    findOwnKeys,
    setSessionGithubRun,
    findGithubRuns,
}
