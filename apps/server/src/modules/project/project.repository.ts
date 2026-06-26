import { prisma } from '@december/database'

import type { Prisma } from '@december/database'

export const projectRepository = {
    async findFirstVersion(projectId: string, versionId?: string) {
        return prisma.projectVersion.findFirst({
            where: {
                projectId,
                ...(versionId ? { id: versionId } : {}),
            },
            orderBy: {
                versionNumber: 'desc',
            },
        })
    },

    async createVersion(data: Prisma.ProjectVersionUncheckedCreateInput) {
        return prisma.projectVersion.create({ data })
    },

    async updateProjectVersionCount(
        projectId: string,
        currentVersionId: string,
        versionCount: number
    ) {
        return prisma.project.update({
            where: { id: projectId },
            data: {
                currentVersionId,
                versionCount,
            },
            select: {
                id: true,
            },
        })
    },

    async findManyProjects(userId: string) {
        return prisma.project.findMany({
            where: {
                OR: [{ userId }, { collaborators: { some: { userId } } }],
            },
            select: {
                id: true,
                name: true,
                description: true,
                prompt: true,
                isStarred: true,
                isSharedAsTemplate: true,
                projectStatus: true,
                versionCount: true,
                currentVersionId: true,
                createdAt: true,
                updatedAt: true,
                userId: true,
                user: {
                    select: {
                        username: true,
                    },
                },
                collaborators: {
                    select: {
                        id: true,
                        userId: true,
                        email: true,
                        user: {
                            select: {
                                id: true,
                                username: true,
                                email: true,
                                name: true,
                                avatarUrl: true,
                            },
                        },
                    },
                },
            },
        })
    },

    async findProjectById(projectId: string, userId: string) {
        return prisma.project.findFirst({
            where: {
                id: projectId,
                OR: [{ userId }, { collaborators: { some: { userId } } }],
            },
            select: {
                id: true,
                name: true,
                description: true,
                prompt: true,
                isStarred: true,
                isSharedAsTemplate: true,
                projectStatus: true,
                versionCount: true,
                currentVersionId: true,
                createdAt: true,
                updatedAt: true,
                userId: true,
                githubRepoName: true,
                githubRepoOwner: true,
                githubRepoUrl: true,
                githubLastSyncedAt: true,
                vercelProjectId: true,
                vercelProjectName: true,
                vercelDeploymentUrl: true,
                vercelLastDeployedAt: true,
                user: {
                    select: {
                        username: true,
                    },
                },
                collaborators: {
                    select: {
                        id: true,
                        userId: true,
                        email: true,
                        user: {
                            select: {
                                id: true,
                                username: true,
                                email: true,
                                name: true,
                                avatarUrl: true,
                            },
                        },
                    },
                },
            },
        })
    },

    async findManyVersions(projectId: string) {
        return prisma.projectVersion.findMany({
            where: {
                projectId,
            },
            orderBy: {
                versionNumber: 'desc',
            },
        })
    },

    async findVersionById(versionId: string, projectId: string) {
        return prisma.projectVersion.findFirst({
            where: {
                id: versionId,
                projectId,
            },
            include: {
                messages: {
                    orderBy: {
                        sequence: 'asc',
                    },
                },
            },
        })
    },

    async createProject(data: Prisma.ProjectUncheckedCreateInput) {
        return prisma.project.create({
            data,
            select: {
                id: true,
                name: true,
                description: true,
                prompt: true,
                isStarred: true,
                isSharedAsTemplate: true,
                projectStatus: true,
                versionCount: true,
                currentVersionId: true,
                createdAt: true,
                updatedAt: true,
                userId: true,
            },
        })
    },

    async updateProjectMany(
        projectId: string,
        userId: string,
        data: Prisma.ProjectUpdateManyMutationInput
    ) {
        return prisma.project.updateMany({
            where: {
                id: projectId,
                userId,
            },
            data,
        })
    },

    async deleteProjectMany(projectId: string, userId: string) {
        return prisma.project.deleteMany({
            where: {
                id: projectId,
                userId,
            },
        })
    },

    async findProjectForDuplicate(projectId: string, userId: string) {
        return prisma.project.findFirst({
            where: {
                id: projectId,
                userId,
            },
            select: {
                id: true,
                name: true,
                description: true,
                prompt: true,
                projectStatus: true,
                currentVersionId: true,
            },
        })
    },

    async findLatestVersionForDuplicate(projectId: string) {
        return prisma.projectVersion.findFirst({
            where: {
                projectId,
            },
            orderBy: {
                versionNumber: 'desc',
            },
            select: {
                id: true,
                sourcePrompt: true,
            },
        })
    },

    async deleteProject(id: string) {
        return prisma.project.delete({
            where: { id },
        })
    },

    async searchUsers(query: string, excludeUserId: string) {
        return prisma.user.findMany({
            where: {
                id: { not: excludeUserId },
                OR: [
                    { username: { contains: query, mode: 'insensitive' } },
                    { email: { contains: query, mode: 'insensitive' } },
                ],
                isDeleted: false,
            },
            select: {
                id: true,
                username: true,
                email: true,
                name: true,
                avatarUrl: true,
            },
            take: 10,
        })
    },

    async findUserByEmailOrUsername(input: string) {
        return prisma.user.findFirst({
            where: {
                OR: [{ email: input }, { username: input }],
                isDeleted: false,
            },
            select: {
                id: true,
                email: true,
                username: true,
                name: true,
                isDeleted: true,
            },
        })
    },

    async findProjectOwner(projectId: string) {
        return prisma.project.findUnique({
            where: { id: projectId },
            select: {
                id: true,
                userId: true,
            },
        })
    },

    async countCollaborators(projectId: string) {
        return prisma.projectCollaborator.count({
            where: { projectId },
        })
    },

    async findCollaborator(projectId: string, email: string) {
        return prisma.projectCollaborator.findUnique({
            where: {
                projectId_email: {
                    projectId,
                    email,
                },
            },
        })
    },

    async findCollaboratorsByProjectId(projectId: string) {
        return prisma.projectCollaborator.findMany({
            where: { projectId },
            select: {
                id: true,
                userId: true,
                email: true,
                createdAt: true,
                user: {
                    select: {
                        id: true,
                        username: true,
                        email: true,
                        name: true,
                        avatarUrl: true,
                    },
                },
            },
        })
    },

    async addCollaborator(projectId: string, userId: string, email: string) {
        return prisma.projectCollaborator.create({
            data: {
                projectId,
                userId,
                email,
            },
            select: {
                id: true,
                userId: true,
                email: true,
                createdAt: true,
                user: {
                    select: {
                        id: true,
                        username: true,
                        email: true,
                        name: true,
                        avatarUrl: true,
                    },
                },
            },
        })
    },

    async removeCollaborator(projectId: string, email: string) {
        return prisma.projectCollaborator.delete({
            where: {
                projectId_email: {
                    projectId,
                    email,
                },
            },
        })
    },
}
