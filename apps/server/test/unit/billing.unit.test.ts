import '../env'

import crypto from 'crypto'

import { describe, expect, it, beforeEach, afterEach } from 'bun:test'

import {
    createRazorpayOrderSchema,
    verifyRazorpayPaymentSchema,
    creditsHistoryQuerySchema,
    redeemCodeSchema,
    addCreditsSchema,
} from '../../src/modules/billing/billing.schema'
import {
    getRazorpayKeyId,
    getRazorpayKeySecret,
    verifyRazorpayOrderPayment,
} from '../../src/modules/billing/billing.utils'

describe('billing.unit.test', () => {
    describe('schemas', () => {
        describe('createRazorpayOrderSchema', () => {
            it('should validate valid payload', () => {
                const result = createRazorpayOrderSchema.safeParse({
                    amountInCents: 500,
                    currency: 'USD',
                })
                expect(result.success).toBe(true)
            })

            it('should default currency to USD if missing', () => {
                const result = createRazorpayOrderSchema.safeParse({ amountInCents: 500 })
                expect(result.success).toBe(true)
                if (result.success) expect(result.data.currency).toBe('USD')
            })

            it('should fail if amount is less than 200', () => {
                const result = createRazorpayOrderSchema.safeParse({ amountInCents: 150 })
                expect(result.success).toBe(false)
            })

            it('should fail if amount is missing', () => {
                const result = createRazorpayOrderSchema.safeParse({ currency: 'USD' })
                expect(result.success).toBe(false)
            })
        })

        describe('verifyRazorpayPaymentSchema', () => {
            it('should validate valid payload', () => {
                const result = verifyRazorpayPaymentSchema.safeParse({
                    razorpay_order_id: 'order_123',
                    razorpay_payment_id: 'pay_123',
                    razorpay_signature: 'sig_123',
                })
                expect(result.success).toBe(true)
            })

            it('should fail if any field is missing', () => {
                const result = verifyRazorpayPaymentSchema.safeParse({
                    razorpay_order_id: 'order_123',
                    razorpay_payment_id: 'pay_123',
                })
                expect(result.success).toBe(false)
            })

            it('should fail if fields are empty strings', () => {
                const result = verifyRazorpayPaymentSchema.safeParse({
                    razorpay_order_id: 'order_123',
                    razorpay_payment_id: 'pay_123',
                    razorpay_signature: '   ',
                })
                expect(result.success).toBe(false)
            })
        })

        describe('creditsHistoryQuerySchema', () => {
            it('should validate with defaults', () => {
                const result = creditsHistoryQuerySchema.safeParse({})
                expect(result.success).toBe(true)
                if (result.success) {
                    expect(result.data.limit).toBe(25)
                    expect(result.data.offset).toBe(0)
                }
            })

            it('should validate with custom limit and offset', () => {
                const result = creditsHistoryQuerySchema.safeParse({ limit: 10, offset: 5 })
                expect(result.success).toBe(true)
                if (result.success) {
                    expect(result.data.limit).toBe(10)
                    expect(result.data.offset).toBe(5)
                }
            })

            it('should coerce strings to numbers', () => {
                const result = creditsHistoryQuerySchema.safeParse({ limit: '50', offset: '10' })
                expect(result.success).toBe(true)
                if (result.success) {
                    expect(result.data.limit).toBe(50)
                    expect(result.data.offset).toBe(10)
                }
            })

            it('should fail if limit is too large', () => {
                const result = creditsHistoryQuerySchema.safeParse({ limit: 101 })
                expect(result.success).toBe(false)
            })
        })

        describe('redeemCodeSchema', () => {
            it('should validate correct code', () => {
                const result = redeemCodeSchema.safeParse({ code: 'CODE123' })
                expect(result.success).toBe(true)
            })

            it('should fail if code is empty', () => {
                const result = redeemCodeSchema.safeParse({ code: '   ' })
                expect(result.success).toBe(false)
            })

            it('should strip whitespace and validate', () => {
                const result = redeemCodeSchema.safeParse({ code: '  VALID  ' })
                expect(result.success).toBe(true)
                if (result.success) {
                    expect(result.data.code).toBe('VALID')
                }
            })
        })

        describe('addCreditsSchema', () => {
            it('should validate valid payload', () => {
                const result = addCreditsSchema.safeParse({
                    amountInCents: 500,
                    paymentMethod: 'card',
                })
                expect(result.success).toBe(true)
            })

            it('should fail if amount is less than 100', () => {
                const result = addCreditsSchema.safeParse({
                    amountInCents: 50,
                    paymentMethod: 'card',
                })
                expect(result.success).toBe(false)
            })

            it('should fail if payment method is invalid', () => {
                const result = addCreditsSchema.safeParse({
                    amountInCents: 500,
                    paymentMethod: 'invalid',
                })
                expect(result.success).toBe(false)
            })
        })
    })

    describe('utils', () => {
        let originalKeyId: string | undefined
        let originalKeySecret: string | undefined

        beforeEach(() => {
            originalKeyId = process.env.RAZORPAY_KEY_ID
            originalKeySecret = process.env.RAZORPAY_KEY_SECRET
        })

        afterEach(() => {
            process.env.RAZORPAY_KEY_ID = originalKeyId
            process.env.RAZORPAY_KEY_SECRET = originalKeySecret
        })

        describe('getRazorpayKeyId', () => {
            it('should return RAZORPAY_KEY_ID if set', () => {
                process.env.RAZORPAY_KEY_ID = 'test_key_id'
                expect(getRazorpayKeyId()).toBe('test_key_id')
            })

            it('should throw if RAZORPAY_KEY_ID is not set', () => {
                delete process.env.RAZORPAY_KEY_ID
                expect(() => getRazorpayKeyId()).toThrow('RAZORPAY_KEY_ID is not configured')
            })
        })

        describe('getRazorpayKeySecret', () => {
            it('should return RAZORPAY_KEY_SECRET if set', () => {
                process.env.RAZORPAY_KEY_SECRET = 'test_key_secret'
                expect(getRazorpayKeySecret()).toBe('test_key_secret')
            })

            it('should throw if RAZORPAY_KEY_SECRET is not set', () => {
                delete process.env.RAZORPAY_KEY_SECRET
                expect(() => getRazorpayKeySecret()).toThrow(
                    'RAZORPAY_KEY_SECRET is not configured'
                )
            })
        })

        describe('verifyRazorpayOrderPayment', () => {
            it('should return true for valid signature', () => {
                process.env.RAZORPAY_KEY_SECRET = 'secret_test_key'
                const orderId = 'order_123'
                const paymentId = 'pay_123'

                const validSignature = crypto
                    .createHmac('sha256', 'secret_test_key')
                    .update(`${orderId}|${paymentId}`)
                    .digest('hex')

                const result = verifyRazorpayOrderPayment({
                    orderId,
                    paymentId,
                    signature: validSignature,
                })

                expect(result).toBe(true)
            })

            it('should return false for invalid signature', () => {
                process.env.RAZORPAY_KEY_SECRET = 'secret_test_key'

                const result = verifyRazorpayOrderPayment({
                    orderId: 'order_123',
                    paymentId: 'pay_123',
                    signature: 'invalid_signature_string',
                })

                expect(result).toBe(false)
            })
        })
    })
})
