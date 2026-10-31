export type Role = 'system' | 'user' | 'assistant' | 'tool'

export interface ToolCall {
    id: string
    name: string
    input: string
}

export interface Message {
    role: Role
    content: string
    toolCalls?: ToolCall[]
    toolCallId?: string
    toolName?: string
    thinking?: string
    thoughtSignature?: string
    thoughtProvider?: string
}

export interface ProviderTool {
    name: string
    description: string
    inputSchema: any
}

export type ProviderStreamChunk =
    | { type: 'text'; text: string }
    | { type: 'thinking_delta'; text: string }
    | { type: 'thought_signature'; signature: string }
    | { type: 'tool_call'; toolCall: ToolCall }
    | { type: 'tool_call_delta'; id: string; name?: string; inputDelta: string }
    | {
          type: 'usage'
          promptTokens: number
          completionTokens: number
          cacheCreationInputTokens?: number
          cacheReadInputTokens?: number
      }

export interface LLMProvider {
    /**
     * the unique identifier for this provider (e.g. 'anthropic', 'openai')
     */
    id: string

    /**
     * optional underlying sdk client or api instance
     */
    api?: any

    /**
     * stream a response from the llm
     */
    stream(
        messages: Message[],
        tools?: ProviderTool[],
        systemPrompt?: string,
        modelOptions?: Record<string, any>,
        signal?: AbortSignal
    ): AsyncGenerator<ProviderStreamChunk, void, unknown>
}

export interface CatalogModel {
    id: string
    label: string
    contextWindow: number
    thinking?: boolean
}

export interface CatalogProvider {
    id: string
    name: string
    defaultModel: string
    endpoint?: string
    envKey?: string
    openRouterPrefix?: string
    models: CatalogModel[]
}

export interface ModelCatalog {
    version: number
    aliases: Record<string, string>
    providers: Record<string, CatalogProvider>
}
