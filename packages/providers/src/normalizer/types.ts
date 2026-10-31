export type CanonicalRole = 'system' | 'user' | 'assistant' | 'tool'

export interface CanonicalToolCall {
    id: string
    name: string
    input: Record<string, any> | string
}

export interface CanonicalToolResult {
    toolCallId: string
    toolName?: string
    content: string
    isError?: boolean
}

export interface CanonicalThinking {
    text: string
    signature?: string
    provider?: string
}

export interface CanonicalMessage {
    role: CanonicalRole
    content?: string
    thinking?: CanonicalThinking
    toolCalls?: CanonicalToolCall[]
    toolResults?: CanonicalToolResult[]
    toolCallId?: string
    toolName?: string
    meta?: Record<string, any>
}

export interface AnthropicNormalizeOptions {
    model?: string
    systemPrompt?: string
    thinkingEnabled?: boolean
    preserveThinkingAsText?: boolean
}

export interface OpenAINormalizeOptions {
    model?: string
    systemPrompt?: string
    supportsReasoning?: boolean
    supportsTools?: boolean
    preserveThinkingAsText?: boolean
}

export interface GeminiNormalizeOptions {
    model?: string
    systemPrompt?: string
    preserveThinkingAsText?: boolean
}

export interface NormalizeOptions {
    model?: string
    systemPrompt?: string
    thinkingEnabled?: boolean
    supportsReasoning?: boolean
    supportsTools?: boolean
    preserveThinkingAsText?: boolean
}

export interface NormalizedProviderResult<T = any> {
    provider: string
    messages: T
    systemPrompt?: string
}
