/**
 * Spend limits (#638): a limit for one session and a limit for one day, on December credits.
 * Every place that charges credits or starts a run asks checkSpendLimits. Runs on the
 * user's own key are never counted and never asked.
 */

/** which limit a paused session asks about */
export type SpendLimitKind = 'session' | 'day'

export type SpendLimitDecision = 'ok' | 'pause-session' | 'pause-day'

export interface SpendLimitState {
    /** the user's limits in cents. null: the limit is off */
    sessionLimitCents: number | null
    dayLimitCents: number | null
    /** the cost of the session on credits, and the part of it a "continue" let through */
    sessionSpentCents: number
    sessionAllowanceCents: number
    /** the cost of the user's day on credits, and the part of it a "continue" let through */
    daySpentCents: number
    dayAllowanceCents: number
}

const reached = (limit: number | null, spent: number, allowance: number) =>
    limit !== null && limit > 0 && spent - Math.max(allowance, 0) >= limit

/**
 * The one decision. A limit is reached when the cost since the last "continue" is at or
 * over the amount. The session limit is asked first when both are reached.
 */
export function checkSpendLimits(state: SpendLimitState): SpendLimitDecision {
    if (reached(state.sessionLimitCents, state.sessionSpentCents, state.sessionAllowanceCents)) {
        return 'pause-session'
    }
    if (reached(state.dayLimitCents, state.daySpentCents, state.dayAllowanceCents)) {
        return 'pause-day'
    }
    return 'ok'
}

/** the kind of a pause, or null for "ok" */
export const spendLimitKind = (decision: SpendLimitDecision): SpendLimitKind | null =>
    decision === 'pause-session' ? 'session' : decision === 'pause-day' ? 'day' : null

/** the two answers to the limit question */
export const SPEND_LIMIT_CONTINUE = 'Continue'
export const SPEND_LIMIT_STOP = 'Stop here'

/** whole dollars with no cents ("$5"), or with cents when the amount has them ("$2.50") */
const dollars = (cents: number) =>
    cents % 100 === 0 ? `$${cents / 100}` : `$${(cents / 100).toFixed(2)}`

/** the words of the limit question, for the session, the inbox, the email and the push */
export const spendLimitQuestion = (data: { kind: SpendLimitKind; limitCents: number }): string =>
    data.kind === 'day'
        ? `Reached ${dollars(data.limitCents)} today. Continue?`
        : `Reached ${dollars(data.limitCents)}. Continue?`

const CLOCK_PARTS = {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
} as const
// one formatter for each time zone. to make one is slow, and a list of days reads it many times
const zoneClocks = new Map<string, Intl.DateTimeFormat>()

const clockFormat = (timezone: string) => {
    let format = zoneClocks.get(timezone)
    if (!format) {
        try {
            format = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, ...CLOCK_PARTS })
        } catch {
            // Intentionally swallowed: a time zone the runtime does not know counts as UTC
            format = new Intl.DateTimeFormat('en-CA', { timeZone: 'UTC', ...CLOCK_PARTS })
        }
        zoneClocks.set(timezone, format)
    }
    return format
}

/**
 * The date (YYYY-MM-DD) and the minute of the day of an instant in a time zone. The one
 * "what day is it for this user" helper: spend limits, the usage days and the daily
 * summary all read it.
 */
export const zoneClock = (
    instant: Date | number,
    timezone: string
): { date: string; minutes: number } => {
    const parts = clockFormat(timezone).formatToParts(new Date(instant))
    const part = (type: string) => parts.find((item) => item.type === type)?.value ?? '00'
    return {
        date: `${part('year')}-${part('month')}-${part('day')}`,
        minutes: Number(part('hour')) * 60 + Number(part('minute')),
    }
}

/** the day of an instant in a time zone, as YYYY-MM-DD */
export const spendDay = (now: Date, timezone: string): string => zoneClock(now, timezone).date

const MINUTE_MS = 60 * 1000

/** the instant the user's day started (midnight in the time zone) */
export const startOfSpendDay = (now: Date, timezone: string): Date => {
    const day = spendDay(now, timezone)
    // whole minutes: time zone offsets are whole minutes, so the day starts on one.
    // `high` is always in the day, `low` is always before it (26 hours covers a 25 hour day)
    let high = Math.floor(now.getTime() / MINUTE_MS)
    let low = high - 26 * 60
    while (high - low > 1) {
        const middle = Math.floor((low + high) / 2)
        if (spendDay(new Date(middle * MINUTE_MS), timezone) === day) high = middle
        else low = middle
    }
    return new Date(high * MINUTE_MS)
}

/** the day allowance counts only on the day it was given */
export const dayAllowanceFor = (data: {
    day: string
    allowanceDay: string | null | undefined
    allowanceCents: number | null | undefined
}): number => (data.allowanceDay === data.day ? (data.allowanceCents ?? 0) : 0)
