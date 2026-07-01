import Anthropic from '@anthropic-ai/sdk'
import { LLMProvider } from '../llm'
import { Message, ToolCall, Tool } from '../types'

export class AnthropicProvider implements LLMProvider {
    private client: Anthropic
    private model: string

    constructor(apiKey: string, model: string = 'claude-3-5-sonnet-20240620') {
        this.client = new Anthropic({ apiKey })
        this.model = model
    }

    async *stream(
        messages: Message[],
        tools: Map<string, Tool>
    ): AsyncGenerator<string, ToolCall[], unknown> {
        let systemPrompt = ''
        const formattedMessages: Anthropic.MessageParam[] = []

        for (const m of messages) {
            if (m.role === 'system') {
                systemPrompt += m.content + '\n'
            } else if (m.role === 'tool') {
                formattedMessages.push({
                    role: 'user',
                    content: [
                        {
                            type: 'tool_result',
                            tool_use_id: m.toolCallId!,
                            content: m.content,
                        },
                    ],
                })
            } else if (m.role === 'assistant' && m.toolCalls && m.toolCalls.length > 0) {
                formattedMessages.push({
                    role: 'assistant',
                    content: [
                        { type: 'text', text: m.content || '' },
                        ...m.toolCalls.map((tc) => ({
                            type: 'tool_use' as const,
                            id: tc.id,
                            name: tc.name,
                            input: JSON.parse(tc.input),
                        })),
                    ],
                })
            } else {
                formattedMessages.push({ role: m.role as any, content: m.content })
            }
        }

        const formattedTools: Anthropic.Tool[] = Array.from(tools.values()).map((t) => ({
            name: t.name,
            description: t.description,
            input_schema: t.inputSchema as any,
        }))

        const stream = await this.client.messages.create({
            model: this.model,
            system: systemPrompt,
            messages: formattedMessages,
            tools: formattedTools.length > 0 ? formattedTools : undefined,
            max_tokens: 4096,
            stream: true,
        })

        const toolCallsMap = new Map<number, { id: string; name: string; arguments: string }>()

        for await (const chunk of stream) {
            if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
                yield chunk.delta.text
            }
            if (chunk.type === 'content_block_start' && chunk.content_block.type === 'tool_use') {
                toolCallsMap.set(chunk.index, {
                    id: chunk.content_block.id,
                    name: chunk.content_block.name,
                    arguments: '',
                })
            }
            if (chunk.type === 'content_block_delta' && chunk.delta.type === 'input_json_delta') {
                const tc = toolCallsMap.get(chunk.index)
                if (tc) tc.arguments += chunk.delta.partial_json
            }
        }

        const toolCalls: ToolCall[] = Array.from(toolCallsMap.values()).map((tc) => ({
            id: tc.id,
            name: tc.name,
            input: tc.arguments,
        }))

        return toolCalls
    }
}
