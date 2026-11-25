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
const { ProfileBillingSettings } =
    await import('../src/features/profile/components/ProfileBillingSettings')
const { setConnectionsDemo } = await import('../src/features/connections/lib/connectionsDemo')

// the receipt column of the billing history on the real api (#638 section 2). only fetch
// is replaced: the tests read what the page shows and which request it sends.

const originalFetch = globalThis.fetch
const originalCreateObjectURL = URL.createObjectURL
const originalRevokeObjectURL = URL.revokeObjectURL
const originalAnchorClick = HTMLAnchorElement.prototype.click

type Call = { path: string; credentials?: RequestCredentials }

let calls: Call[] = []
/** what the server answers for a receipt request */
let receiptReply: () => Response = () => new Response(null, { status: 500 })
/** each file the page saved: the name and the address of the bytes */
let saved: Array<{ download: string; href: string }> = []

const transaction = (
    id: string,
    provider: 'RAZORPAY' | 'COINBASE' | 'GRANT' | 'ADJUSTMENT',
    status: 'PENDING' | 'SUCCESS' | 'FAILED',
    createdAt: string
) => ({ id, createdAt, amountInCents: 2000, currency: 'USD', provider, status })

const overview = {
    creditBalance: 4000,
    giftedCredits: 500,
    createdAt: '2026-01-01T00:00:00.000Z',
    usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0, costInCents: 0 },
    claims: [
        { id: 'claim-1', createdAt: '2026-03-05T12:00:00.000Z', amountInCents: 500, code: 'GIFT' },
    ],
    transactions: [
        transaction('tx-paid-0001', 'RAZORPAY', 'SUCCESS', '2026-03-11T12:00:00.000Z'),
        transaction('tx-failed-0001', 'RAZORPAY', 'FAILED', '2026-03-10T12:00:00.000Z'),
        transaction('tx-grant-0001', 'GRANT', 'SUCCESS', '2026-03-09T12:00:00.000Z'),
        transaction('tx-adjust-0001', 'ADJUSTMENT', 'SUCCESS', '2026-03-08T12:00:00.000Z'),
    ],
}

const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(status < 400 ? { success: true, data } : data), {
        status,
        headers: { 'Content-Type': 'application/json' },
    })

const fakeServer = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input instanceof Request ? input.url : input), 'http://localhost')
    calls.push({ path: url.pathname, credentials: init?.credentials })
    if (url.pathname.endsWith('/receipt')) return receiptReply()
    if (url.pathname.endsWith('/billing/overview')) return json(overview)
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

/** the desktop row of the history list that has this text */
const rowOf = (container: HTMLElement, text: string) => {
    const rows = Array.from(
        container.querySelectorAll<HTMLElement>('.hidden.md\\:grid.grid-cols-12.items-center')
    )
    const row = rows.find((item) => item.textContent?.includes(text))
    if (!row) throw new Error(`no history row with: ${text}`)
    return row
}

beforeEach(() => {
    cleanup()
    // a normal user: the preview flag is off
    setConnectionsDemo(false)
    calls = []
    saved = []
    receiptReply = () =>
        new Response(new Blob(['%PDF-1.4 test'], { type: 'application/pdf' }), {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition':
                    'attachment; filename="december-receipt-2026-03-11-txpaid00.pdf"',
            },
        })
    globalThis.fetch = fakeServer
    URL.createObjectURL = () => 'blob:receipt'
    URL.revokeObjectURL = () => undefined
    HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) {
        saved.push({ download: this.download, href: this.href })
    }
})

afterEach(() => {
    cleanup()
    setConnectionsDemo(null)
    globalThis.fetch = originalFetch
    URL.createObjectURL = originalCreateObjectURL
    URL.revokeObjectURL = originalRevokeObjectURL
    HTMLAnchorElement.prototype.click = originalAnchorClick
})

describe('billing history: receipt column', () => {
    test('a normal user sees the receipt column, with a PDF link only on a payment that went through', async () => {
        const view = renderBilling()
        await view.findAllByText('Card/UPI (Razorpay)')

        expect(view.getByText('Receipt')).toBeTruthy()

        const paid = rowOf(view.container, 'tx_tx-paid-0001')
        expect(within(paid).getByRole('button', { name: 'PDF' })).toBeTruthy()

        // a failed payment, free credits, a credit change and a promo code have no receipt
        for (const id of ['tx_tx-failed-0001', 'tx_tx-grant-0001', 'tx_tx-adjust-0001', 'GIFT']) {
            const row = rowOf(view.container, id)
            expect(within(row).queryByRole('button', { name: 'PDF' })).toBeNull()
            expect(row.textContent).not.toContain('PDF')
        }
    })

    test('the phone row of a payment has the PDF link too', async () => {
        const view = renderBilling()
        await view.findAllByText('Card/UPI (Razorpay)')

        // one in the desktop row and one in the phone row of the one payment
        expect(view.getAllByRole('button', { name: 'PDF' })).toHaveLength(2)
    })

    test('PDF asks for the receipt with the sign-in and saves the file', async () => {
        const view = renderBilling()
        await view.findAllByText('Card/UPI (Razorpay)')

        fireEvent.click(
            within(rowOf(view.container, 'tx_tx-paid-0001')).getByRole('button', { name: 'PDF' })
        )

        await waitFor(() => expect(saved).toHaveLength(1))
        const request = calls.find((call) => call.path.endsWith('/receipt'))
        expect(request?.path.endsWith('/billing/transactions/tx-paid-0001/receipt')).toBe(true)
        // the cookies go with the request: a plain link to another origin would not send them
        expect(request?.credentials).toBe('include')
        expect(saved[0]).toEqual({
            download: 'december-receipt-2026-03-11-txpaid00.pdf',
            href: 'blob:receipt',
        })
    })

    test('names the file from the day of the payment when the browser cannot read the name', async () => {
        receiptReply = () =>
            new Response(new Blob(['%PDF-1.4 test'], { type: 'application/pdf' }), {
                status: 200,
                headers: { 'Content-Type': 'application/pdf' },
            })
        const view = renderBilling()
        await view.findAllByText('Card/UPI (Razorpay)')

        fireEvent.click(
            within(rowOf(view.container, 'tx_tx-paid-0001')).getByRole('button', { name: 'PDF' })
        )

        await waitFor(() => expect(saved).toHaveLength(1))
        expect(saved[0]?.download).toBe('december-receipt-2026-03-11.pdf')
    })

    test('says so when the receipt does not download', async () => {
        receiptReply = () => json({ success: false, message: 'receipt not found' }, 404)
        const view = renderBilling()
        await view.findAllByText('Card/UPI (Razorpay)')

        fireEvent.click(
            within(rowOf(view.container, 'tx_tx-paid-0001')).getByRole('button', { name: 'PDF' })
        )

        await view.findByText('The receipt did not download. Try again.')
        expect(saved).toHaveLength(0)
    })
})
