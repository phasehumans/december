import type { LLMProvider, Message, ProviderTool, ProviderStreamChunk } from './types.ts'

export const MODEL_CONTEXT_WINDOWS: Record<string, number> = {
    'claude-3-5-sonnet-20241022': 200000,
    'claude-3-haiku-20240307': 200000,
    'gpt-4o': 128000,
    'gpt-4o-mini': 128000,
    'gpt-4-turbo': 128000,
}

export interface ProviderConfig<T> {
    id: string
    name: string
    baseUrl?: string
    auth?: Record<string, string>
    models: any[]
    api: T
}

export function createProvider<T>(
    config: ProviderConfig<T>,
    streamImpl: (
        messages: Message[],
        tools?: ProviderTool[],
        systemPrompt?: string,
        modelOptions?: Record<string, any>,
        signal?: AbortSignal
    ) => AsyncGenerator<ProviderStreamChunk, void, unknown>
): LLMProvider {
    return {
        id: config.id,
        stream: streamImpl,
    }
}
