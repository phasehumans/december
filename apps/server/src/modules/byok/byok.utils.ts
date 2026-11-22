import { verifyByokKey } from '@december/providers'

import type { ByokVerifyFailure } from '@december/providers'

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
