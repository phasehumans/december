import { prisma } from '@december/database'
import type { Prisma, ProjectImportStatus } from '@december/database'

async function updateImport(data: {
    importId: string
    status: ProjectImportStatus
    updateData?: Prisma.SessionImportUpdateInput
    select: Prisma.SessionImportSelect
}) {
    const { importId, status, updateData, select } = data
    return prisma.sessionImport.update({
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
    sessionId?: string | null
    select: Prisma.SessionImportSelect
}) {
    const { userId, sourceType, sourceUrl, sourceFileName, sessionId, select } = data
    return prisma.sessionImport.create({
        data: {
            userId,
            sourceType,
            sessionId: sessionId ?? undefined,
            sourceUrl: sourceUrl ?? undefined,
            sourceFileName: sourceFileName ?? undefined,
        },
        select,
    })
}

async function createPlaceholderSession(data: {
    sessionId: string
    userId: string
    displayName: string
    prompt: string
}) {
    const { sessionId, userId, displayName, prompt } = data
    return prisma.session.create({
        data: {
            id: sessionId,
            title: displayName,
            userId,
            type: 'WEB',
        },
        select: {
            id: true,
        },
    })
}

async function updateImportedSessionWorkspace(data: {
    sessionId: string
    messages: Array<{
        role: 'USER' | 'ASSISTANT' | 'SYSTEM'
        content: string
        sequence: number
        status?: string
    }>
}) {
    const { sessionId, messages } = data
    return prisma.$transaction(async (tx) => {
        if (messages.length > 0) {
            await tx.message.createMany({
                data: messages.map((msg) => ({
                    role: msg.role,
                    content: msg.content,
                    sequence: msg.sequence,
                    status: msg.status ?? 'SENT',
                    sessionId,
                })),
            })
        }
    })
}

async function findImportForFail(importId: string) {
    return prisma.sessionImport.findUnique({
        where: { id: importId },
        select: {
            objectPrefix: true,
            sessionId: true,
        },
    })
}

async function incrementAttempts(importId: string) {
    return prisma.sessionImport.update({
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
    return prisma.sessionImport.count({
        where: {
            userId,
            sourceType,
        },
    })
}

async function findImportForStatus(data: {
    id: string
    userId: string
    select: Prisma.SessionImportSelect
}) {
    const { id, userId, select } = data
    return prisma.sessionImport.findFirst({
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
    createPlaceholderSession,
    updateImportedSessionWorkspace,
    findImportForFail,
    incrementAttempts,
    findUserForImport,
    countUserImports,
    findImportForStatus,
}
