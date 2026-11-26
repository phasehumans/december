import crypto from 'crypto'

import { env } from '../../env'

/** Admin accounts come from ADMIN_EMAILS (comma-separated), read on every call. */
export const getAdminEmails = (): string[] =>
    (process.env.ADMIN_EMAILS ?? env.ADMIN_EMAILS ?? '')
        .split(',')
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean)

export const isAdminEmail = (email: string | null | undefined): boolean =>
    Boolean(email) && getAdminEmails().includes(email!.trim().toLowerCase())

const intEnv = (name: string, fallback: number): number => {
    const raw = process.env[name]
    if (raw === undefined || raw.trim() === '') return fallback
    const value = Number(raw)
    return Number.isFinite(value) && value >= 0 ? Math.floor(value) : fallback
}

/**
 * What the admin may do (L1 to L6). Each one can be changed with an env value, read on every
 * call, without a code change.
 */
export const getAdminLimits = () => ({
    // credits the admin gives in 24 hours, all users together: approved $5 requests and
    // credits added by hand both count ($50)
    dailyCreditCents: intEnv('ADMIN_DAILY_CREDIT_CAP_CENTS', env.ADMIN_DAILY_CREDIT_CAP_CENTS),
    // credits one user gets from admins in 24 hours, requests and by hand together ($10, L1)
    userDailyCreditCents: intEnv('ADMIN_USER_DAILY_CREDIT_CAP_CENTS', 1000),
})

/** The web path of the admin panel. Only admins get it, in their profile. */
export const getAdminPath = (): string => process.env.ADMIN_PATH ?? env.ADMIN_PATH ?? '/admin'

const stripSlash = (url: string) => url.replace(/\/+$/, '')

/**
 * The admin api answers only the web app. The web app calls the api from another host, so
 * browsers always send Origin; a missing Origin is allowed only outside production (tests,
 * the dev proxy).
 */
export const isAllowedAdminOrigin = (origin: string | undefined): boolean => {
    const isProduction = (process.env.NODE_ENV ?? env.NODE_ENV) === 'production'
    if (!origin) return !isProduction
    const allowed = [stripSlash(process.env.APP_URL ?? env.APP_URL), 'https://app.trydecember.com']
    if (allowed.includes(stripSlash(origin))) return true
    if (isProduction) return false
    try {
        const { hostname } = new URL(origin)
        return hostname === 'localhost' || hostname === '127.0.0.1'
    } catch {
        return false
    }
}

// a short list of common throwaway inbox domains, shown as a signal on credit requests
const DISPOSABLE_DOMAINS = new Set([
    '10minutemail.com',
    'dispostable.com',
    'emailondeck.com',
    'fakeinbox.com',
    'getnada.com',
    'guerrillamail.com',
    'mailinator.com',
    'maildrop.cc',
    'mintemail.com',
    'mohmal.com',
    'sharklasers.com',
    'temp-mail.org',
    'tempmail.com',
    'tempmailo.com',
    'throwawaymail.com',
    'trashmail.com',
    'yopmail.com',
])

export const isDisposableEmail = (email: string): boolean => {
    const domain = email.trim().toLowerCase().split('@')[1] ?? ''
    return DISPOSABLE_DOMAINS.has(domain)
}

export const getSignupMethod = (user: {
    githubId?: string | null
    googleId?: string | null
}): 'github' | 'google' | 'email' => {
    if (user.githubId) return 'github'
    if (user.googleId) return 'google'
    return 'email'
}

const unsubscribeSecret = () =>
    `unsubscribe:${process.env.ACCESS_TOKEN_SECRET ?? env.ACCESS_TOKEN_SECRET}`

/** A token that lets one user turn product emails off without signing in. */
export const createUnsubscribeToken = (userId: string): string =>
    crypto.createHmac('sha256', unsubscribeSecret()).update(userId).digest('hex')

export const isValidUnsubscribeToken = (userId: string, token: string): boolean => {
    const expected = Buffer.from(createUnsubscribeToken(userId), 'utf8')
    const given = Buffer.from(token, 'utf8')
    return expected.length === given.length && crypto.timingSafeEqual(expected, given)
}

export const buildUnsubscribeUrl = (userId: string): string => {
    const serverUrl = (process.env.SERVER_URL ?? env.SERVER_URL).replace(/\/+$/, '')
    const query = new URLSearchParams({ u: userId, t: createUnsubscribeToken(userId) })
    return `${serverUrl}/api/v1/setting/unsubscribe?${query.toString()}`
}

/** Put the user's first name into an email body ({name}). */
export const personalize = (body: string, name: string | null | undefined): string => {
    const firstName = (name ?? '').trim().split(/\s+/)[0]?.toLowerCase() || 'there'
    return body.replace(/\{name\}/g, firstName)
}
