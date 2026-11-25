import { describe, expect, test } from 'bun:test'

import { isBlockedByCredits, isLowOnCredits } from '../src/features/billing/lib/creditsBlock'

// a session screen blocks follow-ups when December credits are needed and there are none
describe('isBlockedByCredits', () => {
    const empty = { source: 'CREDITS' as const, unlimited: false, remainingInCents: 0 }

    test('blocks a session on credits at a balance of zero', () => {
        expect(isBlockedByCredits(empty)).toBe(true)
        expect(isBlockedByCredits({ ...empty, remainingInCents: -4 })).toBe(true)
    })

    test('does not block a session on the own key of the user at a balance of zero', () => {
        expect(isBlockedByCredits({ ...empty, source: 'OWN_KEY' })).toBe(false)
    })

    test('does not block with credits left, with unlimited credits, or before the balance is known', () => {
        expect(isBlockedByCredits({ ...empty, remainingInCents: 1 })).toBe(false)
        expect(isBlockedByCredits({ ...empty, unlimited: true })).toBe(false)
        expect(isBlockedByCredits({ ...empty, remainingInCents: undefined })).toBe(false)
    })
})

// the low credits line of an open session
describe('isLowOnCredits', () => {
    const base = { source: 'CREDITS' as const, unlimited: false, remainingInCents: 5 }

    test('under 10 cents on December credits', () => {
        expect(isLowOnCredits(base)).toBe(true)
        expect(isLowOnCredits({ ...base, remainingInCents: 9 })).toBe(true)
        expect(isLowOnCredits({ ...base, remainingInCents: 10 })).toBe(false)
    })

    test('not on the own key of the user: the balance does not pay that session', () => {
        expect(isLowOnCredits({ ...base, source: 'OWN_KEY' })).toBe(false)
    })

    test('not with no balance left (the out of credits card shows), no limit, or no answer yet', () => {
        expect(isLowOnCredits({ ...base, remainingInCents: 0 })).toBe(false)
        expect(isLowOnCredits({ ...base, unlimited: true })).toBe(false)
        expect(isLowOnCredits({ ...base, remainingInCents: undefined })).toBe(false)
    })
})
