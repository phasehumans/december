import { prisma } from '../../config/db'
import { AppError } from '../../utils/appError'

const FREE_MONTHLY_CREDIT_CENTS = 100

type UsageUser = {
    id: string
    isDeleted: boolean
    subscriptionPlan: 'FREE' | 'PRO'
    subscriptionStatus: 'FREE' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED'
    subscription: {
        currentPeriodStart: Date
        currentPeriodEnd: Date
    } | null
    createdAt: Date
    creditBalance: number
    giftedCredits: number
}

type RecordUsageEventInput = {
    userId: string
    model: string
    inputTokens: number
    outputTokens: number
    totalTokens: number
    costInCents: number
    projectId?: string
    chatId?: string
    externalRequestId?: string
    metadata?: Record<string, unknown>
}

type CheckEnoughCreditsInput = {
    userId: string
    estimatedCostInCents?: number
}

const startOfUtcMonth = (date: Date) => {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))
}

const startOfNextUtcMonth = (date: Date) => {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1))
}

const resolveCurrentPeriod = (user: UsageUser, now = new Date()) => {
    const isPro = user.subscriptionPlan === 'PRO' && user.subscriptionStatus === 'ACTIVE'
    if (!isPro) {
        return {
            periodStart: user.createdAt,
            periodEnd: new Date('2099-12-31T23:59:59.000Z'),
        }
    }

    if (
        user.subscription &&
        user.subscription.currentPeriodStart <= now &&
        user.subscription.currentPeriodEnd > now
    ) {
        return {
            periodStart: user.subscription.currentPeriodStart,
            periodEnd: user.subscription.currentPeriodEnd,
        }
    }

    return {
        periodStart: startOfUtcMonth(now),
        periodEnd: startOfNextUtcMonth(now),
    }
}

const resolveCreditLimit = (user: UsageUser) => {
    if (user.subscriptionPlan === 'PRO' && user.subscriptionStatus === 'ACTIVE') {
        return null
    }

    return FREE_MONTHLY_CREDIT_CENTS + user.creditBalance + user.giftedCredits
}

const getUsageUser = async (userId: string): Promise<UsageUser> => {
    const user = await prisma.user.findUnique({
        where: {
            id: userId,
            isDeleted: false,
        },
        select: {
            id: true,
            isDeleted: true,
            subscriptionPlan: true,
            subscriptionStatus: true,
            createdAt: true,
            creditBalance: true,
            giftedCredits: true,
            subscription: {
                select: {
                    currentPeriodStart: true,
                    currentPeriodEnd: true,
                },
            },
        },
    })

    if (!user || user.isDeleted) {
        throw new AppError('user not found', 404)
    }

    return user as UsageUser
}

const getPeriodAggregate = async (
    userId: string,
    periodStart: Date,
    periodEnd: Date,
    isPro: boolean
) => {
    const where: any = {
        userId,
        createdAt: {
            gte: periodStart,
            lt: periodEnd,
        },
    }
    if (isPro) {
        where.periodStart = periodStart
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
}

const getCurrentUsage = async (userId: string) => {
    const user = await getUsageUser(userId)
    const { periodStart, periodEnd } = resolveCurrentPeriod(user)
    const isPro = user.subscriptionPlan === 'PRO' && user.subscriptionStatus === 'ACTIVE'
    const usage = await getPeriodAggregate(user.id, periodStart, periodEnd, isPro)
    const creditLimitInCents = resolveCreditLimit(user)
    const remainingCreditsInCents =
        creditLimitInCents === null ? null : Math.max(creditLimitInCents - usage.costInCents, 0)

    return {
        plan: user.subscriptionPlan,
        status: user.subscriptionStatus,
        periodStart,
        periodEnd,
        usage,
        credits: {
            limitInCents: creditLimitInCents,
            usedInCents: usage.costInCents,
            remainingInCents: remainingCreditsInCents,
            unlimited: creditLimitInCents === null,
        },
    }
}

const checkEnoughCredits = async (data: CheckEnoughCreditsInput) => {
    const current = await getCurrentUsage(data.userId)
    const estimatedCostInCents = data.estimatedCostInCents ?? 0
    const enoughCredits =
        current.credits.unlimited || (current.credits.remainingInCents ?? 0) >= estimatedCostInCents

    return {
        enoughCredits,
        estimatedCostInCents,
        credits: current.credits,
        periodStart: current.periodStart,
        periodEnd: current.periodEnd,
    }
}

const assertProjectOwnership = async (userId: string, projectId?: string) => {
    if (!projectId) {
        return
    }

    const project = await prisma.project.findFirst({
        where: {
            id: projectId,
            userId,
        },
        select: {
            id: true,
        },
    })

    if (!project) {
        throw new AppError('project not found', 404)
    }
}

const findExternalUsageEvent = (externalRequestId: string) => {
    return prisma.usageEvent.findFirst({
        where: {
            externalRequestId,
        },
    })
}

const recordUsageEvent = async (data: RecordUsageEventInput) => {
    const user = await getUsageUser(data.userId)
    await assertProjectOwnership(user.id, data.projectId)

    if (data.externalRequestId) {
        const existingEvent = await findExternalUsageEvent(data.externalRequestId)

        if (existingEvent) {
            if (existingEvent.userId !== user.id) {
                throw new AppError('external request id already exists', 409)
            }

            return {
                event: existingEvent,
                idempotent: true,
            }
        }
    }

    const { periodStart, periodEnd } = resolveCurrentPeriod(user)

    try {
        const event = await prisma.usageEvent.create({
            data: {
                userId: user.id,
                model: data.model,
                inputTokens: data.inputTokens,
                outputTokens: data.outputTokens,
                totalTokens: data.totalTokens,
                costInCents: data.costInCents,
                projectId: data.projectId,
                chatId: data.chatId,
                externalRequestId: data.externalRequestId,
                periodStart,
                periodEnd,
                metadata: data.metadata,
            },
        })

        return {
            event,
            idempotent: false,
        }
    } catch (error: any) {
        if (error?.code === 'P2002' && data.externalRequestId) {
            const existingEvent = await findExternalUsageEvent(data.externalRequestId)

            if (existingEvent && existingEvent.userId === user.id) {
                return {
                    event: existingEvent,
                    idempotent: true,
                }
            }
        }

        throw error
    }
}

export const usageService = {
    getCurrentUsage,
    checkEnoughCredits,
    recordUsageEvent,
}
