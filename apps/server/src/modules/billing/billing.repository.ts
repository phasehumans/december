import { Prisma, prisma } from '@december/database'

import { AppError } from '../../shared/appError'

import type {
    PayReferral,
    ReferralPayout,
    UsageBucketSum,
    UsageFilter,
    UsageTotals,
} from './billing.types'

/** the where part that the usage sums share */
const usageConditions = (filter: UsageFilter) => {
    const { userId, start, end, billingSource } = filter
    const conditions = [Prisma.sql`"userId" = ${userId}`]
    // createdAt is a timestamp in UTC. the cast keeps the compare free of the session time zone
    if (start) {
        conditions.push(Prisma.sql`"createdAt" >= ${start.toISOString()}::timestamp`)
    }
    if (end) {
        conditions.push(Prisma.sql`"createdAt" <= ${end.toISOString()}::timestamp`)
    }
    if (billingSource) {
        conditions.push(Prisma.sql`"billingSource" = ${billingSource}::"BillingSource"`)
    }
    return Prisma.join(conditions, ' AND ')
}

export const billingRepository = {
    async findUserForOverview(id: string) {
        return prisma.user.findUnique({
            where: { id },
            select: {
                id: true,
                name: true,
                email: true,
                createdAt: true,
                creditBalance: true,
                redeemClaims: {
                    include: {
                        redeemCode: true,
                    },
                    orderBy: {
                        redeemedAt: 'desc',
                    },
                    take: 10,
                },
                walletTransactions: {
                    orderBy: {
                        createdAt: 'desc',
                    },
                    take: 10,
                },
            },
        })
    },

    async aggregateUsage(userId: string, periodStart: Date, periodEnd: Date) {
        return prisma.usageEvent.aggregate({
            where: {
                userId,
                // own-key runs are paid by the user's provider, not december credits
                billingSource: 'CREDITS',
                createdAt: {
                    gte: periodStart,
                    lt: periodEnd,
                },
            },
            _sum: {
                costInCents: true,
                inputTokens: true,
                outputTokens: true,
                totalTokens: true,
            },
        })
    },

    async findRedeemCodeClaims(userId: string) {
        return prisma.redeemCodeClaim.findMany({
            where: { userId },
            include: {
                redeemCode: true,
            },
        })
    },

    async findGiftedCreditsSum(userId: string) {
        const claims = await prisma.redeemCodeClaim.findMany({
            where: { userId },
            select: {
                redeemCode: {
                    select: {
                        creditAmount: true,
                    },
                },
            },
        })
        const redeemed = claims.reduce(
            (sum, claim) => sum + (claim.redeemCode?.creditAmount || 0),
            0
        )
        // approved free credit requests count as gifted credits too
        const grants = await prisma.walletTransaction.aggregate({
            where: { userId, provider: 'GRANT', status: 'SUCCESS' },
            _sum: { amountInCents: true },
        })
        return redeemed + (grants._sum.amountInCents ?? 0)
    },

    async createWalletTransaction(data: {
        userId: string
        amountInCents: number
        currency: string
        provider: 'RAZORPAY' | 'COINBASE' | 'GRANT' | 'ADJUSTMENT'
        providerOrderId?: string
        metadata?: any
    }) {
        return prisma.walletTransaction.create({
            data: {
                userId: data.userId,
                amountInCents: data.amountInCents,
                currency: data.currency,
                provider: data.provider,
                providerOrderId: data.providerOrderId,
                metadata: data.metadata || {},
            },
        })
    },

    async findWalletTransactionByOrderId(providerOrderId: string) {
        return prisma.walletTransaction.findFirst({
            where: { providerOrderId },
        })
    },

    /** one wallet transaction with what a receipt says about its user */
    async findWalletTransactionForReceipt(id: string) {
        return prisma.walletTransaction.findUnique({
            where: { id },
            include: {
                user: {
                    select: { name: true, email: true, timezone: true },
                },
            },
        })
    },

    async updateWalletTransaction(
        id: string,
        data: {
            status: 'PENDING' | 'SUCCESS' | 'FAILED'
            providerPaymentId?: string
            metadata?: any
        }
    ) {
        return prisma.walletTransaction.update({
            where: { id },
            data,
        })
    },

    async verifyAndUpdateWalletTransaction(
        transactionId: string,
        userId: string,
        amountInCents: number,
        providerPaymentId: string
    ) {
        return prisma.$transaction(async (tx) => {
            const currentTx = await tx.walletTransaction.findUnique({
                where: { id: transactionId },
            })

            if (!currentTx) {
                throw new AppError('transaction order not found', 404)
            }

            if (currentTx.userId !== userId) {
                throw new AppError('unauthorized to verify this transaction', 403)
            }

            // Idempotency: If already credited, return current user state without re-crediting
            if (currentTx.status === 'SUCCESS') {
                const user = await tx.user.findUnique({
                    where: { id: userId },
                })
                return {
                    user: user || { id: userId, creditBalance: 0 },
                    alreadyProcessed: true,
                }
            }

            // Atomically update transaction status to SUCCESS (from PENDING or transient FAILED)
            const updateCount = await tx.walletTransaction.updateMany({
                where: {
                    id: transactionId,
                    status: {
                        in: ['PENDING', 'FAILED'],
                    },
                },
                data: {
                    status: 'SUCCESS',
                    providerPaymentId,
                },
            })

            if (updateCount.count === 0) {
                // If another concurrent request completed it in the millisecond between findUnique and updateMany
                const user = await tx.user.findUnique({
                    where: { id: userId },
                })
                return {
                    user: user || { id: userId, creditBalance: 0 },
                    alreadyProcessed: true,
                }
            }

            const updatedUser = await tx.user.update({
                where: { id: userId },
                data: {
                    creditBalance: {
                        increment: amountInCents,
                    },
                },
            })

            return {
                user: updatedUser,
                alreadyProcessed: false,
            }
        })
    },

    async findManyUsageEvents(where: any, offset: number, limit: number) {
        return prisma.usageEvent.findMany({
            where,
            orderBy: {
                createdAt: 'desc',
            },
            // only what the usage list shows: request ids, chat ids and periods stay on the server
            select: {
                id: true,
                model: true,
                inputTokens: true,
                outputTokens: true,
                totalTokens: true,
                costInCents: true,
                billingSource: true,
                metadata: true,
                periodStart: true,
                periodEnd: true,
                createdAt: true,
                session: {
                    select: {
                        title: true,
                    },
                },
            },
            skip: offset,
            take: limit,
        })
    },

    async countUsageEvents(where: any) {
        return prisma.usageEvent.count({
            where,
        })
    },

    /** cost, tokens and sessions of every matching event. own-key cost is not december spend */
    async sumUsage(filter: UsageFilter): Promise<UsageTotals> {
        const rows = await prisma.$queryRaw<UsageTotals[]>`
            SELECT COALESCE(SUM("costInCents") FILTER (WHERE "billingSource" = 'CREDITS'), 0)::float8 AS "costInCents",
                   COALESCE(SUM("totalTokens"), 0)::float8 AS "totalTokens",
                   COUNT(DISTINCT "sessionId")::int AS "sessions"
            FROM "UsageEvent"
            WHERE ${usageConditions(filter)}
        `
        return rows[0] ?? { costInCents: 0, totalTokens: 0, sessions: 0 }
    },

    /**
     * Cost and tokens for each bucket of time. `startsAt` has the start of each bucket in
     * time order: bucket 1 starts at the first one, and 0 is before it. A bucket with no
     * events has no row.
     */
    async sumUsageByBucket(filter: UsageFilter, startsAt: Date[]): Promise<UsageBucketSum[]> {
        if (startsAt.length === 0) return []
        const thresholds = startsAt.map((instant) => instant.toISOString())
        return prisma.$queryRaw<UsageBucketSum[]>`
            SELECT width_bucket("createdAt", ${thresholds}::timestamp[])::int AS "bucket",
                   COALESCE(SUM("costInCents") FILTER (WHERE "billingSource" = 'CREDITS'), 0)::float8 AS "costInCents",
                   COALESCE(SUM("totalTokens"), 0)::float8 AS "totalTokens",
                   COALESCE(SUM("totalTokens") FILTER (WHERE "billingSource" = 'OWN_KEY'), 0)::float8 AS "ownKeyTokens"
            FROM "UsageEvent"
            WHERE ${usageConditions(filter)}
            GROUP BY 1
        `
    },

    async findUserContact(id: string) {
        return prisma.user.findUnique({
            where: { id },
            select: { id: true, email: true, name: true },
        })
    },

    async findCreditRequestByEmail(normalizedEmail: string) {
        return prisma.creditRequest.findUnique({ where: { normalizedEmail } })
    },

    async createCreditRequest(data: {
        userId: string
        normalizedEmail: string
        buildPlan: string
        heardFrom: string
        agreedToFeedback: boolean
        ipAddress?: string
        userAgent?: string
    }) {
        return prisma.creditRequest.create({ data })
    },

    async findUserById(id: string) {
        return prisma.user.findUnique({
            where: { id },
            select: {
                id: true,
                isDeleted: true,
                // the usage days are in the time zone of the user
                timezone: true,
                createdAt: true,
            },
        })
    },

    async findUserByIdForCredits(id: string) {
        return prisma.user.findUnique({
            where: { id },
        })
    },

    async addCredits(userId: string, amountInCents: number) {
        return prisma.user.update({
            where: { id: userId },
            data: {
                creditBalance: {
                    increment: amountInCents,
                },
            },
        })
    },

    async findReferralCode(userId: string) {
        return prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, referralCode: true },
        })
    },

    /**
     * Saves the code only when the user has none, so two first reads end with one code.
     * A code that another user has fails with P2002.
     */
    async setReferralCodeIfEmpty(userId: string, referralCode: string) {
        return prisma.user.updateMany({
            where: { id: userId, referralCode: null },
            data: { referralCode },
        })
    },

    async findUserByReferralCode(referralCode: string) {
        return prisma.user.findUnique({
            where: { referralCode },
            select: { id: true, email: true, isDeleted: true, deletedAt: true },
        })
    },

    /** how many accounts signed up with the link of this user, and how many of them were paid */
    async countReferrals(inviterId: string) {
        const [invited, credited] = await Promise.all([
            prisma.referral.count({ where: { inviterId } }),
            prisma.referral.count({ where: { inviterId, status: 'CREDITED' } }),
        ])
        return { invited, credited }
    },

    /** inviteeId is unique: a second referral for one account fails with P2002 */
    async createReferral(data: { inviterId: string; inviteeId: string }) {
        return prisma.referral.create({ data })
    },

    /**
     * Pays the referral of an account that paid for credits, one time. Under the cap, the
     * inviter and the new account each get the amount and a wallet transaction, and the
     * referral is CREDITED. At the cap, or when the inviter is deleted, it is SKIPPED and
     * nobody is paid. Returns null when the account has no pending referral.
     */
    async payReferral(data: PayReferral): Promise<ReferralPayout | null> {
        const { inviteeId, amountInCents, maxCredited } = data
        return prisma.$transaction(async (tx) => {
            const referral = await tx.referral.findUnique({ where: { inviteeId } })
            if (!referral || referral.status !== 'PENDING') return null
            const { id: referralId, inviterId } = referral

            // the lock lets one payout at a time read the count of an inviter, so two new
            // accounts that pay together cannot both take the last place under the cap
            const inviters = await tx.$queryRaw<Array<{ isDeleted: boolean }>>`
                SELECT "isDeleted" FROM "User" WHERE "id" = ${inviterId} FOR UPDATE
            `
            const credited = await tx.referral.count({
                where: { inviterId, status: 'CREDITED' },
            })
            const isPaid =
                inviters[0] !== undefined && !inviters[0].isDeleted && credited < maxCredited

            // only a pending referral changes. verify and the webhook of one payment, or two
            // top-ups together, wait here for the first one and then find nothing to claim
            const claimed = await tx.referral.updateMany({
                where: { id: referralId, status: 'PENDING' },
                data: isPaid
                    ? { status: 'CREDITED', creditedAt: new Date() }
                    : { status: 'SKIPPED' },
            })
            if (claimed.count === 0) return null

            if (isPaid) {
                for (const [userId, role] of [
                    [inviterId, 'inviter'],
                    [inviteeId, 'invitee'],
                ] as const) {
                    await tx.user.update({
                        where: { id: userId },
                        data: { creditBalance: { increment: amountInCents } },
                    })
                    await tx.walletTransaction.create({
                        data: {
                            userId,
                            amountInCents,
                            currency: 'USD',
                            provider: 'REFERRAL',
                            status: 'SUCCESS',
                            metadata: { referralId, role },
                        },
                    })
                }
            }

            return { referralId, inviterId, inviteeId, status: isPaid ? 'CREDITED' : 'SKIPPED' }
        })
    },

    // spend limits and the low balance alert (#638 section 1)
    async findLimits(userId: string) {
        return prisma.user.findUnique({
            where: { id: userId },
            select: { lowBalanceAlertCents: true, sessionLimitCents: true, dayLimitCents: true },
        })
    },

    async updateLimits(
        userId: string,
        limits: {
            lowBalanceAlertCents?: number | null
            sessionLimitCents?: number | null
            dayLimitCents?: number | null
        }
    ) {
        return prisma.user.update({
            where: { id: userId },
            data: limits,
            select: { lowBalanceAlertCents: true, sessionLimitCents: true, dayLimitCents: true },
        })
    },
}
