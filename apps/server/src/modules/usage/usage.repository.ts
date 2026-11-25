import { prisma } from '@december/database'

export const usageRepository = {
    async runTransaction<T>(fn: (tx: any) => Promise<T>) {
        return prisma.$transaction(fn)
    },

    async getUsageUser(data: { userId: string }) {
        const { userId } = data
        return prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                createdAt: true,
                creditBalance: true,
            },
        })
    },

    async getPeriodAggregate(data: { userId: string; periodStart: Date; periodEnd: Date }) {
        const { userId, periodStart, periodEnd } = data
        const where: any = {
            userId,
            // own-key runs are paid by the user's provider, not december credits
            billingSource: 'CREDITS',
            createdAt: {
                gte: periodStart,
                lt: periodEnd,
            },
        }

        const [aggregate, eventCount] = await Promise.all([
            prisma.usageEvent.aggregate({
                where,
                _sum: {
                    inputTokens: true,
                    outputTokens: true,
                    totalTokens: true,
                    costInCents: true,
                },
            }),
            prisma.usageEvent.count({
                where,
            }),
        ])

        return {
            eventCount,
            inputTokens: aggregate._sum.inputTokens ?? 0,
            outputTokens: aggregate._sum.outputTokens ?? 0,
            totalTokens: aggregate._sum.totalTokens ?? 0,
            costInCents: aggregate._sum.costInCents ?? 0,
        }
    },

    async findExternalUsageEvent(data: { externalRequestId: string }, tx?: any) {
        const { externalRequestId } = data
        const client = tx || prisma
        return client.usageEvent.findFirst({
            where: { externalRequestId },
        })
    },

    async addToUsageEvent(
        data: {
            id: string
            inputTokens: number
            outputTokens: number
            totalTokens: number
            costInCents: number
            metadata: any
        },
        tx?: any
    ) {
        const { id, inputTokens, outputTokens, totalTokens, costInCents, metadata } = data
        const client = tx || prisma
        return client.usageEvent.update({
            where: { id },
            data: {
                inputTokens: { increment: inputTokens },
                outputTokens: { increment: outputTokens },
                totalTokens: { increment: totalTokens },
                costInCents: { increment: costInCents },
                metadata,
            },
        })
    },

    async findUserCredits(data: { userId: string }, tx?: any) {
        const { userId } = data
        if (tx) {
            const rows: any[] =
                await tx.$queryRaw`SELECT "creditBalance", "lowBalanceAlertCents" FROM "User" WHERE id = ${userId} FOR UPDATE`
            return rows.length > 0
                ? {
                      creditBalance: rows[0].creditBalance as number,
                      lowBalanceAlertCents: rows[0].lowBalanceAlertCents as number | null,
                  }
                : null
        }
        return prisma.user.findUnique({
            where: { id: userId },
            select: { creditBalance: true, lowBalanceAlertCents: true },
        })
    },

    /** the balance went under the alert amount again: the next alert may go out (#638) */
    async clearLowBalanceAlerted(data: { userId: string }, tx?: any) {
        const { userId } = data
        const client = tx || prisma
        return client.user.updateMany({
            where: { id: userId, lowBalanceAlertedAt: { not: null } },
            data: { lowBalanceAlertedAt: null },
        })
    },

    // spend limits (#638): the user's limits and what a "continue" let through today
    async findSpendLimitUser(data: { userId: string }) {
        const { userId } = data
        return prisma.user.findUnique({
            where: { id: userId },
            select: {
                timezone: true,
                sessionLimitCents: true,
                dayLimitCents: true,
                dayLimitAllowanceDay: true,
                dayLimitAllowanceCents: true,
            },
        })
    },

    async findSessionLimitAllowance(data: { sessionId: string; userId: string }) {
        const { sessionId, userId } = data
        return prisma.session.findFirst({
            where: { id: sessionId, userId },
            select: { limitAllowanceCents: true },
        })
    },

    /** the cost on december credits: of one session, or of the user since an instant */
    async sumCreditsCost(data: { userId: string; sessionId?: string; since?: Date }) {
        const { userId, sessionId, since } = data
        const aggregate = await prisma.usageEvent.aggregate({
            where: {
                userId,
                // runs on the user's own key never count
                billingSource: 'CREDITS',
                ...(sessionId ? { sessionId } : {}),
                ...(since ? { createdAt: { gte: since } } : {}),
            },
            _sum: { costInCents: true },
        })
        return aggregate._sum.costInCents ?? 0
    },

    async setSessionLimitAllowance(data: { sessionId: string; allowanceCents: number }) {
        const { sessionId, allowanceCents } = data
        return prisma.session.updateMany({
            where: { id: sessionId },
            data: { limitAllowanceCents: allowanceCents },
        })
    },

    async setDayLimitAllowance(data: { userId: string; day: string; allowanceCents: number }) {
        const { userId, day, allowanceCents } = data
        return prisma.user.update({
            where: { id: userId },
            data: { dayLimitAllowanceDay: day, dayLimitAllowanceCents: allowanceCents },
            select: { id: true },
        })
    },

    async updateUserCredits(data: { userId: string; creditBalance: number }, tx?: any) {
        const { userId, creditBalance } = data
        const client = tx || prisma
        return client.user.update({
            where: { id: userId },
            data: { creditBalance },
        })
    },

    async createUsageEvent(
        data: {
            userId: string
            model: string
            inputTokens: number
            outputTokens: number
            totalTokens: number
            costInCents: number
            sessionId?: string
            chatId?: string
            externalRequestId?: string
            periodStart: Date
            periodEnd: Date
            metadata?: any
        },
        tx?: any
    ) {
        const client = tx || prisma
        return client.usageEvent.create({
            data,
        })
    },
}
