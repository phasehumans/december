import { prisma } from '@december/database'

import type { ProcessInstallation } from './githubapp.types'

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
                accountLogin: { equals: owner, mode: 'insensitive' },
            },
        })
        if (userInstallation) {
            return userInstallation
        }
    }

    return prisma.githubAppInstallation.findFirst({
        where: {
            accountLogin: { equals: owner, mode: 'insensitive' },
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

// the session whose pull request this is (December saves prNumber on the session)
const findSessionByPullRequest = async (data: {
    repoOwner: string
    repoName: string
    prNumber: number
}) => {
    const { repoOwner, repoName, prNumber } = data
    return prisma.session.findFirst({
        where: {
            prNumber,
            githubRepoOwner: { equals: repoOwner, mode: 'insensitive' },
            githubRepoName: { equals: repoName, mode: 'insensitive' },
            deletedAt: null,
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

export const githubAppRepository = {
    upsertInstallation,
    deleteInstallation,
    findByUserId,
    findAllByUserId,
    findByOwnerAndUser,
    findByInstallationId,
    findUserGithubId,
    findUserIdByGithubId,
    findSessionByPullRequest,
    findUserGithubUsername,
    hasUnreadNotification,
}
