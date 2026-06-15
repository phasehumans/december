export type GetCurrentUsage = {
    userId: string
}

export type CheckEnoughCredits = {
    userId: string
    estimatedCostInCents?: number
}

export type HasMinimumBalance = {
    userId: string
}

export type RecordUsageEvent = {
    userId: string
    model: string
    inputTokens: number
    outputTokens: number
    totalTokens: number
    costInCents?: number
    projectId?: string
    chatId?: string
    externalRequestId?: string
    metadata?: Record<string, unknown>
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
    subscriptionPlan: 'FREE' | 'PRO'
    subscriptionStatus: 'FREE' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED'
    subscription: {
        currentPeriodStart: Date
        currentPeriodEnd: Date
    } | null
    createdAt: Date
    creditBalance: number
    giftedCredits: number
}

export type ModelRate = {
    name: string
    inputRate: number // USD per 1M tokens
    outputRate: number // USD per 1M tokens
}
