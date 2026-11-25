import { describe, expect, it } from 'bun:test'

import { LOW_CREDITS_ALERT_CENTS, crossedLowCreditsAmount } from '../../src/low-credits'

// the one rule for the low credits alert: the worker's charge and the server's charges use it
describe('low credits: did a charge take the balance under the amount', () => {
    it('the amount is $1', () => {
        expect(LOW_CREDITS_ALERT_CENTS).toBe(100)
    })

    it('is true for the charge that takes the balance under the amount', () => {
        expect(crossedLowCreditsAmount({ balanceBefore: 100.5, balanceAfter: 99.9 })).toBe(true)
        expect(crossedLowCreditsAmount({ balanceBefore: 100, balanceAfter: 99.99 })).toBe(true)
        // a large charge can take it under zero
        expect(crossedLowCreditsAmount({ balanceBefore: 250, balanceAfter: -3 })).toBe(true)
    })

    it('is false while the balance stays at or over the amount', () => {
        expect(crossedLowCreditsAmount({ balanceBefore: 500, balanceAfter: 480 })).toBe(false)
        expect(crossedLowCreditsAmount({ balanceBefore: 101, balanceAfter: 100 })).toBe(false)
    })

    it('is false for later charges under the amount: one drop, one alert', () => {
        expect(crossedLowCreditsAmount({ balanceBefore: 99.9, balanceAfter: 99.8 })).toBe(false)
        expect(crossedLowCreditsAmount({ balanceBefore: 0, balanceAfter: -1 })).toBe(false)
    })

    it('is false for a charge of nothing and for a top-up', () => {
        expect(crossedLowCreditsAmount({ balanceBefore: 100, balanceAfter: 100 })).toBe(false)
        expect(crossedLowCreditsAmount({ balanceBefore: 50, balanceAfter: 550 })).toBe(false)
    })

    it('takes another amount, for the user setting of #638', () => {
        expect(
            crossedLowCreditsAmount({ balanceBefore: 520, balanceAfter: 480, alertCents: 500 })
        ).toBe(true)
        expect(
            crossedLowCreditsAmount({ balanceBefore: 480, balanceAfter: 90, alertCents: 500 })
        ).toBe(false)
    })

    it('is off when the user turned the alert off (null)', () => {
        expect(
            crossedLowCreditsAmount({ balanceBefore: 150, balanceAfter: 20, alertCents: null })
        ).toBe(false)
    })
})
