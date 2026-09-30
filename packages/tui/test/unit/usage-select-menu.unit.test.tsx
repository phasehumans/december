import { describe, expect, it, mock } from 'bun:test'
import React from 'react'

import { UsageSelectMenu } from '../../src/components/menus/usage-select-menu'
import { renderWithProviders } from '../test-providers'

describe('UsageSelectMenu Component (Unit)', () => {
    it('renders daily volume, session stats, and account info with all footer shortcuts', () => {
        const mockDailyUsage = [
            {
                date: '2026-09-24',
                dayName: 'Wed',
                formattedDate: 'Sep 24',
                tokens: 14200,
                isToday: false,
            },
            {
                date: '2026-09-25',
                dayName: 'Thu',
                formattedDate: 'Sep 25',
                tokens: 6100,
                isToday: false,
            },
            {
                date: '2026-09-26',
                dayName: 'Fri',
                formattedDate: 'Sep 26',
                tokens: 32800,
                isToday: false,
            },
            {
                date: '2026-09-27',
                dayName: 'Sat',
                formattedDate: 'Sep 27',
                tokens: 0,
                isToday: false,
            },
            {
                date: '2026-09-28',
                dayName: 'Sun',
                formattedDate: 'Sep 28',
                tokens: 11400,
                isToday: false,
            },
            {
                date: '2026-09-29',
                dayName: 'Mon',
                formattedDate: 'Sep 29',
                tokens: 19800,
                isToday: false,
            },
            {
                date: '2026-09-30',
                dayName: 'Tue',
                formattedDate: 'Sep 30',
                tokens: 35100,
                isToday: true,
            },
        ]

        const mockSessionStats = {
            requests: 8,
            inputTokens: 14200,
            outputTokens: 3800,
            cacheReadTokens: 6500,
            totalTokens: 18000,
            cost: 0.0023,
        }

        const mockWeeklyStats = {
            totalTokens: 119400,
            activeDays: 6,
            topModels: [{ model: 'gemini-3.7-flash', percentage: 84 }],
        }

        const mockBalance = {
            supported: true,
            balance: '$14.50',
            currency: 'USD',
        }

        const { lastFrame } = renderWithProviders(
            <UsageSelectMenu
                model="gemini-3.7-flash"
                provider="google"
                providerDisplayName="Google AI Studio"
                dailyUsage={mockDailyUsage}
                sessionStats={mockSessionStats}
                weeklyStats={mockWeeklyStats}
                balance={mockBalance}
            />
        )

        const frame = lastFrame()

        // Headers
        expect(frame).toContain('Usage')
        expect(frame).toContain('gemini-3.7-flash')
        expect(frame).toContain('Google AI Studio')

        // Daily volume table
        expect(frame).toContain('Daily Volume (Past 7 Days)')
        expect(frame).toContain('Wed Sep 24')
        expect(frame).toContain('14.2k tokens')
        expect(frame).toContain('Tue Sep 30')
        expect(frame).toContain('(Today)')

        // Shade glyphs & legend
        expect(frame).toContain('░')
        expect(frame).toContain('█')
        expect(frame).toContain('Less')
        expect(frame).toContain('More')

        // Weekly summary
        expect(frame).toContain('Weekly Total:')
        expect(frame).toContain('119.4k tokens')
        expect(frame).toContain('Active Days:')
        expect(frame).toContain('6 / 7 days')

        // Session stats
        expect(frame).toContain('Session Stats')
        expect(frame).toContain('8 requests')
        expect(frame).toContain('· Input:')
        expect(frame).toContain('14.2k tokens')
        expect(frame).toContain('· Output:')
        expect(frame).toContain('3.8k tokens')
        expect(frame).toContain('· Cache Read:')
        expect(frame).toContain('6.5k tokens')
        expect(frame).toContain('$0.0023')

        // Account & Quota
        expect(frame).toContain('Account & Quota')
        expect(frame).toContain('$14.50 (Live)')
        expect(frame).toContain('gemini-3.7-flash (84%)')

        // Footer navigation items
        expect(frame).toContain('esc')
        expect(frame).toContain('Cancel')
        expect(frame).toContain('r')
        expect(frame).toContain('Refresh')
        expect(frame).toContain('m')
        expect(frame).toContain('Switch model')
        expect(frame).toContain('b')
        expect(frame).toContain('Billing portal')
    })

    it('renders safely when props and agent are empty or undefined', () => {
        const { lastFrame } = renderWithProviders(<UsageSelectMenu />)
        const frame = lastFrame()

        expect(frame).toContain('Usage')
        expect(frame).toContain('Daily Volume (Past 7 Days)')
        expect(frame).toContain('Session Stats')
        expect(frame).toContain('Account & Quota')
        expect(frame).toContain('0 requests')
        expect(frame).toContain('0 tokens')
        expect(frame).toContain('Weekly Total:')
        expect(frame).toContain('esc')
        expect(frame).toContain('Cancel')
    })

    it('handles keyboard shortcuts esc, r, m, and b', async () => {
        const onClose = mock(() => {})
        const onRefresh = mock(() => {})
        const onModelSelect = mock(() => {})
        const onOpenBilling = mock((url?: string) => {})

        const { stdin } = renderWithProviders(
            <UsageSelectMenu
                billingUrl="https://console.cloud.google.com"
                onClose={onClose}
                onRefresh={onRefresh}
                onModelSelect={onModelSelect}
                onOpenBilling={onOpenBilling}
            />
        )

        stdin.write('\x1B')
        await new Promise((resolve) => setTimeout(resolve, 20))
        expect(onClose).toHaveBeenCalled()

        stdin.write('r')
        await new Promise((resolve) => setTimeout(resolve, 20))
        expect(onRefresh).toHaveBeenCalled()

        stdin.write('m')
        await new Promise((resolve) => setTimeout(resolve, 20))
        expect(onModelSelect).toHaveBeenCalled()

        stdin.write('b')
        await new Promise((resolve) => setTimeout(resolve, 20))
        expect(onOpenBilling).toHaveBeenCalledWith('https://console.cloud.google.com')
    })

    it('invokes setAuthMode and handleSubmit fallbacks when explicit callbacks are not provided', async () => {
        const setAuthMode = mock((mode: string) => {})
        const handleSubmit = mock((text: string) => {})

        const { stdin } = renderWithProviders(
            <UsageSelectMenu setAuthMode={setAuthMode} handleSubmit={handleSubmit} />
        )

        stdin.write('\x1B')
        await new Promise((resolve) => setTimeout(resolve, 20))
        expect(setAuthMode).toHaveBeenCalledWith('none')

        stdin.write('m')
        await new Promise((resolve) => setTimeout(resolve, 20))
        expect(handleSubmit).toHaveBeenCalledWith('/model')
    })
})
