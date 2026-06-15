import '../env'

import { describe, expect, it } from 'bun:test'

import {
    createHmacSignature,
    mapRazorpayProviderStatus,
    mapUserSubscriptionStatus,
    resolveSubscriptionPeriods,
} from '../../src/modules/billing/billing.utils'

describe('billing.unit', () => {
    it('should map Razorpay statuses to provider statuses', () => {
        expect(mapRazorpayProviderStatus('active')).toBe('ACTIVE')
        expect(mapRazorpayProviderStatus('authenticated')).toBe('ACTIVE')
        expect(mapRazorpayProviderStatus('halted')).toBe('PAST_DUE')
        expect(mapRazorpayProviderStatus('cancelled')).toBe('CANCELED')
        expect(mapRazorpayProviderStatus('expired')).toBe('INCOMPLETE_EXPIRED')
        expect(mapRazorpayProviderStatus('created')).toBe('INCOMPLETE')
    })

    it('should map Razorpay statuses to user statuses', () => {
        expect(mapUserSubscriptionStatus('active')).toBe('ACTIVE')
        expect(mapUserSubscriptionStatus('authenticated')).toBe('ACTIVE')
        expect(mapUserSubscriptionStatus('halted')).toBe('PAST_DUE')
        expect(mapUserSubscriptionStatus('cancelled')).toBe('CANCELED')
        expect(mapUserSubscriptionStatus('created')).toBe('FREE')
    })

    it('should resolve subscription periods from Unix seconds', () => {
        const result = resolveSubscriptionPeriods({
            id: 'sub_test',
            current_start: 1_780_000_000,
            current_end: 1_782_592_000,
        })

        expect(result.periodStart.toISOString()).toBe('2026-05-28T20:26:40.000Z')
        expect(result.periodEnd.toISOString()).toBe('2026-06-27T20:26:40.000Z')
    })

    it('should create HMAC SHA256 signatures', () => {
        expect(createHmacSignature('payload', 'secret')).toBe(
            'b82fcb791acec57859b989b430a826488ce2e479fdf92326bd0a2e8375a42ba4'
        )
    })
})
