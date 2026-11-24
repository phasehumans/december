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

/** Put the user's first name into an announcement body ({name}). */
export const personalize = (body: string, name: string | null | undefined): string => {
    const firstName = (name ?? '').trim().split(/\s+/)[0]?.toLowerCase() || 'there'
    return body.replace(/\{name\}/g, firstName)
}
