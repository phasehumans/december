import { prisma } from '@december/database'

import { AppError } from '../../shared/appError'

import type { SessionFilters } from './session.types'
import type { Prisma } from '@december/database'

export async function findManySessions(userId: string, filters?: SessionFilters) {
    const where: Prisma.SessionWhereInput = {
        userId,
    }

    if (filters?.type) where.type = filters.type
    if (filters?.isArchived !== undefined) where.isArchived = filters.isArchived
    if (filters?.tags && filters.tags.length > 0) {
        where.tags = { hasEvery: filters.tags }
    }

    if (filters?.search && filters.search.trim().length > 0) {
        const searchTerms = filters.search.trim()
        where.AND = [
            {
                OR: [
                    { title: { contains: searchTerms, mode: 'insensitive' } },
                    {
                        messages: {
                            some: { content: { contains: searchTerms, mode: 'insensitive' } },
                        },
                    },
                ],
            },
        ]
    }

    const orderBy: Prisma.SessionOrderByWithRelationInput = {}
    if (filters?.sortBy) {
        orderBy[filters.sortBy] = filters.sortOrder || 'desc'
    } else {
        orderBy.updatedAt = 'desc'
    }

    const page = filters?.page || 1
    const limit = filters?.limit || 50
    const skip = (page - 1) * limit

    const [total, sessions] = await Promise.all([
        prisma.session.count({ where }),
        prisma.session.findMany({
            where,
            orderBy,
            skip,
            take: limit,
            include: {
                user: {
                    select: {
                        name: true,
                        email: true,
                        githubUsername: true,
                    },
                },
                messages: {
                    orderBy: { sequence: 'desc' },
                    take: 1,
                },
            },
        }),
    ])

    return {
        sessions,
        pagination: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        },
    }
}

export async function createSession(data: Prisma.SessionUncheckedCreateInput) {
    return prisma.session.create({ data })
}

export async function findSessionById(sessionId: string, userId: string) {
    return prisma.session.findFirst({
        where: {
            id: sessionId,
            userId,
        },
        include: {
            messages: {
                orderBy: { sequence: 'asc' },
            },
        },
    })
}

export async function updateSession(
    sessionId: string,
    userId: string,
    data: Prisma.SessionUpdateInput
) {
    const session = await prisma.session.findFirst({
        where: {
            id: sessionId,
            userId,
        },
    })
    if (!session) throw new AppError('Session not found', 404)

    return prisma.session.update({
        where: { id: sessionId },
        data,
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

export async function deleteSession(sessionId: string) {
    return prisma.session.delete({
        where: { id: sessionId },
    })
}

export async function findMessagesBySessionId(data: {
    sessionId: string
    beforeSequence?: number
    limit?: number
}) {
    const { sessionId, beforeSequence, limit = 50 } = data
    const where: Prisma.MessageWhereInput = {
        sessionId,
        ...(beforeSequence !== undefined ? { sequence: { lt: beforeSequence } } : {}),
    }

    const messages = await prisma.message.findMany({
        where,
        orderBy: { sequence: 'desc' },
        take: limit,
    })

    return messages.reverse()
}

export const sessionRepository = {
    findManySessions,
    createSession,
    findSessionById,
    findMessagesBySessionId,
    updateSession,
    findSessionOwner,
    deleteSession,
}
