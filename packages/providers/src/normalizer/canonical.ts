import { safeParseJson } from '@december/shared'

import type { Message } from '../types.ts'
import type {
    CanonicalMessage,
    CanonicalRole,
    CanonicalThinking,
    CanonicalToolCall,
} from './types.ts'

export function toCanonicalMessages(
    messages: (Message | CanonicalMessage | any)[]
): CanonicalMessage[] {
    const canonicalList: CanonicalMessage[] = []
    const toolCallNameMap = new Map<string, string>()

    // First pass: index all tool calls across assistant messages to map toolCallId -> toolName
    for (const msg of messages) {
        if (!msg) continue
        if (msg.toolCalls && Array.isArray(msg.toolCalls)) {
            for (const tc of msg.toolCalls) {
                if (tc && tc.id && tc.name) {
                    toolCallNameMap.set(tc.id, tc.name)
                }
            }
        }
    }

    for (const msg of messages) {
        if (!msg) continue

        const role = (msg.role || 'user') as CanonicalRole
        const canonical: CanonicalMessage = { role }

        if (typeof msg.content === 'string') {
            canonical.content = msg.content
        }

        // Thinking normalization
        if (msg.thinking) {
            if (typeof msg.thinking === 'string') {
                const thought: CanonicalThinking = { text: msg.thinking }
                if (msg.thoughtSignature || msg.thinkingSignature) {
                    thought.signature = msg.thoughtSignature || msg.thinkingSignature
                }
                if (msg.thoughtProvider) {
                    thought.provider = msg.thoughtProvider
                }
                canonical.thinking = thought
            } else if (typeof msg.thinking === 'object') {
                canonical.thinking = {
                    text: msg.thinking.text || msg.thinking.thinking || '',
                    signature: msg.thinking.signature || msg.thoughtSignature,
                    provider: msg.thinking.provider || msg.thoughtProvider,
                }
            }
        }

        // Tool calls normalization
        if (msg.toolCalls && Array.isArray(msg.toolCalls)) {
            const canonicalCalls: CanonicalToolCall[] = []
            for (const tc of msg.toolCalls) {
                if (!tc) continue
                let parsedInput: Record<string, any> | string = tc.input
                if (typeof tc.input === 'string') {
                    const parsed = safeParseJson(tc.input)
                    if (parsed && typeof parsed === 'object') {
                        parsedInput = parsed
                    }
                }
                canonicalCalls.push({
                    id: tc.id,
                    name: tc.name,
                    input: parsedInput,
                })
                if (tc.id && tc.name) {
                    toolCallNameMap.set(tc.id, tc.name)
                }
            }
            if (canonicalCalls.length > 0) {
                canonical.toolCalls = canonicalCalls
            }
        }

        // Tool result normalization
        if (role === 'tool' || msg.toolCallId) {
            canonical.toolCallId = msg.toolCallId
            const resolvedName =
                msg.toolName || (msg.toolCallId ? toolCallNameMap.get(msg.toolCallId) : undefined)
            if (resolvedName) {
                canonical.toolName = resolvedName
            }
            if (msg.isError !== undefined) {
                canonical.meta = { ...canonical.meta, isError: msg.isError }
            }
        }

        canonicalList.push(canonical)
    }

    return canonicalList
}
