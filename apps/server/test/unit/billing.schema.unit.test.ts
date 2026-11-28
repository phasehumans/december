import { describe, it, expect } from 'bun:test'

import {
    createRazorpayOrderSchema,
    verifyRazorpayPaymentSchema,
    creditsHistoryQuerySchema,
    creditRequestSchema,
    receiptParamsSchema,
    transactionsQuerySchema,
    updateLimitsSchema,
} from '../../src/modules/billing/billing.schema'

describe('Billing Schema - Unit Tests', () => {
    describe('createRazorpayOrderSchema', () => {
        it('should pass with valid amount within range ($1.00 to $50.00 in cents)', () => {
            const validPayload = {
                amountInCents: 2000,
                currency: 'USD' as const,
            }
            const result = createRazorpayOrderSchema.safeParse(validPayload)
            expect(result.success).toBe(true)
            if (result.success) {
                expect(result.data.amountInCents).toBe(2000)
                expect(result.data.currency).toBe('USD')
            }
        })

        it('should default currency to USD if omitted', () => {
            const result = createRazorpayOrderSchema.safeParse({ amountInCents: 1000 })
            expect(result.success).toBe(true)
            if (result.success) {
                expect(result.data.currency).toBe('USD')
            }
        })

        it('should fail if amount is below minimum ($1.00 / 100 cents)', () => {
            const result = createRazorpayOrderSchema.safeParse({ amountInCents: 50 })
            expect(result.success).toBe(false)
        })

        it('should fail if amount exceeds maximum ($50.00 / 5000 cents)', () => {
            const result = createRazorpayOrderSchema.safeParse({ amountInCents: 5500 })
            expect(result.success).toBe(false)
        })

        it('should fail if amount is not an integer', () => {
            const result = createRazorpayOrderSchema.safeParse({ amountInCents: 2500.5 })
            expect(result.success).toBe(false)
        })
    })

    describe('verifyRazorpayPaymentSchema', () => {
        it('should pass with all required Razorpay fields', () => {
            const validPayload = {
                razorpay_order_id: 'order_12345',
                razorpay_payment_id: 'pay_67890',
                razorpay_signature: 'sig_abcdef',
            }
            const result = verifyRazorpayPaymentSchema.safeParse(validPayload)
            expect(result.success).toBe(true)
        })

        it('should fail if any required field is missing or empty', () => {
            const invalidPayload = {
                razorpay_order_id: 'order_12345',
                razorpay_payment_id: '',
                razorpay_signature: 'sig_abcdef',
            }
            const result = verifyRazorpayPaymentSchema.safeParse(invalidPayload)
            expect(result.success).toBe(false)
        })
    })

    describe('creditsHistoryQuerySchema', () => {
        it('should pass and coerce string limits and offsets to numbers with defaults', () => {
            const result = creditsHistoryQuerySchema.safeParse({})
            expect(result.success).toBe(true)
            if (result.success) {
                expect(result.data.limit).toBe(25)
                expect(result.data.offset).toBe(0)
            }
        })

        it('should coerce query strings and validate bounds', () => {
            const result = creditsHistoryQuerySchema.safeParse({
                limit: '50',
                offset: '10',
                periodStart: '2026-01-01',
                periodEnd: '2026-01-31',
            })
            expect(result.success).toBe(true)
            if (result.success) {
                expect(result.data.limit).toBe(50)
                expect(result.data.offset).toBe(10)
                expect(result.data.periodStart).toBe('2026-01-01')
            }
        })

        it('should fail if limit exceeds max (100)', () => {
            const result = creditsHistoryQuerySchema.safeParse({ limit: 150 })
            expect(result.success).toBe(false)
        })

        it('should fail if offset is negative', () => {
            const result = creditsHistoryQuerySchema.safeParse({ offset: -1 })
            expect(result.success).toBe(false)
        })
    })

    describe('createRazorpayOrderSchema: currency and strict body', () => {
        it('takes only USD: the order is charged in INR worked out on the server', () => {
            expect(
                createRazorpayOrderSchema.safeParse({ amountInCents: 1000, currency: 'INR' })
                    .success
            ).toBe(false)
            expect(
                createRazorpayOrderSchema.safeParse({ amountInCents: 1000, currency: 'usd' })
                    .success
            ).toBe(false)
        })

        it('refuses an unknown field, such as a price in paise from the client', () => {
            expect(
                createRazorpayOrderSchema.safeParse({ amountInCents: 1000, amountInPaise: 1 })
                    .success
            ).toBe(false)
        })

        it('refuses a string amount, NaN and Infinity', () => {
            for (const amountInCents of ['1000', Number.NaN, Number.POSITIVE_INFINITY]) {
                expect(createRazorpayOrderSchema.safeParse({ amountInCents }).success).toBe(false)
            }
        })

        it('takes the two edges, $1 and $50', () => {
            expect(createRazorpayOrderSchema.safeParse({ amountInCents: 100 }).success).toBe(true)
            expect(createRazorpayOrderSchema.safeParse({ amountInCents: 5000 }).success).toBe(true)
        })
    })

    describe('verifyRazorpayPaymentSchema: bounds', () => {
        const valid = {
            razorpay_order_id: 'order_1',
            razorpay_payment_id: 'pay_1',
            razorpay_signature: 'a'.repeat(64),
        }

        it('refuses ids over 64 characters and a signature over 256', () => {
            expect(
                verifyRazorpayPaymentSchema.safeParse({
                    ...valid,
                    razorpay_order_id: 'o'.repeat(65),
                }).success
            ).toBe(false)
            expect(
                verifyRazorpayPaymentSchema.safeParse({
                    ...valid,
                    razorpay_signature: 's'.repeat(257),
                }).success
            ).toBe(false)
        })

        it('refuses an unknown field and a number in place of a string', () => {
            expect(verifyRazorpayPaymentSchema.safeParse({ ...valid, userId: 'x' }).success).toBe(
                false
            )
            expect(
                verifyRazorpayPaymentSchema.safeParse({ ...valid, razorpay_payment_id: 5 }).success
            ).toBe(false)
        })
    })

    describe('creditsHistoryQuerySchema: dates and strict query', () => {
        it('refuses an unknown query field', () => {
            expect(creditsHistoryQuerySchema.safeParse({ userId: 'other' }).success).toBe(false)
        })

        it('refuses dates before 2020 or from 2100, and text that is not a date', () => {
            for (const periodStart of ['2019-12-31', '2100-01-01', '+010000-01-01', 'soon']) {
                expect(creditsHistoryQuerySchema.safeParse({ periodStart }).success).toBe(false)
            }
        })

        it('refuses a start after the end, and takes the same instant', () => {
            expect(
                creditsHistoryQuerySchema.safeParse({
                    periodStart: '2026-02-01',
                    periodEnd: '2026-01-01',
                }).success
            ).toBe(false)
            expect(
                creditsHistoryQuerySchema.safeParse({
                    periodStart: '2026-02-01',
                    periodEnd: '2026-02-01',
                }).success
            ).toBe(true)
        })

        it('refuses a limit of 0, an offset over 100000 and a time zone over 64 characters', () => {
            expect(creditsHistoryQuerySchema.safeParse({ limit: '0' }).success).toBe(false)
            expect(creditsHistoryQuerySchema.safeParse({ offset: '100001' }).success).toBe(false)
            expect(creditsHistoryQuerySchema.safeParse({ timezone: 'x'.repeat(65) }).success).toBe(
                false
            )
        })

        it('takes the two billing sources and refuses others', () => {
            expect(creditsHistoryQuerySchema.safeParse({ billingSource: 'OWN_KEY' }).success).toBe(
                true
            )
            expect(creditsHistoryQuerySchema.safeParse({ billingSource: 'FREE' }).success).toBe(
                false
            )
        })
    })

    describe('transactionsQuerySchema', () => {
        it('has a page of 10 at offset 0 by default', () => {
            const result = transactionsQuerySchema.parse({})
            expect(result).toEqual({ limit: 10, offset: 0 })
        })

        it('coerces strings and keeps the bounds', () => {
            expect(transactionsQuerySchema.parse({ limit: '30', offset: '20' })).toEqual({
                limit: 30,
                offset: 20,
            })
            expect(transactionsQuerySchema.safeParse({ limit: '51' }).success).toBe(false)
            expect(transactionsQuerySchema.safeParse({ limit: '0' }).success).toBe(false)
            expect(transactionsQuerySchema.safeParse({ offset: '-1' }).success).toBe(false)
            expect(transactionsQuerySchema.safeParse({ offset: '10001' }).success).toBe(false)
            expect(transactionsQuerySchema.safeParse({ limit: '2.5' }).success).toBe(false)
        })

        it('refuses an unknown query field', () => {
            expect(transactionsQuerySchema.safeParse({ userId: 'u2' }).success).toBe(false)
        })
    })

    describe('receiptParamsSchema', () => {
        it('takes an id of 1 to 64 characters', () => {
            expect(receiptParamsSchema.safeParse({ id: 'tx-1' }).success).toBe(true)
            expect(receiptParamsSchema.safeParse({ id: '' }).success).toBe(false)
            expect(receiptParamsSchema.safeParse({ id: 'x'.repeat(65) }).success).toBe(false)
        })
    })

    describe('updateLimitsSchema', () => {
        it('takes whole cents from $1 to $1000, and null to turn one off', () => {
            expect(updateLimitsSchema.safeParse({ dayLimitCents: 100 }).success).toBe(true)
            expect(updateLimitsSchema.safeParse({ dayLimitCents: 100000 }).success).toBe(true)
            expect(updateLimitsSchema.safeParse({ sessionLimitCents: null }).success).toBe(true)
        })

        it('refuses amounts out of range, part cents and strings', () => {
            for (const value of [99, 100001, 150.5, '500', -100]) {
                expect(updateLimitsSchema.safeParse({ lowBalanceAlertCents: value }).success).toBe(
                    false
                )
            }
        })

        it('refuses an empty body and an unknown field', () => {
            expect(updateLimitsSchema.safeParse({}).success).toBe(false)
            expect(
                updateLimitsSchema.safeParse({ dayLimitCents: 500, autoTopUp: true }).success
            ).toBe(false)
        })
    })

    describe('creditRequestSchema', () => {
        const valid = { buildPlan: 'a cli', heardFrom: 'x', agreeToFeedback: true }

        it('takes a full request and trims the text', () => {
            const result = creditRequestSchema.parse({ ...valid, buildPlan: '  a cli  ' })
            expect(result.buildPlan).toBe('a cli')
        })

        it('needs the feedback box to be true', () => {
            expect(
                creditRequestSchema.safeParse({ ...valid, agreeToFeedback: false }).success
            ).toBe(false)
        })

        it('refuses a plan under 3 or over 1000 characters, and an unknown field', () => {
            expect(creditRequestSchema.safeParse({ ...valid, buildPlan: 'ab' }).success).toBe(false)
            expect(
                creditRequestSchema.safeParse({ ...valid, buildPlan: 'a'.repeat(1001) }).success
            ).toBe(false)
            expect(creditRequestSchema.safeParse({ ...valid, amountInCents: 5000 }).success).toBe(
                false
            )
        })
    })
})
