import { Prisma, prisma } from '@december/database'

import { AppError } from '../../shared/appError'

import { splitRepoFilter } from './session.utils'

import type {
    PullRequestFilters,
    RemovedPin,
    SessionFacetRepoRow,
    SessionFacetRows,
    SessionFilters,
} from './session.types'

/**
 * The sessions of one repository, for the repository filter of the sessions list and of
 * the pull requests list. `owner/name` matches that repository, a name alone matches it
 * under every owner. A row that knows its repository only by its link matches by the
 * end of the link.
 */
const repoFilterWhere = (repo: string): Prisma.SessionWhereInput => {
    const { owner, name } = splitRepoFilter(repo)
    return {
        OR: owner
            ? [
                  {
                      githubRepoOwner: { equals: owner, mode: 'insensitive' },
                      githubRepoName: { equals: name, mode: 'insensitive' },
                  },
                  // an old row has only the link: the owner and name are its end
                  ...[`/${owner}/${name}`, `/${owner}/${name}.git`].map((end) => ({
                      githubRepoName: null,
                      repoUrl: { endsWith: end, mode: 'insensitive' as const },
                  })),
              ]
            : [
                  { githubRepoName: { equals: name, mode: 'insensitive' } },
                  { repoUrl: { endsWith: `/${name}`, mode: 'insensitive' } },
                  { repoUrl: { endsWith: `/${name}.git`, mode: 'insensitive' } },
              ],
    }
}

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
    if (filters?.repoName) and.push(repoFilterWhere(filters.repoName))
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
            // the notification names the session (#636)
            title: true,
        },
    })
}

// every session of a user, with what is needed to stop its sandbox first (#636)
export async function findSessionsForDeleteAll(userId: string) {
    return prisma.session.findMany({
        where: { userId },
        select: { id: true, vmId: true, sandboxStatus: true },
    })
}

export async function deleteSessionsByIds(data: { userId: string; sessionIds: string[] }) {
    const { userId, sessionIds } = data
    return prisma.session.deleteMany({
        where: { userId, id: { in: sessionIds } },
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

/**
 * clears the waiting state of a session of this user; returns true when it changed. a
 * session that asks about a spend limit keeps waiting: only takeLimitQuestion ends that
 */
export async function clearPendingQuestion(sessionId: string, userId: string) {
    const result = await prisma.session.updateMany({
        where: { id: sessionId, userId, pendingQuestionAt: { not: null }, limitQuestionKind: null },
        data: { pendingQuestionAt: null },
    })
    return result.count > 0
}

/** the open spend limit question of a session of this user (#638) */
export async function findLimitQuestion(sessionId: string, userId: string) {
    return prisma.session.findFirst({
        where: { id: sessionId, userId },
        select: {
            id: true,
            limitQuestionKind: true,
            limitQuestionCents: true,
            limitHeldRun: true,
        },
    })
}

/**
 * saves the spend limit question and marks the session as waiting. true for the first
 * caller only, so one server node asks and notifies
 */
export async function setLimitQuestion(data: {
    sessionId: string
    kind: 'session' | 'day'
    limitCents: number
}) {
    const { sessionId, kind, limitCents } = data
    const result = await prisma.session.updateMany({
        where: { id: sessionId, limitQuestionKind: null },
        data: {
            limitQuestionKind: kind,
            limitQuestionCents: limitCents,
            pendingQuestionAt: new Date(),
        },
    })
    return result.count > 0
}

/**
 * ends the spend limit question (an answer, a stop, a new prompt). true for the first
 * caller only, so an answer that arrives twice continues the run once
 */
export async function takeLimitQuestion(sessionId: string, userId: string) {
    const result = await prisma.session.updateMany({
        where: { id: sessionId, userId, limitQuestionKind: { not: null } },
        data: {
            limitQuestionKind: null,
            limitQuestionCents: null,
            limitHeldRun: Prisma.DbNull,
            pendingQuestionAt: null,
        },
    })
    return result.count > 0
}

/**
 * puts back a spend limit question that takeLimitQuestion ended, with its held run: the
 * "Continue" could not queue the run. only a session with no open question changes
 */
export async function restoreLimitQuestion(data: {
    sessionId: string
    kind: 'session' | 'day'
    limitCents: number | null
    heldRun: Record<string, unknown> | null
}) {
    const { sessionId, kind, limitCents, heldRun } = data
    const result = await prisma.session.updateMany({
        where: { id: sessionId, limitQuestionKind: null },
        data: {
            limitQuestionKind: kind,
            limitQuestionCents: limitCents,
            limitHeldRun: heldRun ? (heldRun as Prisma.InputJsonValue) : Prisma.DbNull,
            pendingQuestionAt: new Date(),
        },
    })
    return result.count > 0
}

/**
 * clears a held run that no question asks about: nothing would ever continue it, and it
 * must not start with the answer to a later question
 */
export async function clearStaleHeldRun(sessionId: string) {
    const result = await prisma.session.updateMany({
        where: { id: sessionId, limitQuestionKind: null, limitHeldRun: { not: Prisma.DbNull } },
        data: { limitHeldRun: Prisma.DbNull },
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

/** archives every merged, not running session of the user; returns their ids and the
 * pins that the archive removed, for the undo */
export async function archiveMergedSessions(userId: string) {
    return prisma.$transaction(async (tx) => {
        const rows = await tx.session.findMany({
            where: mergedIdleWhere(userId),
            select: { id: true, pinnedAt: true },
        })
        const sessionIds = rows.map((row) => row.id)
        const pins: RemovedPin[] = rows.flatMap((row) =>
            row.pinnedAt ? [{ sessionId: row.id, pinnedAt: row.pinnedAt }] : []
        )
        if (sessionIds.length > 0) {
            // raw SQL, because updateMany sets updatedAt and the list order would change.
            // archive drops the pin
            await tx.$executeRaw`UPDATE "Session" SET "isArchived" = true, "pinnedAt" = NULL WHERE "userId" = ${userId} AND "id" = ANY(${sessionIds})`
        }
        return { sessionIds, pins }
    })
}

/**
 * unarchives the given sessions of the user and puts back the given pins of those
 * sessions, while the user has fewer than `pinLimit` pins. returns the ids that changed
 */
export async function unarchiveSessions(
    userId: string,
    sessionIds: string[],
    pins: RemovedPin[],
    pinLimit: number
) {
    return prisma.$transaction(async (tx) => {
        const rows = await tx.session.findMany({
            where: { id: { in: sessionIds }, userId, isArchived: true },
            select: { id: true },
        })
        const changed = rows.map((row) => row.id)
        if (changed.length === 0) return changed

        // raw SQL keeps updatedAt, so undo puts the sessions back where they were
        await tx.$executeRaw`UPDATE "Session" SET "isArchived" = false WHERE "userId" = ${userId} AND "id" = ANY(${changed})`

        const restore = pins.filter((pin) => changed.includes(pin.sessionId))
        if (restore.length > 0) {
            // the same lock as a pin, so the limit holds
            await tx.$executeRaw`SELECT 1 FROM "User" WHERE "id" = ${userId} FOR UPDATE`
            const pinned = await tx.session.count({ where: { userId, pinnedAt: { not: null } } })
            const room = Math.max(0, pinLimit - pinned)
            for (const pin of restore.slice(0, room)) {
                await tx.$executeRaw`UPDATE "Session" SET "pinnedAt" = ${pin.pinnedAt} WHERE "userId" = ${userId} AND "id" = ${pin.sessionId}`
            }
        }
        return changed
    })
}

// a state that was never saved reads as open
const OPEN_PULL_REQUEST: Prisma.SessionWhereInput = {
    OR: [{ prState: null }, { prState: { in: ['open', 'draft'] } }],
}

/**
 * the rows of the Pull requests page. the list and its Open count use this one rule, so
 * the count is never different from the rows. `isArchived` not given: an open or draft
 * pull request of an archived session is left out. a merged or closed one stays, because
 * a merge archives its session ("archive on merge", #637)
 */
const pullRequestRowsWhere = (userId: string, isArchived?: boolean): Prisma.SessionWhereInput => ({
    userId,
    deletedAt: null,
    prNumber: { not: null },
    type: { not: 'SEARCH' },
    ...(isArchived === undefined
        ? { OR: [{ isArchived: false }, { NOT: OPEN_PULL_REQUEST }] }
        : { isArchived }),
})

/** counts for the list switches and menus; archived sessions left out */
export async function countSessions(userId: string) {
    const active = { userId, isArchived: false }
    const [running, openPullRequests, merged] = await Promise.all([
        prisma.session.count({
            where: { ...active, vmStatus: { in: [...ACTIVE_VM_STATUSES] } },
        }),
        prisma.session.count({
            where: { AND: [pullRequestRowsWhere(userId), OPEN_PULL_REQUEST] },
        }),
        prisma.session.count({ where: mergedIdleWhere(userId) }),
    ])
    return { running, openPullRequests, merged }
}

/**
 * every repository spelling and every tag on the user's sessions that are not deleted,
 * archived ones included (#641). the database makes the lists short, so a user with many
 * sessions does not load them all. hasPr keeps only the sessions that opened a pull request
 */
export async function findSessionFacets(userId: string, hasPr: boolean): Promise<SessionFacetRows> {
    const [repos, tags] = await Promise.all([
        prisma.$queryRaw<SessionFacetRepoRow[]>`
            SELECT "githubRepoOwner", "githubRepoName",
                CASE WHEN "githubRepoName" IS NULL THEN "repoUrl" END AS "repoUrl",
                COUNT(*)::int AS "sessions"
            FROM "Session"
            WHERE "userId" = ${userId} AND "deletedAt" IS NULL
                AND (${hasPr}::boolean = false OR "prNumber" IS NOT NULL)
                AND ("githubRepoName" IS NOT NULL OR "repoUrl" IS NOT NULL)
            GROUP BY 1, 2, 3`,
        prisma.$queryRaw<{ tag: string }[]>`
            SELECT DISTINCT unnest("tags") AS "tag"
            FROM "Session"
            WHERE "userId" = ${userId} AND "deletedAt" IS NULL
                AND (${hasPr}::boolean = false OR "prNumber" IS NOT NULL)`,
    ])
    return { repos, tags: tags.map((row) => row.tag) }
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

/**
 * Sessions whose agent is working (vmStatus). An idle sandbox left running after a turn
 * (sandboxStatus) does not count: the worker pauses those, 10 per user (#624).
 */
export async function countWorkingSessions(userId: string) {
    return prisma.session.count({
        where: { userId, vmStatus: { in: ['PROVISIONING', 'RUNNING'] } },
    })
}

export async function touchSandboxActivity(sessionId: string) {
    await prisma.session
        .updateMany({
            where: { id: sessionId, sandboxStatus: 'RUNNING' },
            data: { vmLastActivityAt: new Date() },
        })
        .catch((err: any) => {
            // a missed touch only starts the idle window a little earlier
            console.warn('[session] preview activity touch failed:', err?.message || err)
        })
}

/** the agent run and the sandbox of a session of this user, for a stop (#637) */
export async function findSessionRunState(sessionId: string, userId: string) {
    return prisma.session.findFirst({
        where: { id: sessionId, userId },
        select: { id: true, vmId: true, vmStatus: true, sandboxStatus: true },
    })
}

/** the sessions of this user whose sandbox starts or runs, newest first (#637) */
export async function findRunningSandboxes(userId: string) {
    return prisma.session.findMany({
        where: { userId, sandboxStatus: { in: ['STARTING', 'RUNNING'] } },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        // far over the 10 running sandboxes a user can have (#624)
        take: 100,
        select: {
            id: true,
            title: true,
            githubRepoOwner: true,
            githubRepoName: true,
            createdAt: true,
            sandboxStartedAt: true,
            sandboxStatus: true,
        },
    })
}

/** the cost of each session on december credits, in cents. own-key runs are not counted */
export async function sumCreditCostBySession(sessionIds: string[]) {
    if (sessionIds.length === 0) return new Map<string, number>()
    const rows = await prisma.usageEvent.groupBy({
        by: ['sessionId'],
        where: { sessionId: { in: sessionIds }, billingSource: 'CREDITS' },
        _sum: { costInCents: true },
    })
    return new Map(rows.map((row) => [row.sessionId, row._sum.costInCents ?? 0]))
}

const PULL_REQUEST_SELECT = {
    id: true,
    title: true,
    tags: true,
    type: true,
    gitProvider: true,
    githubRepoOwner: true,
    githubRepoName: true,
    repoUrl: true,
    githubRepoUrl: true,
    branch: true,
    prNumber: true,
    prState: true,
    prTitle: true,
    prUrl: true,
    prBranch: true,
    prAdditions: true,
    prDeletions: true,
    prOpenedAt: true,
    prMergedAt: true,
    prClosedAt: true,
    createdAt: true,
    updatedAt: true,
} satisfies Prisma.SessionSelect

/** the pull requests december opened for this user, one row per session (#632) */
export async function findPullRequests(userId: string, filters: PullRequestFilters) {
    const page = filters.page ?? 1
    const limit = filters.limit ?? 50
    const and: Prisma.SessionWhereInput[] = [pullRequestRowsWhere(userId, filters.isArchived)]

    if (filters.states && filters.states.length > 0) {
        const states = new Set(filters.states)
        // a state that was never saved reads as open
        and.push({
            OR: [
                { prState: { in: [...states] } },
                ...(states.has('open') ? [{ prState: null }] : []),
            ],
        })
    }
    if (filters.repo) and.push(repoFilterWhere(filters.repo))
    if (filters.tag) and.push({ tags: { has: filters.tag } })
    if (filters.search && filters.search.trim()) {
        const needle = filters.search.trim().replace(/^#/, '')
        const asNumber = /^\d+$/.test(needle) ? Number(needle) : null
        and.push({
            OR: [
                { title: { contains: needle, mode: 'insensitive' } },
                { prTitle: { contains: needle, mode: 'insensitive' } },
                { prBranch: { contains: needle, mode: 'insensitive' } },
                { githubRepoName: { contains: needle, mode: 'insensitive' } },
                ...(asNumber !== null ? [{ prNumber: asNumber }] : []),
            ],
        })
    }

    const where: Prisma.SessionWhereInput = { AND: and }
    const sortOrder = filters.sortOrder ?? 'desc'
    // an old row has no opened date: it sorts by the session date after the dated rows.
    // the id breaks ties, so pages do not repeat or skip rows with the same time
    const orderBy: Prisma.SessionOrderByWithRelationInput[] =
        filters.sortBy === 'prOpenedAt'
            ? [
                  { prOpenedAt: { sort: sortOrder, nulls: 'last' } },
                  { createdAt: sortOrder },
                  { id: 'desc' },
              ]
            : [{ [filters.sortBy ?? 'updatedAt']: sortOrder }, { id: 'desc' }]

    const [rows, total] = await Promise.all([
        prisma.session.findMany({
            where,
            orderBy,
            skip: (page - 1) * limit,
            take: limit,
            select: PULL_REQUEST_SELECT,
        }),
        prisma.session.count({ where }),
    ])

    return {
        rows,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    }
}

/** open or draft pull requests of this user that were not read from the host lately */
export async function findStalePullRequests(userId: string, checkedBefore: Date, take: number) {
    return prisma.session.findMany({
        where: {
            userId,
            deletedAt: null,
            prNumber: { not: null },
            githubRepoOwner: { not: null },
            githubRepoName: { not: null },
            OR: [{ prState: null }, { prState: { in: ['open', 'draft'] } }],
            AND: [{ OR: [{ prCheckedAt: null }, { prCheckedAt: { lt: checkedBefore } }] }],
        },
        orderBy: { updatedAt: 'desc' },
        take,
        select: {
            id: true,
            gitProvider: true,
            githubRepoOwner: true,
            githubRepoName: true,
            prNumber: true,
        },
    })
}

/**
 * The pull request as the host reports it now; only the given fields change. The session
 * keeps its updatedAt, so a state check does not move it up the sessions list.
 */
export async function updatePullRequestFields(
    where: Prisma.SessionWhereInput,
    data: Prisma.SessionUpdateInput
) {
    const sessions = await prisma.session.findMany({
        where,
        select: { id: true, userId: true, updatedAt: true, prState: true },
    })
    await Promise.all(
        sessions.map((session) =>
            prisma.session.update({
                where: { id: session.id },
                data: { ...data, updatedAt: session.updatedAt },
            })
        )
    )
    // previousState: the state before this write, so the caller sees a change to merged
    return sessions.map(({ id, userId, prState }) => ({ id, userId, previousState: prState }))
}

/**
 * "Archive the session when the pull request merges" (#637): archives the given sessions,
 * but not those of a user who turned the setting off (no saved row means on) and not a
 * session that works right now, like "Archive merged". returns the archived ids
 */
export async function archiveSessionsOnMerge(sessionIds: string[]) {
    if (sessionIds.length === 0) return []
    return prisma.$transaction(async (tx) => {
        const rows = await tx.session.findMany({
            where: {
                id: { in: sessionIds },
                isArchived: false,
                deletedAt: null,
                vmStatus: { notIn: [...ACTIVE_VM_STATUSES] },
                user: {
                    OR: [
                        { pullRequestSettings: { is: null } },
                        { pullRequestSettings: { is: { archiveOnMerge: true } } },
                    ],
                },
            },
            select: { id: true },
        })
        const ids = rows.map((row) => row.id)
        if (ids.length > 0) {
            // raw SQL keeps updatedAt, so the list order does not change. archive drops the pin
            await tx.$executeRaw`UPDATE "Session" SET "isArchived" = true, "pinnedAt" = NULL WHERE "id" = ANY(${ids})`
        }
        return ids
    })
}

/** the sequence of the user message for this prompt; reuses an unanswered same prompt */
export async function saveUserPrompt(sessionId: string, prompt: string) {
    return prisma.$transaction(async (tx) => {
        const last = await tx.message.findFirst({
            where: { sessionId },
            orderBy: { sequence: 'desc' },
            select: { sequence: true, role: true, content: true },
        })
        if (last && last.role === 'USER' && last.content === prompt) return last.sequence
        const sequence = (last?.sequence ?? 0) + 1
        await tx.message.create({ data: { sessionId, role: 'USER', content: prompt, sequence } })
        return sequence
    })
}

/** the saved web preferences of a user (#636), for `messageWhileWorking` (#637) */
export async function findUserPreferences(userId: string) {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { preferences: true },
    })
    return user?.preferences ?? null
}

/** the user's defaults for a new session (#632, #637) */
export async function findUserRunDefaults(userId: string) {
    return prisma.user.findUnique({
        where: { id: userId },
        select: {
            defaultPlanFirst: true,
            defaultEffort: true,
            defaultOpenPullRequest: true,
            defaultOwnKeyProvider: true,
            defaultOwnKeyModel: true,
        },
    })
}

/** the saved config of a session of this user; null when the session is not theirs */
export async function findSessionRunConfig(sessionId: string, userId: string) {
    const session = await prisma.session.findFirst({
        where: { id: sessionId, userId },
        select: { id: true, settings: { select: { config: true } } },
    })
    if (!session) return null
    return { config: session.settings?.config ?? null }
}

/** merges the run config into the session's settings, keeping any other saved keys */
export async function saveSessionRunConfig(
    sessionId: string,
    config: Prisma.InputJsonObject,
    previous: unknown
) {
    const base =
        previous && typeof previous === 'object' && !Array.isArray(previous)
            ? (previous as Prisma.InputJsonObject)
            : {}
    const merged = { ...base, ...config }
    return prisma.sessionSettings.upsert({
        where: { sessionId },
        create: { sessionId, config: merged },
        update: { config: merged },
    })
}

export const sessionRepository = {
    saveUserPrompt,
    findUserPreferences,
    findSessionsForDeleteAll,
    deleteSessionsByIds,
    findPullRequests,
    findStalePullRequests,
    updatePullRequestFields,
    archiveSessionsOnMerge,
    findUserRunDefaults,
    findSessionRunConfig,
    saveSessionRunConfig,
    countWorkingSessions,
    touchSandboxActivity,
    findSessionRunState,
    findRunningSandboxes,
    sumCreditCostBySession,
    findManySessions,
    findUserRepoNames,
    pinSessionWithinLimit,
    archiveMergedSessions,
    unarchiveSessions,
    countSessions,
    findSessionFacets,
    setPendingQuestion,
    clearPendingQuestion,
    findLimitQuestion,
    setLimitQuestion,
    takeLimitQuestion,
    restoreLimitQuestion,
    clearStaleHeldRun,
    createSession,
    findSessionById,
    findMessagesBySessionId,
    updateSession,
    findSessionOwner,
    deleteSession,
}
