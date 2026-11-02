import { safeParseJson } from '@december/shared'

import type { Message } from '../types.ts'
import type {
    CanonicalMessage,
    CanonicalRole,
    CanonicalThinking,
    CanonicalToolCall,
} from './types.ts'

function unwrapToolCallId(rawId?: string): { id?: string; thoughtSignature?: string } {
    if (!rawId || typeof rawId !== 'string') return { id: rawId }
    const trimmed = rawId.trim()
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
        const parsed = safeParseJson(trimmed)
        if (parsed && typeof parsed === 'object') {
            const innerId = typeof parsed.id === 'string' ? parsed.id : undefined
            const thoughtSig =
                typeof parsed.thoughtSignature === 'string' ? parsed.thoughtSignature : undefined
            if (innerId) {
                return { id: innerId, thoughtSignature: thoughtSig }
            }
        }
    }
    return { id: rawId }
}

export function toCanonicalMessages(
    messages: (Message | CanonicalMessage | any)[]
): CanonicalMessage[] {
    const canonicalList: CanonicalMessage[] = []
    const toolCallNameMap = new Map<string, string>()
    const idUnwrapMap = new Map<string, string>()

    // First pass: index all tool calls across assistant messages to map toolCallId -> toolName
    // and extract unwrap mappings for serialized toolCall IDs
    for (const msg of messages) {
        if (!msg) continue
        if (msg.toolCalls && Array.isArray(msg.toolCalls)) {
            for (const tc of msg.toolCalls) {
                if (tc && tc.id) {
                    const unwrapped = unwrapToolCallId(tc.id)
                    const cleanId = unwrapped.id || tc.id
                    idUnwrapMap.set(tc.id, cleanId)
                    if (tc.name) {
                        toolCallNameMap.set(cleanId, tc.name)
                        toolCallNameMap.set(tc.id, tc.name)
                    }
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
                const unwrapped = unwrapToolCallId(tc.id)
                const cleanId = unwrapped.id || tc.id
                const thoughtSig =
                    unwrapped.thoughtSignature ||
                    tc.thoughtSignature ||
                    msg.thoughtSignature ||
                    msg.thinkingSignature ||
                    (typeof msg.thinking === 'object' ? msg.thinking?.signature : undefined)

                canonicalCalls.push({
                    id: cleanId,
                    name: tc.name,
                    input: parsedInput,
                    ...(thoughtSig ? { thoughtSignature: thoughtSig } : {}),
                })
                if (thoughtSig && !canonical.thinking?.signature) {
                    if (!canonical.thinking) {
                        canonical.thinking = { text: '', signature: thoughtSig }
                    } else {
                        canonical.thinking.signature = thoughtSig
                    }
                }
                if (cleanId && tc.name) {
                    toolCallNameMap.set(cleanId, tc.name)
                }
            }
            if (canonicalCalls.length > 0) {
                canonical.toolCalls = canonicalCalls
            }
        }

        // Tool result normalization
        if (role === 'tool' || msg.toolCallId) {
            const rawId = msg.toolCallId
            const cleanId =
                (rawId ? idUnwrapMap.get(rawId) : undefined) || unwrapToolCallId(rawId).id || rawId
            canonical.toolCallId = cleanId
            const resolvedName =
                msg.toolName ||
                (cleanId ? toolCallNameMap.get(cleanId) : undefined) ||
                (rawId ? toolCallNameMap.get(rawId) : undefined)
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
