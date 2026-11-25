import crypto from 'crypto'

import { zoneClock } from '@december/shared'

import { env } from '../../env'
import { isValidTimezone } from '../notification/notification.utils'

import type {
    ReceiptData,
    UsageBucketSum,
    UsageDay,
    UsageDayBucket,
    UsageHour,
    UsageHourBucket,
    UsageRange,
} from './billing.types'
import type { PdfLine } from '../../shared/pdf'

export const getRazorpayKeyId = () => {
    const keyId =
        process.env.RAZORPAY_KEY_ID ||
        (process.env.NODE_ENV === 'test' ? undefined : env.RAZORPAY_KEY_ID)

    if (!keyId) {
        throw new Error('RAZORPAY_KEY_ID is not configured')
    }

    return keyId
}

export const getRazorpayKeySecret = () => {
    const keySecret =
        process.env.RAZORPAY_KEY_SECRET ||
        (process.env.NODE_ENV === 'test' ? undefined : env.RAZORPAY_KEY_SECRET)

    if (!keySecret) {
        throw new Error('RAZORPAY_KEY_SECRET is not configured')
    }

    return keySecret
}

export const getRazorpayWebhookSecret = () => {
    const webhookSecret =
        process.env.RAZORPAY_WEBHOOK_SECRET ||
        (process.env.NODE_ENV === 'test' ? undefined : env.RAZORPAY_WEBHOOK_SECRET)

    if (!webhookSecret) {
        throw new Error('RAZORPAY_WEBHOOK_SECRET is not configured')
    }

    return webhookSecret
}

export const verifyRazorpayOrderPayment = (data: {
    orderId: string
    paymentId: string
    signature: string
}) => {
    const { orderId, paymentId, signature } = data
    const secret = getRazorpayKeySecret()
    const generatedSignature = crypto
        .createHmac('sha256', secret)
        .update(`${orderId}|${paymentId}`)
        .digest('hex')

    const a = Buffer.from(generatedSignature, 'utf8')
    const b = Buffer.from(signature, 'utf8')

    if (a.length !== b.length) {
        return false
    }

    return crypto.timingSafeEqual(a, b)
}

export const verifyRazorpayWebhookSignature = (data: {
    rawBody: string | Buffer
    signature: string
    webhookSecret?: string
}) => {
    const { rawBody, signature, webhookSecret } = data
    const secret = webhookSecret || getRazorpayWebhookSecret()
    const generatedSignature = crypto.createHmac('sha256', secret).update(rawBody).digest('hex')

    const a = Buffer.from(generatedSignature, 'utf8')
    const b = Buffer.from(signature, 'utf8')

    if (a.length !== b.length) {
        return false
    }

    return crypto.timingSafeEqual(a, b)
}

// the one-time free credits a user can request (#624 part 2)
export const FREE_CREDITS_IN_CENTS = 500

const GMAIL_DOMAINS = new Set(['gmail.com', 'googlemail.com'])

/**
 * The address a free credit request is counted under. Lowercase for every provider;
 * for gmail the dots and the +tag are removed and googlemail counts as gmail, because
 * gmail delivers all of those to the same inbox.
 */
export const normalizeEmail = (email: string): string => {
    const lower = email.trim().toLowerCase()
    const at = lower.lastIndexOf('@')
    if (at <= 0) return lower

    const local = lower.slice(0, at)
    const domain = lower.slice(at + 1)
    if (!GMAIL_DOMAINS.has(domain)) return lower

    const base = local.split('+')[0]!.replace(/\./g, '')
    return `${base}@gmail.com`
}

/**
 * The address the self-referral check compares (review C1). A `+tag` goes to the same
 * mailbox on almost every mail host, so it is removed for every domain. Dots are the
 * same mailbox only on gmail. Free credit requests keep `normalizeEmail`.
 */
export const referralEmailKey = (email: string): string => {
    const normalized = normalizeEmail(email)
    const at = normalized.lastIndexOf('@')
    if (at <= 0) return normalized
    return `${normalized.slice(0, at).split('+')[0]}${normalized.slice(at)}`
}

const MINUTE_MS = 60 * 1000
const QUARTER_MS = 15 * MINUTE_MS
const HOUR_MS = 60 * MINUTE_MS
const DAY_MS = 24 * HOUR_MS

// the usage chart has at most this many day bars. a longer range keeps its latest days
export const MAX_USAGE_DAYS = 366

/** the time zone of the usage days: the first of the given ones that is a known zone, or UTC */
export const usageTimezone = (...timezones: Array<string | null | undefined>): string =>
    timezones.find((timezone) => timezone && isValidTimezone(timezone)) ?? 'UTC'

/** how far the clock of a time zone is ahead of UTC at an instant */
const zoneOffsetMs = (instant: number, timezone: string): number => {
    const { date, minutes } = zoneClock(instant, timezone)
    const wall = Date.parse(`${date}T00:00:00.000Z`) + minutes * MINUTE_MS
    // the clock has no seconds, so compare it with the start of the minute
    return wall - Math.floor(instant / MINUTE_MS) * MINUTE_MS
}

/**
 * The instant a day (YYYY-MM-DD) starts in a time zone. The database does not know every
 * time zone name a browser sends (Chrome sends Asia/Calcutta), so the days are worked out
 * here and the database only gets instants.
 */
export const startOfLocalDay = (date: string, timezone: string): Date => {
    const wall = Date.parse(`${date}T00:00:00.000Z`)
    // the offset at a first guess, then at the corrected instant: right on both sides of a clock change
    let instant = wall - zoneOffsetMs(wall, timezone)
    instant = wall - zoneOffsetMs(instant, timezone)
    // a clock change can skip midnight: then the day starts later than the guess
    while (zoneClock(instant, timezone).date < date) {
        instant += QUARTER_MS
    }
    while (zoneClock(instant - QUARTER_MS, timezone).date >= date) {
        instant -= QUARTER_MS
    }
    return new Date(instant)
}

/** each day from the day of `start` to the day of `end` in a time zone, with the instant it starts */
export const usageDayBuckets = (data: UsageRange): UsageDayBucket[] => {
    const { start, end, timezone } = data
    if (end.getTime() < start.getTime()) return []

    const last = Date.parse(`${zoneClock(end.getTime(), timezone).date}T00:00:00.000Z`)
    const first = Math.max(
        Date.parse(`${zoneClock(start.getTime(), timezone).date}T00:00:00.000Z`),
        last - (MAX_USAGE_DAYS - 1) * DAY_MS
    )

    const days: UsageDayBucket[] = []
    // the dates step in UTC, so a clock change in the zone does not move them
    for (let day = first; day <= last; day += DAY_MS) {
        const date = new Date(day).toISOString().slice(0, 10)
        days.push({ date, startsAt: startOfLocalDay(date, timezone) })
    }
    return days
}

/**
 * Each clock hour from the hour of `start` to the hour of `end` in a time zone, or null
 * when the range is more than 24 hours (then the chart shows days).
 */
export const usageHourBuckets = (data: UsageRange): UsageHourBucket[] | null => {
    const { start, end, timezone } = data
    const from = start.getTime()
    const to = end.getTime()
    if (to < from || to - from > DAY_MS) return null

    // the hour starts on the clock of the zone (India is 30 minutes from the UTC hours)
    const minuteOfHour = zoneClock(from, timezone).minutes % 60
    const first = from - (from % MINUTE_MS) - minuteOfHour * MINUTE_MS

    const hours: UsageHourBucket[] = []
    for (let instant = first; instant <= to; instant += HOUR_MS) {
        hours.push({
            hour: Math.floor(zoneClock(instant, timezone).minutes / 60),
            startsAt: new Date(instant),
        })
    }
    return hours
}

/** one row for each day in time order. a day with no events has zeros */
export const toUsageDays = (buckets: UsageDayBucket[], sums: UsageBucketSum[]): UsageDay[] =>
    buckets.map((bucket, index) => {
        const sum = sums.find((row) => row.bucket === index + 1)
        return {
            date: bucket.date,
            costInCents: sum?.costInCents ?? 0,
            totalTokens: sum?.totalTokens ?? 0,
        }
    })

/**
 * 24 rows, one for each hour of the day, in time order: the last row is the hour the range
 * ends in. A range that starts inside an hour ends inside the same hour of the next day,
 * and the two parts count in the one row.
 */
export const toUsageHours = (buckets: UsageHourBucket[], sums: UsageBucketSum[]): UsageHour[] => {
    const lastHour = buckets[buckets.length - 1]?.hour ?? 23
    const hours: UsageHour[] = Array.from({ length: 24 }, (_, index) => ({
        hour: (lastHour + 1 + index) % 24,
        costInCents: 0,
        totalTokens: 0,
    }))
    for (const sum of sums) {
        const bucket = buckets[sum.bucket - 1]
        const row = hours.find((item) => item.hour === bucket?.hour)
        if (row) {
            row.costInCents += sum.costInCents
            row.totalTokens += sum.totalTokens
        }
    }
    return hours
}

/**
 * A wallet transaction that has a receipt: a payment that went through. Free credits and
 * a credit change by an admin are not payments.
 */
export const isReceiptPayment = (transaction: { status: string; provider: string }): boolean =>
    transaction.status === 'SUCCESS' &&
    (transaction.provider === 'RAZORPAY' || transaction.provider === 'COINBASE')

/** an amount in cents or paise with its currency code. the pdf font has no rupee sign */
const receiptMoney = (minorUnits: number, currency: string): string => {
    const amount = (minorUnits / 100).toLocaleString(currency === 'INR' ? 'en-IN' : 'en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })
    return `${currency} ${amount}`
}

/** the file name of a receipt: the day of the payment and the start of its id */
export const receiptFileName = (data: { id: string; paidAt: Date; timezone: string }): string => {
    const { id, paidAt, timezone } = data
    const day = zoneClock(paidAt.getTime(), timezone).date
    return `december-receipt-${day}-${id.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8)}.pdf`
}

/** the text lines of a receipt. it has no tax lines: tax is not decided (#625) */
export const buildReceiptLines = (data: ReceiptData): PdfLine[] => {
    const { paidAt, timezone, amountInCents, currency, amountInPaise, paymentId, orderId } = data
    const date = new Intl.DateTimeFormat('en-GB', {
        timeZone: timezone,
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    }).format(paidAt)
    const credits = receiptMoney(amountInCents, currency)

    const lines: PdfLine[] = [
        { text: 'December', size: 20, bold: true },
        { text: 'Receipt', size: 14, gap: 2 },
        { text: `Date: ${date}`, gap: 18 },
        { text: 'Billed to', bold: true, gap: 18 },
    ]
    if (data.name) lines.push({ text: data.name })
    lines.push({ text: data.email })

    // the charge is in INR and the wallet gets the amount in USD
    if (amountInPaise) {
        lines.push(
            { text: `Amount paid: ${receiptMoney(amountInPaise, 'INR')}`, gap: 18 },
            { text: `Credits added: ${credits}` }
        )
    } else {
        lines.push({ text: `Amount paid: ${credits}`, gap: 18 })
    }

    if (paymentId) lines.push({ text: `Payment ID: ${paymentId}`, gap: 18 })
    if (orderId) lines.push({ text: `Order ID: ${orderId}`, gap: paymentId ? 0 : 18 })
    return lines
}

// referral codes (#638). no 0, 1, i, l or o: they read alike in a link
const REFERRAL_CODE_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789'
const REFERRAL_CODE_LENGTH = 8

/** a random code for an invite link. it is not made from the name or the id of the user */
export const generateReferralCode = (): string =>
    Array.from(
        { length: REFERRAL_CODE_LENGTH },
        () => REFERRAL_CODE_ALPHABET[crypto.randomInt(REFERRAL_CODE_ALPHABET.length)]
    ).join('')

/** the code as it is saved, or null for a value that cannot be a code */
export const normalizeReferralCode = (code: string | null | undefined): string | null => {
    if (typeof code !== 'string') return null
    const normalized = code.trim().toLowerCase()
    return /^[a-z0-9]{4,32}$/.test(normalized) ? normalized : null
}

/** the invite link of a code: a page of the web app that keeps the code for the sign-up */
export const referralLink = (code: string): string =>
    `${(env.APP_URL || 'https://app.trydecember.com').replace(/\/+$/, '')}/r/${code}`

/** the credit for each side, and how many paid referrals one inviter can have */
export const referralConfig = () => ({
    amountInCents: env.REFERRAL_CREDIT_CENTS,
    minTopUpInCents: env.REFERRAL_MIN_TOPUP_CENTS,
    maxCredited: env.REFERRAL_MAX_PER_INVITER,
})
