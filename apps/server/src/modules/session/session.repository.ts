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
    if (filters?.hasPr) where.prNumber = { not: null }
    if (filters?.needsAnswer) where.pendingQuestionAt = { not: null }
    if (filters?.vmStatus) {
        if (filters.vmStatus === 'active' || filters.vmStatus === 'running') {
            where.vmStatus = { in: ['PROVISIONING', 'RUNNING'] }
        } else {
            where.vmStatus = filters.vmStatus as any
        }
    }

    if (filters?.search && filters.search.trim().length > 0) {
        const searchTerms = filters.search.trim()
        const titleMatch: Prisma.SessionWhereInput = {
            title: { contains: searchTerms, mode: 'insensitive' },
        }
        where.AND = [
            filters.searchIn === 'title'
                ? titleMatch
                : {
                      OR: [
                          titleMatch,
                          {
                              messages: {
                                  some: {
                                      content: { contains: searchTerms, mode: 'insensitive' },
                                  },
                              },
                          },
                      ],
                  },
        ]
    }

    const and: Prisma.SessionWhereInput[] = Array.isArray(where.AND) ? [...where.AND] : []
    if (filters?.titleAny && filters.titleAny.length > 0) {
        and.push({
            OR: filters.titleAny.map((word) => ({
                title: { contains: word, mode: 'insensitive' as const },
            })),
        })
    }
    if (filters?.repoName) {
        and.push({
            OR: [
                { githubRepoName: { equals: filters.repoName, mode: 'insensitive' } },
                { repoUrl: { endsWith: `/${filters.repoName}`, mode: 'insensitive' } },
                { repoUrl: { endsWith: `/${filters.repoName}.git`, mode: 'insensitive' } },
            ],
        })
    }
    if (filters?.updatedAfter) where.updatedAt = { gte: filters.updatedAfter }
    if (and.length > 0) where.AND = and

    const sort: Prisma.SessionOrderByWithRelationInput = {
        [filters?.sortBy ?? 'updatedAt']: filters?.sortOrder || 'desc',
    }
    // pinned rows first (newest pin first), then the asked sort; the id breaks ties, so
    // pages do not repeat or skip rows with the same time
    const orderBy: Prisma.SessionOrderByWithRelationInput[] = filters?.pinnedFirst
        ? [{ pinnedAt: { sort: 'desc', nulls: 'last' } }, sort, { id: 'desc' }]
        : [sort, { id: 'desc' }]

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

/** saves that the agent waits for an answer; returns the owner, or null when nothing changed */
export async function setPendingQuestion(sessionId: string) {
    const result = await prisma.session.updateMany({
        where: { id: sessionId, pendingQuestionAt: null },
        data: { pendingQuestionAt: new Date() },
    })
    if (result.count === 0) return null
    return findSessionOwner(sessionId)
}

/** clears the waiting state of a session of this user; returns true when it changed */
export async function clearPendingQuestion(sessionId: string, userId: string) {
    const result = await prisma.session.updateMany({
        where: { id: sessionId, userId, pendingQuestionAt: { not: null } },
        data: { pendingQuestionAt: null },
    })
    return result.count > 0
}

// "running" in the list: the sandbox starts or runs
const ACTIVE_VM_STATUSES = ['PROVISIONING', 'RUNNING'] as const

// what "Archive merged" archives, and what its count counts: keep the two in step
const mergedIdleWhere = (userId: string): Prisma.SessionWhereInput => ({
    userId,
    isArchived: false,
    prState: 'merged',
    vmStatus: { notIn: [...ACTIVE_VM_STATUSES] },
})

/** archives every merged, not running session of the user; returns their ids */
export async function archiveMergedSessions(userId: string) {
    return prisma.$transaction(async (tx) => {
        const rows = await tx.session.findMany({
            where: mergedIdleWhere(userId),
            select: { id: true },
        })
        const sessionIds = rows.map((row) => row.id)
        if (sessionIds.length > 0) {
            // raw SQL, because updateMany sets updatedAt and the list order would change.
            // archive drops the pin
            await tx.$executeRaw`UPDATE "Session" SET "isArchived" = true, "pinnedAt" = NULL WHERE "userId" = ${userId} AND "id" = ANY(${sessionIds})`
        }
        return sessionIds
    })
}

/** unarchives the given sessions of the user; returns the ids that changed */
export async function unarchiveSessions(userId: string, sessionIds: string[]) {
    return prisma.$transaction(async (tx) => {
        const rows = await tx.session.findMany({
            where: { id: { in: sessionIds }, userId, isArchived: true },
            select: { id: true },
        })
        const changed = rows.map((row) => row.id)
        if (changed.length > 0) {
            // raw SQL keeps updatedAt, so undo puts the sessions back where they were
            await tx.$executeRaw`UPDATE "Session" SET "isArchived" = false WHERE "userId" = ${userId} AND "id" = ANY(${changed})`
        }
        return changed
    })
}

/** counts for the list switches and menus; archived sessions left out */
export async function countSessions(userId: string) {
    const active = { userId, isArchived: false }
    const [running, openPullRequests, merged] = await Promise.all([
        prisma.session.count({
            where: { ...active, vmStatus: { in: [...ACTIVE_VM_STATUSES] } },
        }),
        prisma.session.count({
            where: {
                ...active,
                prNumber: { not: null },
                // a state that was never saved reads as open
                OR: [{ prState: null }, { prState: { in: ['open', 'draft'] } }],
            },
        }),
        prisma.session.count({ where: mergedIdleWhere(userId) }),
    ])
    return { running, openPullRequests, merged }
}

/**
 * pins the session when the user has fewer than `limit` pins. the user row is locked
 * first, so two pins at the same time cannot both pass the limit. returns null when full
 */
export async function pinSessionWithinLimit(sessionId: string, userId: string, limit: number) {
    return prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT 1 FROM "User" WHERE "id" = ${userId} FOR UPDATE`
        const pinned = await tx.session.count({ where: { userId, pinnedAt: { not: null } } })
        if (pinned >= limit) return null
        const session = await tx.session.findFirst({ where: { id: sessionId, userId } })
        if (!session) return null
        // the same updatedAt, so the session keeps its place in "Last updated"
        return tx.session.update({
            where: { id: sessionId },
            data: { pinnedAt: new Date(), updatedAt: session.updatedAt },
        })
    })
}

/** distinct repo names across the user's sessions, for AI search filters */
export async function findUserRepoNames(userId: string) {
    const rows = await prisma.session.findMany({
        where: { userId, githubRepoName: { not: null } },
        select: { githubRepoName: true },
        distinct: ['githubRepoName'],
        take: 50,
    })
    return rows.map((row) => row.githubRepoName).filter((name): name is string => Boolean(name))
}

// one preview write per session per 30 seconds is enough for the 10 minute idle window
const PREVIEW_TOUCH_THROTTLE_MS = 30 * 1000
const lastPreviewTouch = new Map<string, number>()

export async function touchSandboxActivity(sessionId: string) {
    const now = Date.now()
    if (now - (lastPreviewTouch.get(sessionId) ?? 0) < PREVIEW_TOUCH_THROTTLE_MS) return
    lastPreviewTouch.set(sessionId, now)
    await prisma.session
        .updateMany({
            where: { id: sessionId, vmStatus: 'RUNNING' },
            data: { vmLastActivityAt: new Date(now) },
        })
        .catch((err: any) => {
            // a missed touch only starts the idle window a little earlier
            console.warn('[session] preview activity touch failed:', err?.message || err)
        })
}

export const sessionRepository = {
    touchSandboxActivity,
    findManySessions,
    findUserRepoNames,
    pinSessionWithinLimit,
    archiveMergedSessions,
    unarchiveSessions,
    countSessions,
    setPendingQuestion,
    clearPendingQuestion,
    createSession,
    findSessionById,
    findMessagesBySessionId,
    updateSession,
    findSessionOwner,
    deleteSession,
}
