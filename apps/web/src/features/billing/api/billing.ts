import { apiRequest } from '@/shared/api/client'

export type BillingPlanId = 'FREE' | 'PRO'
export type BillingSubscriptionStatus = 'FREE' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED'

export interface BillingOverview {
    plan: BillingPlanId
    status: BillingSubscriptionStatus
    currentPeriodEnd: string | null
    subscription: {
        id: string
        userId: string
        provider: string
        providerSubscriptionId: string
        providerCustomerId: string | null
        providerPlanId: string
        status: string
        plan: BillingPlanId
        cancelAtPeriodEnd: boolean
        currentPeriodStart: string
        currentPeriodEnd: string
        createdAt: string
        updatedAt: string
    } | null
    periodStart: string
    periodEnd: string
    usage: {
        inputTokens: number
        outputTokens: number
        totalTokens: number
        costInCents: number
    }
    credits: {
        limitInCents: number | null
        giftedCreditsInCents: number
        usedInCents: number
        remainingPlanCreditsInCents: number
        remainingGiftedCreditsInCents: number
        remainingInCents: number | null
        unlimited: boolean
    }
    claims?: Array<{
        id: string
        code: string
        amountInCents: number
        createdAt: string
    }>
}

export interface BillingPlan {
    id: BillingPlanId
    name: string
    priceInPaise: number | null
    currency: string
    interval: 'month' | 'year'
    monthlyCreditLimitInCents: number | null
    razorpayPlanId: string | null
}

export interface CreateSubscriptionInput {
    plan?: BillingPlanId
    quantity?: number
    totalCount?: number
}

export interface CreateSubscriptionResponse {
    keyId: string
    subscriptionId: string
    provider: string
    plan: BillingPlanId
    razorpayPlanId: string
    shortUrl: string | null
    subscription: any
}

export interface VerifySubscriptionInput {
    razorpay_subscription_id: string
    razorpay_payment_id: string
    razorpay_signature: string
}

export interface VerifySubscriptionResponse {
    verified: boolean
    paymentId: string
    subscription: any
    user: {
        subscriptionPlan: BillingPlanId
        subscriptionStatus: BillingSubscriptionStatus
        currentPeriodEnd: string
    }
}

export interface CancelSubscriptionInput {
    cancelAtPeriodEnd?: boolean
}

export interface CancelSubscriptionResponse {
    subscription: any
    user: {
        subscriptionPlan: BillingPlanId
        subscriptionStatus: BillingSubscriptionStatus
        currentPeriodEnd: string
    }
}

export interface UsageEvent {
    id: string
    userId: string
    model: string
    inputTokens: number
    outputTokens: number
    totalTokens: number
    costInCents: number
    projectId: string | null
    chatId: string | null
    externalRequestId: string | null
    periodStart: string
    periodEnd: string
    metadata: any
    createdAt: string
    project?: { name: string } | null
}

export interface CreditsHistoryResponse {
    events: UsageEvent[]
    total: number
    limit: number
    offset: number
    periods: Array<{
        periodStart: string
        periodEnd: string
        costInCents: number
    }>
}

export interface PortalSessionResponse {
    provider: string
    url: string
    subscriptionId: string | null
}

const getOverview = () => {
    return apiRequest<BillingOverview>('/billing/overview')
}

const getPlans = () => {
    return apiRequest<BillingPlan[]>('/billing/plans')
}

const createSubscription = (data: CreateSubscriptionInput = {}) => {
    return apiRequest<CreateSubscriptionResponse>('/billing/subscription', {
        method: 'POST',
        body: JSON.stringify(data),
    })
}

const verifySubscription = (data: VerifySubscriptionInput) => {
    return apiRequest<VerifySubscriptionResponse>('/billing/subscription/verify', {
        method: 'POST',
        body: JSON.stringify(data),
    })
}

const cancelSubscription = (data: CancelSubscriptionInput = {}) => {
    return apiRequest<CancelSubscriptionResponse>('/billing/subscription/cancel', {
        method: 'POST',
        body: JSON.stringify(data),
    })
}

const getCreditsHistory = (
    params: { limit?: number; offset?: number; periodStart?: string; periodEnd?: string } = {}
) => {
    const query = new URLSearchParams()
    if (params.limit !== undefined) query.set('limit', params.limit.toString())
    if (params.offset !== undefined) query.set('offset', params.offset.toString())
    if (params.periodStart !== undefined) query.set('periodStart', params.periodStart)
    if (params.periodEnd !== undefined) query.set('periodEnd', params.periodEnd)

    const queryString = query.toString()
    const path = `/billing/credits/history${queryString ? `?${queryString}` : ''}`
    return apiRequest<CreditsHistoryResponse>(path)
}

const createPortalSession = () => {
    return apiRequest<PortalSessionResponse>('/billing/portal', {
        method: 'POST',
    })
}

const redeemCode = (code: string) => {
    return apiRequest<{ creditAmount: number; newBalance: number }>('/billing/redeem-code', {
        method: 'POST',
        body: JSON.stringify({ code }),
    })
}

const addCredits = (amountInCents: number, paymentMethod: string) => {
    return apiRequest<{ success: boolean; newBalance: number }>('/billing/credits/add', {
        method: 'POST',
        body: JSON.stringify({ amountInCents, paymentMethod }),
    })
}

export const billingAPI = {
    getOverview,
    getPlans,
    createSubscription,
    verifySubscription,
    cancelSubscription,
    getCreditsHistory,
    createPortalSession,
    redeemCode,
    addCredits,
}
