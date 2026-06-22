import { prisma } from '@december/database'

import type { Prisma } from '@december/database'

export const profileRepository = {
    async findUserByIdForInfo(id: string) {
        return prisma.user.findUnique({
            where: { id },
            select: {
                name: true,
                githubConnected: true,
            },
        })
    },

    async findUserByIdForCard(id: string) {
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
    },

    async findUserByIdForProfile(id: string, selectFields: Prisma.UserSelect) {
        return prisma.user.findUnique({
            where: { id },
            select: {
                ...selectFields,
                password: true,
            },
        })
    },

    async findUserByIdForExistCheck(id: string) {
        return prisma.user.findUnique({
            where: { id },
            select: {
                id: true,
            },
        })
    },

    async findUserByIdForUsernameCheck(id: string) {
        return prisma.user.findUnique({
            where: { id },
            select: {
                id: true,
                username: true,
            },
        })
    },

    async findUserByUsername(username: string) {
        return prisma.user.findUnique({
            where: { username },
            select: {
                id: true,
            },
        })
    },

    async updateUserName(id: string, name: string) {
        return prisma.user.update({
            where: { id },
            data: { name },
            select: {
                name: true,
            },
        })
    },

    async updateUsername(id: string, username: string) {
        return prisma.user.update({
            where: { id },
            data: { username },
            select: {
                username: true,
            },
        })
    },

    async updateAvatarUrl(id: string, avatarUrl: string) {
        return prisma.user.update({
            where: { id },
            data: { avatarUrl },
            select: {
                avatarUrl: true,
            },
        })
    },

    async findUserPasswordById(id: string) {
        return prisma.user.findUnique({
            where: { id },
            select: {
                id: true,
                password: true,
            },
        })
    },

    async updatePassword(id: string, passwordHash: string) {
        return prisma.user.update({
            where: { id },
            data: { password: passwordHash },
            select: {
                id: true,
            },
        })
    },

    async updateNotifications(id: string, data: Prisma.UserUpdateInput) {
        return prisma.user.update({
            where: { id },
            data,
            select: {
                notifyProjectActivity: true,
                notifyProductUpdates: true,
                notifySecurityAlerts: true,
            },
        })
    },

    async findSession(sessionId: string, userId: string) {
        return prisma.session.findFirst({
            where: {
                id: sessionId,
                userId,
                isRevoked: false,
            },
        })
    },

    async revokeSession(sessionId: string) {
        return prisma.session.update({
            where: { id: sessionId },
            data: {
                isRevoked: true,
                revokedAt: new Date(),
            },
        })
    },

    async revokeAllSessions(userId: string) {
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
    },

    async findUserByIdForDeleteCheck(id: string) {
        return prisma.user.findUnique({
            where: { id },
            select: {
                id: true,
                isDeleted: true,
            },
        })
    },

    async deleteAccount(userId: string) {
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
    },

    async findUserByIdForChatSuggestions(id: string) {
        return prisma.user.findUnique({
            where: { id },
            select: {
                id: true,
                chatSuggestions: true,
            },
        })
    },

    async updateChatSuggestions(id: string, chatSuggestions: boolean) {
        return prisma.user.update({
            where: { id },
            data: { chatSuggestions },
            select: {
                chatSuggestions: true,
            },
        })
    },

    async findUserByIdForGenerationSound(id: string) {
        return prisma.user.findUnique({
            where: { id },
            select: {
                id: true,
                generationSound: true,
            },
        })
    },

    async updateGenerationSound(
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
    },

    async getUserDesign(id: string) {
        return prisma.user.findUnique({
            where: { id },
            select: {
                design: true,
            },
        })
    },

    async updateUserDesign(id: string, design: string) {
        return prisma.user.update({
            where: { id },
            data: { design },
            select: {
                design: true,
            },
        })
    },

    async deleteUserDesign(id: string) {
        return prisma.user.update({
            where: { id },
            data: { design: null },
            select: {
                id: true,
            },
        })
    },

    async updateCompleteOnboarding(id: string) {
        return prisma.user.update({
            where: { id },
            data: { hasCompletedOnboarding: true },
            select: {
                id: true,
                hasCompletedOnboarding: true,
            },
        })
    },

    async createFeedback(data: Prisma.FeedbackUncheckedCreateInput) {
        return prisma.feedback.create({ data })
    },
}
