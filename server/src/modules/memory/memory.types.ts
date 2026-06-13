export type UpsertStyleGuidelines = {
    projectId: string
    guidelines: Record<string, string>
}

export type LoadMemoryPromptInstructions = {
    projectId: string
    userId?: string
}
