import { prisma } from '@december/database'
import type { Prisma } from '@december/database'

export async function findManySessions(
    userId: string,
    filters?: import('./session.types').SessionFilters
) {
    const where: Prisma.SessionWhereInput = {
        OR: [{ userId }, { collaborators: { some: { userId } } }],
    }

    if (filters?.type) where.type = filters.type
    if (filters?.isArchived !== undefined) where.isArchived = filters.isArchived
    if (filters?.isPinned !== undefined) where.isPinned = filters.isPinned
    if (filters?.tags && filters.tags.length > 0) {
        where.tags = { hasEvery: filters.tags }
    }

    const orderBy: Prisma.SessionOrderByWithRelationInput = {}
    if (filters?.sortBy) {
        orderBy[filters.sortBy] = filters.sortOrder || 'desc'
    } else {
        orderBy.updatedAt = 'desc'
    }

    return prisma.session.findMany({
        where,
        orderBy,
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

export async function countActiveSessions(userId: string) {
    return prisma.session.count({
        where: {
            userId,
            vmStatus: { in: ['PROVISIONING', 'RUNNING'] },
        },
    })
}

export async function findSessionById(sessionId: string, userId: string) {
    return prisma.session.findFirst({
        where: {
            id: sessionId,
            OR: [{ userId }, { collaborators: { some: { userId } } }],
        },
        include: {
            project: {
                select: {
                    id: true,
                    name: true,
                },
            },
            messages: {
                orderBy: { sequence: 'asc' },
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
}

export async function createSession(data: Prisma.SessionUncheckedCreateInput) {
    return prisma.session.create({ data })
}

export async function updateSession(
    sessionId: string,
    userId: string,
    data: Prisma.SessionUpdateInput
) {
    // Assert access
    const session = await prisma.session.findFirst({
        where: {
            id: sessionId,
            OR: [{ userId }, { collaborators: { some: { userId } } }],
        },
    })
    if (!session) throw new Error('Session not found or access denied')

    return prisma.session.update({
        where: { id: sessionId },
        data,
    })
}

export async function deleteSession(sessionId: string) {
    return prisma.session.delete({
        where: { id: sessionId },
    })
}

export async function findSessionOwner(sessionId: string) {
    return prisma.session.findUnique({
        where: { id: sessionId },
        select: {
            id: true,
            userId: true,
        },
    })
}

export async function countCollaborators(sessionId: string) {
    return prisma.sessionCollaborator.count({
        where: { sessionId },
    })
}

export async function findCollaborator(sessionId: string, email: string) {
    return prisma.sessionCollaborator.findUnique({
        where: {
            sessionId_email: {
                sessionId,
                email,
            },
        },
    })
}

export async function findCollaboratorsBySessionId(sessionId: string) {
    return prisma.sessionCollaborator.findMany({
        where: { sessionId },
        select: {
            id: true,
            sessionId: true,
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
}

export async function addCollaborator(sessionId: string, userId: string, email: string) {
    return prisma.sessionCollaborator.create({
        data: {
            sessionId,
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
}

export async function removeCollaborator(sessionId: string, email: string) {
    return prisma.sessionCollaborator.delete({
        where: {
            sessionId_email: {
                sessionId,
                email,
            },
        },
    })
}

export async function findUserByEmailOrUsername(input: string) {
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
}
