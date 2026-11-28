import { BYOK_PROVIDERS, verifyByokKey } from '@december/providers'

import type { CredentialRow, CredentialSummary } from './byok.types'
import type { ByokVerifyFailure } from '@december/providers'

export const MAX_KEY_LENGTH = 4096
// a key shorter than this shows no hint: 4 characters of a short key give too much away
export const MIN_KEY_LENGTH_FOR_HINT = 12
// what a saved key keeps of the provider's model list
export const MAX_MODELS = 2000
export const MAX_MODEL_ID_LENGTH = 200
// the part of a provider's error message that goes into our message
export const MAX_PROVIDER_DETAIL_LENGTH = 300

// the provider's display name, for messages ("add your OpenAI key")
export const providerName = (provider: string): string =>
    BYOK_PROVIDERS.find((p) => p.id === provider)?.name || provider

// the model ids December keeps for a key: strings only, no repeats, no very long ids, and a
// cap on the count, so a provider with a huge or odd list cannot fill the row
export const cleanModelIds = (models: unknown): string[] => {
    if (!Array.isArray(models)) return []
    const seen = new Set<string>()
    for (const model of models) {
        if (typeof model !== 'string') continue
        const id = model.trim()
        if (!id || id.length > MAX_MODEL_ID_LENGTH || seen.has(id)) continue
        seen.add(id)
        if (seen.size >= MAX_MODELS) break
    }
    return [...seen]
}

// a stored credential as the client sees it: never the key itself
export const toCredentialSummary = (row: CredentialRow): CredentialSummary => ({
    provider: row.provider,
    keyHint: row.keyHint,
    models: cleanModelIds(row.models),
    defaultModel: row.defaultModel,
    verifiedAt: row.verifiedAt,
    lastUsedAt: row.lastUsedAt,
})

// last 4 characters of the key part, and nothing for a short key. watsonx keys are
// API_KEY:PROJECT_ID, so the project id is cut off first.
export const buildKeyHint = (provider: string, apiKey: string): string => {
    const keyPart = provider === 'watsonx' ? apiKey.split(':')[0] || apiKey : apiKey
    return keyPart.length >= MIN_KEY_LENGTH_FOR_HINT ? keyPart.slice(-4) : ''
}

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * Takes the key out of a provider's error text. Some providers repeat the key they got (or
 * the request url, which for some holds the key), so the key, its url-encoded form and each
 * part of a watsonx key are replaced before the text reaches a response or a log.
 */
export const redactKey = (data: { text: string; apiKey: string }): string => {
    const { text, apiKey } = data
    const parts = new Set<string>()
    for (const value of [apiKey, ...apiKey.split(':')]) {
        if (value.length >= 6) {
            parts.add(value)
            parts.add(encodeURIComponent(value))
        }
    }
    let result = text
    // longest first, so a part of the key does not break up the whole key
    for (const part of [...parts].sort((a, b) => b.length - a.length)) {
        result = result.replace(new RegExp(escapeRegExp(part), 'gi'), '[key]')
    }
    return result
}

export const verifyFailureMessage = (data: {
    providerName: string
    reason: ByokVerifyFailure
    message?: string
}): string => {
    const { providerName, reason, message } = data
    const trimmed = message?.trim().slice(0, MAX_PROVIDER_DETAIL_LENGTH)
    const detail = trimmed ? ` (${trimmed})` : ''
    switch (reason) {
        case 'bad_key':
            return `${providerName} rejected this key. Check that you copied the whole key.${detail}`
        case 'forbidden':
            return `${providerName} accepted the key but refused access. Check the key's permissions.${detail}`
        case 'no_credits':
            return `${providerName} says this account has no credits. Add credits with ${providerName}, then try again.${detail}`
        case 'no_endpoint':
            return `December could not list the models for this key. Try again later.${detail}`
        case 'network':
        default:
            return `December could not reach ${providerName} to check the key. Try again.${detail}`
    }
}

// kept on an object so tests can replace the network check
export const byokUtils = {
    verifyKey: verifyByokKey,
}
