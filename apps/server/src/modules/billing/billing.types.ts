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

export type UsageBillingSource = 'CREDITS' | 'OWN_KEY'

export type CreditsHistory = {
    userId: string
    limit: number
    offset: number
    periodStart?: string
    periodEnd?: string
    billingSource?: UsageBillingSource
    // the time zone of the days and hours. no value is the time zone saved for the user
    timezone?: string
}

/** the usage events that a sum reads */
export type UsageFilter = {
    userId: string
    start?: Date
    end?: Date
    billingSource?: UsageBillingSource
}

export type UsageTotals = {
    costInCents: number
    totalTokens: number
    sessions: number
}

/** the range that the usage chart shows, in the time zone of its bars */
export type UsageRange = {
    start: Date
    end: Date
    timezone: string
}

/** a day (YYYY-MM-DD) in a time zone and the instant it starts */
export type UsageDayBucket = {
    date: string
    startsAt: Date
}

/** an hour of the day (0 to 23) in a time zone and the instant it starts */
export type UsageHourBucket = {
    hour: number
    startsAt: Date
}

/** the sum of one bucket. bucket 1 starts at the first threshold */
export type UsageBucketSum = {
    bucket: number
    costInCents: number
    totalTokens: number
}

/** one bar of the usage chart for a range of more than one day */
export type UsageDay = {
    date: string
    costInCents: number
    totalTokens: number
}

/** one bar of the usage chart for a one-day range */
export type UsageHour = {
    hour: number
    costInCents: number
    totalTokens: number
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

export type GetReceipt = {
    userId: string
    transactionId: string
}

/** what a receipt shows about one payment */
export type ReceiptData = {
    paidAt: Date
    timezone: string
    // the credits added to the wallet, in USD cents
    amountInCents: number
    currency: string
    // the amount charged in INR paise, when the payment was in INR
    amountInPaise?: number
    paymentId?: string | null
    orderId?: string | null
    name: string
    email: string
}

export type GetReferral = {
    userId: string
}

/** a new account that signed up with the invite link of another user */
export type AttachReferral = {
    inviteeId: string
    inviteeEmail: string
    // what the sign-up sent. no value, or a code that no user has, makes no referral
    code?: string | null
}

export type SettleReferral = {
    // the account that paid for credits
    userId: string
    // the amount of this paid top-up. under the minimum, the referral stays pending
    paidInCents: number
}

/** an order razorpay says is paid: what verify and the webhook both finish */
export type CompletePaidTopUp = {
    transaction: { id: string; userId: string; amountInCents: number; status: string }
    paymentId: string
    // 'verify' or 'webhook', for the log line of a failed notification
    source: string
}

export type PayReferral = {
    inviteeId: string
    amountInCents: number
    // how many paid referrals one inviter can have
    maxCredited: number
}

/** what a paid top-up did to the referral of the account */
export type ReferralPayout = {
    referralId: string
    inviterId: string
    inviteeId: string
    status: 'CREDITED' | 'SKIPPED'
}

// #638 section 1: spend limits and the low balance alert. whole cents, null is off
export type SpendLimits = {
    lowBalanceAlertCents: number | null
    sessionLimitCents: number | null
    dayLimitCents: number | null
}

export type GetLimits = {
    userId: string
}

export type UpdateLimits = { userId: string } & Partial<SpendLimits>
