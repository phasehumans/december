import { prisma } from '@december/database'

const attachmentSelect = {
    id: true,
    name: true,
    contentType: true,
    sizeBytes: true,
    fileKey: true,
} as const

/** the session, only when it belongs to this user */
async function findOwnedSession(sessionId: string, userId: string) {
    return prisma.session.findFirst({
        where: { id: sessionId, userId },
        select: { id: true },
    })
}

async function sumSessionBytes(sessionId: string) {
    const result = await prisma.messageAttachment.aggregate({
        where: { sessionId },
        _sum: { sizeBytes: true },
    })
    return result._sum.sizeBytes ?? 0
}

async function createAttachment(data: {
    id: string
    sessionId: string
    name: string
    contentType: string
    sizeBytes: number
    fileKey: string
}) {
    return prisma.messageAttachment.create({ data, select: attachmentSelect })
}

/** one file of a session, only when the session belongs to this user */
async function findOwnedAttachment(data: {
    sessionId: string
    userId: string
    attachmentId: string
}) {
    const { sessionId, userId, attachmentId } = data
    return prisma.messageAttachment.findFirst({
        where: { id: attachmentId, sessionId, session: { userId } },
        select: { id: true, fileKey: true, messageId: true },
    })
}

/** removes a file that no message has. gives the count: 0 when a prompt took it first */
async function deleteWaitingAttachment(data: { sessionId: string; attachmentId: string }) {
    const { sessionId, attachmentId } = data
    const result = await prisma.messageAttachment.deleteMany({
        where: { id: attachmentId, sessionId, messageId: null },
    })
    return result.count
}

/** the user message with this sequence, only in a session of this user */
async function findOwnedUserMessage(data: { sessionId: string; userId: string; sequence: number }) {
    const { sessionId, userId, sequence } = data
    return prisma.message.findFirst({
        where: { sessionId, sequence, role: 'USER', session: { userId } },
        select: { id: true },
    })
}

/**
 * Ties files to the message of their prompt. Only files of this session that no message
 * has yet are taken, so an id from another session or user changes nothing.
 */
async function claimForMessage(data: { sessionId: string; ids: string[]; messageId: string }) {
    const { sessionId, ids, messageId } = data
    return prisma.$transaction(async (tx) => {
        await tx.messageAttachment.updateMany({
            where: { id: { in: ids }, sessionId, messageId: null },
            data: { messageId },
        })
        return tx.messageAttachment.findMany({
            where: { id: { in: ids }, sessionId, messageId },
            select: attachmentSelect,
            orderBy: { createdAt: 'asc' },
        })
    })
}

/** the files of a session that a message carries, oldest first */
async function findSentBySession(sessionId: string) {
    return prisma.messageAttachment.findMany({
        where: { sessionId, messageId: { not: null } },
        select: { ...attachmentSelect, messageId: true },
        orderBy: { createdAt: 'asc' },
    })
}

export const attachmentRepository = {
    findOwnedSession,
    sumSessionBytes,
    createAttachment,
    findOwnedAttachment,
    deleteWaitingAttachment,
    findOwnedUserMessage,
    claimForMessage,
    findSentBySession,
}
