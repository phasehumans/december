/**
 * Client-visible `december_logged_in` flag shared with the landing site (trydecember.com).
 * The landing site reads it to redirect signed-in users to the app and to swap its
 * header CTA. The server sets it on login/refresh; the app mirrors it here so users
 * whose session predates the flag (or whose flag went stale) stay in sync.
 */
const LOGGED_IN_COOKIE_NAME = 'december_logged_in'
const LOGGED_IN_COOKIE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60

const getSharedCookieDomain = (hostname: string): string | undefined => {
    if (hostname === 'trydecember.com' || hostname.endsWith('.trydecember.com')) {
        return '.trydecember.com'
    }
    return undefined
}

const buildCookieAttributes = (maxAgeSeconds: number, domain?: string): string => {
    const parts = ['Path=/', `Max-Age=${maxAgeSeconds}`, 'SameSite=Lax']
    if (domain) parts.push(`Domain=${domain}`)
    if (typeof window !== 'undefined' && window.location.protocol === 'https:') {
        parts.push('Secure')
    }
    return parts.join('; ')
}

export const setLoggedInCookie = (): void => {
    if (typeof document === 'undefined' || typeof window === 'undefined') return
    try {
        const domain = getSharedCookieDomain(window.location.hostname)
        document.cookie = `${LOGGED_IN_COOKIE_NAME}=1; ${buildCookieAttributes(LOGGED_IN_COOKIE_MAX_AGE_SECONDS, domain)}`
    } catch {
        // Intentionally swallowed: cookie writes can throw in restricted/sandboxed environments
    }
}

export const clearLoggedInCookie = (): void => {
    if (typeof document === 'undefined' || typeof window === 'undefined') return
    try {
        const domain = getSharedCookieDomain(window.location.hostname)
        if (domain) {
            document.cookie = `${LOGGED_IN_COOKIE_NAME}=; ${buildCookieAttributes(0, domain)}`
        }
        document.cookie = `${LOGGED_IN_COOKIE_NAME}=; ${buildCookieAttributes(0)}`
    } catch {
        // Intentionally swallowed: cookie writes can throw in restricted/sandboxed environments
    }
}
