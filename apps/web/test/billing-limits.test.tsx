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
const { ProfileBillingSettings } =
    await import('../src/features/profile/components/ProfileBillingSettings')
const { SpendLimitQuestionCard } =
    await import('../src/features/chat/components/SpendLimitQuestionCard')
const { setConnectionsDemo } = await import('../src/features/connections/lib/connectionsDemo')

// limits on the real api (#638 section 1). only fetch is replaced: the tests read what the
// page shows and which request it sends.

const originalFetch = globalThis.fetch

type Call = { path: string; method: string; body: any }

let calls: Call[] = []
let limits: {
    lowBalanceAlertCents: number | null
    sessionLimitCents: number | null
    dayLimitCents: number | null
}
let pendingQuestion: unknown

const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(status < 400 ? { success: true, data } : data), {
        status,
        headers: { 'Content-Type': 'application/json' },
    })

const overview = {
    creditBalance: 1500,
    giftedCredits: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0, costInCents: 0 },
    claims: [],
    transactions: [],
}

const fakeServer = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input instanceof Request ? input.url : input), 'http://localhost')
    const method = init?.method ?? 'GET'
    const body = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined
    calls.push({ path: url.pathname, method, body })
    if (url.pathname.endsWith('/billing/limits')) {
        if (method === 'PATCH') limits = { ...limits, ...body }
        return json(limits)
    }
    if (url.pathname.endsWith('/billing/overview')) return json(overview)
    if (url.pathname.endsWith('/pending-question')) return json(pendingQuestion)
    if (url.pathname.endsWith('/question-answer')) return json({ success: true, continued: true })
    return json(null)
}) as typeof fetch

const withQueries = (children: React.ReactNode) => (
    <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
        <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
)

const renderBilling = () =>
    render(
        withQueries(
            <ProfileBillingSettings profile={{ name: 'Asha', email: 'asha@example.com' }} />
        )
    )

const limitChanges = () =>
    calls
        .filter((call) => call.path.endsWith('/billing/limits') && call.method === 'PATCH')
        .map((call) => call.body)

beforeEach(() => {
    cleanup()
    // a normal user: the preview flag is off
    setConnectionsDemo(false)
    localStorage.clear()
    calls = []
    limits = { lowBalanceAlertCents: 100, sessionLimitCents: 500, dayLimitCents: null }
    pendingQuestion = null
    globalThis.fetch = fakeServer
})

afterEach(() => {
    cleanup()
    setConnectionsDemo(null)
    globalThis.fetch = originalFetch
})

describe('the limits section on billing', () => {
    test('every user sees the three rows with the saved amounts and switches', async () => {
        const view = renderBilling()

        const session = (await view.findByLabelText(
            'Pause a session when it reaches, in dollars'
        )) as HTMLInputElement
        expect(session.value).toBe('5')
        expect(
            (
                view.getByLabelText(
                    'Tell me when the balance is under, in dollars'
                ) as HTMLInputElement
            ).value
        ).toBe('1')
        const switches = view.getAllByRole('switch')
        const state = (label: string) =>
            switches
                .find((item) => item.getAttribute('aria-label') === label)
                ?.getAttribute('aria-checked')
        expect(state('Tell me when the balance is under')).toBe('true')
        expect(state('Pause a session when it reaches')).toBe('true')
        expect(state("Pause all sessions at a day's total of")).toBe('false')
        // no sample values and no pill on the real section
        expect(view.queryByText('Demo')).toBeNull()
        expect(view.queryByText('Soon')).toBeNull()
    })

    test('a switch that goes off sends null, and on sends the amount in cents', async () => {
        const view = renderBilling()
        await view.findByLabelText('Pause a session when it reaches, in dollars')
        const switchOf = (label: string) =>
            view.getAllByRole('switch').find((item) => item.getAttribute('aria-label') === label)!

        fireEvent.click(switchOf('Pause a session when it reaches'))
        await waitFor(() => expect(limitChanges()).toEqual([{ sessionLimitCents: null }]))
        await waitFor(() =>
            expect(switchOf('Pause a session when it reaches').getAttribute('aria-checked')).toBe(
                'false'
            )
        )

        // the day limit is off: its box shows $10, and the switch saves that amount
        fireEvent.click(switchOf("Pause all sessions at a day's total of"))
        await waitFor(() =>
            expect(limitChanges()).toEqual([{ sessionLimitCents: null }, { dayLimitCents: 1000 }])
        )
    })

    test('a new amount is saved in whole cents when the box loses focus', async () => {
        const view = renderBilling()
        const box = (await view.findByLabelText(
            'Pause a session when it reaches, in dollars'
        )) as HTMLInputElement

        fireEvent.change(box, { target: { value: '25' } })
        expect(limitChanges()).toEqual([])
        fireEvent.blur(box)

        await waitFor(() => expect(limitChanges()).toEqual([{ sessionLimitCents: 2500 }]))
    })

    test('an amount the server does not take is not sent and the box goes back', async () => {
        const view = renderBilling()
        const box = (await view.findByLabelText(
            'Pause a session when it reaches, in dollars'
        )) as HTMLInputElement

        fireEvent.change(box, { target: { value: '0' } })
        fireEvent.blur(box)

        await waitFor(() => expect(box.value).toBe('5'))
        expect(limitChanges()).toEqual([])
    })

    test('auto top-up is not shown to a normal user', async () => {
        const view = renderBilling()
        await view.findByText('Limits')
        expect(view.queryByText('Auto top-up')).toBeNull()
    })

    test('auto top-up is not shown with the preview flag on, and limits stay real', async () => {
        setConnectionsDemo(true)
        const view = renderBilling()

        const session = (await view.findByLabelText(
            'Pause a session when it reaches, in dollars'
        )) as HTMLInputElement
        expect(session.value).toBe('5')
        expect(view.queryByText('Auto top-up')).toBeNull()
        expect(view.queryByText('Demo')).toBeNull()
    })
})

describe('the spend limit question in a session', () => {
    const renderCard = () => render(withQueries(<SpendLimitQuestionCard sessionId="session-1" />))
    const answers = () =>
        calls.filter((call) => call.path.endsWith('/question-answer')).map((call) => call.body)

    test('shows nothing when the session has no limit question', async () => {
        const view = renderCard()
        await waitFor(() =>
            expect(calls.some((call) => call.path.endsWith('/pending-question'))).toBe(true)
        )
        expect(view.queryByText('Continue')).toBeNull()
    })

    test('does not show the question of the agent, which the chat shows itself', async () => {
        pendingQuestion = {
            type: 'AskQuestionPrompt',
            questionId: 'qid-1',
            questions: [{ question: 'Which database?', options: ['Postgres', 'SQLite'] }],
        }
        const view = renderCard()
        await waitFor(() =>
            expect(calls.some((call) => call.path.endsWith('/pending-question'))).toBe(true)
        )
        expect(view.queryByText('Which database?')).toBeNull()
    })

    test('asks "Reached $5. Continue?" with the two choices, and sends the pick', async () => {
        pendingQuestion = {
            type: 'AskQuestionPrompt',
            source: 'spend-limit',
            kind: 'session',
            sessionId: 'session-1',
            questionId: 'spend-limit:session',
            questions: [{ question: 'Reached $5. Continue?', options: ['Continue', 'Stop here'] }],
        }
        const view = renderCard()

        await view.findByText('Reached $5. Continue?')
        expect(view.getByText('Spend limit')).not.toBeNull()
        expect(view.getAllByRole('button').map((button) => button.textContent)).toEqual([
            'Continue',
            'Stop here',
        ])

        pendingQuestion = null
        fireEvent.click(view.getByText('Stop here'))

        await waitFor(() =>
            expect(answers()).toEqual([{ questionId: 'spend-limit:session', answer: 'Stop here' }])
        )
        // the question is answered: the card goes away
        await waitFor(() => expect(view.queryByText('Reached $5. Continue?')).toBeNull())
    })
})
