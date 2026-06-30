import { Message, ToolCall, Tool } from './types'

/**
 * A unified interface for all LLM providers (OpenAI, Anthropic, Google, etc.)
 */
export interface LLMProvider {
    /**
     * Streams the completion, yielding text chunks.
     * When the stream finishes, it returns an array of parsed ToolCalls.
     */
    stream(
        messages: Message[],
        tools: Map<string, Tool>
    ): AsyncGenerator<string, ToolCall[], unknown>
}
