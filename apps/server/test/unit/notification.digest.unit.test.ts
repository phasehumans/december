import { describe, it, expect } from 'bun:test'

import { isDigestDue } from '../../src/modules/notification/notification.utils'

// the background tick runs on quarter hours (background.ts), so these are tick times
describe('daily summary: when it is due', () => {
    const due = (data: { now: string; last: string; digestTime: string; timezone?: string }) =>
        isDigestDue({
            now: new Date(data.now),
            lastDigestAt: new Date(data.last),
            digestTime: data.digestTime,
            timezone: data.timezone ?? 'UTC',
        })

    it('a time late in the day (23:46 to 23:59) goes out at the first tick after midnight', () => {
        // the summary of the day before went out at the midnight tick
        const last = '2026-11-25T00:00:00Z'
        expect(due({ now: '2026-11-25T23:45:00Z', last, digestTime: '23:50' })).toBe(false)
        expect(due({ now: '2026-11-26T00:00:00Z', last, digestTime: '23:50' })).toBe(true)
        expect(due({ now: '2026-11-26T00:00:00Z', last, digestTime: '23:59' })).toBe(true)
    })

    it('a late time goes out once a day', () => {
        const last = '2026-11-26T00:00:00Z'
        expect(due({ now: '2026-11-26T00:15:00Z', last, digestTime: '23:50' })).toBe(false)
        expect(due({ now: '2026-11-26T23:45:00Z', last, digestTime: '23:50' })).toBe(false)
        expect(due({ now: '2026-11-27T00:00:00Z', last, digestTime: '23:50' })).toBe(true)
    })

    it('a time on a tick goes out at that tick, once a day', () => {
        const last = '2026-11-24T09:00:00Z'
        expect(due({ now: '2026-11-25T08:45:00Z', last, digestTime: '09:00' })).toBe(false)
        expect(due({ now: '2026-11-25T09:00:00Z', last, digestTime: '09:00' })).toBe(true)
        expect(
            due({ now: '2026-11-25T18:00:00Z', last: '2026-11-25T09:00:00Z', digestTime: '09:00' })
        ).toBe(false)
    })

    it('a summary turned on before its time goes out the same day', () => {
        // turned on at 08:00, the time is 09:00
        const last = '2026-11-25T08:00:00Z'
        expect(due({ now: '2026-11-25T08:45:00Z', last, digestTime: '09:00' })).toBe(false)
        expect(due({ now: '2026-11-25T09:00:00Z', last, digestTime: '09:00' })).toBe(true)
    })

    it('a summary turned on after its time waits for the next day', () => {
        const last = '2026-11-25T10:00:00Z'
        expect(due({ now: '2026-11-25T10:15:00Z', last, digestTime: '09:00' })).toBe(false)
        expect(due({ now: '2026-11-26T09:00:00Z', last, digestTime: '09:00' })).toBe(true)
    })

    it('follows the time zone: 23:50 in Kolkata is 18:20 UTC', () => {
        const timezone = 'Asia/Kolkata'
        // 00:00 on the 25th in Kolkata
        const last = '2026-11-24T18:30:00Z'
        expect(due({ now: '2026-11-25T18:15:00Z', last, digestTime: '23:50', timezone })).toBe(
            false
        )
        expect(due({ now: '2026-11-25T18:30:00Z', last, digestTime: '23:50', timezone })).toBe(true)
    })
})
