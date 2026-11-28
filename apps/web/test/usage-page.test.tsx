import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import React from 'react'

if (!globalThis.document) {
    GlobalRegistrator.register()
}

// load react-dom and the app only after the dom exists, or react skips its input events
const { render, cleanup, waitFor, fireEvent } = await import('@testing-library/react')
const { MemoryRouter } = await import('react-router-dom')
const { ProfileUsageSettings } =
    await import('../src/features/profile/components/ProfileUsageSettings')
const { setConnectionsDemo } = await import('../src/features/connections/lib/connectionsDemo')

// the usage list on the real api: the rows, the page size control, the pager, and the
// error and empty states. only fetch is replaced.

const originalFetch = globalThis.fetch

let historyCalls: URLSearchParams[] = []
let historyReply: (query: URLSearchParams) => Response

const reply = (data: unknown, status = 200) =>
    new Response(JSON.stringify(status < 400 ? { success: true, data } : data), {
        status,
        headers: { 'Content-Type': 'application/json' },
    })

const event = (id: string, overrides: Record<string, unknown> = {}) => ({
    id,
    model: 'gpt-4o',
    inputTokens: 60,
    outputTokens: 40,
    totalTokens: 1500,
    costInCents: 12.345,
    billingSource: 'CREDITS',
    periodStart: '2026-03-11T10:00:00.000Z',
    periodEnd: '2026-03-11T10:00:00.000Z',
    metadata: null,
    createdAt: '2026-03-11T10:00:00.000Z',
    session: { title: `run ${id}` },
    ...overrides,
})

/** a range of `total` events: each request gets the page it asks for */
const rangeOf = (total: number, make = (index: number) => event(`e${index + 1}`)) => {
    const all = Array.from({ length: total }, (_, index) => make(index))
    return (query: URLSearchParams) => {
        const limit = Number(query.get('limit'))
        const offset = Number(query.get('offset'))
        return reply({
            events: all.slice(offset, offset + limit),
            total,
            limit,
            offset,
            totals: { costInCents: 100, totalTokens: total * 1500, sessions: 1 },
            days: [{ date: '2026-03-11', costInCents: 100, totalTokens: 1500, ownKeyTokens: 0 }],
        })
    }
}

const fakeServer = (async (input: RequestInfo | URL) => {
    const url = new URL(String(input instanceof Request ? input.url : input), 'http://localhost')
    if (url.pathname.endsWith('/billing/credits/history')) {
        historyCalls.push(url.searchParams)
        return historyReply(url.searchParams)
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
    setConnectionsDemo(false)
    historyCalls = []
    historyReply = rangeOf(3)
    globalThis.fetch = fakeServer
})

afterEach(() => {
    cleanup()
    setConnectionsDemo(null)
    globalThis.fetch = originalFetch
})

describe('usage page: rows', () => {
    test('asks for 10 rows at offset 0 and shows each row with its cost in whole cents', async () => {
        const view = renderUsage()
        await view.findAllByText('run e1')
        expect(lastCall().get('limit')).toBe('10')
        expect(lastCall().get('offset')).toBe('0')
        // $0.12345 shows as $0.12 on the desktop and the phone row
        expect(view.getAllByText('$0.12').length).toBe(6)
        expect(view.getAllByText('GPT-4o').length).toBeGreaterThan(0)
    })

    test('a daily AI search row says how many searches it has', async () => {
        historyReply = rangeOf(1, () =>
            event('s1', { session: null, metadata: { type: 'search-filters', calls: 3 } })
        )
        const view = renderUsage()
        await waitFor(() => expect(view.getAllByText('AI search (3 searches)').length).toBe(2))
    })

    test('a run on the user key says "your key" in place of a cost', async () => {
        historyReply = rangeOf(1, () => event('k1', { billingSource: 'OWN_KEY' }))
        const view = renderUsage()
        await waitFor(() => expect(view.getAllByText('your key').length).toBe(2))
    })

    test('says so when usage does not load', async () => {
        historyReply = () => reply({ success: false, message: 'server down' }, 500)
        const view = renderUsage()
        await view.findByText('Usage did not load. Reload the page to try again.')
        expect(view.queryByRole('button', { name: 'Next page' })).toBeNull()
    })

    test('a range with nothing in it shows the empty chart and no list or pager', async () => {
        historyReply = () =>
            reply({
                events: [],
                total: 0,
                limit: 10,
                offset: 0,
                totals: { costInCents: 0, totalTokens: 0, sessions: 0 },
                days: [{ date: '2026-03-11', costInCents: 0, totalTokens: 0, ownKeyTokens: 0 }],
            })
        const view = renderUsage()
        await view.findByText('No usage in this period')
        expect(view.getByRole('button', { name: 'Start a session' })).toBeTruthy()
        expect(view.queryByText('1 of 1')).toBeNull()
        expect(view.queryByRole('button', { name: 'Rows per page' })).toBeNull()
    })
})

describe('usage page: page size and pager', () => {
    test('the "Show" control is the shared menu: no native select, no hand-made list', async () => {
        historyReply = rangeOf(25)
        const view = renderUsage()
        await view.findByText('1 of 3')
        expect(view.container.querySelector('select')).toBeNull()

        fireEvent.click(view.getByRole('button', { name: 'Rows per page' }))
        const options = await view.findAllByRole('option')
        expect(options.map((option) => option.textContent)).toEqual(['10', '20', '30'])
    })

    test('Show 30 asks for pages of 30 from the first page', async () => {
        historyReply = rangeOf(45)
        const view = renderUsage()
        await view.findByText('1 of 5')
        fireEvent.click(view.getByRole('button', { name: 'Next page' }))
        await view.findByText('2 of 5')

        fireEvent.click(view.getByRole('button', { name: 'Rows per page' }))
        fireEvent.click(await view.findByRole('option', { name: '30' }))

        await view.findByText('1 of 2')
        expect(lastCall().get('limit')).toBe('30')
        expect(lastCall().get('offset')).toBe('0')
        await waitFor(() => expect(view.getAllByText(/^run e/).length).toBe(60))
    })

    test('a new range goes back to the first page', async () => {
        historyReply = rangeOf(25)
        const view = renderUsage()
        await view.findByText('1 of 3')
        fireEvent.click(view.getByRole('button', { name: 'Next page' }))
        await view.findByText('2 of 3')

        fireEvent.click(view.getByRole('radio', { name: '7d' }))
        await view.findByText('1 of 3')
        expect(lastCall().get('offset')).toBe('0')
    })

    test('Previous is off on the first page and Next is off on the last', async () => {
        historyReply = rangeOf(15)
        const view = renderUsage()
        await view.findByText('1 of 2')
        const previous = view.getByRole('button', { name: 'Previous page' }) as HTMLButtonElement
        expect(previous.disabled).toBe(true)

        fireEvent.click(view.getByRole('button', { name: 'Next page' }))
        await view.findByText('2 of 2')
        expect(
            (view.getByRole('button', { name: 'Next page' }) as HTMLButtonElement).disabled
        ).toBe(true)
    })

    test('phones: "Show" is for wide screens, and a one-page list has no pager', async () => {
        const view = renderUsage()
        await view.findAllByText('run e1')
        const pager = view.getByText('1 of 1').closest('div.items-center.justify-between')
        expect(pager?.className).toContain('hidden md:flex')
        expect(
            view.getByRole('button', { name: 'Rows per page' }).closest('.hidden.md\\:flex')
        ).toBeTruthy()
    })

    test('phones: a list with a second page shows the pager', async () => {
        historyReply = rangeOf(11)
        const view = renderUsage()
        await view.findByText('1 of 2')
        const pager = view.getByText('1 of 2').closest('div.items-center.justify-between')
        expect(pager?.className.split(' ')).toContain('flex')
        expect(pager?.className).not.toContain('hidden md:flex')
    })

    test('the phone row keeps the date on one line and cuts a long model name', async () => {
        historyReply = rangeOf(1, () => event('m1', { model: 'some-very-long-model-name-v2' }))
        const view = renderUsage()
        await view.findAllByText('run m1')
        const model = view.getAllByText('Some Very Long Model Name V2')[0]!
        expect(model.className).toContain('truncate')
        expect(model.parentElement?.className).toContain('min-w-0')
    })
})
