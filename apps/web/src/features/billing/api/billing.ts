import { ApiError, apiFetch, apiRequest } from '@/shared/api/client'

export interface BillingOverview {
    creditBalance: number
    giftedCredits: number
    createdAt: string
    usdToInrRate?: number
    usage: {
        inputTokens: number
        outputTokens: number
        totalTokens: number
        costInCents: number
    }
    claims: Array<{
        id: string
        createdAt: string
        amountInCents: number
        code: string
    }>
    transactions: Array<{
        id: string
        createdAt: string
        amountInCents: number
        currency: string
        provider: 'RAZORPAY' | 'COINBASE' | 'GRANT' | 'ADJUSTMENT' | 'REFERRAL'
        status: 'PENDING' | 'SUCCESS' | 'FAILED'
    }>
}

/** the invite link of the user. both sides get the amount when the new account first pays */
export interface Referral {
    code: string
    link: string
    amountInCents: number
    // the smallest payment of the invited account that pays the credit
    minTopUpInCents: number
    // accounts that signed up with the link, and how many of them were paid
    invited: number
    credited: number
    maxCredited: number
}

/** spend limits and the low balance alert (#638). whole cents, null is off */
export interface SpendLimits {
    lowBalanceAlertCents: number | null
    sessionLimitCents: number | null
    dayLimitCents: number | null
}

export interface FreeCreditRequest {
    status: 'PENDING' | 'APPROVED' | 'REJECTED'
    createdAt: string
    reviewedAt?: string | null
    rejectReason?: string | null
    amountInCents: number
}

export interface FreeCreditRequestInput {
    buildPlan: string
    heardFrom: string
    agreeToFeedback: true
}

export interface CreateRazorpayOrderInput {
    amountInCents: number
    currency?: string
}

export interface CreateRazorpayOrderResponse {
    keyId: string
    orderId: string
    amount: number
    currency: string
    usdToInrRate?: number
}

export interface VerifyRazorpayPaymentInput {
    razorpay_order_id: string
    razorpay_payment_id: string
    razorpay_signature: string
}

export interface VerifyRazorpayPaymentResponse {
    success: boolean
    alreadyProcessed?: boolean
    newBalance?: number
}

export interface UsageEvent {
    id: string
    model: string
    inputTokens: number
    outputTokens: number
    totalTokens: number
    // For own-key runs this is an estimate of the provider cost: December did not charge it
    costInCents: number
    billingSource?: 'CREDITS' | 'OWN_KEY'
    periodStart: string
    periodEnd: string
    metadata: any
    createdAt: string
    session?: { title: string | null } | null
}

export type UsageBillingSource = 'CREDITS' | 'OWN_KEY'

/** the sums of every event of the range. own-key cost is not in the cost */
export interface UsageTotals {
    costInCents: number
    totalTokens: number
    sessions: number
}

/** one day (YYYY-MM-DD) of the range. a day with no usage has zeros */
export interface UsageDay {
    date: string
    costInCents: number
    totalTokens: number
    // the part of totalTokens that ran on the user's own keys
    ownKeyTokens: number
}

/** one hour of the day (0 to 23), in time order. only a range of one day has hours */
export interface UsageHour {
    hour: number
    costInCents: number
    totalTokens: number
    ownKeyTokens: number
}

export interface CreditsHistoryParams {
    limit?: number
    offset?: number
    periodStart?: string
    periodEnd?: string
    // no value is all events
    billingSource?: UsageBillingSource
    // the time zone of the days and hours
    timezone?: string
}

export interface CreditsHistoryResponse {
    // one page of events
    events: UsageEvent[]
    total: number
    limit: number
    offset: number
    // the events of this page only. read totals for a sum
    periods: Array<{
        periodStart: string
        periodEnd: string
        costInCents: number
    }>
    totals: UsageTotals
    days: UsageDay[]
    hours?: UsageHour[]
}

const getOverview = () => {
    return apiRequest<BillingOverview>('/billing/overview')
}

const createRazorpayOrder = (data: CreateRazorpayOrderInput) => {
    return apiRequest<CreateRazorpayOrderResponse>('/billing/wallet/order/razorpay', {
        method: 'POST',
        body: JSON.stringify(data),
    })
}

const verifyRazorpayPayment = (data: VerifyRazorpayPaymentInput) => {
    return apiRequest<VerifyRazorpayPaymentResponse>('/billing/wallet/verify/razorpay', {
        method: 'POST',
        body: JSON.stringify(data),
    })
}

const getCreditsHistory = (params: CreditsHistoryParams = {}) => {
    const query = new URLSearchParams()
    if (params.limit !== undefined) query.set('limit', params.limit.toString())
    if (params.offset !== undefined) query.set('offset', params.offset.toString())
    if (params.periodStart !== undefined) query.set('periodStart', params.periodStart)
    if (params.periodEnd !== undefined) query.set('periodEnd', params.periodEnd)
    if (params.billingSource !== undefined) query.set('billingSource', params.billingSource)
    if (params.timezone !== undefined) query.set('timezone', params.timezone)

    const queryString = query.toString()
    const path = `/billing/credits/history${queryString ? `?${queryString}` : ''}`
    return apiRequest<CreditsHistoryResponse>(path)
}

/** the receipt pdf of one payment. a fetch, not a link, so the sign-in goes with it */
const downloadReceipt = async (transactionId: string) => {
    const res = await apiFetch(`/billing/transactions/${encodeURIComponent(transactionId)}/receipt`)

    if (!res.ok) {
        let payload: { message?: string } | null
        try {
            payload = await res.json()
        } catch {
            // Intentionally swallowed: an error with no json body still gets a message
            payload = null
        }
        throw new ApiError(
            payload?.message || `Request failed with status ${res.status}`,
            res.status
        )
    }

    return {
        blob: await res.blob(),
        // a browser on another origin cannot read this header: then the caller names the file
        fileName:
            res.headers.get('Content-Disposition')?.match(/filename="?([^";]+)"?/)?.[1] ?? null,
    }
}

const getReferral = () => {
    return apiRequest<Referral>('/billing/referral')
}

const getFreeCreditRequest = () => {
    return apiRequest<FreeCreditRequest | null>('/billing/credit-request')
}

const requestFreeCredits = (data: FreeCreditRequestInput) => {
    return apiRequest<FreeCreditRequest>('/billing/credit-request', {
        method: 'POST',
        body: JSON.stringify(data),
    })
}

const getLimits = () => apiRequest<SpendLimits>('/billing/limits')

/** only the amounts that are sent change. null turns one off */
const updateLimits = (data: Partial<SpendLimits>) =>
    apiRequest<SpendLimits>('/billing/limits', {
        method: 'PATCH',
        body: JSON.stringify(data),
    })

export const billingAPI = {
    getLimits,
    updateLimits,
    getReferral,
    getFreeCreditRequest,
    requestFreeCredits,
    getOverview,
    createRazorpayOrder,
    verifyRazorpayPayment,
    getCreditsHistory,
    downloadReceipt,
}
