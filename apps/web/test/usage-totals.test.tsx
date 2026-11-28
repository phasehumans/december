import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import React from 'react'

if (!globalThis.document) {
    GlobalRegistrator.register()
}

// load react-dom and the app only after the dom exists, or react skips its input events
const { render, cleanup, waitFor, fireEvent, within } = await import('@testing-library/react')
const { MemoryRouter, Route, Routes } = await import('react-router-dom')
const { ProfileUsageSettings } =
    await import('../src/features/profile/components/ProfileUsageSettings')
const { setConnectionsDemo } = await import('../src/features/connections/lib/connectionsDemo')

// the usage page on the real api (#638 section 5). only fetch is replaced: the tests read
// what the page shows and which request it sends.

const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS

const originalFetch = globalThis.fetch

type History = Record<string, unknown>

/** the query of each history request, in the order the page sent them */
let historyCalls: URLSearchParams[] = []
/** what the server answers for a history request */
let historyFor: (query: URLSearchParams) => History = () => ({})

const usageEvent = (id: string, billingSource: 'CREDITS' | 'OWN_KEY' = 'CREDITS') => ({
    id,
    userId: 'user-1',
    model: 'gpt-4o',
    inputTokens: 60,
    outputTokens: 40,
    totalTokens: 100,
    costInCents: 10,
    billingSource,
    projectId: null,
    chatId: null,
    externalRequestId: null,
    periodStart: '2026-03-11T10:00:00.000Z',
    periodEnd: '2026-03-11T10:00:00.000Z',
    metadata: null,
    createdAt: '2026-03-11T10:00:00.000Z',
    session: { title: `run ${id}` },
})

const page = (count: number, prefix = 'e') =>
    Array.from({ length: count }, (_, index) => usageEvent(`${prefix}${index + 1}`))

const reply = (data: unknown) =>
    new Response(JSON.stringify({ success: true, data }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
    })

const fakeServer = (async (input: RequestInfo | URL) => {
    const url = new URL(String(input instanceof Request ? input.url : input), 'http://localhost')
    if (url.pathname.endsWith('/billing/credits/history')) {
        historyCalls.push(url.searchParams)
        return reply(historyFor(url.searchParams))
    }
    if (url.pathname.endsWith('/billing/overview')) {
        return reply({ creditBalance: 500, transactions: [], claims: [] })
    }
    return reply({ id: 'user-1', name: 'Asha', email: 'asha@example.com' })
}) as typeof fetch

const renderUsage = () =>
    render(
        <QueryClientProvider
            client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
        >
            <MemoryRouter>
                <ProfileUsageSettings />
            </MemoryRouter>
        </QueryClientProvider>
    )

const lastCall = () => historyCalls[historyCalls.length - 1]!

beforeEach(() => {
    cleanup()
    // a normal user: the preview flag is off
    setConnectionsDemo(false)
    historyCalls = []
    historyFor = () => ({
        events: [],
        total: 0,
        limit: 10,
        offset: 0,
        periods: [],
        totals: { costInCents: 0, totalTokens: 0, sessions: 0 },
        days: [],
    })
    globalThis.fetch = fakeServer
})

afterEach(() => {
    cleanup()
    setConnectionsDemo(null)
    globalThis.fetch = originalFetch
})

describe('usage page: totals', () => {
    test('the three numbers and "total spent" are the totals of the range, not the sum of the page', async () => {
        // the page has 10 rows of $0.10. the range has 12 events and other sums
        historyFor = () => ({
            events: page(10),
            total: 12,
            limit: 10,
            offset: 0,
            periods: [{ periodStart: '', periodEnd: '', costInCents: 100 }],
            totals: { costInCents: 4321, totalTokens: 1234567, sessions: 7 },
            days: [],
        })

        const view = renderUsage()
        await view.findAllByText('run e1')

        const tile = (label: string) =>
            view.getByText(label, { selector: 'span' }).parentElement?.textContent
        expect(tile('Spent')).toBe('Spent$43.21')
        expect(tile('Tokens')).toBe('Tokens1.23M')
        expect(tile('Sessions')).toBe('Sessions7')
        expect(view.container.textContent).toContain('Total spent: $43.21')
        expect(view.container.textContent).not.toContain('$1.00')
    })

    test('own-key cost is not in the numbers when the server leaves it out', async () => {
        historyFor = () => ({
            events: [usageEvent('k1', 'OWN_KEY')],
            total: 1,
            limit: 10,
            offset: 0,
            periods: [],
            totals: { costInCents: 0, totalTokens: 100, sessions: 1 },
            days: [],
        })

        const view = renderUsage()
        await view.findAllByText('run k1')

        expect(view.container.textContent).toContain('your key')
        expect(view.container.textContent).toContain('Total spent: $0.00')
        expect(view.container.textContent).not.toContain('$0.10')
    })
})

describe('usage page: chart', () => {
    /** hovers the point of a chart and returns the text of the hover box */
    const hoverPoint = (chart: Element, index: number) => {
        const targets = chart.querySelectorAll('rect[fill="transparent"]')
        fireEvent.mouseEnter(targets[index] as Element)
    }

    test('draws the analytics chart with a point for each day the server sends', async () => {
        historyFor = () => ({
            events: page(1),
            total: 1,
            limit: 10,
            offset: 0,
            periods: [],
            totals: { costInCents: 80, totalTokens: 1100, sessions: 1 },
            days: [
                { date: '2026-03-09', costInCents: 0, totalTokens: 0, ownKeyTokens: 0 },
                { date: '2026-03-10', costInCents: 10, totalTokens: 1050, ownKeyTokens: 1000 },
                { date: '2026-03-11', costInCents: 70, totalTokens: 50, ownKeyTokens: 0 },
            ],
        })

        const view = renderUsage()
        await view.findByText('Last 30 days')
        const chart = await view.findByRole('img', {
            name: 'Credits tokens, Your keys tokens, Spent over 3 days',
        })
        expect(chart.querySelectorAll('polyline')).toHaveLength(3)

        hoverPoint(chart, 1)
        const box = await view.findByRole('status')
        expect(box.textContent).toContain('Mar 10')
        expect(box.textContent).toContain('Credits tokens50')
        expect(box.textContent).toContain('Your keys tokens1k')
        expect(box.textContent).toContain('Spent$0.1')
    })

    test('shows the hours in place of the days for the one-day range', async () => {
        const hours = Array.from({ length: 24 }, (_, index) => ({
            hour: (15 + index) % 24,
            costInCents: 0,
            totalTokens: 0,
            ownKeyTokens: 0,
        }))
        // 9 in the morning is the 19th row when the rows start at 15
        hours[18] = { hour: 9, costInCents: 3, totalTokens: 30, ownKeyTokens: 0 }
        historyFor = (query) => {
            const oneDay = Date.now() - Date.parse(query.get('periodStart') ?? '') <= DAY_MS
            return {
                events: page(1),
                total: 1,
                limit: 10,
                offset: 0,
                periods: [],
                totals: { costInCents: 3, totalTokens: 30, sessions: 1 },
                days: [{ date: '2026-03-11', costInCents: 3, totalTokens: 30, ownKeyTokens: 0 }],
                ...(oneDay ? { hours } : {}),
            }
        }

        const view = renderUsage()
        await view.findByRole('img', { name: 'Credits tokens, Spent over 1 days' })
        fireEvent.click(view.getByRole('radio', { name: '1d' }))

        await view.findByText('Last 24 hours')
        const chart = await view.findByRole('img', { name: 'Credits tokens, Spent over 24 days' })
        hoverPoint(chart, 18)
        const box = await view.findByRole('status')
        expect(box.textContent).toContain('9 AM')
        expect(box.textContent).toContain('Credits tokens30')
    })

    test('shows the chart for runs on own keys only, with no credits line', async () => {
        historyFor = () => ({
            events: [usageEvent('k1', 'OWN_KEY')],
            total: 1,
            limit: 10,
            offset: 0,
            periods: [],
            totals: { costInCents: 0, totalTokens: 100, sessions: 1 },
            days: [{ date: '2026-03-11', costInCents: 0, totalTokens: 100, ownKeyTokens: 100 }],
        })

        const view = renderUsage()
        await view.findAllByText('run k1')

        expect(
            await view.findByRole('img', { name: 'Your keys tokens, Spent over 1 days' })
        ).toBeTruthy()
    })

    test('shows the empty chart with a drawing and a start button when nothing ran', async () => {
        historyFor = () => ({
            events: [],
            total: 0,
            limit: 10,
            offset: 0,
            periods: [],
            totals: { costInCents: 0, totalTokens: 0, sessions: 0 },
            days: [{ date: '2026-03-11', costInCents: 0, totalTokens: 0, ownKeyTokens: 0 }],
        })

        const view = render(
            <QueryClientProvider
                client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
            >
                <MemoryRouter initialEntries={['/settings/usage']}>
                    <Routes>
                        <Route path="/settings/usage" element={<ProfileUsageSettings />} />
                        <Route path="/" element={<div>home page</div>} />
                    </Routes>
                </MemoryRouter>
            </QueryClientProvider>
        )
        // one message: the empty table is not drawn under the empty chart
        expect(await view.findAllByText('No usage in this period')).toHaveLength(1)
        expect(view.getByText('Last 30 days')).toBeTruthy()
        // the empty plot is a picture only: no hover, not read out
        expect(view.queryByRole('img')).toBeNull()
        expect(view.getByText('Spent', { selector: 'span' })).toBeTruthy()

        fireEvent.click(view.getByRole('button', { name: 'Start a session' }))
        await view.findByText('home page')
    })
})

describe('usage page: requests', () => {
    test('asks for 30 whole days in the time zone of the browser at the start', async () => {
        renderUsage()
        await waitFor(() => expect(historyCalls.length).toBeGreaterThan(0))

        const query = lastCall()
        const start = new Date(query.get('periodStart') ?? '')
        // no end: the server ends the range at the time of each fetch, so new usage shows
        expect(query.get('periodEnd')).toBeNull()
        // today and the 29 days before it: the range starts at a midnight of the browser
        expect([start.getHours(), start.getMinutes(), start.getSeconds()]).toEqual([0, 0, 0])
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        expect(Math.round((today.getTime() - start.getTime()) / DAY_MS)).toBe(29)
        expect(query.get('timezone')).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone)
        expect(query.get('billingSource')).toBeNull()
        expect(query.get('limit')).toBe('10')
        expect(query.get('offset')).toBe('0')
    })

    test('1d asks for the hour that runs now and the 23 hours before it', async () => {
        const view = renderUsage()
        await waitFor(() => expect(historyCalls.length).toBeGreaterThan(0))
        fireEvent.click(view.getByRole('radio', { name: '1d' }))
        await waitFor(() => expect(historyCalls.length).toBeGreaterThan(1))

        const query = lastCall()
        const start = new Date(query.get('periodStart') ?? '')
        expect(query.get('periodEnd')).toBeNull()
        expect([start.getMinutes(), start.getSeconds(), start.getMilliseconds()]).toEqual([0, 0, 0])
        const length = Date.now() - start.getTime()
        expect(length).toBeGreaterThanOrEqual(23 * HOUR_MS)
        expect(length).toBeLessThan(24 * HOUR_MS)
    })

    test('has no "paid with" control and never sends billingSource', async () => {
        const view = renderUsage()
        await waitFor(() => expect(historyCalls.length).toBe(1))

        expect(view.queryByRole('radiogroup', { name: 'Paid with' })).toBeNull()
        expect(view.queryByRole('radio', { name: 'Your keys' })).toBeNull()
        fireEvent.click(view.getByRole('radio', { name: '7d' }))
        await waitFor(() => expect(historyCalls.length).toBe(2))
        expect(historyCalls.every((call) => !call.has('billingSource'))).toBe(true)
    })
})

describe('usage page: pages', () => {
    test('Next loads the next page, and Previous goes back', async () => {
        historyFor = (query) => {
            const offset = Number(query.get('offset'))
            return {
                events: page(offset === 20 ? 5 : 10, `p${offset}-`),
                total: 25,
                limit: 10,
                offset,
                periods: [],
                totals: { costInCents: 250, totalTokens: 2500, sessions: 2 },
                days: [],
            }
        }

        const view = renderUsage()
        await view.findAllByText('run p0-1')
        expect(view.getByText('1 of 3')).toBeTruthy()

        fireEvent.click(view.getByRole('button', { name: 'Next page' }))
        await view.findAllByText('run p10-1')
        expect(lastCall().get('offset')).toBe('10')
        expect(view.getByText('2 of 3')).toBeTruthy()
        // the totals stay: they are for the range, not for the page
        expect(view.container.textContent).toContain('Total spent: $2.50')

        fireEvent.click(view.getByRole('button', { name: 'Next page' }))
        await view.findAllByText('run p20-1')
        expect(lastCall().get('offset')).toBe('20')
        expect(
            (view.getByRole('button', { name: 'Next page' }) as HTMLButtonElement).disabled
        ).toBe(true)

        fireEvent.click(view.getByRole('button', { name: 'Previous page' }))
        await view.findAllByText('run p10-1')
        expect(view.getByText('2 of 3')).toBeTruthy()
    })
})
