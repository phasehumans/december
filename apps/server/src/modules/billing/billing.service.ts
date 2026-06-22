import crypto from 'crypto'

import { razorpay } from '../../config/razorpay'
import { AppError } from '../../shared/appError'
import { sendNotificationToUser } from '../notification/notification.service'

import { billingRepository } from './billing.repository'
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

import type {
    GetOverview,
    CreateSubscription,
    VerifySubscription,
    CancelSubscription,
    CreditsHistory,
    CreatePortalSession,
    RazorpayWebhook,
    RedeemCode,
    PersistProviderSubscription,
    RazorpaySubscriptionLike,
} from './billing.types'

type BillingUser = {
    subscriptionPlan: string | null
    subscriptionStatus: string | null
    currentPeriodEnd: Date | null
    subscription: any
}

const buildSubscriptionSummary = (user: BillingUser) => {
    return {
        plan: user.subscriptionPlan,
        status: user.subscriptionStatus,
        currentPeriodEnd: user.currentPeriodEnd,
        subscription: user.subscription,
    }
}

const getOverview = async (data: GetOverview) => {
    const { userId } = data
    const user = await billingRepository.findUserForOverview(userId)

    if (!user) {
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
        const sub = user.subscription as any
        const subscriptionPeriodStart = sub?.currentPeriodStart
        const subscriptionPeriodEnd = sub?.currentPeriodEnd
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

    const [aggregate, claims] = await Promise.all([
        billingRepository.aggregateUsage(userId, periodStart, periodEnd, isPro),
        billingRepository.findRedeemCodeClaims(userId),
    ])

    const usedInCents = aggregate._sum.costInCents ?? 0
    const creditLimitInCents = isPro ? 500 : 100
    const totalGiftedCredits = claims.reduce((sum, c) => sum + c.redeemCode.creditAmount, 0)

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
            giftedCreditsInCents: totalGiftedCredits,
            usedInCents,
        },
    }
}

const getPlans = async () => {
    const plans = getPlanCatalog()
    const razorpayPlanId = getRazorpayProPlanId()

    try {
        const razorpayPlan = (await razorpay.plans.fetch(razorpayPlanId)) as any
        return plans.map((plan) => {
            if (plan.id !== 'PRO') return plan
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

const createSubscription = async (data: CreateSubscription) => {
    const { userId, plan, totalCount, quantity } = data
    const user = await billingRepository.findUserForCreateSub(userId)

    if (!user) {
        throw new AppError('user not found', 404)
    }

    if (user.subscriptionStatus === 'ACTIVE' && user.subscriptionPlan === plan) {
        throw new AppError('subscription already active', 409)
    }

    const planId = getRazorpayProPlanId()
    const subscription = (await razorpay.subscriptions.create({
        plan_id: planId,
        total_count: totalCount,
        quantity: quantity,
        customer_notify: 1,
        notify_info: {
            notify_email: user.email,
        },
        notes: {
            userId: user.id,
            plan: plan,
        },
    })) as RazorpaySubscriptionLike

    return {
        keyId: getRazorpayKeyId(),
        subscriptionId: subscription.id,
        provider: 'razorpay',
        plan: plan,
        razorpayPlanId: planId,
        shortUrl: subscription.short_url ?? null,
        subscription,
    }
}

const persistProviderSubscription = async (data: PersistProviderSubscription) => {
    const { userId, subscription: provSubscription, cancelAtPeriodEnd } = data
    const { periodStart, periodEnd } = resolveSubscriptionPeriods(provSubscription)
    const providerStatus = mapRazorpayProviderStatus(provSubscription.status)
    const userStatus = mapUserSubscriptionStatus(provSubscription.status)
    const userPlan = userStatus === 'ACTIVE' || userStatus === 'PAST_DUE' ? 'PRO' : 'FREE'

    const existingForProvider = await billingRepository.findSubscriptionByProviderId(
        provSubscription.id
    )

    if (existingForProvider && existingForProvider.userId !== userId) {
        throw new AppError('subscription belongs to another user', 409)
    }

    const previousUser = await billingRepository.findUserPlan(userId)

    const existingSubscription = await billingRepository.findSubscriptionByUserId(userId)

    let nextCreditBalance: number | undefined = undefined

    // 1. Initial Upgrade: plan changes from FREE to PRO
    const isInitialUpgrade = previousUser?.subscriptionPlan !== 'PRO' && userPlan === 'PRO'

    // 2. Renewal: Pro subscription renewed for a new billing cycle (different start date)
    const isRenewal =
        userPlan === 'PRO' &&
        existingSubscription &&
        existingSubscription.plan === 'PRO' &&
        existingSubscription.currentPeriodStart.getTime() !== periodStart.getTime()

    // 3. Downgrade: plan changes from PRO to FREE
    const isDowngrade = previousUser?.subscriptionPlan === 'PRO' && userPlan === 'FREE'

    if (isInitialUpgrade || isRenewal) {
        nextCreditBalance = 500 // Reset/expire and set to exactly $5.00
    } else if (isDowngrade) {
        nextCreditBalance = 0 // Clear to 0
    }

    const [subscription, user] = await billingRepository.persistProviderSubscription({
        userId,
        userPlan,
        userStatus,
        periodEnd,
        nextCreditBalance,
        providerSubscriptionId: provSubscription.id,
        providerCustomerId: provSubscription.customer_id ?? null,
        providerPlanId: provSubscription.plan_id ?? getRazorpayProPlanId(),
        status: providerStatus,
        cancelAtPeriodEnd: cancelAtPeriodEnd ?? false,
        periodStart,
    })

    if (userPlan === 'PRO' && previousUser?.subscriptionPlan !== 'PRO') {
        try {
            await sendNotificationToUser({
                userId: userId,
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

const verifySubscription = async (data: VerifySubscription) => {
    const { userId, razorpay_subscription_id, razorpay_payment_id, razorpay_signature } = data
    const isValid = verifyRazorpaySubscriptionPayment({
        subscriptionId: razorpay_subscription_id,
        paymentId: razorpay_payment_id,
        signature: razorpay_signature,
    })

    if (!isValid) {
        throw new AppError('invalid razorpay signature', 400)
    }

    const user = await billingRepository.findUserForCreateSub(userId)

    if (!user) {
        throw new AppError('user not found', 404)
    }

    const subscription = (await razorpay.subscriptions.fetch(
        razorpay_subscription_id
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
        userId,
        subscription,
    })

    return {
        verified: true,
        paymentId: razorpay_payment_id,
        subscription: result.subscription,
        user: {
            subscriptionPlan: result.user.subscriptionPlan,
            subscriptionStatus: result.user.subscriptionStatus,
            currentPeriodEnd: result.user.currentPeriodEnd,
        },
    }
}

const cancelSubscription = async (data: CancelSubscription) => {
    const { userId, cancelAtPeriodEnd } = data
    const user = await billingRepository.findUserForCreateSub(userId)

    if (!user) {
        throw new AppError('user not found', 404)
    }

    const sub = user.subscription as any
    if (!sub) {
        throw new AppError('subscription not found', 404)
    }

    if (sub.provider !== 'razorpay') {
        throw new AppError('unsupported billing provider', 400)
    }

    const canceledSubscription = (await razorpay.subscriptions.cancel(
        sub.providerSubscriptionId,
        cancelAtPeriodEnd
    )) as RazorpaySubscriptionLike

    const shouldRemainActive = cancelAtPeriodEnd && canceledSubscription.status !== 'cancelled'
    const nextUserStatus = shouldRemainActive
        ? 'ACTIVE'
        : mapUserSubscriptionStatus(canceledSubscription.status)
    const nextUserPlan =
        nextUserStatus === 'ACTIVE' || nextUserStatus === 'PAST_DUE' ? 'PRO' : 'FREE'
    const providerStatus = mapRazorpayProviderStatus(canceledSubscription.status)
    const { periodStart, periodEnd } = resolveSubscriptionPeriods(canceledSubscription)

    const [subscription, updatedUser] = await billingRepository.cancelSubscription({
        userId,
        providerStatus,
        cancelAtPeriodEnd,
        periodStart,
        periodEnd,
        nextUserPlan,
        nextUserStatus,
    })

    return {
        subscription,
        user: {
            subscriptionPlan: updatedUser.subscriptionPlan,
            subscriptionStatus: updatedUser.subscriptionStatus,
            currentPeriodEnd: updatedUser.currentPeriodEnd,
        },
    }
}

const getCreditsHistory = async (data: CreditsHistory) => {
    const { userId, limit, offset, periodStart, periodEnd } = data
    const user = await billingRepository.findUserForCreateSub(userId)

    if (!user) {
        throw new AppError('user not found', 404)
    }

    const where: any = {
        userId,
    }

    if (periodStart && periodEnd) {
        where.createdAt = {
            gte: new Date(periodStart),
            lte: new Date(periodEnd),
        }
    } else if (periodStart) {
        where.createdAt = {
            gte: new Date(periodStart),
        }
    } else if (periodEnd) {
        where.createdAt = {
            lte: new Date(periodEnd),
        }
    }

    const [events, total] = await Promise.all([
        billingRepository.findManyUsageEvents(where, offset, limit),
        billingRepository.countUsageEvents(where),
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
        limit,
        offset,
        periods: Array.from(periods.values()),
    }
}

const createPortalSession = async (data: CreatePortalSession) => {
    const { userId } = data
    const user = await billingRepository.findUserForCreateSub(userId)

    if (!user) {
        throw new AppError('user not found', 404)
    }

    const sub = user.subscription as any
    return {
        provider: 'razorpay',
        url: process.env.RAZORPAY_DASHBOARD_URL ?? 'https://dashboard.razorpay.com/',
        subscriptionId: sub?.providerSubscriptionId ?? null,
    }
}

const handleRazorpayWebhook = async (data: RazorpayWebhook) => {
    const { body, rawBody, signature } = data
    const webhookRawBody = rawBody ?? Buffer.from(JSON.stringify(body))
    const isValid = verifyRazorpayWebhookSignature({
        body: webhookRawBody,
        signature,
    })

    if (!isValid) {
        throw new AppError('invalid webhook signature', 400)
    }

    const event = body.event as string | undefined
    const subscription = body.payload?.subscription?.entity as RazorpaySubscriptionLike | undefined

    if (!event || !subscription?.id) {
        return {
            processed: false,
            reason: 'unsupported webhook payload',
        }
    }

    const existingSubscription = await billingRepository.findSubscriptionByProviderId(
        subscription.id
    )
    const userId = existingSubscription?.userId ?? subscription.notes?.userId?.toString()

    if (!userId) {
        return {
            processed: false,
            reason: 'user not found for subscription',
            event,
            subscriptionId: subscription.id,
        }
    }

    const user = await billingRepository.findUserById(userId)

    if (!user || user.isDeleted) {
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

const redeemCode = async (data: RedeemCode) => {
    const { userId, code } = data

    const normalizedCode = code.trim().toUpperCase()
    if (!normalizedCode) {
        throw new AppError('redeem code cannot be empty', 400)
    }

    const codeHash = crypto.createHash('sha256').update(normalizedCode).digest('hex')

    const result = await billingRepository.redeemCode({ userId, codeHash })

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

interface AddCredits {
    userId: string
    amountInCents: number
    paymentMethod: string
}

const addCredits = async (data: AddCredits) => {
    const { userId, amountInCents, paymentMethod } = data

    const user = await billingRepository.findUserByIdForCredits(userId)

    if (!user) {
        throw new AppError('user not found', 404)
    }

    const updatedUser = await billingRepository.addCredits(userId, amountInCents)

    try {
        await sendNotificationToUser({
            userId,
            title: 'Credits Added Successfully',
            message: `Successfully purchased $${(amountInCents / 100).toFixed(2)} in credits using ${paymentMethod.toUpperCase()}!`,
            type: 'SUCCESS',
        })
    } catch (err) {
        console.error('Failed to send purchase notification:', err)
    }

    return {
        amountInCents,
        newBalance: updatedUser.creditBalance,
    }
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
    addCredits,
}
