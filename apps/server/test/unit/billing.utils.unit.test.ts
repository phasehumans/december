import crypto from 'crypto'

import { describe, it, expect, afterEach } from 'bun:test'

import {
    getRazorpayKeyId,
    getRazorpayKeySecret,
    getRazorpayWebhookSecret,
    isReceiptPayment,
    toPaise,
    toTransactionItem,
    usdToInrRate,
    verifyRazorpayOrderPayment,
    verifyRazorpayWebhookSignature,
} from '../../src/modules/billing/billing.utils'

describe('Billing Utils - Unit Tests', () => {
    const originalEnv = { ...process.env }

    afterEach(() => {
        process.env = { ...originalEnv }
    })

    describe('getRazorpayKeyId', () => {
        it('should return RAZORPAY_KEY_ID when environment variable is configured', () => {
            process.env.RAZORPAY_KEY_ID = 'rzp_test_key_id_123'
            expect(getRazorpayKeyId()).toBe('rzp_test_key_id_123')
        })

        it('should throw an error when RAZORPAY_KEY_ID is missing', () => {
            delete process.env.RAZORPAY_KEY_ID
            expect(() => getRazorpayKeyId()).toThrow('RAZORPAY_KEY_ID is not configured')
        })
    })

    describe('getRazorpayKeySecret', () => {
        it('should return RAZORPAY_KEY_SECRET when environment variable is configured', () => {
            process.env.RAZORPAY_KEY_SECRET = 'rzp_test_secret_456'
            expect(getRazorpayKeySecret()).toBe('rzp_test_secret_456')
        })

        it('should throw an error when RAZORPAY_KEY_SECRET is missing', () => {
            delete process.env.RAZORPAY_KEY_SECRET
            expect(() => getRazorpayKeySecret()).toThrow('RAZORPAY_KEY_SECRET is not configured')
        })
    })

    describe('getRazorpayWebhookSecret', () => {
        it('should return RAZORPAY_WEBHOOK_SECRET when environment variable is configured', () => {
            process.env.RAZORPAY_WEBHOOK_SECRET = 'whsec_test_789'
            expect(getRazorpayWebhookSecret()).toBe('whsec_test_789')
        })

        it('should throw an error when RAZORPAY_WEBHOOK_SECRET is missing', () => {
            delete process.env.RAZORPAY_WEBHOOK_SECRET
            expect(() => getRazorpayWebhookSecret()).toThrow(
                'RAZORPAY_WEBHOOK_SECRET is not configured'
            )
        })
    })

    describe('verifyRazorpayOrderPayment', () => {
        it('should return true for valid HMAC SHA-256 signature match', () => {
            const secret = 'test_razorpay_secret_key'
            process.env.RAZORPAY_KEY_SECRET = secret

            const orderId = 'order_998877'
            const paymentId = 'pay_112233'
            const expectedSignature = crypto
                .createHmac('sha256', secret)
                .update(`${orderId}|${paymentId}`)
                .digest('hex')

            const isValid = verifyRazorpayOrderPayment({
                orderId,
                paymentId,
                signature: expectedSignature,
            })

            expect(isValid).toBe(true)
        })

        it('should return false for mismatched or tampered signature', () => {
            process.env.RAZORPAY_KEY_SECRET = 'test_razorpay_secret_key'

            const isValid = verifyRazorpayOrderPayment({
                orderId: 'order_998877',
                paymentId: 'pay_112233',
                signature: 'invalid_tampered_signature',
            })

            expect(isValid).toBe(false)
        })

        it('should return false if signature length differs', () => {
            process.env.RAZORPAY_KEY_SECRET = 'test_razorpay_secret_key'

            const isValid = verifyRazorpayOrderPayment({
                orderId: 'order_998877',
                paymentId: 'pay_112233',
                signature: 'short',
            })

            expect(isValid).toBe(false)
        })
    })

    describe('verifyRazorpayWebhookSignature', () => {
        it('should return true for valid webhook signature', () => {
            const secret = 'test_webhook_secret_key'
            const rawBody = JSON.stringify({ event: 'payment.captured', id: 'evt_123' })
            const expectedSignature = crypto
                .createHmac('sha256', secret)
                .update(rawBody)
                .digest('hex')

            const isValid = verifyRazorpayWebhookSignature({
                rawBody,
                signature: expectedSignature,
                webhookSecret: secret,
            })

            expect(isValid).toBe(true)
        })

        it('should return false for invalid webhook signature', () => {
            const secret = 'test_webhook_secret_key'
            const rawBody = JSON.stringify({ event: 'payment.captured', id: 'evt_123' })

            const isValid = verifyRazorpayWebhookSignature({
                rawBody,
                signature: 'invalid_sig',
                webhookSecret: secret,
            })

            expect(isValid).toBe(false)
        })
    })

    describe('verifyRazorpayOrderPayment: edge cases', () => {
        it('refuses an empty signature, an upper case copy and a signature with a space', () => {
            process.env.RAZORPAY_KEY_SECRET = 'edge_secret'
            const good = crypto
                .createHmac('sha256', 'edge_secret')
                .update('order_1|pay_1')
                .digest('hex')
            const check = (signature: string) =>
                verifyRazorpayOrderPayment({ orderId: 'order_1', paymentId: 'pay_1', signature })
            expect(check(good)).toBe(true)
            expect(check('')).toBe(false)
            expect(check(good.toUpperCase())).toBe(false)
            expect(check(` ${good.slice(1)}`)).toBe(false)
        })

        it('a signature of order|payment does not pass for the ids joined another way', () => {
            process.env.RAZORPAY_KEY_SECRET = 'edge_secret'
            const signature = crypto
                .createHmac('sha256', 'edge_secret')
                .update('order_1|pay_1')
                .digest('hex')
            expect(
                verifyRazorpayOrderPayment({ orderId: 'order_1|pay', paymentId: '_1', signature })
            ).toBe(false)
        })
    })

    describe('usdToInrRate', () => {
        it('uses USD_TO_INR_RATE when it is a number above zero', () => {
            process.env.USD_TO_INR_RATE = '88.25'
            expect(usdToInrRate()).toBe(88.25)
        })

        it('falls back to a rate above zero for text, zero and a negative number', () => {
            for (const value of ['abc', '0', '-3', 'Infinity']) {
                process.env.USD_TO_INR_RATE = value
                const rate = usdToInrRate()
                expect(Number.isFinite(rate)).toBe(true)
                expect(rate).toBeGreaterThan(0)
            }
        })
    })

    describe('toPaise', () => {
        it('rounds to whole paise', () => {
            expect(toPaise(1000, 92.68)).toBe(92680)
            expect(toPaise(101, 92.685)).toBe(9361)
            expect(toPaise(100, 0.005)).toBe(1)
        })
    })

    describe('isReceiptPayment', () => {
        it('is true only for a paid razorpay or coinbase row', () => {
            expect(isReceiptPayment({ status: 'SUCCESS', provider: 'RAZORPAY' })).toBe(true)
            expect(isReceiptPayment({ status: 'SUCCESS', provider: 'COINBASE' })).toBe(true)
            expect(isReceiptPayment({ status: 'FAILED', provider: 'RAZORPAY' })).toBe(false)
            expect(isReceiptPayment({ status: 'PENDING', provider: 'RAZORPAY' })).toBe(false)
            for (const provider of ['GRANT', 'ADJUSTMENT', 'REFERRAL', 'CODE']) {
                expect(isReceiptPayment({ status: 'SUCCESS', provider })).toBe(false)
            }
        })
    })

    describe('toTransactionItem', () => {
        const row = (provider: string, status = 'SUCCESS', code: string | null = null) => ({
            id: 'id-1',
            createdAt: new Date('2026-03-11T10:00:00.000Z'),
            amountInCents: 500,
            status,
            provider,
            code,
        })

        it('names each provider as a kind', () => {
            expect(toTransactionItem(row('RAZORPAY')).kind).toBe('payment')
            expect(toTransactionItem(row('COINBASE')).kind).toBe('payment')
            expect(toTransactionItem(row('GRANT')).kind).toBe('grant')
            expect(toTransactionItem(row('ADJUSTMENT')).kind).toBe('adjustment')
            expect(toTransactionItem(row('REFERRAL')).kind).toBe('referral')
            expect(toTransactionItem(row('CODE', 'SUCCESS', 'HELLO')).kind).toBe('code')
        })

        it('a paid payment has a receipt, a failed one does not', () => {
            expect(toTransactionItem(row('RAZORPAY')).hasReceipt).toBe(true)
            const failed = toTransactionItem(row('RAZORPAY', 'FAILED'))
            expect(failed.hasReceipt).toBe(false)
            expect(failed.status).toBe('FAILED')
        })

        it('keeps the code only for a code row, with GIFT when the code has no name', () => {
            expect(toTransactionItem(row('CODE', 'SUCCESS', 'HELLO')).code).toBe('HELLO')
            expect(toTransactionItem(row('CODE')).code).toBe('GIFT')
            expect(toTransactionItem(row('GRANT', 'SUCCESS', 'X')).code).toBeNull()
        })

        it('an unknown provider is a credit change, never a payment with a receipt', () => {
            const item = toTransactionItem(row('SOMETHING_NEW'))
            expect(item.kind).toBe('adjustment')
            expect(item.hasReceipt).toBe(false)
        })

        it('sends only the list fields', () => {
            expect(Object.keys(toTransactionItem(row('GRANT'))).sort()).toEqual([
                'amountInCents',
                'code',
                'createdAt',
                'hasReceipt',
                'id',
                'kind',
                'status',
            ])
        })
    })
})
