import crypto from 'crypto'
import { prisma } from '../../config/db'
import { razorpay } from '../../config/razorpay'
import { AppError } from '../../utils/appError'
import { sendNotificationToUser } from '../notification/notification.service'

import {
    getPlanCatalog,
    getRazorpayKeyId,
    getRazorpayProPlanId,
    mapRazorpayProviderStatus,
    mapUserSubscriptionStatus,
    resolveSubscriptionPeriods,
    verifyRazorpaySubscriptionPayment,
    verifyRazorpayWebhookSignature,
} from './billing.utils'

type CreateSubscriptionInput = {
    userId: string
    plan: 'PRO'
    quantity: number
    totalCount: number
}

type VerifySubscriptionInput = {
    userId: string
    razorpay_subscription_id: string
    razorpay_payment_id: string
    razorpay_signature: string
}

type CancelSubscriptionInput = {
    userId: string
    cancelAtPeriodEnd: boolean
}

type CreditsHistoryInput = {
    userId: string
    limit: number
    offset: number
    periodStart?: string
    periodEnd?: string
}

type RazorpayWebhookInput = {
    body: Record<string, any>
    rawBody?: Buffer
    signature?: string
}

type RazorpaySubscriptionLike = {
    id: string
    status?: string
    current_start?: number | null
    current_end?: number | null
    start_at?: number | null
    end_at?: number | null
    ended_at?: number | null
    customer_id?: string | null
    plan_id?: string
    notes?: Record<string, string | number | undefined>
    short_url?: string
}

// const getUserForBilling = async (userId: string) => {
//     const user = await prisma.user.findUnique({
//         where: {
//             id: userId,
//         },
//         select: {
//             id: true,
//             name: true,
//             email: true,
//             subscriptionPlan: true,
//             subscriptionStatus: true,
//             currentPeriodEnd: true,
//             subscription: true,
//             isDeleted: true
//         },
//     })

//     if (!user || user.isDeleted == true) {
//         throw new AppError('user not found', 404)
//     }

//     return user
// }

type BillingUser = {
    subscriptionPlan: string | null
    subscriptionStatus: string | null
    currentPeriodEnd: Date | null
    subscription: unknown
}

const buildSubscriptionSummary = (user: BillingUser) => {
    return {
        plan: user.subscriptionPlan,
        status: user.subscriptionStatus,
        currentPeriodEnd: user.currentPeriodEnd,
        subscription: user.subscription,
    }
}

const getOverview = async (userId: string) => {
    const user = await prisma.user.findUnique({
        where: {
            id: userId,
        },
        select: {
            id: true,
            name: true,
            email: true,
            subscriptionPlan: true,
            subscriptionStatus: true,
            currentPeriodEnd: true,
            subscription: true,
            isDeleted: true,
            createdAt: true,
            creditBalance: true,
            giftedCredits: true,
        },
    })

    if (!user || user.isDeleted == true) {
        throw new AppError('user not found', 404)
    }

    const now = new Date()
    const isPro = user.subscriptionPlan === 'PRO' && user.subscriptionStatus === 'ACTIVE'

    let periodStart: Date
    let periodEnd: Date

    if (!isPro) {
        periodStart = user.createdAt
        periodEnd = new Date('2099-12-31T23:59:59.000Z')
    } else {
        const subscriptionPeriodStart = user.subscription?.currentPeriodStart
        const subscriptionPeriodEnd = user.subscription?.currentPeriodEnd
        const hasActiveSubscriptionPeriod =
            subscriptionPeriodStart !== undefined &&
            subscriptionPeriodEnd !== undefined &&
            subscriptionPeriodEnd > now
        periodStart = hasActiveSubscriptionPeriod
            ? subscriptionPeriodStart
            : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
        periodEnd = hasActiveSubscriptionPeriod
            ? subscriptionPeriodEnd
            : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1))
    }

    const aggregate = await prisma.usageEvent.aggregate({
        where: {
            userId,
            ...(isPro ? { periodStart } : {}),
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

    const usedInCents = aggregate._sum.costInCents ?? 0
    const creditLimitInCents = (isPro ? 500 : 100) + user.creditBalance

    const remainingPlanCreditsInCents = Math.max(creditLimitInCents - usedInCents, 0)
    const usedGiftedInCents = Math.max(usedInCents - creditLimitInCents, 0)
    const remainingGiftedCreditsInCents = Math.max(user.giftedCredits - usedGiftedInCents, 0)
    const remainingInCents = remainingPlanCreditsInCents + remainingGiftedCreditsInCents

    return {
        ...buildSubscriptionSummary(user),
        periodStart,
        periodEnd,
        usage: {
            inputTokens: aggregate._sum.inputTokens ?? 0,
            outputTokens: aggregate._sum.outputTokens ?? 0,
            totalTokens: aggregate._sum.totalTokens ?? 0,
            costInCents: usedInCents,
        },
        credits: {
            limitInCents: creditLimitInCents,
            giftedCreditsInCents: user.giftedCredits,
            usedInCents,
            remainingPlanCreditsInCents,
            remainingGiftedCreditsInCents,
            remainingInCents,
            unlimited: creditLimitInCents === null,
        },
    }
}

const getPlans = async () => {
    const plans = getPlanCatalog()
    const razorpayPlanId = process.env.RAZORPAY_PRO_PLAN_ID

    if (!razorpayPlanId) {
        return plans
    }

    try {
        const razorpayPlan = await razorpay.plans.fetch(razorpayPlanId)

        return plans.map((plan) => {
            if (plan.id !== 'PRO') {
                return plan
            }

            return {
                ...plan,
                priceInPaise: razorpayPlan.item?.amount ?? plan.priceInPaise,
                currency: razorpayPlan.item?.currency ?? plan.currency,
                interval: razorpayPlan.period,
                razorpayPlanId,
            }
        })
    } catch {
        return plans
    }
}

const createSubscription = async (data: CreateSubscriptionInput) => {
    const user = await prisma.user.findUnique({
        where: {
            id: data.userId,
        },
        select: {
            id: true,
            name: true,
            email: true,
            subscriptionPlan: true,
            subscriptionStatus: true,
            currentPeriodEnd: true,
            subscription: true,
            isDeleted: true,
        },
    })

    if (!user || user.isDeleted == true) {
        throw new AppError('user not found', 404)
    }

    if (user.subscriptionStatus === 'ACTIVE' && user.subscriptionPlan === data.plan) {
        throw new AppError('subscription already active', 409)
    }

    const planId = getRazorpayProPlanId()
    const subscription = (await razorpay.subscriptions.create({
        plan_id: planId,
        total_count: data.totalCount,
        quantity: data.quantity,
        customer_notify: 1,
        notify_info: {
            notify_email: user.email,
        },
        notes: {
            userId: user.id,
            plan: data.plan,
        },
    })) as RazorpaySubscriptionLike

    return {
        keyId: getRazorpayKeyId(),
        subscriptionId: subscription.id,
        provider: 'razorpay',
        plan: data.plan,
        razorpayPlanId: planId,
        shortUrl: subscription.short_url ?? null,
        subscription,
    }
}

const persistProviderSubscription = async (data: {
    userId: string
    subscription: RazorpaySubscriptionLike
    cancelAtPeriodEnd?: boolean
}) => {
    const { periodStart, periodEnd } = resolveSubscriptionPeriods(data.subscription)
    const providerStatus = mapRazorpayProviderStatus(data.subscription.status)
    const userStatus = mapUserSubscriptionStatus(data.subscription.status)
    const userPlan = userStatus === 'ACTIVE' || userStatus === 'PAST_DUE' ? 'PRO' : 'FREE'

    const existingForProvider = await prisma.subscription.findUnique({
        where: {
            providerSubscriptionId: data.subscription.id,
        },
        select: {
            userId: true,
        },
    })

    if (existingForProvider && existingForProvider.userId !== data.userId) {
        throw new AppError('subscription belongs to another user', 409)
    }

    const previousUser = await prisma.user.findUnique({
        where: {
            id: data.userId,
        },
        select: {
            subscriptionPlan: true,
        },
    })

    const [subscription, user] = await prisma.$transaction([
        prisma.subscription.upsert({
            where: {
                userId: data.userId,
            },
            create: {
                userId: data.userId,
                provider: 'razorpay',
                providerSubscriptionId: data.subscription.id,
                providerCustomerId: data.subscription.customer_id ?? null,
                providerPlanId: data.subscription.plan_id ?? getRazorpayProPlanId(),
                status: providerStatus,
                plan: 'PRO',
                cancelAtPeriodEnd: data.cancelAtPeriodEnd ?? false,
                currentPeriodStart: periodStart,
                currentPeriodEnd: periodEnd,
            },
            update: {
                provider: 'razorpay',
                providerSubscriptionId: data.subscription.id,
                providerCustomerId: data.subscription.customer_id ?? null,
                providerPlanId: data.subscription.plan_id ?? getRazorpayProPlanId(),
                status: providerStatus,
                plan: 'PRO',
                cancelAtPeriodEnd: data.cancelAtPeriodEnd ?? false,
                currentPeriodStart: periodStart,
                currentPeriodEnd: periodEnd,
            },
        }),
        prisma.user.update({
            where: {
                id: data.userId,
            },
            data: {
                subscriptionPlan: userPlan,
                subscriptionStatus: userStatus,
                currentPeriodEnd: periodEnd,
            },
        }),
    ])

    if (userPlan === 'PRO' && previousUser?.subscriptionPlan !== 'PRO') {
        try {
            await sendNotificationToUser({
                userId: data.userId,
                title: 'Upgraded to PRO Plan',
                message:
                    'Thank you for upgrading to Pro! You now have unlimited generation credits and access to premium features.',
                type: 'SUCCESS',
            })
        } catch (error) {
            console.error('Failed to send PRO upgrade notification:', error)
        }
    }

    return {
        subscription,
        user,
    }
}

const verifySubscription = async (data: VerifySubscriptionInput) => {
    const isValid = verifyRazorpaySubscriptionPayment({
        subscriptionId: data.razorpay_subscription_id,
        paymentId: data.razorpay_payment_id,
        signature: data.razorpay_signature,
    })

    if (!isValid) {
        throw new AppError('invalid razorpay signature', 400)
    }

    // await getUserForBilling(data.userId)
    const user = await prisma.user.findUnique({
        where: {
            id: data.userId,
        },
        select: {
            id: true,
            name: true,
            email: true,
            subscriptionPlan: true,
            subscriptionStatus: true,
            currentPeriodEnd: true,
            subscription: true,
            isDeleted: true,
        },
    })

    if (!user || user.isDeleted == true) {
        throw new AppError('user not found', 404)
    }

    const subscription = (await razorpay.subscriptions.fetch(
        data.razorpay_subscription_id
    )) as RazorpaySubscriptionLike

    // Force active status if payment signature is valid to ensure immediate upgrade
    if (
        !subscription.status ||
        subscription.status === 'created' ||
        subscription.status === 'pending'
    ) {
        subscription.status = 'active'
    }

    const result = await persistProviderSubscription({
        userId: data.userId,
        subscription,
    })

    return {
        verified: true,
        paymentId: data.razorpay_payment_id,
        subscription: result.subscription,
        user: {
            subscriptionPlan: result.user.subscriptionPlan,
            subscriptionStatus: result.user.subscriptionStatus,
            currentPeriodEnd: result.user.currentPeriodEnd,
        },
    }
}

const cancelSubscription = async (data: CancelSubscriptionInput) => {
    const user = await prisma.user.findUnique({
        where: {
            id: data.userId,
        },
        select: {
            id: true,
            name: true,
            email: true,
            subscriptionPlan: true,
            subscriptionStatus: true,
            currentPeriodEnd: true,
            subscription: true,
            isDeleted: true,
        },
    })

    if (!user || user.isDeleted == true) {
        throw new AppError('user not found', 404)
    }

    if (!user.subscription) {
        throw new AppError('subscription not found', 404)
    }

    if (user.subscription.provider !== 'razorpay') {
        throw new AppError('unsupported billing provider', 400)
    }

    const canceledSubscription = (await razorpay.subscriptions.cancel(
        user.subscription.providerSubscriptionId,
        data.cancelAtPeriodEnd
    )) as RazorpaySubscriptionLike

    const shouldRemainActive = data.cancelAtPeriodEnd && canceledSubscription.status !== 'cancelled'
    const nextUserStatus = shouldRemainActive
        ? 'ACTIVE'
        : mapUserSubscriptionStatus(canceledSubscription.status)
    const nextUserPlan =
        nextUserStatus === 'ACTIVE' || nextUserStatus === 'PAST_DUE' ? 'PRO' : 'FREE'
    const providerStatus = mapRazorpayProviderStatus(canceledSubscription.status)
    const { periodStart, periodEnd } = resolveSubscriptionPeriods(canceledSubscription)

    const [subscription, updatedUser] = await prisma.$transaction([
        prisma.subscription.update({
            where: {
                userId: data.userId,
            },
            data: {
                status: providerStatus,
                cancelAtPeriodEnd: data.cancelAtPeriodEnd,
                currentPeriodStart: periodStart,
                currentPeriodEnd: periodEnd,
            },
        }),
        prisma.user.update({
            where: {
                id: data.userId,
            },
            data: {
                subscriptionPlan: nextUserPlan,
                subscriptionStatus: nextUserStatus,
                currentPeriodEnd: periodEnd,
            },
        }),
    ])

    return {
        subscription,
        user: {
            subscriptionPlan: updatedUser.subscriptionPlan,
            subscriptionStatus: updatedUser.subscriptionStatus,
            currentPeriodEnd: updatedUser.currentPeriodEnd,
        },
    }
}

const getCreditsHistory = async (data: CreditsHistoryInput) => {
    const user = await prisma.user.findUnique({
        where: {
            id: data.userId,
        },
        select: {
            id: true,
            name: true,
            email: true,
            subscriptionPlan: true,
            subscriptionStatus: true,
            currentPeriodEnd: true,
            subscription: true,
            isDeleted: true,
        },
    })

    if (!user || user.isDeleted == true) {
        throw new AppError('user not found', 404)
    }

    const where: any = {
        userId: data.userId,
    }

    if (data.periodStart && data.periodEnd) {
        where.createdAt = {
            gte: new Date(data.periodStart),
            lte: new Date(data.periodEnd),
        }
    } else if (data.periodStart) {
        where.createdAt = {
            gte: new Date(data.periodStart),
        }
    } else if (data.periodEnd) {
        where.createdAt = {
            lte: new Date(data.periodEnd),
        }
    }

    const [events, total] = await Promise.all([
        prisma.usageEvent.findMany({
            where,
            orderBy: {
                createdAt: 'desc',
            },
            include: {
                project: {
                    select: {
                        name: true,
                    },
                },
            },
            skip: data.offset,
            take: data.limit,
        }),
        prisma.usageEvent.count({
            where,
        }),
    ])

    const periods = new Map<string, { periodStart: Date; periodEnd: Date; costInCents: number }>()

    for (const event of events) {
        const key = event.periodStart.toISOString()
        const period = periods.get(key) ?? {
            periodStart: event.periodStart,
            periodEnd: event.periodEnd,
            costInCents: 0,
        }

        period.costInCents += event.costInCents
        periods.set(key, period)
    }

    return {
        events,
        total,
        limit: data.limit,
        offset: data.offset,
        periods: Array.from(periods.values()),
    }
}

const createPortalSession = async (userId: string) => {
    const user = await prisma.user.findUnique({
        where: {
            id: userId,
        },
        select: {
            id: true,
            name: true,
            email: true,
            subscriptionPlan: true,
            subscriptionStatus: true,
            currentPeriodEnd: true,
            subscription: true,
            isDeleted: true,
        },
    })

    if (!user || user.isDeleted == true) {
        throw new AppError('user not found', 404)
    }

    return {
        provider: 'razorpay',
        url: process.env.RAZORPAY_DASHBOARD_URL ?? 'https://dashboard.razorpay.com/',
        subscriptionId: user.subscription?.providerSubscriptionId ?? null,
    }
}

const handleRazorpayWebhook = async (data: RazorpayWebhookInput) => {
    const rawBody = data.rawBody ?? Buffer.from(JSON.stringify(data.body))
    const isValid = verifyRazorpayWebhookSignature({
        body: rawBody,
        signature: data.signature,
    })

    if (!isValid) {
        throw new AppError('invalid webhook signature', 400)
    }

    const event = data.body.event as string | undefined
    const subscription = data.body.payload?.subscription?.entity as
        | RazorpaySubscriptionLike
        | undefined

    if (!event || !subscription?.id) {
        return {
            processed: false,
            reason: 'unsupported webhook payload',
        }
    }

    const existingSubscription = await prisma.subscription.findUnique({
        where: {
            providerSubscriptionId: subscription.id,
        },
        select: {
            userId: true,
        },
    })
    const userId = existingSubscription?.userId ?? subscription.notes?.userId?.toString()

    if (!userId) {
        return {
            processed: false,
            reason: 'user not found for subscription',
            event,
            subscriptionId: subscription.id,
        }
    }

    const user = await prisma.user.findUnique({
        where: {
            id: userId,
            isDeleted: false,
        },
        select: {
            id: true,
        },
    })

    if (!user) {
        return {
            processed: false,
            reason: 'user not found',
            event,
            subscriptionId: subscription.id,
        }
    }

    const result = await persistProviderSubscription({
        userId,
        subscription,
        cancelAtPeriodEnd: event === 'subscription.cancelled' ? false : undefined,
    })

    return {
        processed: true,
        event,
        subscription: result.subscription,
    }
}

const redeemCode = async (data: { userId: string; code: string }) => {
    const { userId, code } = data

    const normalizedCode = code.trim().toUpperCase()
    if (!normalizedCode) {
        throw new AppError('Redeem code cannot be empty', 400)
    }

    const codeHash = crypto.createHash('sha256').update(normalizedCode).digest('hex')

    const result = await prisma.$transaction(async (tx) => {
        const dbCode = await tx.redeemCode.findUnique({
            where: { codeHash },
        })

        if (!dbCode) {
            throw new AppError('Invalid or expired redeem code.', 404)
        }

        const now = new Date()
        if (dbCode.expiresAt && dbCode.expiresAt < now) {
            throw new AppError('This redeem code has expired.', 400)
        }

        if (dbCode.maxRedemptions !== null && dbCode.redemptionCount >= dbCode.maxRedemptions) {
            throw new AppError('This redeem code has reached its maximum redemptions.', 400)
        }

        const existingClaim = await tx.redeemCodeClaim.findUnique({
            where: {
                redeemCodeId_userId: {
                    redeemCodeId: dbCode.id,
                    userId,
                },
            },
        })

        if (existingClaim) {
            throw new AppError('You have already redeemed this code.', 409)
        }

        const updatedUser = await tx.user.update({
            where: { id: userId },
            data: {
                giftedCredits: {
                    increment: dbCode.creditAmount,
                },
            },
        })

        await tx.redeemCodeClaim.create({
            data: {
                redeemCodeId: dbCode.id,
                userId,
            },
        })

        await tx.redeemCode.update({
            where: { id: dbCode.id },
            data: {
                redemptionCount: {
                    increment: 1,
                },
            },
        })

        return {
            creditAmount: dbCode.creditAmount,
            newBalance: updatedUser.giftedCredits,
        }
    })

    try {
        await sendNotificationToUser({
            userId,
            title: 'Code Redeemed Successfully',
            message: `Successfully claimed $${(result.creditAmount / 100).toFixed(2)} in gifted credits!`,
            type: 'SUCCESS',
        })
    } catch (err) {
        console.error('Failed to send redemption notification:', err)
    }

    return result
}

export const billingService = {
    getOverview,
    getPlans,
    createSubscription,
    verifySubscription,
    cancelSubscription,
    getCreditsHistory,
    createPortalSession,
    handleRazorpayWebhook,
    redeemCode,
}
