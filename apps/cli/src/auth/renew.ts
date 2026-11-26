import pkg from '../../package.json' with { type: 'json' }
import { loadConfig, saveConfig } from '../config'
import { getDecemberServerUrl } from '../utils/december-credits'

const REQUEST_TIMEOUT_MS = 5000

// keeps "cli" in it, like the device sign-in (see describeUserAgent on the server)
const CLI_USER_AGENT = `december-cli/${pkg.version} (${process.platform}; ${process.arch})`

/** The expiry of a December token in ms, read without a check. undefined: not a token we know. */
export function readTokenExpiryMs(token: string): number | undefined {
    const part = token.split('.')[1]
    if (!part) return undefined
    try {
        const payload = JSON.parse(Buffer.from(part, 'base64url').toString('utf8'))
        return typeof payload?.exp === 'number' ? payload.exp * 1000 : undefined
    } catch {
        // Intentionally swallowed: not a JWT, so there is nothing to renew
        return undefined
    }
}

/**
 * Asks the server for a new token for an expired one. The server gives it while the
 * sign-in is still active (used in the last 30 days). Returns undefined when it can't.
 */
export async function requestRenewedToken(data: {
    token: string
    serverUrl?: string
}): Promise<string | undefined> {
    const { token, serverUrl = getDecemberServerUrl() } = data
    try {
        const res = await fetch(`${serverUrl}/api/v1/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'User-Agent': CLI_USER_AGENT },
            body: JSON.stringify({ refreshToken: token }),
            signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        })
        if (!res.ok) return undefined
        const body: any = await res.json()
        const next = body?.data?.accessToken
        return typeof next === 'string' && next ? next : undefined
    } catch {
        // Intentionally swallowed: offline or server down, the old token stays and the user can log in
        return undefined
    }
}

/**
 * Runs at start-up. Only an expired token is renewed: renewing a token that still works
 * would stop it in other December windows that are open now.
 */
export async function renewDecemberTokenIfExpired(): Promise<void> {
    const config = await loadConfig()
    const token = config.decemberToken
    if (!token) return

    const expiresAt = readTokenExpiryMs(token)
    if (expiresAt === undefined || expiresAt > Date.now()) return

    const next = await requestRenewedToken({ token })
    if (!next) return

    // another December window may have saved a new token in the meantime: keep that one
    const latest = await loadConfig()
    if (latest.decemberToken !== token) return
    latest.decemberToken = next
    await saveConfig(latest)
}
