import '../env'

import { describe, expect, it } from 'bun:test'
import {
    createRazorpayOrderSchema,
    verifyRazorpayPaymentSchema,
    createCryptoOrderSchema,
    redeemCodeSchema,
} from '../../src/modules/billing/billing.schema'

describe('billing schemas', () => {
    it('createRazorpayOrderSchema validation', () => {
        const valid = createRazorpayOrderSchema.safeParse({ amountInCents: 500, currency: 'USD' })
        expect(valid.success).toBe(true)

        const invalid = createRazorpayOrderSchema.safeParse({ amountInCents: 50 }) // too small
        expect(invalid.success).toBe(false)
    })

    it('verifyRazorpayPaymentSchema validation', () => {
        const valid = verifyRazorpayPaymentSchema.safeParse({
            razorpay_order_id: 'order_123',
            razorpay_payment_id: 'pay_123',
            razorpay_signature: 'sig_123',
        })
        expect(valid.success).toBe(true)

        const invalid = verifyRazorpayPaymentSchema.safeParse({
            razorpay_order_id: '',
        })
        expect(invalid.success).toBe(false)
    })

    it('createCryptoOrderSchema validation', () => {
        const valid = createCryptoOrderSchema.safeParse({ amountInCents: 1000 })
        expect(valid.success).toBe(true)
    })

    it('redeemCodeSchema validation', () => {
        const valid = redeemCodeSchema.safeParse({ code: 'CODE123' })
        expect(valid.success).toBe(true)

        const empty = redeemCodeSchema.safeParse({ code: '' })
        expect(empty.success).toBe(false)
    })
})
