import { BYOK_PROVIDERS, verifyByokKey } from '@december/providers'

import type { CredentialRow, CredentialSummary } from './byok.types'
import type { ByokVerifyFailure } from '@december/providers'

// the provider's display name, for messages ("add your OpenAI key")
export const providerName = (provider: string): string =>
    BYOK_PROVIDERS.find((p) => p.id === provider)?.name || provider

// a stored credential as the client sees it: never the key itself
export const toCredentialSummary = (row: CredentialRow): CredentialSummary => ({
    provider: row.provider,
    keyHint: row.keyHint,
    models: Array.isArray(row.models) ? (row.models as string[]) : [],
    defaultModel: row.defaultModel,
    verifiedAt: row.verifiedAt,
    lastUsedAt: row.lastUsedAt,
})

// last 4 characters of the key part. watsonx keys are API_KEY:PROJECT_ID, so the
// project id is cut off first.
export const buildKeyHint = (provider: string, apiKey: string): string => {
    const keyPart = provider === 'watsonx' ? apiKey.split(':')[0] || apiKey : apiKey
    return keyPart.length > 4 ? keyPart.slice(-4) : ''
}

export const verifyFailureMessage = (data: {
    providerName: string
    reason: ByokVerifyFailure
    message?: string
}): string => {
    const { providerName, reason, message } = data
    const detail = message ? ` (${message})` : ''
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
