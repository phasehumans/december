const REQUEST_TIMEOUT_MS = 4000

export function getDecemberServerUrl(): string {
    const serverUrl =
        process.env.SERVER_URL ||
        (process.env.NODE_ENV !== 'production' && process.env.SERVER_PORT
            ? `http://localhost:${process.env.SERVER_PORT}`
            : 'https://api.trydecember.com')
    return serverUrl.replace(/\/+$/, '')
}

/**
 * Remaining december cloud wallet balance in cents, from the server.
 * Returns undefined when the user is offline, logged out, or the call fails.
 */
export async function fetchDecemberCreditsInCents(token?: string): Promise<number | undefined> {
    if (!token) return undefined
    try {
        const res = await fetch(`${getDecemberServerUrl()}/api/v1/billing/overview`, {
            headers: { Authorization: `Bearer ${token}` },
            signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        })
        if (!res.ok) return undefined
        const body: any = await res.json()
        const balance = Number((body?.data ?? body)?.creditBalance)
        return Number.isFinite(balance) ? balance : undefined
    } catch {
        // Intentionally swallowed: the usage view hides the credits row when offline
        return undefined
    }
}
