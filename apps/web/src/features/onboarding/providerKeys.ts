// helpers for the "use your own API key" form in onboarding step 3

/** shown first in the provider list, in this order. The rest follow A to Z. */
export const POPULAR_PROVIDER_IDS = [
    'anthropic',
    'openai',
    'google',
    'openrouter',
    'xai',
    'deepseek',
]

/**
 * key prefixes that belong to exactly one provider. More specific prefixes come first
 * (sk-ant- and sk-or- before any plain sk- key). A plain `sk-...` key is used by several
 * providers, so it is not listed and the picker stays as it is.
 */
const KEY_PREFIXES: [prefix: string, providerId: string][] = [
    ['sk-ant-', 'anthropic'],
    ['sk-or-', 'openrouter'],
    ['sk-proj-', 'openai'],
    ['sk-svcacct-', 'openai'],
    ['AIza', 'google'],
    ['gsk_', 'groq'],
    ['xai-', 'xai'],
    ['hf_', 'huggingface'],
    ['pplx-', 'perplexity'],
    ['nvapi-', 'nvidia'],
    ['csk-', 'cerebras'],
]

/** the provider a pasted key belongs to, or null when the key does not say */
export const detectProviderFromKey = (apiKey: string): string | null => {
    const key = apiKey.trim()
    const match = KEY_PREFIXES.find(([prefix]) => key.startsWith(prefix))
    return match ? match[1] : null
}

/** popular providers first, in POPULAR_PROVIDER_IDS order, then the rest by name */
export const sortProviders = <T extends { id: string; name: string }>(providers: T[]): T[] => {
    const rank = (id: string) => {
        const index = POPULAR_PROVIDER_IDS.indexOf(id)
        return index === -1 ? POPULAR_PROVIDER_IDS.length : index
    }
    return [...providers].sort((a, b) => rank(a.id) - rank(b.id) || a.name.localeCompare(b.name))
}
