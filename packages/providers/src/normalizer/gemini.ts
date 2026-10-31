import { safeParseJson } from '@december/shared'

import { toCanonicalMessages } from './canonical.ts'

import type { Message } from '../types.ts'
import type { CanonicalMessage, GeminiNormalizeOptions } from './types.ts'
import type { Content, Part } from '@google/genai'

export function normalizeForGemini(
    messages: (Message | CanonicalMessage | any)[],
    options?: GeminiNormalizeOptions
): Content[] {
    const canonical = toCanonicalMessages(messages)
    const geminiMessages: Content[] = []
    const resolvedSystemPrompt = options?.systemPrompt

    let i = 0
    while (i < canonical.length) {
        const msg = canonical[i]!

        if (msg.role === 'system') {
            // Omit root system prompt (Gemini passes system instructions separately)
            if (msg.content === resolvedSystemPrompt || (i === 0 && !resolvedSystemPrompt)) {
                i++
                continue
            }
            // Mid-conversation summary -> append as user part
            const last = geminiMessages[geminiMessages.length - 1]
            if (last && last.role === 'user') {
                if (msg.content) last.parts.push({ text: msg.content })
            } else {
                geminiMessages.push({
                    role: 'user',
                    parts: msg.content ? [{ text: msg.content }] : [{ text: 'System note' }],
                })
            }
            i++
            continue
        }

        if (msg.role === 'assistant') {
            const parts: Part[] = []

            if (msg.content && msg.content.trim().length > 0) {
                parts.push({ text: msg.content })
            }

            if (msg.toolCalls && msg.toolCalls.length > 0) {
                for (const tc of msg.toolCalls) {
                    const argsObj =
                        typeof tc.input === 'object' && tc.input !== null
                            ? tc.input
                            : safeParseJson(tc.input) || {}

                    parts.push({
                        functionCall: {
                            name: tc.name,
                            args: argsObj,
                        },
                    } as any)
                }
            }

            if (parts.length === 0) {
                parts.push({ text: '(empty response)' })
            }

            const last = geminiMessages[geminiMessages.length - 1]
            if (last && last.role === 'model') {
                last.parts.push(...parts)
            } else {
                geminiMessages.push({
                    role: 'model',
                    parts,
                })
            }
            i++
            continue
        }

        if (msg.role === 'tool') {
            // Collect contiguous tool results into functionResponse parts inside a user turn
            const toolParts: Part[] = []
            while (i < canonical.length && canonical[i]!.role === 'tool') {
                const tr = canonical[i]!
                const toolName = tr.toolName || 'unknown'
                toolParts.push({
                    functionResponse: {
                        name: toolName,
                        response: { result: tr.content || '' },
                    },
                } as any)
                i++
            }

            const last = geminiMessages[geminiMessages.length - 1]
            if (last && last.role === 'user') {
                last.parts.push(...toolParts)
            } else {
                geminiMessages.push({
                    role: 'user',
                    parts: toolParts,
                })
            }
            continue
        }

        // Standard user message
        const userText = msg.content || ''
        const last = geminiMessages[geminiMessages.length - 1]
        if (last && last.role === 'user') {
            if (userText.trim().length > 0) {
                last.parts.push({ text: userText })
            }
        } else {
            geminiMessages.push({
                role: 'user',
                parts: userText.trim().length > 0 ? [{ text: userText }] : [{ text: ' ' }],
            })
        }
        i++
    }

    return geminiMessages
}
