import { describe, expect, it } from 'bun:test'

import {
    checkSpendLimits,
    dayAllowanceFor,
    spendDay,
    spendLimitKind,
    spendLimitQuestion,
    startOfSpendDay,
} from '../../src/spend-limits'

const state = (over: Partial<Parameters<typeof checkSpendLimits>[0]> = {}) => ({
    sessionLimitCents: null,
    dayLimitCents: null,
    sessionSpentCents: 0,
    sessionAllowanceCents: 0,
    daySpentCents: 0,
    dayAllowanceCents: 0,
    ...over,
})

// #638: the one decision for the session limit and the day limit
describe('spend limits: the decision', () => {
    it('is ok when both limits are off, at any cost', () => {
        expect(checkSpendLimits(state({ sessionSpentCents: 90000, daySpentCents: 90000 }))).toBe(
            'ok'
        )
    })

    it('pauses the session when its cost reaches the amount', () => {
        expect(checkSpendLimits(state({ sessionLimitCents: 500, sessionSpentCents: 499.9 }))).toBe(
            'ok'
        )
        expect(checkSpendLimits(state({ sessionLimitCents: 500, sessionSpentCents: 500 }))).toBe(
            'pause-session'
        )
        expect(checkSpendLimits(state({ sessionLimitCents: 500, sessionSpentCents: 512 }))).toBe(
            'pause-session'
        )
    })

    it('a "continue" lets the session run for the same amount again', () => {
        // stopped at $5.12, then continued: the next pause is at $10.12
        const continued = { sessionLimitCents: 500, sessionAllowanceCents: 512 }
        expect(checkSpendLimits(state({ ...continued, sessionSpentCents: 512 }))).toBe('ok')
        expect(checkSpendLimits(state({ ...continued, sessionSpentCents: 1011 }))).toBe('ok')
        expect(checkSpendLimits(state({ ...continued, sessionSpentCents: 1012 }))).toBe(
            'pause-session'
        )
    })

    it('pauses for the day when the total of the day reaches the amount', () => {
        expect(checkSpendLimits(state({ dayLimitCents: 2000, daySpentCents: 1999 }))).toBe('ok')
        expect(checkSpendLimits(state({ dayLimitCents: 2000, daySpentCents: 2000 }))).toBe(
            'pause-day'
        )
        expect(
            checkSpendLimits(
                state({ dayLimitCents: 2000, daySpentCents: 2600, dayAllowanceCents: 2000 })
            )
        ).toBe('ok')
        expect(
            checkSpendLimits(
                state({ dayLimitCents: 2000, daySpentCents: 4000, dayAllowanceCents: 2000 })
            )
        ).toBe('pause-day')
    })

    it('asks about the session first when both limits are reached', () => {
        expect(
            checkSpendLimits(
                state({
                    sessionLimitCents: 500,
                    sessionSpentCents: 500,
                    dayLimitCents: 500,
                    daySpentCents: 500,
                })
            )
        ).toBe('pause-session')
    })

    it('a limit of zero is off', () => {
        expect(checkSpendLimits(state({ sessionLimitCents: 0, dayLimitCents: 0 }))).toBe('ok')
    })

    it('names the kind of a pause', () => {
        expect(spendLimitKind('ok')).toBe(null)
        expect(spendLimitKind('pause-session')).toBe('session')
        expect(spendLimitKind('pause-day')).toBe('day')
    })
})

describe('spend limits: the question', () => {
    it('asks with the amount in dollars', () => {
        expect(spendLimitQuestion({ kind: 'session', limitCents: 500 })).toBe(
            'Reached $5. Continue?'
        )
        expect(spendLimitQuestion({ kind: 'day', limitCents: 2000 })).toBe(
            'Reached $20 today. Continue?'
        )
        expect(spendLimitQuestion({ kind: 'session', limitCents: 250 })).toBe(
            'Reached $2.50. Continue?'
        )
    })
})

describe('spend limits: the day of the user', () => {
    it('is the date in the time zone of the user', () => {
        const instant = new Date('2026-11-25T20:00:00Z')
        expect(spendDay(instant, 'UTC')).toBe('2026-11-25')
        // 01:30 on the next day in India
        expect(spendDay(instant, 'Asia/Kolkata')).toBe('2026-11-26')
        // 12:00 in Los Angeles
        expect(spendDay(instant, 'America/Los_Angeles')).toBe('2026-11-25')
    })

    it('starts at midnight in the time zone of the user', () => {
        const instant = new Date('2026-11-25T20:00:00Z')
        expect(startOfSpendDay(instant, 'UTC').toISOString()).toBe('2026-11-25T00:00:00.000Z')
        expect(startOfSpendDay(instant, 'Asia/Kolkata').toISOString()).toBe(
            '2026-11-25T18:30:00.000Z'
        )
        expect(startOfSpendDay(instant, 'America/Los_Angeles').toISOString()).toBe(
            '2026-11-25T08:00:00.000Z'
        )
    })

    it('a time zone that is not known counts as UTC', () => {
        expect(spendDay(new Date('2026-11-25T20:00:00Z'), 'Not/AZone')).toBe('2026-11-25')
    })

    it('the allowance of a "continue" counts only on its day', () => {
        expect(
            dayAllowanceFor({ day: '2026-11-25', allowanceDay: '2026-11-25', allowanceCents: 2000 })
        ).toBe(2000)
        expect(
            dayAllowanceFor({ day: '2026-11-26', allowanceDay: '2026-11-25', allowanceCents: 2000 })
        ).toBe(0)
        expect(dayAllowanceFor({ day: '2026-11-26', allowanceDay: null, allowanceCents: 0 })).toBe(
            0
        )
    })
})
