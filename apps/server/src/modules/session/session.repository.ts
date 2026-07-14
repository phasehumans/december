import { prisma } from '@december/database'

import type { Prisma } from '@december/database'

export async function findManySessions(userId: string) {
    return prisma.session.findMany({
        where: { userId },
        orderBy: { updatedAt: 'desc' },
        include: {
            project: {
                select: {
                    id: true,
                    name: true,
                },
            },
            messages: {
                orderBy: { sequence: 'desc' },
                take: 1,
            },
        },
    })
}

export async function findSessionById(sessionId: string, userId: string) {
    return prisma.session.findFirst({
        where: { id: sessionId, userId },
        include: {
            messages: {
                orderBy: { sequence: 'asc' },
            },
            project: {
                select: {
                    id: true,
                    name: true,
                },
            },
        },
    })
}

export async function createSession(data: Prisma.SessionUncheckedCreateInput) {
    return prisma.session.create({ data })
}

export async function updateSession(
    sessionId: string,
    userId: string,
    data: Prisma.SessionUpdateInput
) {
    const session = await prisma.session.findFirst({ where: { id: sessionId, userId } })
    if (!session) throw new Error('Session not found')
    return prisma.session.update({
        where: { id: sessionId },
        data,
    })
}
