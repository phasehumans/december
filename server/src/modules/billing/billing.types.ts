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
