import { prisma } from '@december/database'

import type { Prisma, ProjectImportStatus } from '@december/database'

async function updateImport(data: {
    importId: string
    status: ProjectImportStatus
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
}

async function createImport(data: {
    userId: string
    sourceType: 'GITHUB' | 'ZIP'
    sourceUrl?: string | null
    sourceFileName?: string | null
    projectId?: string | null
    projectVersionId?: string | null
    select: Prisma.ProjectImportSelect
}) {
    const { userId, sourceType, sourceUrl, sourceFileName, projectId, projectVersionId, select } =
        data
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
}

async function createPlaceholderProject(data: {
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
}

async function updateImportedProjectVersion(data: {
    projectId: string
    versionId: string
    description: string
    summary: string
    manifestJson: Prisma.InputJsonValue
    messages: Array<{
        role: 'USER' | 'ASSISTANT' | 'SYSTEM'
        content: string
        sequence: number
        status?: string
    }>
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

        const project = await tx.project.findUniqueOrThrow({ where: { id: projectId } })
        let session = await tx.session.findFirst({
            where: { projectId },
            orderBy: { createdAt: 'desc' },
        })
        if (!session) {
            session = await tx.session.create({
                data: { userId: project.userId, projectId, type: 'WEB' },
            })
        }

        await tx.projectVersion.update({
            where: { id: versionId },
            data: {
                summary,
                status: 'READY',
                manifestJson,
                messages: {
                    create: messages.map((msg) => ({
                        role: msg.role,
                        content: msg.content,
                        sequence: msg.sequence,
                        status: msg.status,
                        sessionId: session!.id,
                    })),
                },
            },
        })
    })
}

async function findImportForFail(importId: string) {
    return prisma.projectImport.findUnique({
        where: { id: importId },
        select: {
            objectPrefix: true,
            projectId: true,
        },
    })
}

async function incrementAttempts(importId: string) {
    return prisma.projectImport.update({
        where: { id: importId },
        data: {
            attempts: { increment: 1 },
        },
    })
}

async function findUserForImport(userId: string) {
    return prisma.user.findUnique({
        where: { id: userId },
        select: {
            id: true,
            githubToken: true,
        },
    })
}

async function countUserImports(data: { userId: string; sourceType: 'GITHUB' | 'ZIP' }) {
    const { userId, sourceType } = data
    return prisma.projectImport.count({
        where: {
            userId,
            sourceType,
        },
    })
}

async function findImportForStatus(data: {
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
}

export const importRepository = {
    updateImport,
    createImport,
    createPlaceholderProject,
    updateImportedProjectVersion,
    findImportForFail,
    incrementAttempts,
    findUserForImport,
    countUserImports,
    findImportForStatus,
}
