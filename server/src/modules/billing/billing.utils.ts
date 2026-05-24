import crypto from 'crypto'

import {
    validatePaymentVerification,
    validateWebhookSignature,
} from 'razorpay/dist/utils/razorpay-utils'

const FREE_MONTHLY_CREDIT_CENTS = 500
const PRO_MONTHLY_CREDIT_CENTS = null

type RazorpaySubscriptionStatus =
    | 'created'
    | 'authenticated'
    | 'active'
    | 'pending'
    | 'halted'
    | 'cancelled'
    | 'completed'
    | 'expired'

type RazorpaySubscriptionLike = {
    id: string
    status?: RazorpaySubscriptionStatus | string
    current_start?: number | null
    current_end?: number | null
    start_at?: number | null
    end_at?: number | null
    ended_at?: number | null
    customer_id?: string | null
    plan_id?: string
    notes?: Record<string, string | number | undefined>
}

export const centsToRupees = (cents: number) => cents / 100

export const nowPlusDays = (days: number) => {
    const date = new Date()
    date.setUTCDate(date.getUTCDate() + days)
    return date
}

export const fromUnixSeconds = (value?: number | null) => {
    if (!value) {
        return null
    }

    return new Date(value * 1000)
}

export const getRazorpayKeyId = () => {
    const keyId = process.env.RAZORPAY_KEY_ID

    if (!keyId) {
        throw new Error('RAZORPAY_KEY_ID is not configured')
    }

    return keyId
}

export const getRazorpayKeySecret = () => {
    const keySecret = process.env.RAZORPAY_KEY_SECRET

    if (!keySecret) {
        throw new Error('RAZORPAY_KEY_SECRET is not configured')
    }

    return keySecret
}

export const getRazorpayProPlanId = () => {
    const planId = process.env.RAZORPAY_PRO_PLAN_ID

    if (!planId) {
        throw new Error('RAZORPAY_PRO_PLAN_ID is not configured')
    }

    return planId
}

export const getPlanCatalog = () => [
    {
        id: 'FREE',
        name: 'Free',
        priceInPaise: 0,
        currency: 'INR',
        interval: 'month',
        monthlyCreditLimitInCents: FREE_MONTHLY_CREDIT_CENTS,
        razorpayPlanId: null,
    },
    {
        id: 'PRO',
        name: 'Pro',
        priceInPaise: null,
        currency: 'INR',
        interval: 'month',
        monthlyCreditLimitInCents: PRO_MONTHLY_CREDIT_CENTS,
        razorpayPlanId: process.env.RAZORPAY_PRO_PLAN_ID ?? null,
    },
]

export const mapRazorpayProviderStatus = (status?: string) => {
    switch (status) {
        case 'active':
        case 'authenticated':
            return 'ACTIVE'
        case 'halted':
            return 'PAST_DUE'
        case 'cancelled':
        case 'completed':
            return 'CANCELED'
        case 'expired':
            return 'INCOMPLETE_EXPIRED'
        case 'created':
        case 'pending':
        default:
            return 'INCOMPLETE'
    }
}

export const mapUserSubscriptionStatus = (status?: string) => {
    switch (status) {
        case 'active':
        case 'authenticated':
            return 'ACTIVE'
        case 'halted':
            return 'PAST_DUE'
        case 'cancelled':
        case 'completed':
            return 'CANCELED'
        default:
            return 'FREE'
    }
}

export const resolveSubscriptionPeriods = (subscription: RazorpaySubscriptionLike) => {
    const periodStart =
        fromUnixSeconds(subscription.current_start) ??
        fromUnixSeconds(subscription.start_at) ??
        new Date()
    const periodEnd =
        fromUnixSeconds(subscription.current_end) ??
        fromUnixSeconds(subscription.end_at) ??
        fromUnixSeconds(subscription.ended_at) ??
        nowPlusDays(30)

    return {
        periodStart,
        periodEnd,
    }
}

export const verifyRazorpaySubscriptionPayment = (data: {
    subscriptionId: string
    paymentId: string
    signature: string
}) => {
    return validatePaymentVerification(
        {
            subscription_id: data.subscriptionId,
            payment_id: data.paymentId,
        },
        data.signature,
        getRazorpayKeySecret()
    )
}

export const verifyRazorpayWebhookSignature = (data: {
    body: Buffer | string
    signature?: string
}) => {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET

    if (!secret) {
        throw new Error('RAZORPAY_WEBHOOK_SECRET is not configured')
    }

    if (!data.signature) {
        return false
    }

    const body = Buffer.isBuffer(data.body) ? data.body.toString('utf8') : data.body
    return validateWebhookSignature(body, data.signature, secret)
}

export const createHmacSignature = (payload: string, secret: string) => {
    return crypto.createHmac('sha256', secret).update(payload).digest('hex')
}
