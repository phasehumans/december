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
