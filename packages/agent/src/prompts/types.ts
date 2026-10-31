import type { Tool, DiscoveredSkill } from '@december/shared'

export type ModelTier = 'reasoning' | 'compact' | 'frontier'
export type ModelFamily = 'anthropic' | 'google' | 'openai' | 'deepseek' | 'generic'

export interface ModelFamilyPromptOptions {
    model?: string
    thinkingLevel?: string
}

export interface ModelFamilyPromptResult {
    roleGuidelines: string
    reasoningProtocol: string
    suppressThoughtTags: boolean
}

export interface AssembleSystemPromptOptions {
    baseSystemPrompt?: string
    workspaceDir: string
    tools?: Tool[]
    modelOptions?: Record<string, any>
    thinkingLevel?: string
    skills?: DiscoveredSkill[]
    rules?: { path: string; content: string }[]
    userRules?: string
    availableSecrets?: string[]
    lean?: boolean
}
