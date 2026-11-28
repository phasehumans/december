import { Prisma, prisma } from '@december/database'

import { escapeLike } from '../../shared/escape-like'

import type { UserFilter } from './admin.types'

const findAdminUser = async (userId: string) =>
    prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true, name: true, emailVerified: true, isDeleted: true },
    })

const writeAuditLog = async (data: {
    adminUserId: string
    action: string
    targetType: string
    targetId?: string | null
    metadata?: Prisma.InputJsonValue
}) => prisma.adminAuditLog.create({ data })

// a1 credit requests

/** The waiting credit request of each user on a page of the Users tab. */
const findPendingRequests = async (userIds: string[]) =>
    userIds.length === 0
        ? []
        : prisma.creditRequest.findMany({
              where: { userId: { in: userIds }, status: 'PENDING' },
              select: {
                  id: true,
                  userId: true,
                  buildPlan: true,
                  heardFrom: true,
                  createdAt: true,
                  ipAddress: true,
                  normalizedEmail: true,
              },
          })

/** The newest feedback of each user on a page of the Users tab. */
const findLatestFeedback = async (userIds: string[]) =>
    userIds.length === 0
        ? []
        : prisma.feedback.findMany({
              where: { userId: { in: userIds } },
              distinct: ['userId'],
              orderBy: { createdAt: 'desc' },
              select: { userId: true, feedback: true, rating: true, createdAt: true },
          })

const countRequestsFromIp = async (ipAddress: string, excludeId: string) =>
    prisma.creditRequest.count({ where: { ipAddress, id: { not: excludeId } } })

/** Other accounts whose address lands in the same inbox (gmail dots, +tags, googlemail). */
const countAccountsForNormalizedEmail = async (normalizedEmail: string, excludeUserId?: string) => {
    const rows = await prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*)::bigint AS count FROM "User"
        WHERE (
            CASE
                WHEN split_part(lower(email), '@', 2) IN ('gmail.com', 'googlemail.com')
                THEN replace(split_part(split_part(lower(email), '@', 1), '+', 1), '.', '') || '@gmail.com'
                ELSE lower(email)
            END
        ) = ${normalizedEmail}
        AND id <> ${excludeUserId ?? ''}
    `
    return Number(rows[0]?.count ?? 0)
}

// product emails on, live and verified: the list for announcements (A5)
const findProductEmailUsers = async () =>
    prisma.user.findMany({
        where: { notifyProductUpdates: true, isDeleted: false, emailVerified: true },
        select: { id: true, name: true, email: true },
        orderBy: { createdAt: 'asc' },
        take: 5000,
    })

const findCreditRequest = async (id: string) =>
    prisma.creditRequest.findUnique({
        where: { id },
        include: { user: { select: { id: true, email: true, name: true, isDeleted: true } } },
    })

/**
 * Approve once: the status change, the GRANT wallet row and the balance move together.
 * Returns null when the request was not pending (approved twice, or rejected).
 */
/**
 * Returns null when the request was already handled, and { overCap } when the $5 would pass
 * a 24-hour credit cap (they count approvals and credits added by hand together).
 */
const approveCreditRequest = async (data: {
    requestId: string
    adminUserId: string
    amountInCents: number
    dailyCapCents: number
    userDailyCapCents: number
}) => {
    const { requestId, adminUserId, amountInCents, dailyCapCents, userDailyCapCents } = data
    return prisma.$transaction(async (tx) => {
        // the same lock as credit changes: one at a time across both
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('admin_credit_cap'))`
        const pending = await tx.creditRequest.findUnique({
            where: { id: requestId },
            select: { status: true, userId: true },
        })
        if (pending?.status === 'PENDING' && pending.userId) {
            const over = await checkCreditCaps({
                tx,
                adminUserId,
                userId: pending.userId,
                amountInCents,
                dailyCapCents,
                userDailyCapCents,
            })
            if (over) return over
        }

        // B10: never for an account that was deleted since it asked
        const claimed = await tx.creditRequest.updateMany({
            where: {
                id: requestId,
                status: 'PENDING',
                userId: { not: null },
                user: { is: { isDeleted: false } },
            },
            data: { status: 'APPROVED', reviewedBy: adminUserId, reviewedAt: new Date() },
        })
        if (claimed.count === 0) return null

        const request = await tx.creditRequest.findUniqueOrThrow({ where: { id: requestId } })
        const userId = request.userId as string
        await tx.walletTransaction.create({
            data: {
                userId,
                amountInCents,
                currency: 'USD',
                provider: 'GRANT',
                status: 'SUCCESS',
                metadata: { creditRequestId: requestId, approvedBy: adminUserId },
            },
        })
        // B9: the audit row commits with the money, or neither does
        await tx.adminAuditLog.create({
            data: {
                adminUserId,
                action: 'credit_request.approve',
                targetType: 'credit_request',
                targetId: requestId,
                metadata: { userId, amountInCents },
            },
        })
        const user = await tx.user.update({
            where: { id: userId },
            data: { creditBalance: { increment: amountInCents } },
            select: { id: true, email: true, name: true, creditBalance: true },
        })
        return { request, user }
    })
}

const rejectCreditRequest = async (data: {
    requestId: string
    adminUserId: string
    reason: string
}) => {
    const { requestId, adminUserId, reason } = data
    const result = await prisma.creditRequest.updateMany({
        where: { id: requestId, status: 'PENDING' },
        data: {
            status: 'REJECTED',
            reviewedBy: adminUserId,
            reviewedAt: new Date(),
            rejectReason: reason,
        },
    })
    return result.count
}

// users tab

const userSearch = (q?: string): Prisma.UserWhereInput =>
    q
        ? {
              OR: [
                  { email: { contains: escapeLike(q), mode: 'insensitive' } },
                  { name: { contains: escapeLike(q), mode: 'insensitive' } },
              ],
          }
        : {}

const USER_DAY_MS = 24 * 60 * 60 * 1000
const userFilter = (filter: UserFilter): Prisma.UserWhereInput => {
    switch (filter) {
        case 'active': {
            const since = new Date(Date.now() - 7 * USER_DAY_MS)
            return {
                OR: [
                    { usageEvents: { some: { createdAt: { gte: since } } } },
                    { sessions: { some: { updatedAt: { gte: since } } } },
                    { authSessions: { some: { updatedAt: { gte: since } } } },
                ],
            }
        }
        case 'asked':
            return { creditRequests: { some: { status: 'PENDING' } } }
        case 'feedback':
            return { feedbacks: { some: {} } }
        default:
            return {}
    }
}

const USER_ROW = {
    id: true,
    name: true,
    email: true,
    createdAt: true,
    creditBalance: true,
    githubId: true,
    googleId: true,
    githubUsername: true,
} as const

/** One page of users, newest signup first, and how many match in total. */
const listUsersPage = async (data: {
    q?: string
    page: number
    pageSize: number
    filter: UserFilter
}) => {
    const { q, page, pageSize, filter } = data
    const where: Prisma.UserWhereInput = {
        isDeleted: false,
        AND: [userSearch(q), userFilter(filter)],
    }
    const skip = (page - 1) * pageSize
    if (filter !== 'feedback') {
        return Promise.all([
            prisma.user.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip,
                take: pageSize,
                select: USER_ROW,
            }),
            prisma.user.count({ where }),
        ])
    }
    // M4: users who sent feedback, newest feedback first
    const groups = await prisma.feedback.groupBy({
        by: ['userId'],
        where: { user: { isDeleted: false, ...userSearch(q) } },
        _max: { createdAt: true },
        orderBy: { _max: { createdAt: 'desc' } },
        skip,
        take: pageSize,
    })
    const ids = groups.map((group) => group.userId)
    const [users, total] = await Promise.all([
        prisma.user.findMany({ where: { id: { in: ids } }, select: USER_ROW }),
        prisma.user.count({ where }),
    ])
    const order = new Map(ids.map((id, i) => [id, i]))
    return [users.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0)), total] as const
}

/**
 * U1 + D1-D11: everything the details card shows about one user, from real rows. No
 * tokens, keys, key hints, code hashes, IP addresses, session titles or repository names
 * leave this function: repositories and pull requests are counts only.
 */
const findUserDetails = async (userId: string) => {
    const user = await prisma.user.findFirst({
        where: { id: userId, isDeleted: false },
        select: {
            id: true,
            name: true,
            email: true,
            emailVerified: true,
            createdAt: true,
            githubId: true,
            googleId: true,
            githubUsername: true,
            githubConnected: true,
            githubAppInstall: true,
            creditBalance: true,
            onboardingCompletedAt: true,
            onboardingStep: true,
            notifyProductUpdates: true,
            notifySecurityAlerts: true,
            notifyLevel: true,
            notifyPush: true,
            timezone: true,
            defaultModelSource: true,
            defaultPlanFirst: true,
            defaultOpenPullRequest: true,
            idleStopMinutes: true,
            archiveAfterDays: true,
            lowBalanceAlertCents: true,
            sessionLimitCents: true,
            dayLimitCents: true,
            toolDenyRules: true,
            referralCode: true,
            gitConnections: { select: { provider: true, username: true } },
            providerCredentials: {
                select: { provider: true, defaultModel: true, verifiedAt: true, lastUsedAt: true },
                orderBy: { provider: 'asc' },
            },
            referredBy: { select: { status: true, inviter: { select: { email: true } } } },
            referralsMade: {
                select: { status: true, createdAt: true, invitee: { select: { email: true } } },
                orderBy: { createdAt: 'desc' },
                take: 50,
            },
            _count: {
                select: {
                    feedbacks: true,
                    skills: true,
                    mcpServers: true,
                    secrets: true,
                    pushSubscriptions: true,
                    projects: true,
                    githubInstallations: true,
                },
            },
        },
    })
    if (!user) return null

    const now = Date.now()
    const since30 = new Date(now - 30 * USER_DAY_MS)
    const since1 = new Date(now - USER_DAY_MS)
    const ofUser = { userId }
    const credits = { userId, billingSource: 'CREDITS' as const }
    const [
        devices,
        sessionCounts,
        repoCount,
        prLines,
        usageAll,
        spentAll,
        spent30,
        spentDay,
        ownKeyCalls,
        cliCalls,
        topModels,
        dailySpend,
        walletSums,
        failedPayments,
        wallet,
        creditRequest,
        feedback,
    ] = await Promise.all([
        prisma.authSession.findMany({
            where: { userId, isRevoked: false, expiresAt: { gt: new Date() } },
            select: { userAgent: true, createdAt: true, updatedAt: true },
            orderBy: { updatedAt: 'desc' },
            take: 20,
        }),
        Promise.all([
            prisma.session.count({ where: ofUser }),
            prisma.session.count({ where: { ...ofUser, isArchived: true } }),
            prisma.session.count({
                where: { ...ofUser, sandboxStatus: { in: ['STARTING', 'RUNNING'] } },
            }),
            prisma.session.count({ where: { ...ofUser, pendingQuestionAt: { not: null } } }),
            prisma.session.count({ where: { ...ofUser, githubRun: { not: Prisma.AnyNull } } }),
            prisma.session.count({ where: { ...ofUser, prNumber: { not: null } } }),
            prisma.session.count({ where: { ...ofUser, prMergedAt: { not: null } } }),
            prisma.session.count({
                where: { ...ofUser, prClosedAt: { not: null }, prMergedAt: null },
            }),
        ]),
        prisma.$queryRaw<Array<{ count: bigint }>>`
            SELECT COUNT(DISTINCT COALESCE(
                NULLIF(CONCAT_WS('/', "githubRepoOwner", "githubRepoName"), ''), "repoUrl"
            ))::bigint AS count
            FROM "Session"
            WHERE "userId" = ${userId}
                AND ("githubRepoName" IS NOT NULL OR "repoUrl" IS NOT NULL)
        `,
        prisma.session.aggregate({
            where: { ...ofUser, prNumber: { not: null } },
            _sum: { prAdditions: true, prDeletions: true },
        }),
        prisma.usageEvent.aggregate({
            where: { userId },
            _count: { _all: true },
            _sum: { totalTokens: true },
            _min: { createdAt: true },
            _max: { createdAt: true },
        }),
        prisma.usageEvent.aggregate({ where: credits, _sum: { costInCents: true } }),
        prisma.usageEvent.aggregate({
            where: { ...credits, createdAt: { gte: since30 } },
            _sum: { costInCents: true },
        }),
        prisma.usageEvent.aggregate({
            where: { ...credits, createdAt: { gte: since1 } },
            _sum: { costInCents: true },
        }),
        prisma.usageEvent.count({ where: { userId, billingSource: 'OWN_KEY' } }),
        prisma.usageEvent.count({
            where: { userId, externalRequestId: { startsWith: 'proxy-' } },
        }),
        prisma.usageEvent.groupBy({
            by: ['model'],
            where: { userId },
            _count: { _all: true },
            _sum: { costInCents: true },
            orderBy: { _count: { model: 'desc' } },
            take: 5,
        }),
        // D7: spend on credits per day (India time), the last 30 days
        prisma.$queryRaw<Array<{ day: string; cents: number }>>`
            SELECT to_char(timezone('Asia/Kolkata', "createdAt" AT TIME ZONE 'UTC'), 'YYYY-MM-DD') AS day,
                COALESCE(SUM("costInCents"), 0)::float AS cents
            FROM "UsageEvent"
            WHERE "userId" = ${userId} AND "billingSource" = 'CREDITS' AND "createdAt" >= ${since30}
            GROUP BY 1
            ORDER BY 1
        `,
        prisma.walletTransaction.groupBy({
            by: ['provider'],
            where: { userId, status: 'SUCCESS' },
            _sum: { amountInCents: true },
        }),
        prisma.walletTransaction.count({ where: { userId, status: 'FAILED' } }),
        prisma.walletTransaction.findMany({
            where: { userId },
            select: {
                id: true,
                provider: true,
                amountInCents: true,
                status: true,
                createdAt: true,
            },
            orderBy: { createdAt: 'desc' },
            take: 100,
        }),
        prisma.creditRequest.findFirst({
            where: { userId },
            select: {
                id: true,
                status: true,
                buildPlan: true,
                heardFrom: true,
                agreedToFeedback: true,
                rejectReason: true,
                reviewedAt: true,
                createdAt: true,
            },
            orderBy: { createdAt: 'desc' },
        }),
        prisma.feedback.findMany({
            where: { userId },
            select: { id: true, rating: true, feedback: true, createdAt: true },
            orderBy: { createdAt: 'desc' },
            take: 50,
        }),
    ])

    // D11: what an admin did to this user or to their credit request
    const adminHistory = await prisma.adminAuditLog.findMany({
        where: {
            OR: [
                { targetType: 'user', targetId: userId },
                ...(creditRequest
                    ? [{ targetType: 'credit_request', targetId: creditRequest.id }]
                    : []),
            ],
        },
        select: { id: true, action: true, metadata: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 50,
    })

    const [sessions, archived, running, waiting, githubRuns, prOpened, prMerged, prClosed] =
        sessionCounts
    return {
        user,
        devices,
        sessions: {
            total: sessions,
            archived,
            running,
            waiting,
            githubRuns,
            repos: Number(repoCount[0]?.count ?? 0),
        },
        prs: {
            opened: prOpened,
            merged: prMerged,
            closed: prClosed,
            additions: prLines._sum.prAdditions ?? 0,
            deletions: prLines._sum.prDeletions ?? 0,
        },
        usage: {
            calls: usageAll._count._all,
            tokens: usageAll._sum.totalTokens ?? 0,
            firstAt: usageAll._min.createdAt,
            lastAt: usageAll._max.createdAt,
            spentCents: spentAll._sum.costInCents ?? 0,
            spent30Cents: spent30._sum.costInCents ?? 0,
            spentDayCents: spentDay._sum.costInCents ?? 0,
            ownKeyCalls,
            cliCalls,
            topModels: topModels.map((row) => ({
                model: row.model,
                calls: row._count._all,
                cents: row._sum.costInCents ?? 0,
            })),
            daily: dailySpend,
        },
        walletSums,
        failedPayments,
        wallet,
        creditRequest,
        feedback,
        adminHistory,
    }
}

/**
 * The last time each user did something: the newest of their last model call, the last
 * change to one of their sessions, and the last use of a sign-in.
 */
const findLastActive = async (userIds: string[]): Promise<Map<string, Date>> => {
    if (userIds.length === 0) return new Map()
    const rows = await prisma.$queryRaw<Array<{ userId: string; at: Date | null }>>`
        SELECT u.id AS "userId",
            GREATEST(
                (SELECT MAX(e."createdAt") FROM "UsageEvent" e WHERE e."userId" = u.id),
                (SELECT MAX(s."updatedAt") FROM "Session" s WHERE s."userId" = u.id),
                (SELECT MAX(a."updatedAt") FROM "AuthSession" a WHERE a."userId" = u.id)
            ) AS at
        FROM "User" u
        WHERE u.id IN (${Prisma.join(userIds)})
    `
    return new Map(rows.filter((row) => row.at !== null).map((row) => [row.userId, row.at as Date]))
}

const DAY_MS = 24 * 60 * 60 * 1000

type CreditClient = Pick<typeof prisma, 'walletTransaction'>

/**
 * Credits an admin gave since a time, in cents: approved free credit requests (GRANT) and
 * credits added by hand (positive ADJUSTMENT). With adminUserId, only what that admin gave;
 * with userId, only what that user got.
 */
const sumAdminCreditsSince = async (data: {
    since: Date
    client?: CreditClient
    adminUserId?: string
    userId?: string
}) => {
    const { since, client = prisma, adminUserId, userId } = data
    const base = {
        status: 'SUCCESS' as const,
        amountInCents: { gt: 0 },
        createdAt: { gte: since },
        ...(userId ? { userId } : {}),
    }
    const [grants, manual] = await Promise.all([
        client.walletTransaction.aggregate({
            where: {
                ...base,
                provider: 'GRANT',
                ...(adminUserId ? { metadata: { path: ['approvedBy'], equals: adminUserId } } : {}),
            },
            _sum: { amountInCents: true },
        }),
        client.walletTransaction.aggregate({
            where: {
                ...base,
                provider: 'ADJUSTMENT',
                ...(adminUserId ? { metadata: { path: ['adjustedBy'], equals: adminUserId } } : {}),
            },
            _sum: { amountInCents: true },
        }),
    ])
    return (grants._sum.amountInCents ?? 0) + (manual._sum.amountInCents ?? 0)
}

/**
 * The 24-hour caps on credits an admin gives: in total for the admin, and to one user.
 * Runs inside the caller's transaction, after the shared lock below.
 */
const checkCreditCaps = async (data: {
    tx: CreditClient
    adminUserId: string
    userId: string
    amountInCents: number
    dailyCapCents: number
    userDailyCapCents: number
}) => {
    const { tx, adminUserId, userId, amountInCents, dailyCapCents, userDailyCapCents } = data
    const since = new Date(Date.now() - DAY_MS)
    const used = await sumAdminCreditsSince({ since, client: tx, adminUserId })
    if (used + amountInCents > dailyCapCents) {
        return { overCap: 'all' as const, usedCents: used, capCents: dailyCapCents }
    }
    const usedForUser = await sumAdminCreditsSince({ since, client: tx, userId })
    if (usedForUser + amountInCents > userDailyCapCents) {
        return { overCap: 'user' as const, usedCents: usedForUser, capCents: userDailyCapCents }
    }
    return null
}

/**
 * Returns undefined for a missing user, null when the balance would go below $0, and
 * { overCap } when a 24-hour cap on added credits would be passed: all users (S4.1) or
 * this one user (L1).
 */
const adjustCredits = async (data: {
    userId: string
    amountInCents: number
    adminUserId: string
    dailyCapCents: number
    userDailyCapCents: number
}) => {
    const { userId, amountInCents, adminUserId, dailyCapCents, userDailyCapCents } = data
    return prisma.$transaction(async (tx) => {
        // one credit change or approval at a time, so two quick ones can't both pass the caps
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('admin_credit_cap'))`

        // B10: a deleted account gets no credits
        const user = await tx.user.findFirst({
            where: { id: userId, isDeleted: false },
            select: { creditBalance: true },
        })
        if (!user) return undefined
        if (user.creditBalance + amountInCents < 0) return null
        if (amountInCents > 0) {
            const over = await checkCreditCaps({
                tx,
                adminUserId,
                userId,
                amountInCents,
                dailyCapCents,
                userDailyCapCents,
            })
            if (over) return over
        }

        await tx.walletTransaction.create({
            data: {
                userId,
                amountInCents,
                currency: 'USD',
                provider: 'ADJUSTMENT',
                status: 'SUCCESS',
                metadata: { adjustedBy: adminUserId },
            },
        })
        // B9: the audit row commits with the money, or neither does
        await tx.adminAuditLog.create({
            data: {
                adminUserId,
                action: 'credits.adjust',
                targetType: 'user',
                targetId: userId,
                metadata: { amountInCents },
            },
        })
        return tx.user.update({
            where: { id: userId },
            data: { creditBalance: { increment: amountInCents } },
            select: { id: true, creditBalance: true },
        })
    })
}

// credits tab: every grant and hand change, newest first
const listCreditLedger = async (limit: number) =>
    prisma.walletTransaction.findMany({
        where: { provider: { in: ['GRANT', 'ADJUSTMENT'] }, status: 'SUCCESS' },
        orderBy: { createdAt: 'desc' },
        take: limit,
        select: {
            id: true,
            amountInCents: true,
            provider: true,
            metadata: true,
            createdAt: true,
            user: { select: { id: true, email: true } },
        },
    })

// a9 sandboxes and usage

const listSandboxes = async () =>
    prisma.session.findMany({
        where: {
            sandboxStatus: { in: ['STARTING', 'RUNNING', 'PAUSED'] },
            vmId: { not: null },
        },
        orderBy: [{ sandboxStatus: 'asc' }, { vmLastActivityAt: 'desc' }],
        take: 500,
        // B12: no session titles, they are the user's own work
        select: {
            id: true,
            vmId: true,
            vmStatus: true,
            sandboxStatus: true,
            vmLastActivityAt: true,
            createdAt: true,
            user: { select: { id: true, email: true } },
        },
    })

const findSandboxSession = async (sessionId: string) =>
    prisma.session.findUnique({
        where: { id: sessionId },
        select: { id: true, userId: true, vmId: true, sandboxStatus: true },
    })

export const adminRepository = {
    listUsersPage,
    findUserDetails,
    findLastActive,
    sumAdminCreditsSince,
    listCreditLedger,
    findAdminUser,
    writeAuditLog,
    findPendingRequests,
    findLatestFeedback,
    countRequestsFromIp,
    countAccountsForNormalizedEmail,
    findProductEmailUsers,
    findCreditRequest,
    approveCreditRequest,
    rejectCreditRequest,
    adjustCredits,
    listSandboxes,
    findSandboxSession,
}
