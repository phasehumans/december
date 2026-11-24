import crypto from 'crypto'

import { env } from '../../env'

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
