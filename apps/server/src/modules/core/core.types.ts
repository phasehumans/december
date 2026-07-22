import type { HandlePromptDto } from './core.schema'

export type { HandlePromptDto }

export type ProcessPromptJob = {
    userId: string
    data: HandlePromptDto
}

export type PromptJobData = {
    prompt: string
    projectId?: string
    sessionId?: string
    userId: string
}
