import { prisma } from '@december/database'

import type { Prisma } from '@december/database'

const SESSION_SELECT = {
    id: true,
    userId: true,
    title: true,
    type: true,
    vmId: true,
    vmStatus: true,
    sandboxStatus: true,
    projectId: true,
    repoUrl: true,
    githubRepoUrl: true,
    githubRepoOwner: true,
    githubRepoName: true,
    gitProvider: true,
    branch: true,
    gitRef: true,
    prBranch: true,
    tags: true,
    contextStartSequence: true,
    settings: { select: { config: true } },
} satisfies Prisma.SessionSelect

/** a session of this user that is not deleted, or null */
export async function findSession(sessionId: string, userId: string) {
    return prisma.session.findFirst({
        where: { id: sessionId, userId, deletedAt: null },
        select: SESSION_SELECT,
    })
}

/** the messages the agent sees: from the context start on */
export async function findContextMessages(sessionId: string, fromSequence: number) {
    return prisma.message.findMany({
        where: { sessionId, sequence: { gte: fromSequence } },
        orderBy: { sequence: 'asc' },
        select: { role: true, content: true, blocks: true, sequence: true, status: true },
    })
}

export async function findLastSequence(sessionId: string) {
    const last = await prisma.message.findFirst({
        where: { sessionId },
        orderBy: { sequence: 'desc' },
        select: { sequence: true },
    })
    return last?.sequence ?? 0
}

export async function setContextStart(sessionId: string, sequence: number) {
    return prisma.session.update({
        where: { id: sessionId },
        data: { contextStartSequence: sequence },
        select: { contextStartSequence: true },
    })
}

/** saves the summary as the first message of the new context, in one transaction */
export async function saveCompactSummary(sessionId: string, content: string) {
    return prisma.$transaction(async (tx) => {
        const last = await tx.message.findFirst({
            where: { sessionId },
            orderBy: { sequence: 'desc' },
            select: { sequence: true },
        })
        const sequence = (last?.sequence ?? 0) + 1
        const message = await tx.message.create({
            data: { sessionId, role: 'ASSISTANT', content, status: 'summary', sequence },
        })
        await tx.session.update({
            where: { id: sessionId },
            data: { contextStartSequence: sequence },
        })
        return message
    })
}

/** the prompts the user sent, from the context start on, newest first */
export async function findUserTurns(sessionId: string, fromSequence: number) {
    return prisma.message.findMany({
        where: { sessionId, role: 'USER', sequence: { gte: fromSequence } },
        orderBy: { sequence: 'desc' },
        take: 100,
        select: { sequence: true, content: true, createdAt: true },
    })
}

export async function findMessage(sessionId: string, sequence: number) {
    return prisma.message.findUnique({
        where: { sessionId_sequence: { sessionId, sequence } },
        select: { role: true, content: true, sequence: true },
    })
}

export async function deleteMessagesFrom(sessionId: string, sequence: number) {
    return prisma.message.deleteMany({ where: { sessionId, sequence: { gte: sequence } } })
}

/** a copy of the session, its messages and its settings, as a new session of the user */
export async function forkSession(
    data: Prisma.SessionUncheckedCreateInput,
    sourceId: string,
    config: Prisma.InputJsonValue | null
) {
    return prisma.$transaction(async (tx) => {
        const session = await tx.session.create({ data })
        const messages = await tx.message.findMany({
            where: { sessionId: sourceId },
            orderBy: { sequence: 'asc' },
            select: { role: true, content: true, status: true, sequence: true, blocks: true },
        })
        if (messages.length > 0) {
            await tx.message.createMany({
                data: messages.map((message) => ({
                    sessionId: session.id,
                    role: message.role,
                    content: message.content,
                    status: message.status,
                    sequence: message.sequence,
                    blocks: (message.blocks ?? undefined) as Prisma.InputJsonValue | undefined,
                })),
            })
        }
        if (config !== null) {
            await tx.sessionSettings.create({ data: { sessionId: session.id, config } })
        }
        return session
    })
}

/** tokens and cost of one session, per model */
export async function sumSessionUsage(sessionId: string) {
    return prisma.usageEvent.groupBy({
        by: ['model', 'billingSource'],
        where: { sessionId },
        _sum: { inputTokens: true, outputTokens: true, totalTokens: true, costInCents: true },
        _count: { _all: true },
    })
}

/** what /check reports about the account */
export async function findCheckUser(userId: string) {
    return prisma.user.findUnique({
        where: { id: userId },
        select: {
            creditBalance: true,
            githubConnected: true,
            githubAppInstall: true,
            githubUsername: true,
            githubInstallations: { select: { accountLogin: true } },
            gitConnections: { select: { provider: true, username: true } },
            providerCredentials: { select: { provider: true, keyHint: true } },
        },
    })
}

export const sessionCommandRepository = {
    findSession,
    findContextMessages,
    findLastSequence,
    setContextStart,
    saveCompactSummary,
    findUserTurns,
    findMessage,
    deleteMessagesFrom,
    forkSession,
    sumSessionUsage,
    findCheckUser,
}
