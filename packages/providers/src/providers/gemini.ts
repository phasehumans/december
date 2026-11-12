import { GoogleGenAI } from '@google/genai'
import { v4 as uuidv4 } from 'uuid'

import { createProvider, supportsModelThinking } from '../models.ts'
import { normalizeForGemini } from '../normalizer/index.ts'

import type { LLMProvider, Message, ProviderStreamChunk, ProviderTool } from '../types.ts'

export function sanitizeSchemaForGemini(schema: any): any {
    if (!schema || typeof schema !== 'object') return schema

    const result = { ...schema }

    if (Array.isArray(result.anyOf)) {
        const isAllConsts = result.anyOf.every(
            (item: any) => item && typeof item === 'object' && 'const' in item
        )
        if (isAllConsts) {
            result.enum = result.anyOf.map((item: any) => item.const)
            delete result.anyOf
        } else {
            result.anyOf = result.anyOf.map((item: any) => sanitizeSchemaForGemini(item))
        }
    }

    if ('const' in result) {
        result.enum = [result.const]
        delete result.const
    }

    for (const key in result) {
        if (
            typeof result[key] === 'object' &&
            result[key] !== null &&
            !Array.isArray(result[key])
        ) {
            result[key] = sanitizeSchemaForGemini(result[key])
        } else if (Array.isArray(result[key])) {
            result[key] = result[key].map((item: any) =>
                typeof item === 'object' && item !== null ? sanitizeSchemaForGemini(item) : item
            )
        }
    }

    return result
}

export function resolveGeminiModel(model?: string): string {
    let name = model || 'gemini-2.5-flash'
    if (name.startsWith('google/')) {
        name = name.slice('google/'.length)
    }
    const geminiFallbacks: Record<string, string> = {
        'gemini-3.8-flash': 'gemini-2.5-flash',
        'gemini-3.7-flash': 'gemini-2.5-flash',
        'gemini-3.6-flash': 'gemini-2.5-flash',
        'gemini-3.5-flash': 'gemini-2.5-flash',
        'gemini-3.5-flash-lite': 'gemini-2.5-flash-lite',
        'gemini-3.1-pro': 'gemini-2.5-pro',
        'gemini-3.1-pro-preview': 'gemini-2.5-pro',
        'gemini-3-pro': 'gemini-2.5-pro',
        'gemini-flash': 'gemini-2.5-flash',
        'gemini-pro': 'gemini-2.5-pro',
    }
    return geminiFallbacks[name] || name
}

export function geminiProvider(apiKey?: string, customClient?: GoogleGenAI): LLMProvider {
    const client =
        customClient ||
        new GoogleGenAI({
            apiKey: apiKey || process.env.GEMINI_API_KEY || 'dummy-key',
        })

    return createProvider(
        {
            id: 'gemini',
            name: 'Gemini',
            models: [],
            api: client,
        },
        async function* (
            messages: Message[],
            tools?: ProviderTool[],
            systemPrompt?: string,
            modelOptions?: Record<string, any>,
            signal?: AbortSignal
        ): AsyncGenerator<ProviderStreamChunk, void, unknown> {
            const resolvedSystemPrompt =
                systemPrompt || (messages[0]?.role === 'system' ? messages[0].content : undefined)
            const resolvedModel = resolveGeminiModel(modelOptions?.model)

            const geminiMessages = normalizeForGemini(messages, {
                model: resolvedModel,
                systemPrompt: resolvedSystemPrompt,
            })

            const geminiTools =
                tools && tools.length > 0
                    ? [
                          {
                              functionDeclarations: tools.map((t) => ({
                                  name: t.name,
                                  description: t.description,
                                  parameters: sanitizeSchemaForGemini(t.inputSchema),
                              })),
                          },
                      ]
                    : undefined

            const supportsThinking = supportsModelThinking(resolvedModel)

            const thinkingLevel = modelOptions?.thinkingLevel
            let thinkingConfig: { thinkingBudget?: number; includeThoughts?: boolean } | undefined
            if (supportsThinking) {
                if (thinkingLevel === 'off') {
                    thinkingConfig = { thinkingBudget: 0 }
                } else if (
                    thinkingLevel === 'deep' ||
                    thinkingLevel === 'high' ||
                    thinkingLevel === 'medium'
                ) {
                    thinkingConfig = { thinkingBudget: 8192, includeThoughts: true }
                } else if (
                    thinkingLevel === 'fast' ||
                    thinkingLevel === 'low' ||
                    thinkingLevel === 'minimal'
                ) {
                    thinkingConfig = { thinkingBudget: 1024, includeThoughts: true }
                } else {
                    thinkingConfig = { includeThoughts: true }
                }
            }

            const DEFAULT_GEMINI_MAX_OUTPUT_TOKENS = 65536
            let maxOutputTokens = modelOptions?.max_tokens || DEFAULT_GEMINI_MAX_OUTPUT_TOKENS
            if (thinkingConfig?.thinkingBudget && thinkingConfig.thinkingBudget > 0) {
                maxOutputTokens = Math.max(maxOutputTokens, thinkingConfig.thinkingBudget + 16384)
            }

            const responseStream = await (client.models.generateContentStream as any)({
                model: resolvedModel,
                contents: geminiMessages,
                config: {
                    systemInstruction: resolvedSystemPrompt
                        ? { parts: [{ text: resolvedSystemPrompt }] }
                        : undefined,
                    tools: geminiTools,
                    temperature: modelOptions?.temperature,
                    maxOutputTokens,
                    thinkingConfig,
                    abortSignal: signal,
                    httpOptions: {
                        signal,
                    },
                },
                abortSignal: signal,
            })

            let totalPromptTokens = 0
            let totalCompletionTokens = 0

            for await (const chunk of responseStream) {
                if (chunk.usageMetadata) {
                    totalPromptTokens = chunk.usageMetadata.promptTokenCount || totalPromptTokens
                    totalCompletionTokens =
                        chunk.usageMetadata.candidatesTokenCount || totalCompletionTokens
                }
                const candidate = chunk.candidates?.[0]
                if (candidate?.finishReason) {
                    if (candidate.finishReason === 'SAFETY') {
                        throw new Error('Gemini output blocked due to safety settings.')
                    }
                    if (candidate.finishReason === 'RECITATION') {
                        throw new Error('Gemini output blocked due to recitation policy.')
                    }
                    if (candidate.finishReason === 'BLOCKLIST') {
                        throw new Error('Gemini output blocked due to blocklist.')
                    }
                    if (candidate.finishReason === 'MAX_TOKENS') {
                        console.warn('[gemini provider] candidate reached MAX_TOKENS output limit')
                    }
                }
                const parts = candidate?.content?.parts || []
                let chunkText = ''

                for (const part of parts) {
                    if ((part as any).thought || (part as any).thoughtText) {
                        const thoughtContent = (part as any).thoughtText || part.text || ''
                        if (thoughtContent) {
                            yield { type: 'thinking_delta', text: thoughtContent }
                        }
                    } else if (part.text && typeof part.text === 'string') {
                        chunkText += part.text
                    }
                }

                if (chunkText) {
                    yield { type: 'text', text: chunkText }
                }

                let chunkThoughtSignature: string | undefined = undefined
                const rawCandidateSig =
                    (candidate as any)?.thoughtSignature || (candidate as any)?.thought_signature
                if (rawCandidateSig) {
                    chunkThoughtSignature =
                        typeof rawCandidateSig === 'string'
                            ? rawCandidateSig
                            : JSON.stringify(rawCandidateSig)
                }

                for (const part of parts) {
                    const rawSig =
                        (part as any).thoughtSignature ||
                        (part as any).thought_signature ||
                        (part.functionCall as any)?.thoughtSignature ||
                        (part.functionCall as any)?.thought_signature
                    if (rawSig) {
                        chunkThoughtSignature =
                            typeof rawSig === 'string' ? rawSig : JSON.stringify(rawSig)
                        break
                    }
                }

                if (chunkThoughtSignature) {
                    yield {
                        type: 'thought_signature',
                        signature: chunkThoughtSignature,
                    }
                }

                for (const part of parts) {
                    if (part.functionCall) {
                        const fc = part.functionCall
                        const toolCallId = (fc as any).id || uuidv4()
                        const fcSig =
                            (part as any).thoughtSignature ||
                            (part as any).thought_signature ||
                            (fc as any).thoughtSignature ||
                            (fc as any).thought_signature ||
                            chunkThoughtSignature

                        yield {
                            type: 'tool_call_delta',
                            id: toolCallId,
                            name: fc.name,
                            inputDelta: JSON.stringify(fc.args || {}),
                            ...(fcSig
                                ? {
                                      thoughtSignature:
                                          typeof fcSig === 'string' ? fcSig : JSON.stringify(fcSig),
                                  }
                                : {}),
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
    )
}

export class GeminiProvider implements LLMProvider {
    public id = 'gemini'
    private provider: LLMProvider

    constructor(apiKey?: string) {
        this.provider = geminiProvider(apiKey)
    }

    stream(
        messages: Message[],
        tools?: ProviderTool[],
        systemPrompt?: string,
        modelOptions?: Record<string, any>,
        signal?: AbortSignal
    ) {
        return this.provider.stream(messages, tools, systemPrompt, modelOptions, signal)
    }
}
