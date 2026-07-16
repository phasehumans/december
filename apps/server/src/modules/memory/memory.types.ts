export type UpsertStyleGuidelines = {
    sessionId: string
    guidelines: Record<string, string>
}

export type LoadMemoryPromptInstructions = {
    sessionId: string
    userId?: string
}
