export type GetOverview = {
    userId: string
}

export type CreateSubscription = {
    userId: string
    plan: 'PRO'
    quantity: number
    totalCount: number
}

export type VerifySubscription = {
    userId: string
    razorpay_subscription_id: string
    razorpay_payment_id: string
    razorpay_signature: string
}

export type CancelSubscription = {
    userId: string
    cancelAtPeriodEnd: boolean
}

export type CreditsHistory = {
    userId: string
    limit: number
    offset: number
    periodStart?: string
    periodEnd?: string
}

export type CreatePortalSession = {
    userId: string
}

export type RazorpayWebhook = {
    body: Record<string, any>
    rawBody?: Buffer
    signature?: string
}

export type RedeemCode = {
    userId: string
    code: string
}

export type RazorpaySubscriptionStatus =
    | 'created'
    | 'authenticated'
    | 'active'
    | 'pending'
    | 'halted'
    | 'cancelled'
    | 'completed'
    | 'expired'

export type RazorpaySubscriptionLike = {
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
    short_url?: string
}

export type PersistProviderSubscription = {
    userId: string
    subscription: RazorpaySubscriptionLike
    cancelAtPeriodEnd?: boolean
}

export type VerifyRazorpaySubscriptionPayment = {
    subscriptionId: string
    paymentId: string
    signature: string
}

export type VerifyRazorpayWebhookSignature = {
    body: Buffer | string
    signature?: string
}
