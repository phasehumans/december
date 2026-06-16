import { prisma } from '@december/database'
import { AppError } from '../../shared/appError'

import type {
    GetCurrentUsage,
    CheckEnoughCredits,
    HasMinimumBalance,
    RecordUsageEvent,
    CalculateGenerationCost,
    CanRunSelfCorrection,
    UsageUser,
    ModelRate,
} from '@december/shared'

const getModelRatesFromEnv = (): ModelRate[] => {
    const rates: ModelRate[] = []
    for (let i = 1; i <= 8; i++) {
        const name = process.env[`MODEL_${i}_NAME`]
        const inputRateStr = process.env[`MODEL_${i}_INPUT_RATE`]
        const outputRateStr = process.env[`MODEL_${i}_OUTPUT_RATE`]
        if (name) {
            rates.push({
                name: name.trim(),
                inputRate: parseFloat(inputRateStr ?? '0'),
                outputRate: parseFloat(outputRateStr ?? '0'),
            })
        }
    }
    return rates
}

const calculateGenerationCost = (data: CalculateGenerationCost): number => {
    const { modelName, inputTokens, outputTokens } = data
    if (inputTokens === 0 && outputTokens === 0) {
        return 0
    }

    const rates = getModelRatesFromEnv()
    let matchedRate = rates.find((r) => r.name.toLowerCase() === modelName.trim().toLowerCase())

    if (!matchedRate && modelName === 'auto') {
        const resolvedAuto = (process.env.AUTO_MODEL || 'openai/gpt-oss-20b:free').trim()
        matchedRate = rates.find((r) => r.name.toLowerCase() === resolvedAuto.toLowerCase())
    }

    let inputRatePer1M = parseFloat(process.env.FALLBACK_MODEL_INPUT_RATE ?? '2.00')
    let outputRatePer1M = parseFloat(process.env.FALLBACK_MODEL_OUTPUT_RATE ?? '8.00')

    if (matchedRate) {
        inputRatePer1M = matchedRate.inputRate
        outputRatePer1M = matchedRate.outputRate
    }

    // Convert USD per 1M tokens to cents per token:
    // cents/token = (USD/1M * 100) / 1,000,000 = USD/1M / 10,000
    const inputCentsPerToken = inputRatePer1M / 10000
    const outputCentsPerToken = outputRatePer1M / 10000

    const rawCost = inputTokens * inputCentsPerToken + outputTokens * outputCentsPerToken

    // Ceiling rounding, minimum 1 cent
    return Math.max(Math.ceil(rawCost), 1)
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

const getUsageUser = async (userId: string): Promise<UsageUser> => {
    const user = await prisma.user.findUnique({
        where: {
            id: userId,
        },
        select: {
            id: true,
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

    if (!user) {
        throw new AppError('user not found', 404)
    }

    return user as unknown as UsageUser
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

const getCurrentUsage = async (data: GetCurrentUsage) => {
    const { userId } = data
    const user = await getUsageUser(userId)
    const { periodStart, periodEnd } = resolveCurrentPeriod(user)
    const isPro = user.subscriptionPlan === 'PRO' && user.subscriptionStatus === 'ACTIVE'
    const usage = await getPeriodAggregate(user.id, periodStart, periodEnd, isPro)

    const creditLimitInCents = isPro ? 500 : 100
    const remainingCreditsInCents = user.creditBalance + user.giftedCredits

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
            unlimited: false,
        },
    }
}

const checkEnoughCredits = async (data: CheckEnoughCredits) => {
    const current = await getCurrentUsage({ userId: data.userId })
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

const hasMinimumBalance = async (data: HasMinimumBalance): Promise<boolean> => {
    const { userId } = data
    const user = await getUsageUser(userId)
    return user.creditBalance + user.giftedCredits >= 1
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

const recordUsageEvent = async (data: RecordUsageEvent) => {
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
    const calculatedCost = calculateGenerationCost({
        modelName: data.model,
        inputTokens: data.inputTokens,
        outputTokens: data.outputTokens,
    })

    try {
        const result = await prisma.$transaction(async (tx) => {
            const costLogged = calculatedCost

            // Re-fetch user inside transaction to avoid race conditions
            const dbUser = await tx.user.findUnique({
                where: { id: user.id },
                select: { creditBalance: true, giftedCredits: true },
            })
            if (!dbUser) {
                throw new AppError('user not found', 404)
            }

            let remainingCost = calculatedCost
            let newCreditBalance = dbUser.creditBalance
            let newGiftedCredits = dbUser.giftedCredits

            if (newCreditBalance >= remainingCost) {
                newCreditBalance -= remainingCost
            } else {
                remainingCost -= newCreditBalance
                newCreditBalance = 0
                newGiftedCredits = Math.max(newGiftedCredits - remainingCost, 0)
            }

            // Update user balance
            await tx.user.update({
                where: { id: user.id },
                data: {
                    creditBalance: newCreditBalance,
                    giftedCredits: newGiftedCredits,
                },
            })

            // Create usage event
            const event = await tx.usageEvent.create({
                data: {
                    userId: user.id,
                    model: data.model,
                    inputTokens: data.inputTokens,
                    outputTokens: data.outputTokens,
                    totalTokens: data.totalTokens,
                    costInCents: costLogged,
                    projectId: data.projectId,
                    chatId: data.chatId,
                    externalRequestId: data.externalRequestId,
                    periodStart,
                    periodEnd,
                    metadata: data.metadata as any,
                },
            })

            return event
        })

        return {
            event: result,
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

const canRunSelfCorrection = async (data: CanRunSelfCorrection): Promise<boolean> => {
    try {
        const { userId } = data
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { creditBalance: true, giftedCredits: true },
        })
        if (!user) return false

        const threshold = parseInt(process.env.SELF_CORRECTION_CREDIT_THRESHOLD || '5', 10) // default 5 cents
        return user.creditBalance + user.giftedCredits >= threshold
    } catch {
        return false
    }
}

export const usageService = {
    getCurrentUsage,
    checkEnoughCredits,
    hasMinimumBalance,
    recordUsageEvent,
    calculateGenerationCost,
    canRunSelfCorrection,
}
