import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import React from 'react'

if (!globalThis.document) {
    GlobalRegistrator.register()
}

// load react-dom and the app only after the dom exists, or react skips its input events
const { render, cleanup, waitFor, fireEvent, within } = await import('@testing-library/react')
const { MemoryRouter } = await import('react-router-dom')
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
    test('shows one bar for each day the server sends', async () => {
        historyFor = () => ({
            events: page(1),
            total: 1,
            limit: 10,
            offset: 0,
            periods: [],
            totals: { costInCents: 80, totalTokens: 100, sessions: 1 },
            days: [
                { date: '2026-03-09', costInCents: 0, totalTokens: 0 },
                { date: '2026-03-10', costInCents: 10, totalTokens: 50 },
                { date: '2026-03-11', costInCents: 70, totalTokens: 50 },
            ],
        })

        const view = renderUsage()
        const chart = await view.findByRole('img', {
            name: 'Spend for each day. Total $0.80.',
        })

        const bars = chart.querySelectorAll('[tabindex="0"]')
        expect(bars).toHaveLength(3)
        expect(bars[0]?.textContent).toBe('Mar 9 · $0.00')
        expect(bars[1]?.textContent).toBe('Mar 10 · $0.10')
        expect(bars[2]?.textContent).toBe('Mar 11 · $0.70')
        // the largest day is the full height, and a day with no spend has no height
        const heightOf = (bar: Element | undefined) =>
            (bar?.firstElementChild as HTMLElement | null)?.style.height
        expect(heightOf(bars[0])).toBe('0%')
        expect(heightOf(bars[2])).toBe('100%')
    })

    test('shows the hours in place of the days for the one-day range', async () => {
        const hours = Array.from({ length: 24 }, (_, index) => ({
            hour: (15 + index) % 24,
            costInCents: 0,
            totalTokens: 0,
        }))
        // 9 in the morning is the 19th row when the rows start at 15
        hours[18] = { hour: 9, costInCents: 3, totalTokens: 30 }
        historyFor = (query) => {
            const oneDay =
                Date.parse(query.get('periodEnd') ?? '') -
                    Date.parse(query.get('periodStart') ?? '') <=
                DAY_MS
            return {
                events: page(1),
                total: 1,
                limit: 10,
                offset: 0,
                periods: [],
                totals: { costInCents: 3, totalTokens: 30, sessions: 1 },
                days: [{ date: '2026-03-11', costInCents: 3, totalTokens: 30 }],
                ...(oneDay ? { hours } : {}),
            }
        }

        const view = renderUsage()
        await view.findByRole('img', { name: 'Spend for each day. Total $0.03.' })
        fireEvent.click(view.getByRole('radio', { name: '1d' }))

        const chart = await view.findByRole('img', {
            name: 'Spend for each hour. Total $0.03.',
        })
        const bars = chart.querySelectorAll('[tabindex="0"]')
        expect(bars).toHaveLength(24)
        expect(bars[0]?.textContent).toBe('3 PM · $0.00')
        expect(bars[18]?.textContent).toBe('9 AM · $0.03')
        expect(bars[23]?.textContent).toBe('2 PM · $0.00')
    })

    test('shows no chart when nothing was spent', async () => {
        historyFor = () => ({
            events: [usageEvent('k1', 'OWN_KEY')],
            total: 1,
            limit: 10,
            offset: 0,
            periods: [],
            totals: { costInCents: 0, totalTokens: 100, sessions: 1 },
            days: [{ date: '2026-03-11', costInCents: 0, totalTokens: 100 }],
        })

        const view = renderUsage()
        await view.findAllByText('run k1')

        expect(view.queryByRole('img')).toBeNull()
        expect(view.getByText('Spent', { selector: 'span' })).toBeTruthy()
    })
})

describe('usage page: requests', () => {
    test('asks for 30 whole days in the time zone of the browser at the start', async () => {
        renderUsage()
        await waitFor(() => expect(historyCalls.length).toBeGreaterThan(0))

        const query = lastCall()
        const start = new Date(query.get('periodStart') ?? '')
        const end = new Date(query.get('periodEnd') ?? '')
        // today and the 29 days before it: the range starts at a midnight of the browser
        expect([start.getHours(), start.getMinutes(), start.getSeconds()]).toEqual([0, 0, 0])
        const today = new Date(end)
        today.setHours(0, 0, 0, 0)
        expect(Math.round((today.getTime() - start.getTime()) / DAY_MS)).toBe(29)
        expect(Math.abs(end.getTime() - Date.now())).toBeLessThan(60 * 1000)
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
        const end = new Date(query.get('periodEnd') ?? '')
        expect([start.getMinutes(), start.getSeconds(), start.getMilliseconds()]).toEqual([0, 0, 0])
        const length = end.getTime() - start.getTime()
        expect(length).toBeGreaterThanOrEqual(23 * HOUR_MS)
        expect(length).toBeLessThan(24 * HOUR_MS)
    })

    test('a normal user sees the "paid with" control, and it sends billingSource', async () => {
        const view = renderUsage()
        await waitFor(() => expect(historyCalls.length).toBe(1))

        const control = view.getByRole('radiogroup', { name: 'Paid with' })
        fireEvent.click(within(control).getByRole('radio', { name: 'Your keys' }))
        await waitFor(() => expect(lastCall().get('billingSource')).toBe('OWN_KEY'))

        fireEvent.click(within(control).getByRole('radio', { name: 'Credits' }))
        await waitFor(() => expect(lastCall().get('billingSource')).toBe('CREDITS'))

        const before = historyCalls.length
        fireEvent.click(within(control).getByRole('radio', { name: 'All' }))
        // "All" was loaded first: the page shows it again with no billingSource
        await waitFor(() =>
            expect(
                within(control).getByRole('radio', { name: 'All' }).getAttribute('aria-checked')
            ).toBe('true')
        )
        expect(historyCalls.slice(before).every((call) => !call.has('billingSource'))).toBe(true)
    })

    test('the "paid with" control goes back to the first page', async () => {
        historyFor = (query) => ({
            events: page(10, query.get('billingSource') ?? 'all'),
            total: 25,
            limit: 10,
            offset: Number(query.get('offset')),
            periods: [],
            totals: { costInCents: 250, totalTokens: 2500, sessions: 2 },
            days: [],
        })

        const view = renderUsage()
        await view.findByText('1 of 3')
        fireEvent.click(view.getByRole('button', { name: 'Next page' }))
        await view.findByText('2 of 3')

        fireEvent.click(view.getByRole('radio', { name: 'Your keys' }))

        await waitFor(() => expect(lastCall().get('billingSource')).toBe('OWN_KEY'))
        expect(lastCall().get('offset')).toBe('0')
        await view.findByText('1 of 3')
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
