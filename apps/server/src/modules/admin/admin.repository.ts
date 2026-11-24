import { prisma } from '@december/database'

import type { Prisma } from '@december/database'

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

const listAuditLog = async (limit: number) =>
    prisma.adminAuditLog.findMany({ orderBy: { createdAt: 'desc' }, take: limit })

// a1 credit requests

const listCreditRequests = async (data: {
    status?: 'PENDING' | 'APPROVED' | 'REJECTED'
    limit: number
}) =>
    prisma.creditRequest.findMany({
        where: data.status ? { status: data.status } : {},
        orderBy: { createdAt: 'desc' },
        take: data.limit,
        include: {
            user: {
                select: {
                    id: true,
                    email: true,
                    name: true,
                    createdAt: true,
                    githubId: true,
                    googleId: true,
                    githubUsername: true,
                    isDeleted: true,
                    // the $5 is given on the promise of feedback (a2)
                    _count: { select: { feedbacks: true } },
                },
            },
        },
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

const findCreditRequest = async (id: string) =>
    prisma.creditRequest.findUnique({
        where: { id },
        include: { user: { select: { id: true, email: true, name: true } } },
    })

/**
 * Approve once: the status change, the GRANT wallet row and the balance move together.
 * Returns null when the request was not pending (approved twice, or rejected).
 */
const approveCreditRequest = async (data: {
    requestId: string
    adminUserId: string
    amountInCents: number
}) => {
    const { requestId, adminUserId, amountInCents } = data
    return prisma.$transaction(async (tx) => {
        const claimed = await tx.creditRequest.updateMany({
            where: { id: requestId, status: 'PENDING', userId: { not: null } },
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

// a2 feedback

const listFeedback = async (data: { userId?: string; limit: number }) =>
    prisma.feedback.findMany({
        where: data.userId ? { userId: data.userId } : {},
        orderBy: { createdAt: 'desc' },
        take: data.limit,
        include: {
            user: {
                select: {
                    id: true,
                    email: true,
                    name: true,
                    creditRequests: { select: { status: true }, take: 1 },
                },
            },
        },
    })

// a3 and a5 users

const userListSelect = {
    id: true,
    name: true,
    email: true,
    createdAt: true,
    githubId: true,
    googleId: true,
    githubUsername: true,
    creditBalance: true,
    defaultModelSource: true,
    isDeleted: true,
    deletedAt: true,
    _count: { select: { providerCredentials: true, sessions: true } },
} satisfies Prisma.UserSelect

const searchUsers = async (data: { q?: string; limit: number }) => {
    const { q, limit } = data
    return prisma.user.findMany({
        where: q
            ? {
                  OR: [
                      { email: { contains: q, mode: 'insensitive' } },
                      { name: { contains: q, mode: 'insensitive' } },
                      { githubUsername: { contains: q, mode: 'insensitive' } },
                      { id: q },
                  ],
              }
            : {},
        orderBy: { createdAt: 'desc' },
        take: limit,
        select: userListSelect,
    })
}

const sumUsageByUser = async (userIds: string[]) => {
    if (userIds.length === 0) return []
    return prisma.usageEvent.groupBy({
        by: ['userId', 'billingSource'],
        where: { userId: { in: userIds } },
        _sum: { costInCents: true },
    })
}

const findUserDetail = async (userId: string) =>
    prisma.user.findUnique({
        where: { id: userId },
        select: {
            ...userListSelect,
            notifyProductUpdates: true,
            githubAppInstall: true,
            onboardingCompletedAt: true,
            providerCredentials: { select: { provider: true, keyHint: true, verifiedAt: true } },
            walletTransactions: {
                orderBy: { createdAt: 'desc' },
                take: 50,
                select: {
                    id: true,
                    amountInCents: true,
                    provider: true,
                    status: true,
                    metadata: true,
                    createdAt: true,
                },
            },
            creditRequests: {
                select: { id: true, status: true, createdAt: true, rejectReason: true },
            },
        },
    })

/** Add or remove credits with a reason. Returns null when the balance would go below 0. */
const adjustCredits = async (data: {
    userId: string
    amountInCents: number
    reason: string
    adminUserId: string
}) => {
    const { userId, amountInCents, reason, adminUserId } = data
    return prisma.$transaction(async (tx) => {
        const user = await tx.user.findUnique({
            where: { id: userId },
            select: { creditBalance: true },
        })
        if (!user) return undefined
        if (user.creditBalance + amountInCents < 0) return null

        await tx.walletTransaction.create({
            data: {
                userId,
                amountInCents,
                currency: 'USD',
                provider: 'ADJUSTMENT',
                status: 'SUCCESS',
                metadata: { reason, adjustedBy: adminUserId },
            },
        })
        return tx.user.update({
            where: { id: userId },
            data: { creditBalance: { increment: amountInCents } },
            select: { id: true, creditBalance: true },
        })
    })
}

const restoreUser = async (userId: string) =>
    prisma.user.updateMany({
        where: { id: userId, isDeleted: true },
        data: { isDeleted: false, deletedAt: null },
    })

// a4 redeem codes

const listRedeemCodes = async () =>
    prisma.redeemCode.findMany({
        orderBy: { createdAt: 'desc' },
        take: 100,
        include: {
            claims: {
                orderBy: { redeemedAt: 'desc' },
                include: { user: { select: { id: true, email: true } } },
            },
        },
    })

const createRedeemCode = async (data: {
    codeHash: string
    code: string
    creditAmount: number
    maxRedemptions?: number
    expiresAt?: Date
    adminUserId: string
}) =>
    prisma.redeemCode.create({
        data: {
            codeHash: data.codeHash,
            creditAmount: data.creditAmount,
            maxRedemptions: data.maxRedemptions ?? null,
            expiresAt: data.expiresAt ?? null,
            metadata: { code: data.code, createdBy: data.adminUserId },
        },
    })

const findRedeemCodeByHash = async (codeHash: string) =>
    prisma.redeemCode.findUnique({ where: { codeHash }, select: { id: true } })

// a6 github installations

const listInstallations = async () =>
    prisma.githubAppInstallation.findMany({
        orderBy: { createdAt: 'desc' },
        take: 200,
        include: { user: { select: { id: true, email: true, githubUsername: true } } },
    })

const assignInstallation = async (data: { installationId: string; userId: string }) => {
    const { installationId, userId } = data
    return prisma.$transaction(async (tx) => {
        const installation = await tx.githubAppInstallation.findUnique({
            where: { id: installationId },
        })
        const user = await tx.user.findUnique({ where: { id: userId }, select: { id: true } })
        if (!installation || !user) return null

        const previousUserId = installation.userId
        const updated = await tx.githubAppInstallation.update({
            where: { id: installationId },
            data: { userId },
        })
        await tx.user.update({ where: { id: userId }, data: { githubAppInstall: true } })
        if (previousUserId && previousUserId !== userId) {
            const left = await tx.githubAppInstallation.count({ where: { userId: previousUserId } })
            if (left === 0) {
                await tx.user.update({
                    where: { id: previousUserId },
                    data: { githubAppInstall: false },
                })
            }
        }
        return { installation: updated, previousUserId }
    })
}

// a7 and a8 announcements

const findAnnouncementAudience = async (data: { signedUpFrom?: Date; signedUpTo?: Date }) => {
    const { signedUpFrom, signedUpTo } = data
    return prisma.user.findMany({
        where: {
            isDeleted: false,
            ...(signedUpFrom || signedUpTo
                ? {
                      createdAt: {
                          ...(signedUpFrom ? { gte: signedUpFrom } : {}),
                          ...(signedUpTo ? { lt: signedUpTo } : {}),
                      },
                  }
                : {}),
        },
        select: { id: true, email: true, name: true, notifyProductUpdates: true },
    })
}

const createAnnouncement = async (data: Prisma.AnnouncementUncheckedCreateInput) =>
    prisma.announcement.create({ data })

const listAnnouncements = async () =>
    prisma.announcement.findMany({ orderBy: { createdAt: 'desc' }, take: 100 })

// a9 sandboxes and usage

const listSandboxes = async () =>
    prisma.session.findMany({
        where: {
            sandboxStatus: { in: ['STARTING', 'RUNNING', 'PAUSED'] },
            vmId: { not: null },
        },
        orderBy: [{ sandboxStatus: 'asc' }, { vmLastActivityAt: 'desc' }],
        take: 500,
        select: {
            id: true,
            title: true,
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

const dailyUsageByModel = async (since: Date) =>
    prisma.$queryRaw<
        Array<{
            day: Date
            model: string
            billingSource: string
            costInCents: number
            events: bigint
        }>
    >`
        SELECT date_trunc('day', "createdAt") AS day,
               model,
               "billingSource"::text AS "billingSource",
               SUM("costInCents")::float8 AS "costInCents",
               COUNT(*)::bigint AS events
        FROM "UsageEvent"
        WHERE "createdAt" >= ${since}
        GROUP BY 1, 2, 3
        ORDER BY 1 DESC, 4 DESC
    `

export const adminRepository = {
    findAdminUser,
    writeAuditLog,
    listAuditLog,
    listCreditRequests,
    countRequestsFromIp,
    countAccountsForNormalizedEmail,
    findCreditRequest,
    approveCreditRequest,
    rejectCreditRequest,
    listFeedback,
    searchUsers,
    sumUsageByUser,
    findUserDetail,
    adjustCredits,
    restoreUser,
    listRedeemCodes,
    createRedeemCode,
    findRedeemCodeByHash,
    listInstallations,
    assignInstallation,
    findAnnouncementAudience,
    createAnnouncement,
    listAnnouncements,
    listSandboxes,
    findSandboxSession,
    dailyUsageByModel,
}
