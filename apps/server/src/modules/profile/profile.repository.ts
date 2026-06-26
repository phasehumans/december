import { prisma } from '@december/database'

import type { Prisma } from '@december/database'

async function findUserByIdForInfo(id: string) {
    return prisma.user.findUnique({
        where: { id },
        select: {
            name: true,
            githubConnected: true,
        },
    })
}

async function findUserByIdForCard(id: string) {
    return prisma.user.findUnique({
        where: { id },
        select: {
            id: true,
            name: true,
            username: true,
            email: true,
            avatarUrl: true,
            createdAt: true,
        },
    })
}

async function findUserByIdForProfile(id: string, selectFields: Prisma.UserSelect) {
    return prisma.user.findUnique({
        where: { id },
        select: {
            ...selectFields,
            password: true,
        },
    })
}

async function findUserByIdForExistCheck(id: string) {
    return prisma.user.findUnique({
        where: { id },
        select: {
            id: true,
        },
    })
}

async function findUserByIdForUsernameCheck(id: string) {
    return prisma.user.findUnique({
        where: { id },
        select: {
            id: true,
            username: true,
        },
    })
}

async function findUserByUsername(username: string) {
    return prisma.user.findUnique({
        where: { username },
        select: {
            id: true,
        },
    })
}

async function updateUserName(id: string, name: string) {
    return prisma.user.update({
        where: { id },
        data: { name },
        select: {
            name: true,
        },
    })
}

async function updateUsername(id: string, username: string) {
    return prisma.user.update({
        where: { id },
        data: { username },
        select: {
            username: true,
        },
    })
}

async function updateAvatarUrl(id: string, avatarUrl: string) {
    return prisma.user.update({
        where: { id },
        data: { avatarUrl },
        select: {
            avatarUrl: true,
        },
    })
}

async function findUserPasswordById(id: string) {
    return prisma.user.findUnique({
        where: { id },
        select: {
            id: true,
            password: true,
        },
    })
}

async function updatePassword(id: string, passwordHash: string) {
    return prisma.user.update({
        where: { id },
        data: { password: passwordHash },
        select: {
            id: true,
        },
    })
}

async function updateNotifications(id: string, data: Prisma.UserUpdateInput) {
    return prisma.user.update({
        where: { id },
        data,
        select: {
            notifyProjectActivity: true,
            notifyProductUpdates: true,
            notifySecurityAlerts: true,
        },
    })
}

async function findSession(sessionId: string, userId: string) {
    return prisma.session.findFirst({
        where: {
            id: sessionId,
            userId,
            isRevoked: false,
        },
    })
}

async function revokeSession(sessionId: string) {
    return prisma.session.update({
        where: { id: sessionId },
        data: {
            isRevoked: true,
            revokedAt: new Date(),
        },
    })
}

async function revokeAllSessions(userId: string) {
    return prisma.session.updateMany({
        where: {
            userId,
            isRevoked: false,
        },
        data: {
            isRevoked: true,
            revokedAt: new Date(),
        },
    })
}

async function findUserByIdForDeleteCheck(id: string) {
    return prisma.user.findUnique({
        where: { id },
        select: {
            id: true,
            isDeleted: true,
        },
    })
}

async function deleteAccount(userId: string) {
    return prisma.$transaction([
        prisma.session.updateMany({
            where: {
                userId,
                isRevoked: false,
            },
            data: {
                isRevoked: true,
                revokedAt: new Date(),
            },
        }),
        prisma.user.update({
            where: { id: userId },
            data: {
                isDeleted: true,
                deletedAt: new Date(),
                githubToken: null,
                githubConnected: false,
                githubUsername: null,
                vercelAccessToken: null,
                vercelConnected: false,
                vercelTeamId: null,
                vercelConfigurationId: null,
                supabaseConnected: false,
                supabaseAccessToken: null,
                supabaseRefreshToken: null,
                supabaseTokenExpiresAt: null,
                supabaseTokenScope: null,
                supabaseUserId: null,
                supabaseConnectedAt: null,
                notionAccessToken: null,
                notionWorkspaceId: null,
                notionWorkspaceName: null,
            },
            select: {
                id: true,
            },
        }),
    ])
}

async function findUserByIdForChatSuggestions(id: string) {
    return prisma.user.findUnique({
        where: { id },
        select: {
            id: true,
            chatSuggestions: true,
        },
    })
}

async function updateChatSuggestions(id: string, chatSuggestions: boolean) {
    return prisma.user.update({
        where: { id },
        data: { chatSuggestions },
        select: {
            chatSuggestions: true,
        },
    })
}

async function findUserByIdForGenerationSound(id: string) {
    return prisma.user.findUnique({
        where: { id },
        select: {
            id: true,
            generationSound: true,
        },
    })
}

async function updateGenerationSound(
    id: string,
    generationSound: Prisma.UserUpdateInput['generationSound']
) {
    return prisma.user.update({
        where: { id },
        data: { generationSound },
        select: {
            generationSound: true,
        },
    })
}

async function getUserDesign(id: string) {
    return prisma.user.findUnique({
        where: { id },
        select: {
            design: true,
        },
    })
}

async function updateUserDesign(id: string, design: string) {
    return prisma.user.update({
        where: { id },
        data: { design },
        select: {
            design: true,
        },
    })
}

async function deleteUserDesign(id: string) {
    return prisma.user.update({
        where: { id },
        data: { design: null },
        select: {
            id: true,
        },
    })
}

async function updateCompleteOnboarding(id: string) {
    return prisma.user.update({
        where: { id },
        data: { hasCompletedOnboarding: true },
        select: {
            id: true,
            hasCompletedOnboarding: true,
        },
    })
}

async function createFeedback(data: Prisma.FeedbackUncheckedCreateInput) {
    return prisma.feedback.create({ data })
}

export const profileRepository = {
    findUserByIdForInfo,
    findUserByIdForCard,
    findUserByIdForProfile,
    findUserByIdForExistCheck,
    findUserByIdForUsernameCheck,
    findUserByUsername,
    updateUserName,
    updateUsername,
    updateAvatarUrl,
    findUserPasswordById,
    updatePassword,
    updateNotifications,
    findSession,
    revokeSession,
    revokeAllSessions,
    findUserByIdForDeleteCheck,
    deleteAccount,
    findUserByIdForChatSuggestions,
    updateChatSuggestions,
    findUserByIdForGenerationSound,
    updateGenerationSound,
    getUserDesign,
    updateUserDesign,
    deleteUserDesign,
    updateCompleteOnboarding,
    createFeedback,
}
