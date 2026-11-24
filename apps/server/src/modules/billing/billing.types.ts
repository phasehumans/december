export type GetOverview = {
    userId: string
}

export type CreateRazorpayOrder = {
    userId: string
    amountInCents: number
    currency?: string
}

export type VerifyRazorpayPayment = {
    userId: string
    razorpay_order_id: string
    razorpay_payment_id: string
    razorpay_signature: string
}

export type CreditsHistory = {
    userId: string
    limit: number
    offset: number
    periodStart?: string
    periodEnd?: string
}

export type RedeemCode = {
    userId: string
    code: string
}

export type AddCredits = {
    userId: string
    amountInCents: number
    paymentMethod: string
}

export type RequestFreeCredits = {
    userId: string
    buildPlan: string
    heardFrom: string
    ipAddress?: string
    userAgent?: string
}

export type CreditRequestRecord = {
    status: string
    createdAt: Date
    reviewedAt: Date | null
    rejectReason: string | null
}

export type GetFreeCreditRequest = {
    userId: string
}

export type HandleRazorpayWebhook = {
    rawBody: string | Buffer
    signature: string
    eventPayload: any
}
