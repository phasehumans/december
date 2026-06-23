import { prisma } from '@december/database'

export const platformRepository = {
    async findProjectForDeployment(data: { projectId: string; userId: string }) {
        const { projectId, userId } = data
        return prisma.project.findFirst({
            where: {
                id: projectId,
                userId,
                isDeleted: false,
            },
            include: {
                currentVersion: true,
            },
        })
    },

    async updateProjectDecemberDeployment(data: { projectId: string; deployUrl: string }) {
        const { projectId, deployUrl } = data
        return prisma.project.update({
            where: { id: projectId },
            data: {
                decemberDeploymentUrl: deployUrl,
                decemberLastDeployedAt: new Date(),
            },
        })
    },

    async getVercelCredentials(data: { userId: string }) {
        const { userId } = data
        return prisma.user.findUnique({
            where: { id: userId },
            select: {
                vercelAccessToken: true,
                vercelTeamId: true,
                vercelConnected: true,
            },
        })
    },

    async findProjectById(data: { projectId: string }) {
        const { projectId } = data
        return prisma.project.findUnique({
            where: { id: projectId },
        })
    },

    async updateProjectVercelLink(data: {
        projectId: string
        vercelProjectId: string
        vercelProjectName: string
    }) {
        const { projectId, vercelProjectId, vercelProjectName } = data
        return prisma.project.update({
            where: { id: projectId },
            data: {
                vercelProjectId,
                vercelProjectName,
            },
        })
    },

    async updateProjectVercelDeployment(data: { projectId: string; url: string }) {
        const { projectId, url } = data
        return prisma.project.update({
            where: { id: projectId },
            data: {
                vercelDeploymentUrl: url,
                vercelLastDeployedAt: new Date(),
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
