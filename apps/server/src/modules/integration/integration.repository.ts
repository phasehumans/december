import { prisma } from '@december/database'

import type { Prisma } from '@december/database'

export const integrationRepository = {
    async findUserById(id: string) {
        return prisma.user.findUnique({
            where: { id },
        })
    },

    async findUserFirst(id: string) {
        return prisma.user.findFirst({
            where: { id },
        })
    },

    async updateUserVercel(data: {
        id: string
        vercelAccessToken: string
        vercelTeamId: string | null
        vercelConfigurationId: string | null
    }) {
        const { id, vercelAccessToken, vercelTeamId, vercelConfigurationId } = data
        return prisma.user.update({
            where: { id },
            data: {
                vercelConnected: true,
                vercelAccessToken,
                vercelTeamId,
                vercelConfigurationId,
            },
        })
    },

    async updateUserSupabase(data: {
        id: string
        supabaseAccessToken: string
        supabaseRefreshToken: string
        supabaseTokenExpiresAt: Date
        supabaseTokenScope: string | null
    }) {
        const {
            id,
            supabaseAccessToken,
            supabaseRefreshToken,
            supabaseTokenExpiresAt,
            supabaseTokenScope,
        } = data
        return prisma.user.update({
            where: { id },
            data: {
                supabaseConnected: true,
                supabaseAccessToken,
                supabaseRefreshToken,
                supabaseTokenExpiresAt,
                supabaseTokenScope,
                supabaseConnectedAt: new Date(),
            },
        })
    },

    async updateUserNotion(data: {
        id: string
        notionAccessToken: string
        notionWorkspaceId: string
        notionWorkspaceName: string
    }) {
        const { id, notionAccessToken, notionWorkspaceId, notionWorkspaceName } = data
        return prisma.user.update({
            where: { id },
            data: {
                notionAccessToken,
                notionWorkspaceId,
                notionWorkspaceName,
            },
        })
    },

    async updateUserGithub(data: { id: string; username: string; accessToken: string }) {
        const { id, username, accessToken } = data
        return prisma.user.update({
            where: { id },
            data: {
                githubUsername: username,
                githubToken: accessToken,
                githubConnected: true,
            },
            select: {
                id: true,
                githubConnected: true,
                githubUsername: true,
            },
        })
    },

    async findUserGithubConnection(id: string) {
        return prisma.user.findUnique({
            where: { id },
            select: {
                githubToken: true,
                githubUsername: true,
                githubConnected: true,
            },
        })
    },

    async findProjectByIdAndUser(data: { projectId: string; userId: string }) {
        const { projectId, userId } = data
        return prisma.project.findFirst({
            where: {
                id: projectId,
                userId,
            },
        })
    },

    async updateProjectGithub(data: {
        projectId: string
        githubRepoName: string
        githubRepoOwner: string
        githubRepoUrl: string
    }) {
        const { projectId, githubRepoName, githubRepoOwner, githubRepoUrl } = data
        return prisma.project.update({
            where: { id: projectId },
            data: {
                githubRepoName,
                githubRepoOwner,
                githubRepoUrl,
            },
        })
    },

    async findProjectVersionByIdAndProject(data: { versionId: string; projectId: string }) {
        const { versionId, projectId } = data
        return prisma.projectVersion.findFirst({
            where: {
                id: versionId,
                projectId,
            },
        })
    },

    async updateProjectSynced(projectId: string) {
        return prisma.project.update({
            where: { id: projectId },
            data: {
                githubLastSyncedAt: new Date(),
            },
        })
    },
}
