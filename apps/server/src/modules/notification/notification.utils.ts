import { zoneClock } from '@december/shared'

import { env } from '../../env'

import type {
    DigestSummary,
    NotifyEventKind,
    NotifyEventMessage,
    NotifyLevel,
} from './notification.types'
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

/** the words of one event, for the inbox, the email and the push */
export const eventMessage = (data: {
    kind: NotifyEventKind
    sessionId?: string
    sessionTitle?: string | null
    detail?: string
}): NotifyEventMessage => {
    const { kind, sessionId, sessionTitle, detail } = data
    const sessionPath = sessionId ? `/session/${sessionId}` : '/'
    const name = quoted(sessionTitle)

    switch (kind) {
        case 'SESSION_NEEDS_INPUT':
            return {
                title: 'December needs your input',
                message: `${name} is waiting for your answer.`,
                type: 'WARNING',
                path: sessionPath,
                emailSubject: `December needs your input: ${name}`,
                emailBody: `${name} is waiting for your answer.`,
            }
        case 'SESSION_FAILED': {
            const reason = detail ? ` ${detail.slice(0, 300)}` : ''
            return {
                title: 'A session failed',
                message: `${name} stopped with an error.${reason}`,
                type: 'ERROR',
                path: sessionPath,
                emailSubject: `A session failed: ${name}`,
                emailBody: `${name} stopped with an error.${reason}`,
            }
        }
        case 'LOW_CREDITS': {
            const balance = detail ? ` Your balance is ${money(Number(detail))}.` : ''
            return {
                title: 'Your credits are low',
                message: `Add credits so your sessions keep running.${balance}`,
                type: 'WARNING',
                path: '/settings/billing',
                emailSubject: 'Your December credits are low',
                emailBody: `Add credits so your sessions keep running.${balance}`,
            }
        }
        case 'SPEND_LIMIT': {
            const question = detail || 'Reached your spend limit. Continue?'
            return {
                title: question,
                message: `${name} is paused. Open it to continue or stop.`,
                type: 'WARNING',
                path: sessionPath,
                emailSubject: `${question} ${name}`,
                emailBody: `${name} is paused at your spend limit. ${question}`,
            }
        }
        case 'SESSION_FINISHED':
        default:
            return {
                title: 'A session finished',
                message: `${name} is done.`,
                type: 'SUCCESS',
                path: sessionPath,
                emailSubject: `A session finished: ${name}`,
                emailBody: `${name} is done.`,
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
 * The summary day of a moment (YYYY-MM-DD). A summary day starts at digestTime, not at
 * midnight, so 00:10 belongs to the day before for a 23:50 summary.
 */
const digestDay = (at: Date, timezone: string, digestMinutes: number): string => {
    const clock = zoneClock(at, timezone)
    if (clock.minutes >= digestMinutes) return clock.date
    const dayBefore = new Date(`${clock.date}T00:00:00Z`)
    dayBefore.setUTCDate(dayBefore.getUTCDate() - 1)
    return dayBefore.toISOString().slice(0, 10)
}

/**
 * The summary is due once a summary day, at the first tick at or after digestTime. The
 * ticks run on quarter hours, so a 23:50 summary goes out at the tick after midnight.
 * lastDigestAt is the start of the window: the last summary, or when the user turned it on.
 */
export const isDigestDue = (data: {
    now: Date
    timezone: string
    digestTime: string
    lastDigestAt: Date
}): boolean => {
    const { now, timezone, digestTime, lastDigestAt } = data
    const [hours = 9, minutes = 0] = digestTime.split(':').map(Number)
    const digestMinutes = hours * 60 + minutes
    return (
        digestDay(lastDigestAt, timezone, digestMinutes) < digestDay(now, timezone, digestMinutes)
    )
}

/** the text of the daily summary, or null when nothing happened */
export const digestBody = (summary: DigestSummary): string | null => {
    const lines: string[] = []
    if (summary.sessionsFinished > 0) {
        const noun = summary.sessionsFinished === 1 ? 'session' : 'sessions'
        lines.push(`${summary.sessionsFinished} ${noun} finished.`)
    }
    if (summary.pullRequestsOpened > 0) {
        const verb = summary.pullRequestsOpened === 1 ? 'pull request was' : 'pull requests were'
        lines.push(`${summary.pullRequestsOpened} ${verb} opened.`)
    }
    if (summary.creditsUsedCents > 0) {
        lines.push(`You used ${money(summary.creditsUsedCents)} of credits.`)
    }
    return lines.length > 0 ? lines.join('\n\n') : null
}
