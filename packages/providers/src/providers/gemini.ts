import { GoogleGenAI, Type, FunctionDeclaration, Content } from '@google/genai'
import { LLMProvider, Message, ProviderStreamChunk, ProviderTool } from '../types.ts'
import { registerProvider } from '../registry.ts'

export class GeminiProvider implements LLMProvider {
    public id = 'gemini'
    private client: GoogleGenAI

    constructor(apiKey?: string) {
        this.client = new GoogleGenAI({
            apiKey: apiKey || process.env.GEMINI_API_KEY,
        })
    }

    async *stream(
        messages: Message[],
        tools?: ProviderTool[],
        systemPrompt?: string,
        modelOptions?: Record<string, any>
    ): AsyncGenerator<ProviderStreamChunk, void, unknown> {
        const geminiMessages: Content[] = []

        for (const msg of messages) {
            if (msg.role === 'tool') {
                geminiMessages.push({
                    role: 'user',
                    parts: [
                        {
                            functionResponse: {
                                name: msg.toolCallId!, // We assume toolCallId maps to the function name in gemini for simplicity here
                                response: { result: msg.content },
                            },
                        },
                    ],
                })
            } else if (msg.role === 'assistant') {
                const parts: any[] = []
                if (msg.content) {
                    parts.push({ text: msg.content })
                }
                if (msg.toolCalls && msg.toolCalls.length > 0) {
                    for (const tc of msg.toolCalls) {
                        parts.push({
                            functionCall: {
                                name: tc.name,
                                args: JSON.parse(tc.input || '{}'),
                            },
                        })
                    }
                }
                if (parts.length > 0) {
                    geminiMessages.push({ role: 'model', parts })
                }
            } else {
                geminiMessages.push({
                    role: 'user',
                    parts: [{ text: msg.content }],
                })
            }
        }

        const geminiTools = tools
            ? [
                  {
                      functionDeclarations: tools.map((t) => ({
                          name: t.name,
                          description: t.description,
                          parameters: t.inputSchema, // Note: Gemini expects OpenAPI 3.0 schemas, usually very similar to JSON Schema
                      })),
                  },
              ]
            : undefined

        const responseStream = await this.client.models.generateContentStream({
            model: modelOptions?.model || 'gemini-2.5-pro',
            contents: geminiMessages,
            config: {
                systemInstruction: systemPrompt
                    ? { role: 'system', parts: [{ text: systemPrompt }] }
                    : undefined,
                tools: geminiTools,
                temperature: modelOptions?.temperature,
                maxOutputTokens: modelOptions?.max_tokens,
            },
        })

        // Gemini doesn't stream tool call deltas like OpenAI/Anthropic do.
        // It returns the entire tool call in one chunk.
        for await (const chunk of responseStream) {
            if (chunk.text) {
                yield { type: 'text', text: chunk.text }
            }
            if (chunk.functionCalls) {
                for (const fc of chunk.functionCalls) {
                    const id = Math.random().toString(36).substring(7)
                    yield {
                        type: 'tool_call_delta',
                        id,
                        name: fc.name,
                        inputDelta: JSON.stringify(fc.args),
                    }
                }
            }
        }
    }
}
