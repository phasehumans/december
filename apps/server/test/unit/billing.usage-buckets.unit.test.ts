import { describe, expect, it } from 'bun:test'

import {
    startOfLocalDay,
    usageDayBuckets,
    usageHourBuckets,
    usageTimezone,
} from '../../src/modules/billing/billing.utils'

const iso = (date: Date) => date.toISOString()

// #638 section 5: the days and hours of a usage range in a time zone
describe('usage buckets', () => {
    describe('startOfLocalDay', () => {
        it('is midnight UTC for UTC', () => {
            expect(iso(startOfLocalDay('2026-03-11', 'UTC'))).toBe('2026-03-11T00:00:00.000Z')
        })

        it('is 18:30 UTC of the day before for India', () => {
            expect(iso(startOfLocalDay('2026-03-11', 'Asia/Kolkata'))).toBe(
                '2026-03-10T18:30:00.000Z'
            )
        })

        it('reads the old name that Chrome gives for India', () => {
            expect(iso(startOfLocalDay('2026-03-11', 'Asia/Calcutta'))).toBe(
                '2026-03-10T18:30:00.000Z'
            )
        })

        it('follows the clock change in New York (8 March 2026, 1 November 2026)', () => {
            expect(iso(startOfLocalDay('2026-03-08', 'America/New_York'))).toBe(
                '2026-03-08T05:00:00.000Z'
            )
            expect(iso(startOfLocalDay('2026-03-09', 'America/New_York'))).toBe(
                '2026-03-09T04:00:00.000Z'
            )
            expect(iso(startOfLocalDay('2026-11-01', 'America/New_York'))).toBe(
                '2026-11-01T04:00:00.000Z'
            )
            expect(iso(startOfLocalDay('2026-11-02', 'America/New_York'))).toBe(
                '2026-11-02T05:00:00.000Z'
            )
        })

        it('starts the day at 01:00 when the clock change skips midnight (Santiago, 6 September 2026)', () => {
            expect(iso(startOfLocalDay('2026-09-06', 'America/Santiago'))).toBe(
                '2026-09-06T04:00:00.000Z'
            )
            expect(iso(startOfLocalDay('2026-09-07', 'America/Santiago'))).toBe(
                '2026-09-07T03:00:00.000Z'
            )
        })

        it('works at the two ends of the time zones', () => {
            expect(iso(startOfLocalDay('2026-03-11', 'Pacific/Kiritimati'))).toBe(
                '2026-03-10T10:00:00.000Z'
            )
            expect(iso(startOfLocalDay('2026-03-11', 'Etc/GMT+12'))).toBe(
                '2026-03-11T12:00:00.000Z'
            )
        })
    })

    describe('usageDayBuckets', () => {
        it('lists every day of the range in the time zone', () => {
            const days = usageDayBuckets({
                start: new Date('2026-03-10T00:00:00.000Z'),
                end: new Date('2026-03-11T12:00:00.000Z'),
                timezone: 'Asia/Kolkata',
            })

            expect(days.map((day) => ({ date: day.date, startsAt: iso(day.startsAt) }))).toEqual([
                { date: '2026-03-10', startsAt: '2026-03-09T18:30:00.000Z' },
                { date: '2026-03-11', startsAt: '2026-03-10T18:30:00.000Z' },
            ])
        })

        it('is one day when the range is inside one day', () => {
            const days = usageDayBuckets({
                start: new Date('2026-03-10T01:00:00.000Z'),
                end: new Date('2026-03-10T02:00:00.000Z'),
                timezone: 'UTC',
            })

            expect(days.map((day) => day.date)).toEqual(['2026-03-10'])
        })

        it('is empty when the range ends before it starts', () => {
            const days = usageDayBuckets({
                start: new Date('2026-03-12T00:00:00.000Z'),
                end: new Date('2026-03-10T00:00:00.000Z'),
                timezone: 'UTC',
            })

            expect(days).toEqual([])
        })

        it('keeps the latest 366 days of a longer range', () => {
            const days = usageDayBuckets({
                start: new Date('2020-01-01T00:00:00.000Z'),
                end: new Date('2026-03-10T12:00:00.000Z'),
                timezone: 'UTC',
            })

            expect(days).toHaveLength(366)
            expect(days[0]?.date).toBe('2025-03-10')
            expect(days[365]?.date).toBe('2026-03-10')
        })
    })

    describe('usageHourBuckets', () => {
        it('lists the 24 clock hours of one day in the time zone', () => {
            const hours = usageHourBuckets({
                start: new Date('2026-03-10T18:30:00.000Z'),
                end: new Date('2026-03-11T18:29:59.999Z'),
                timezone: 'Asia/Kolkata',
            })

            expect(hours).toHaveLength(24)
            expect(hours?.[0]).toEqual({ hour: 0, startsAt: new Date('2026-03-10T18:30:00.000Z') })
            expect(hours?.[23]).toEqual({
                hour: 23,
                startsAt: new Date('2026-03-11T17:30:00.000Z'),
            })
        })

        it('starts at the clock hour of the start when the range starts inside an hour', () => {
            // 14:37 in India, for 24 hours
            const hours = usageHourBuckets({
                start: new Date('2026-03-10T09:07:00.000Z'),
                end: new Date('2026-03-11T09:07:00.000Z'),
                timezone: 'Asia/Kolkata',
            })

            expect(hours).toHaveLength(25)
            expect(hours?.[0]).toEqual({ hour: 14, startsAt: new Date('2026-03-10T08:30:00.000Z') })
            expect(hours?.[24]).toEqual({
                hour: 14,
                startsAt: new Date('2026-03-11T08:30:00.000Z'),
            })
        })

        it('is null for a range of more than 24 hours', () => {
            const hours = usageHourBuckets({
                start: new Date('2026-03-10T00:00:00.000Z'),
                end: new Date('2026-03-11T00:00:00.001Z'),
                timezone: 'UTC',
            })

            expect(hours).toBeNull()
        })
    })

    describe('usageTimezone', () => {
        it('keeps a time zone that is known', () => {
            expect(usageTimezone('Asia/Kolkata')).toBe('Asia/Kolkata')
        })

        it('is UTC for no value and for a name that is not a time zone', () => {
            expect(usageTimezone(undefined)).toBe('UTC')
            expect(usageTimezone(null)).toBe('UTC')
            expect(usageTimezone('Mars/Olympus')).toBe('UTC')
        })

        it('is the first known time zone of the ones given', () => {
            expect(usageTimezone('Mars/Olympus', 'Asia/Kolkata')).toBe('Asia/Kolkata')
            expect(usageTimezone(undefined, 'America/New_York')).toBe('America/New_York')
            expect(usageTimezone('Asia/Kolkata', 'America/New_York')).toBe('Asia/Kolkata')
        })
    })
})
