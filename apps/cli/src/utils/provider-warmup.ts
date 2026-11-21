/** Origins used by SDK clients that do not expose a `baseURL` */
const DEFAULT_ORIGINS: Record<string, string> = {
    gemini: 'https://generativelanguage.googleapis.com',
}

const WARMUP_TIMEOUT_MS = 5000

/** Returns the https origin the provider sends its requests to, if it can be found. */
export function getProviderOrigin(llm: unknown): string | undefined {
    const provider = llm as { id?: string; api?: { baseURL?: unknown } } | undefined
    const baseURL =
        typeof provider?.api?.baseURL === 'string'
            ? provider.api.baseURL
            : provider?.id
              ? DEFAULT_ORIGINS[provider.id]
              : undefined
    if (!baseURL) return undefined
    try {
        const url = new URL(baseURL)
        return url.protocol === 'https:' ? url.origin : undefined
    } catch {
        // Intentionally swallowed: an invalid base URL has nothing to warm up
        return undefined
    }
}

/**
 * Opens the connection to the provider before the first prompt, so the first request
 * does not wait for DNS, TCP and TLS. The SDKs use the global fetch connection pool,
 * which keeps this connection. The request is an unauthenticated HEAD to the origin:
 * it sends no key, prompt or other user data, and costs no tokens.
 */
export function warmProviderConnection(llm: unknown): void {
    if (process.env.NODE_ENV === 'test') return
    const origin = getProviderOrigin(llm)
    if (!origin) return
    fetch(origin, { method: 'HEAD', signal: AbortSignal.timeout(WARMUP_TIMEOUT_MS) }).catch(() => {
        // Intentionally swallowed: warmup is best-effort, the real request reports errors
    })
}
