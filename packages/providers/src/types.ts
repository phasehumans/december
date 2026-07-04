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
}

export interface ProviderTool {
    name: string
    description: string
    inputSchema: any
}

export type ProviderStreamChunk =
    | { type: 'text'; text: string }
    | { type: 'thinking_delta'; text: string }
    | { type: 'tool_call'; toolCall: ToolCall }
    | { type: 'tool_call_delta'; id: string; name?: string; inputDelta: string }

export interface LLMProvider {
    /**
     * The unique identifier for this provider (e.g. 'anthropic', 'openai')
     */
    id: string

    /**
     * Stream a response from the LLM
     */
    stream(
        messages: Message[],
        tools?: ProviderTool[],
        systemPrompt?: string,
        modelOptions?: Record<string, any>,
        signal?: AbortSignal
    ): AsyncGenerator<ProviderStreamChunk, void, unknown>
}
