import { prisma } from '@december/database'

import type { Prisma } from '@december/database'

export const importRepository = {
    async updateImport(data: {
        importId: string
        status: string
        updateData?: Prisma.ProjectImportUpdateInput
        select: Prisma.ProjectImportSelect
    }) {
        const { importId, status, updateData, select } = data
        return prisma.projectImport.update({
            where: { id: importId },
            data: {
                status,
                ...(updateData ?? {}),
            },
            select,
        })
    },

    async createImport(data: {
        userId: string
        sourceType: 'GITHUB' | 'ZIP'
        sourceUrl?: string | null
        sourceFileName?: string | null
        projectId?: string | null
        projectVersionId?: string | null
        select: Prisma.ProjectImportSelect
    }) {
        const {
            userId,
            sourceType,
            sourceUrl,
            sourceFileName,
            projectId,
            projectVersionId,
            select,
        } = data
        return prisma.projectImport.create({
            data: {
                userId,
                sourceType,
                projectId: projectId ?? undefined,
                projectVersionId: projectVersionId ?? undefined,
                sourceUrl: sourceUrl ?? undefined,
                sourceFileName: sourceFileName ?? undefined,
            },
            select,
        })
    },

    async createPlaceholderProject(data: {
        projectId: string
        versionId: string
        userId: string
        displayName: string
        prompt: string
        versionPrefix: string
    }) {
        const { projectId, versionId, userId, displayName, prompt, versionPrefix } = data
        return prisma.$transaction(async (tx) => {
            const createdProject = await tx.project.create({
                data: {
                    id: projectId,
                    name: displayName,
                    description: `Importing project...`.slice(0, 30),
                    prompt: prompt,
                    projectStatus: 'GENERATING',
                    userId,
                    versionCount: 1,
                    versions: {
                        create: {
                            id: versionId,
                            versionNumber: 1,
                            label: 'import',
                            sourcePrompt: prompt,
                            summary: 'Importing project files...',
                            status: 'GENERATING',
                            objectStoragePrefix: versionPrefix,
                            manifestJson: [],
                        },
                    },
                },
                select: {
                    id: true,
                },
            })

            await tx.project.update({
                where: { id: createdProject.id },
                data: {
                    currentVersionId: versionId,
                },
                select: { id: true },
            })

            return createdProject
        })
    },

    async updateImportedProjectVersion(data: {
        projectId: string
        versionId: string
        description: string
        summary: string
        manifestJson: Prisma.InputJsonValue
        messages: Prisma.ProjectMessageCreateWithoutProjectInput[]
    }) {
        const { projectId, versionId, description, summary, manifestJson, messages } = data
        return prisma.$transaction(async (tx) => {
            await tx.project.update({
                where: { id: projectId },
                data: {
                    description,
                    projectStatus: 'READY',
                },
            })

            await tx.projectVersion.update({
                where: { id: versionId },
                data: {
                    summary,
                    status: 'READY',
                    manifestJson,
                    messages: {
                        create: messages,
                    },
                },
            })
        })
    },

    async findImportForFail(importId: string) {
        return prisma.projectImport.findUnique({
            where: { id: importId },
            select: {
                objectPrefix: true,
                projectId: true,
            },
        })
    },

    async incrementAttempts(importId: string) {
        return prisma.projectImport.update({
            where: { id: importId },
            data: {
                attempts: { increment: 1 },
            },
        })
    },

    async findUserForImport(userId: string) {
        return prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                githubToken: true,
                subscriptionPlan: true,
            },
        })
    },

    async countUserImports(data: { userId: string; sourceType: 'GITHUB' | 'ZIP' }) {
        const { userId, sourceType } = data
        return prisma.projectImport.count({
            where: {
                userId,
                sourceType,
            },
        })
    },

    async findImportForStatus(data: {
        id: string
        userId: string
        select: Prisma.ProjectImportSelect
    }) {
        const { id, userId, select } = data
        return prisma.projectImport.findFirst({
            where: {
                id,
                userId,
            },
            select,
        })
    },
}
