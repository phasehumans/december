import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import React from 'react'

if (!globalThis.document) {
    GlobalRegistrator.register()
}

// load react-dom and the app only after the dom exists, or react skips its input events
const { render, cleanup, waitFor, fireEvent } = await import('@testing-library/react')
const { MemoryRouter, Routes, Route, useLocation } = await import('react-router-dom')
const { ProfileBillingSettings } =
    await import('../src/features/profile/components/ProfileBillingSettings')
const { ReferralLanding } = await import('../src/features/auth/components/ReferralLanding')
const { authAPI } = await import('../src/features/auth/api/auth')
const { setConnectionsDemo } = await import('../src/features/connections/lib/connectionsDemo')

// referrals on the real api (#638 section 3). only fetch and the clipboard are replaced:
// the tests read what the page shows and which request it sends.

const originalFetch = globalThis.fetch
const originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard')
const originalNow = Date.now

type Call = { path: string; method: string; body: any }

let calls: Call[] = []
let copied: string[] = []
let referralReply: () => Response

const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(status < 400 ? { success: true, data } : data), {
        status,
        headers: { 'Content-Type': 'application/json' },
    })

const overview = {
    creditBalance: 1500,
    createdAt: '2026-01-01T00:00:00.000Z',
    usdToInrRate: 92.68,
}

const transactions = {
    items: [
        {
            id: 'tx-referral-0001',
            createdAt: '2026-03-11T12:00:00.000Z',
            amountInCents: 500,
            status: 'SUCCESS',
            kind: 'referral',
            code: null,
            hasReceipt: false,
        },
        {
            id: 'tx-paid-0001',
            createdAt: '2026-03-10T12:00:00.000Z',
            amountInCents: 1000,
            status: 'SUCCESS',
            kind: 'payment',
            code: null,
            hasReceipt: true,
        },
    ],
    total: 2,
    limit: 10,
    offset: 0,
}

const fakeServer = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input instanceof Request ? input.url : input), 'http://localhost')
    calls.push({
        path: url.pathname,
        method: init?.method ?? 'GET',
        body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined,
    })
    if (url.pathname.endsWith('/billing/referral')) return referralReply()
    if (url.pathname.endsWith('/billing/overview')) return json(overview)
    if (url.pathname.endsWith('/billing/transactions')) return json(transactions)
    if (url.pathname.includes('/auth/')) return json({ isNewUser: true })
    return json(null)
}) as typeof fetch

const renderBilling = () =>
    render(
        <QueryClientProvider
            client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
        >
            <MemoryRouter>
                <ProfileBillingSettings profile={{ name: 'Asha', email: 'asha@example.com' }} />
            </MemoryRouter>
        </QueryClientProvider>
    )

const Where = () => {
    const location = useLocation()
    return <div data-testid="where">{location.pathname}</div>
}

const openLink = (path: string) =>
    render(
        <MemoryRouter initialEntries={[path]}>
            <Routes>
                <Route path="/r/:code" element={<ReferralLanding />} />
                <Route path="*" element={<Where />} />
            </Routes>
        </MemoryRouter>
    )

const authBodies = () => calls.filter((call) => call.path.includes('/auth/')).map((c) => c.body)

beforeEach(() => {
    cleanup()
    // a normal user: the preview flag is off
    setConnectionsDemo(false)
    localStorage.clear()
    calls = []
    copied = []
    referralReply = () =>
        json({
            code: 'k7m2p9xq',
            link: 'https://app.trydecember.com/r/k7m2p9xq',
            amountInCents: 500,
            minTopUpInCents: 1000,
            invited: 3,
            credited: 1,
            maxCredited: 20,
        })
    globalThis.fetch = fakeServer
    Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: {
            writeText: async (text: string) => {
                copied.push(text)
            },
        },
    })
})

afterEach(() => {
    cleanup()
    setConnectionsDemo(null)
    globalThis.fetch = originalFetch
    Date.now = originalNow
    if (originalClipboard) Object.defineProperty(navigator, 'clipboard', originalClipboard)
})

describe('the invite a friend row on billing', () => {
    test('a normal user sees the link and the amount from the server', async () => {
        const view = renderBilling()

        await waitFor(() =>
            expect(
                view.getByText('Invite a friend. You both get $5 when they first add $10 or more.')
            ).toBeTruthy()
        )
        await waitFor(() => expect(view.getByText('app.trydecember.com/r/k7m2p9xq')).toBeTruthy())
        expect(calls.some((call) => call.path.endsWith('/billing/referral'))).toBe(true)
    })

    test('an amount with cents shows the cents', async () => {
        referralReply = () =>
            json({
                code: 'k7m2p9xq',
                link: 'https://app.trydecember.com/r/k7m2p9xq',
                amountInCents: 250,
                minTopUpInCents: 2000,
                invited: 0,
                credited: 0,
                maxCredited: 20,
            })
        const view = renderBilling()

        await waitFor(() =>
            expect(
                view.getByText(
                    'Invite a friend. You both get $2.50 when they first add $20 or more.'
                )
            ).toBeTruthy()
        )
    })

    test('copy puts the server link on the clipboard', async () => {
        const view = renderBilling()
        const button = await waitFor(() => view.getByRole('button', { name: 'Copy link' }))
        await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(false))

        fireEvent.click(button)

        await waitFor(() => expect(view.getByRole('button', { name: 'Copied' })).toBeTruthy())
        expect(copied).toEqual(['https://app.trydecember.com/r/k7m2p9xq'])
    })

    test('the row is not there when the link did not load', async () => {
        referralReply = () => json({ success: false, message: 'no' }, 500)
        const view = renderBilling()

        await waitFor(() => expect(view.getByText('Balance')).toBeTruthy())
        await waitFor(() => expect(view.queryByText(/Invite a friend/)).toBeNull())
    })

    test('a referral credit in the history has the type Referral', async () => {
        const view = renderBilling()

        await waitFor(() => expect(view.getAllByText('Referral').length).toBeGreaterThan(0))
        expect(view.getAllByText('Card or UPI').length).toBeGreaterThan(0)
    })
})

describe('/r/<code> and the sign-up', () => {
    test('the link keeps the code and sends the visitor to sign-up', async () => {
        const view = openLink('/r/K7M2P9XQ')

        await waitFor(() => expect(view.getByTestId('where').textContent).toBe('/signup'))

        await authAPI.verifyEmailAuth({ email: 'new@example.com', otp: '123456' })
        expect(authBodies()).toEqual([
            { email: 'new@example.com', otp: '123456', referralCode: 'k7m2p9xq' },
        ])
    })

    test('google and github sign-ups send the code too', async () => {
        openLink('/r/k7m2p9xq')

        await authAPI.google({ code: 'google-code' })
        openLink('/r/k7m2p9xq')
        await authAPI.github({ code: 'github-code' })

        expect(authBodies()).toEqual([
            { code: 'google-code', referralCode: 'k7m2p9xq' },
            { code: 'github-code', referralCode: 'k7m2p9xq' },
        ])
    })

    test('the code is used once: a later sign-in does not send it', async () => {
        openLink('/r/k7m2p9xq')
        await authAPI.verifyEmailAuth({ email: 'new@example.com', otp: '123456' })

        await authAPI.verifyEmailAuth({ email: 'new@example.com', otp: '654321' })

        expect(authBodies()[1]).toEqual({ email: 'new@example.com', otp: '654321' })
    })

    test('the code is kept for 30 days', async () => {
        const day = 24 * 60 * 60 * 1000
        const start = Date.UTC(2026, 0, 1)
        Date.now = () => start
        openLink('/r/k7m2p9xq')

        // asking for the email code does not send or use up the referral code
        Date.now = () => start + 29 * day
        await authAPI.startEmailAuth({ email: 'new@example.com' })
        await authAPI.google({ code: 'day-29' })
        // a new visit to the link, and a sign-up 31 days after it
        Date.now = () => start
        openLink('/r/k7m2p9xq')
        Date.now = () => start + 31 * day
        await authAPI.verifyEmailAuth({ email: 'new@example.com', otp: '123456' })

        expect(authBodies()).toEqual([
            { email: 'new@example.com' },
            { code: 'day-29', referralCode: 'k7m2p9xq' },
            { email: 'new@example.com', otp: '123456' },
        ])
    })

    test('a sign-up with no link sends no code, and a broken link keeps nothing', async () => {
        const view = openLink('/r/not%20a%20code!')
        await waitFor(() => expect(view.getByTestId('where').textContent).toBe('/signup'))

        await authAPI.github({ code: 'github-code' })

        expect(authBodies()).toEqual([{ code: 'github-code' }])
    })
})
