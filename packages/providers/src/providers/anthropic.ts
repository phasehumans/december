import Anthropic from '@anthropic-ai/sdk'
import { LLMProvider, Message, ProviderStreamChunk, ProviderTool } from '../types.ts'
import { registerProvider } from '../registry.ts'

export class AnthropicProvider implements LLMProvider {
    public id = 'anthropic'
    private client: Anthropic

    constructor(apiKey?: string) {
        this.client = new Anthropic({
            apiKey: apiKey || process.env.ANTHROPIC_API_KEY,
        })
    }

    async *stream(
        messages: Message[],
        tools?: ProviderTool[],
        systemPrompt?: string,
        modelOptions?: Record<string, any>
    ): AsyncGenerator<ProviderStreamChunk, void, unknown> {
        const antMessages: Anthropic.MessageParam[] = []

        for (const msg of messages) {
            if (msg.role === 'tool') {
                antMessages.push({
                    role: 'user',
                    content: [
                        {
                            type: 'tool_result',
                            tool_use_id: msg.toolCallId!,
                            content: msg.content,
                        },
                    ],
                })
            } else if (msg.role === 'assistant') {
                const content: Anthropic.ContentBlockParam[] = []
                if (msg.content) {
                    content.push({ type: 'text', text: msg.content })
                }
                if (msg.toolCalls && msg.toolCalls.length > 0) {
                    for (const tc of msg.toolCalls) {
                        content.push({
                            type: 'tool_use',
                            id: tc.id,
                            name: tc.name,
                            input: JSON.parse(tc.input || '{}'),
                        })
                    }
                }
                if (content.length > 0) {
                    antMessages.push({ role: 'assistant', content })
                }
            } else {
                antMessages.push({
                    role: msg.role as 'user',
                    content: msg.content,
                })
            }
        }

        const antTools: Anthropic.Tool[] | undefined = tools?.map((t) => ({
            name: t.name,
            description: t.description,
            input_schema: t.inputSchema,
        }))

        const stream = await this.client.messages.create({
            model: modelOptions?.model || 'claude-3-5-sonnet-20241022',
            messages: antMessages,
            system: systemPrompt,
            tools: antTools,
            stream: true,
            max_tokens: modelOptions?.max_tokens || 4096,
            temperature: modelOptions?.temperature,
        })

        const activeToolCalls = new Map<number, string>()

        for await (const event of stream) {
            if (event.type === 'content_block_start') {
                if (event.content_block.type === 'tool_use') {
                    activeToolCalls.set(event.index, event.content_block.id)
                    yield {
                        type: 'tool_call_delta',
                        id: event.content_block.id,
                        name: event.content_block.name,
                        inputDelta: '',
                    }
                }
            } else if (event.type === 'content_block_delta') {
                if (event.delta.type === 'text_delta') {
                    yield { type: 'text', text: event.delta.text }
                } else if (event.delta.type === 'input_json_delta') {
                    const id = activeToolCalls.get(event.index)
                    if (id) {
                        yield {
                            type: 'tool_call_delta',
                            id,
                            inputDelta: event.delta.partial_json,
                        }
                    }
                }
            }
        }
    }
}
