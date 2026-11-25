export type GetCurrentUsage = {
    userId: string
}

export type CheckEnoughCredits = {
    userId: string
    estimatedCostInCents?: number
}

export type HasMinimumBalance = {
    userId: string
    minBalanceInCents?: number
}

export type RecordUsageEvent = {
    userId: string
    model: string
    inputTokens: number
    outputTokens: number
    totalTokens: number
    costInCents?: number
    sessionId?: string
    chatId?: string
    externalRequestId?: string
    metadata?: Record<string, unknown>
}

export type RecordDailyUsage = {
    userId: string
    model: string
    inputTokens: number
    outputTokens: number
    /** groups calls into one usage event per user per UTC day, e.g. 'search-filters' */
    kind: string
}

export type CalculateGenerationCost = {
    modelName: string
    inputTokens: number
    outputTokens: number
}

export type CanRunSelfCorrection = {
    userId: string
}

export type UsageUser = {
    id: string
    isDeleted: boolean
    createdAt: Date
    creditBalance: number
}

export type ModelRate = {
    name: string
    inputRate: number // usd per 1m tokens
    outputRate: number // usd per 1m tokens
}

/** a charge on the server: the balance in cents before and after it */
export type AlertIfCreditsLow = {
    userId: string
    balanceBefore: number
    balanceAfter: number
    /** the user's alert amount. null: the alert is off (#638) */
    alertCents: number | null
}

/** the same check inside the charge: `tx` is the database transaction of the charge */
export type MarkNewLowBalanceDrop = AlertIfCreditsLow & {
    tx: unknown
}

// spend limits (#638)
export type GetSpendLimitState = {
    userId: string
    /** with a session, its limit is checked too */
    sessionId?: string
    now?: Date
}

/** the limits of a user against the cost so far, and what checkSpendLimits says */
export type SpendLimitCheck = {
    decision: import('@december/shared').SpendLimitDecision
    /** the limit that is reached, with its amount, or null for "ok" */
    kind: import('@december/shared').SpendLimitKind | null
    limitCents: number | null
    sessionSpentCents: number
    daySpentCents: number
    /** the user's day, YYYY-MM-DD in their time zone */
    day: string
}

export type ContinuePastLimit = {
    userId: string
    sessionId: string
    kind: import('@december/shared').SpendLimitKind
    now?: Date
}

export type CheckLimitsAfterCharge = {
    userId: string
    sessionId?: string
}
