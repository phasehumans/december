import OpenAI from 'openai'
import { LLMProvider } from '../llm'
import { Message, ToolCall, Tool } from '../types'

export class OpenAIProvider implements LLMProvider {
    private client: OpenAI
    private model: string

    constructor(apiKey: string, baseURL?: string, model: string = 'gpt-4o') {
        this.client = new OpenAI({ apiKey, baseURL })
        this.model = model
    }

    async *stream(
        messages: Message[],
        tools: Map<string, Tool>
    ): AsyncGenerator<string, ToolCall[], unknown> {
        // Map our agnostic Message format to OpenAI's format
        const formattedMessages = messages.map((m) => {
            if (m.role === 'tool') {
                return { role: 'tool', content: m.content, tool_call_id: m.toolCallId! } as any
            }
            if (m.role === 'assistant' && m.toolCalls && m.toolCalls.length > 0) {
                return {
                    role: 'assistant',
                    content: m.content || null,
                    tool_calls: m.toolCalls.map((tc) => ({
                        id: tc.id,
                        type: 'function',
                        function: { name: tc.name, arguments: tc.input },
                    })),
                } as any
            }
            return { role: m.role as any, content: m.content }
        })

        // Map our agnostic Tool format to OpenAI's schema
        const formattedTools = Array.from(tools.values()).map((t) => ({
            type: 'function' as const,
            function: {
                name: t.name,
                description: t.description,
                parameters: t.inputSchema,
            },
        }))

        const stream = await this.client.chat.completions.create({
            model: this.model,
            messages: formattedMessages,
            tools: formattedTools.length > 0 ? formattedTools : undefined,
            stream: true,
        })

        // We must buffer tool call chunks as they stream in
        const toolCallsMap = new Map<number, { id: string; name: string; arguments: string }>()

        for await (const chunk of stream) {
            const delta = chunk.choices[0]?.delta
            if (!delta) continue

            if (delta.content) {
                yield delta.content // Yield text token to the UI
            }

            if (delta.tool_calls) {
                for (const toolCall of delta.tool_calls) {
                    if (!toolCallsMap.has(toolCall.index)) {
                        toolCallsMap.set(toolCall.index, {
                            id: toolCall.id || '',
                            name: toolCall.function?.name || '',
                            arguments: '',
                        })
                    }
                    const tc = toolCallsMap.get(toolCall.index)!
                    if (toolCall.function?.arguments) {
                        tc.arguments += toolCall.function.arguments
                    }
                }
            }
        }

        // Parse and return the final assembled tool calls
        const toolCalls: ToolCall[] = Array.from(toolCallsMap.values()).map((tc) => ({
            id: tc.id,
            name: tc.name,
            input: tc.arguments,
        }))

        return toolCalls
    }
}
