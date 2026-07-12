import { GoogleGenAI, Content } from '@google/genai'

import { LLMProvider, Message, ProviderStreamChunk, ProviderTool } from '../types.ts'

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
        modelOptions?: Record<string, any>,
        signal?: AbortSignal
    ): AsyncGenerator<ProviderStreamChunk, void, unknown> {
        const geminiMessages: Content[] = []

        for (const msg of messages) {
            if (msg.role === 'tool') {
                let name = 'unknown'
                let extraFields: any = { id: msg.toolCallId }
                try {
                    const parsed = JSON.parse(msg.toolCallId!)
                    if (parsed && typeof parsed === 'object') {
                        extraFields = parsed
                        if (extraFields.thoughtSignature) {
                            delete extraFields.thoughtSignature
                        }
                    }
                } catch {}

                for (let i = geminiMessages.length - 1; i >= 0; i--) {
                    const prev = geminiMessages[i]
                    if (prev.role === 'model') {
                        const call = prev.parts?.find(
                            (p) => p.functionCall && (p.functionCall as any).id === extraFields.id
                        )
                        if (call && call.functionCall?.name) {
                            name = call.functionCall.name
                            break
                        }
                    }
                }

                geminiMessages.push({
                    role: 'user',
                    parts: [
                        {
                            functionResponse: {
                                ...extraFields,
                                name: name,
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
                        let extraFields: any = { id: tc.id }
                        let thoughtSignature: string | undefined
                        try {
                            const parsed = JSON.parse(tc.id)
                            if (parsed && typeof parsed === 'object') {
                                extraFields = parsed
                                if (parsed.thoughtSignature) {
                                    thoughtSignature = parsed.thoughtSignature
                                    delete extraFields.thoughtSignature
                                }
                            }
                        } catch {}

                        const part: any = {
                            functionCall: {
                                ...extraFields,
                                name: tc.name,
                                args: JSON.parse(tc.input || '{}'),
                            },
                        }
                        if (thoughtSignature) {
                            part.thoughtSignature = thoughtSignature
                        }
                        parts.push(part)
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
            abortSignal: signal,
        })

        // Gemini doesn't stream tool call deltas like OpenAI/Anthropic do.
        // It returns the entire tool call in one chunk.
        let totalPromptTokens = 0
        let totalCompletionTokens = 0

        for await (const chunk of responseStream) {
            if (chunk.usageMetadata) {
                totalPromptTokens = chunk.usageMetadata.promptTokenCount || totalPromptTokens
                totalCompletionTokens =
                    chunk.usageMetadata.candidatesTokenCount || totalCompletionTokens
            }
            const parts = chunk.candidates?.[0]?.content?.parts || []
            let chunkText = ''

            for (const part of parts) {
                if (part.text && typeof part.text === 'string') {
                    chunkText += part.text
                }
            }

            if (chunkText) {
                yield { type: 'text', text: chunkText }
            }

            for (const part of parts) {
                if (part.functionCall) {
                    const fc = part.functionCall
                    const extraFields: any = {}

                    if ((fc as any).id) {
                        extraFields.id = (fc as any).id
                    } else {
                        extraFields.id = Math.random().toString(36).substring(7)
                    }

                    if ((part as any).thoughtSignature) {
                        extraFields.thoughtSignature = (part as any).thoughtSignature
                    }

                    const id = JSON.stringify(extraFields)
                    yield {
                        type: 'tool_call_delta',
                        id,
                        name: fc.name,
                        inputDelta: JSON.stringify(fc.args),
                    }
                }
            }
        }

        if (totalPromptTokens > 0 || totalCompletionTokens > 0) {
            yield {
                type: 'usage',
                promptTokens: totalPromptTokens,
                completionTokens: totalCompletionTokens,
            }
        }
    }
}
