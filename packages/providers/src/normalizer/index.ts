import { normalizeForAnthropic } from './anthropic.ts'
import { normalizeForGemini } from './gemini.ts'
import { normalizeForOpenAI } from './openai.ts'

import type { Message } from '../types.ts'
import type { CanonicalMessage, NormalizedProviderResult, NormalizeOptions } from './types.ts'

export * from './types.ts'
export * from './canonical.ts'
export * from './anthropic.ts'
export * from './openai.ts'
export * from './gemini.ts'

export function normalizeForProvider(
    providerId: string,
    messages: (Message | CanonicalMessage | any)[],
    options?: NormalizeOptions
): NormalizedProviderResult {
    const normId = (providerId || 'openai').toLowerCase().trim()

    if (normId === 'anthropic') {
        const mapped = normalizeForAnthropic(messages, options)
        return {
            provider: 'anthropic',
            messages: mapped,
            systemPrompt: options?.systemPrompt,
        }
    }

    if (normId === 'gemini' || normId === 'antigravity' || normId === 'google') {
        const mapped = normalizeForGemini(messages, options)
        return {
            provider: normId,
            messages: mapped,
            systemPrompt: options?.systemPrompt,
        }
    }

    // OpenAI and OpenAI-compatible providers
    const mapped = normalizeForOpenAI(messages, options)
    return {
        provider: normId,
        messages: mapped,
        systemPrompt: options?.systemPrompt,
    }
}
