import { env } from '../../env'

import type { NotifyEventKind, NotifyEventMessage, NotifyLevel } from './notification.types'
import type { VapidKeys } from '../../shared/web-push'

/** "important": the user has to act (#636) */
const IMPORTANT_EVENTS = new Set<NotifyEventKind>([
    'SESSION_NEEDS_INPUT',
    'SESSION_FAILED',
    'LOW_CREDITS',
    'SPEND_LIMIT',
])

export const levelAllows = (level: NotifyLevel, kind: NotifyEventKind): boolean => {
    if (level === 'NONE') return false
    if (level === 'ALL') return true
    return IMPORTANT_EVENTS.has(kind)
}

export const appUrl = () => (env.APP_URL || 'https://app.trydecember.com').replace(/\/+$/, '')

export const money = (cents: number) => `$${(Math.max(cents, 0) / 100).toFixed(2)}`

const quoted = (title: string | null | undefined) => `"${(title || 'Untitled session').trim()}"`

/** the words of one event, for the inbox and the push */
export const eventMessage = (data: {
    kind: NotifyEventKind
    sessionId?: string
    sessionTitle?: string | null
    detail?: string
}): NotifyEventMessage => {
    const { kind, sessionId, sessionTitle, detail } = data
    const sessionPath = sessionId ? `/sessions/${sessionId}` : '/'
    const name = quoted(sessionTitle)

    switch (kind) {
        case 'SESSION_NEEDS_INPUT': {
            // the agent's question when there is one: "Fix login: Keep the old cookie name?"
            const question = detail?.replace(/\s+/g, ' ').trim().slice(0, 240)
            return {
                title: 'December needs your input',
                message: question
                    ? `${(sessionTitle || 'Untitled session').trim()}: ${question}`
                    : `${name} is waiting for your answer.`,
                type: 'WARNING',
                path: sessionPath,
            }
        }
        case 'SESSION_FAILED': {
            const reason = detail ? ` ${detail.slice(0, 300)}` : ''
            return {
                title: 'A session failed',
                message: `${name} stopped with an error.${reason}`,
                type: 'ERROR',
                path: sessionPath,
            }
        }
        case 'LOW_CREDITS': {
            const balance = detail ? ` Your balance is ${money(Number(detail))}.` : ''
            return {
                title: 'Your credits are low',
                message: `Add credits so your sessions keep running.${balance}`,
                type: 'WARNING',
                path: '/settings/billing',
            }
        }
        case 'SPEND_LIMIT': {
            const question = detail || 'Reached your spend limit. Continue?'
            return {
                title: question,
                message: `${name} is paused. Open it to continue or stop.`,
                type: 'WARNING',
                path: sessionPath,
            }
        }
        case 'SESSION_FINISHED':
        default:
            return {
                title: 'A session finished',
                message: `${name} is done.`,
                type: 'SUCCESS',
                path: sessionPath,
            }
    }
}

/**
 * The server's VAPID keys, or null when push is not set up. The subject tells push
 * services who sends; it is VAPID_SUBJECT (a mailto: or https url) or the app url.
 */
export const vapidKeys = (): VapidKeys | null => {
    const publicKey = process.env.VAPID_PUBLIC_KEY ?? env.VAPID_PUBLIC_KEY
    const privateKey = process.env.VAPID_PRIVATE_KEY ?? env.VAPID_PRIVATE_KEY
    if (!publicKey || !privateKey) return null
    const subject = process.env.VAPID_SUBJECT ?? env.VAPID_SUBJECT ?? appUrl()
    return { publicKey, privateKey, subject }
}

/**
 * Push services December sends to. The server posts to the endpoint a browser gives it, so
 * only these hosts are allowed (no requests to other hosts).
 */
const PUSH_HOSTS = [
    'fcm.googleapis.com',
    'android.googleapis.com',
    'push.services.mozilla.com',
    'notify.windows.com',
    'push.apple.com',
]

export const isAllowedPushEndpoint = (endpoint: string): boolean => {
    try {
        const url = new URL(endpoint)
        if (url.protocol !== 'https:') return false
        return PUSH_HOSTS.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`))
    } catch {
        // Intentionally swallowed: a value that is not a url is not allowed
        return false
    }
}

export const isValidTimezone = (timezone: string): boolean => {
    try {
        new Intl.DateTimeFormat('en-US', { timeZone: timezone })
        return true
    } catch {
        // Intentionally swallowed: Intl throws for a zone it does not know
        return false
    }
}

/**
 * The inbox links of one session: the web path, and the older /session/ form that items
 * written before the server used /sessions/ still have.
 */
export const sessionLinks = (sessionId: string): string[] => [
    `/sessions/${sessionId}`,
    `/session/${sessionId}`,
]
