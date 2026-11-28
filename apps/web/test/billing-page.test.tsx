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

// the billing page on the real api: balance, history (paged on the server), receipts and
// the add credits dialog with a fake Razorpay checkout. only fetch, Razorpay and the file
// download are replaced: the tests read what the page shows and which requests it sends.

const originalFetch = globalThis.fetch
const originalCreateObjectURL = URL.createObjectURL
const originalRevokeObjectURL = URL.revokeObjectURL
const originalAnchorClick = HTMLAnchorElement.prototype.click
const originalMatchMedia = window.matchMedia

type Kind = 'payment' | 'grant' | 'adjustment' | 'referral' | 'code'
type Item = {
    id: string
    createdAt: string
    amountInCents: number
    status: 'SUCCESS' | 'FAILED'
    kind: Kind
    code: string | null
    hasReceipt: boolean
}
type Call = {
    path: string
    method: string
    query: URLSearchParams
    body: any
    credentials?: string
}

const item = (id: string, kind: Kind, overrides: Partial<Item> = {}): Item => ({
    id,
    createdAt: '2026-03-11T12:00:00.000Z',
    amountInCents: 2000,
    status: 'SUCCESS',
    kind,
    code: null,
    hasReceipt: kind === 'payment',
    ...overrides,
})

let calls: Call[] = []
let balance = 4000
let items: Item[] = []
let overviewReply: () => Response
let transactionsReply: (query: URLSearchParams) => Response
let receiptReply: () => Response
let orderReply: () => Response
let verifyReply: () => Response
let saved: Array<{ download: string; href: string }> = []

const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(status < 400 ? { success: true, data } : data), {
        status,
        headers: { 'Content-Type': 'application/json' },
    })

const pageOf = (query: URLSearchParams) => {
    const limit = Number(query.get('limit'))
    const offset = Number(query.get('offset'))
    return json({ items: items.slice(offset, offset + limit), total: items.length, limit, offset })
}

const fakeServer = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input instanceof Request ? input.url : input), 'http://localhost')
    calls.push({
        path: url.pathname,
        method: init?.method ?? 'GET',
        query: url.searchParams,
        body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined,
        credentials: init?.credentials,
    })
    const path = url.pathname
    if (path.endsWith('/receipt')) return receiptReply()
    if (path.endsWith('/billing/overview')) return overviewReply()
    if (path.endsWith('/billing/transactions')) return transactionsReply(url.searchParams)
    if (path.endsWith('/billing/referral')) return json({ message: 'off' }, 500)
    if (path.endsWith('/billing/limits')) {
        return json({ lowBalanceAlertCents: null, sessionLimitCents: null, dayLimitCents: null })
    }
    if (path.endsWith('/billing/credit-request')) return json(null)
    if (path.endsWith('/wallet/order/razorpay')) return orderReply()
    if (path.endsWith('/wallet/verify/razorpay')) return verifyReply()
    return json({ id: 'user-1', name: 'Asha', email: 'asha@example.com' })
}) as typeof fetch

/** the fake Razorpay checkout: each opened one, with what the page gave it */
let checkouts: Array<{ options: any; opened: boolean }> = []

class FakeRazorpay {
    entry: { options: any; opened: boolean }
    constructor(options: any) {
        this.entry = { options, opened: false }
        checkouts.push(this.entry)
    }
    open() {
        this.entry.opened = true
    }
}

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

const typeInto = (el: HTMLElement, value: string) => {
    fireEvent.focusIn(el)
    fireEvent.change(el, { target: { value } })
    fireEvent.keyUp(el)
    fireEvent.focusOut(el)
}

const historyRows = (container: HTMLElement) =>
    Array.from(container.querySelectorAll<HTMLElement>('[data-testid="history-row"]'))

/** the history row that has this text */
const rowOf = (container: HTMLElement, text: string) => {
    const row = historyRows(container).find((el) => el.textContent?.includes(text))
    if (!row) throw new Error(`no history row with: ${text}`)
    return row
}

const transactionCalls = () => calls.filter((call) => call.path.endsWith('/billing/transactions'))

const setPhone = (isPhone: boolean) => {
    window.matchMedia = ((query: string) => ({
        matches: isPhone && query.includes('max-width'),
        media: query,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
    })) as never
}

beforeEach(() => {
    cleanup()
    // a normal user: the preview flag is off
    setConnectionsDemo(false)
    calls = []
    saved = []
    checkouts = []
    balance = 4000
    items = [
        item('tx-paid-0001', 'payment', { createdAt: '2026-03-11T12:00:00.000Z' }),
        item('tx-failed-0001', 'payment', {
            status: 'FAILED',
            hasReceipt: false,
            createdAt: '2026-03-10T12:00:00.000Z',
        }),
        item('tx-grant-0001', 'grant', {
            amountInCents: 500,
            createdAt: '2026-03-09T12:00:00.000Z',
        }),
        item('tx-adjust-0001', 'adjustment', {
            amountInCents: -300,
            createdAt: '2026-03-08T12:00:00.000Z',
        }),
        item('claim-1', 'code', {
            code: 'GIFT',
            amountInCents: 500,
            createdAt: '2026-03-05T12:00:00.000Z',
        }),
    ]
    overviewReply = () =>
        json({ creditBalance: balance, createdAt: '2026-01-01T00:00:00.000Z', usdToInrRate: 90 })
    transactionsReply = pageOf
    receiptReply = () =>
        new Response(new Blob(['%PDF-1.4 test'], { type: 'application/pdf' }), {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition':
                    'attachment; filename="december-receipt-2026-03-11-txpaid00.pdf"',
            },
        })
    orderReply = () =>
        json(
            {
                keyId: 'rzp_test',
                orderId: 'order_1',
                amount: 90000,
                currency: 'INR',
                usdToInrRate: 90,
            },
            201
        )
    verifyReply = () => {
        balance += 1000
        return json({ success: true, newBalance: balance })
    }
    globalThis.fetch = fakeServer
    ;(window as any).Razorpay = FakeRazorpay
    URL.createObjectURL = () => 'blob:receipt'
    URL.revokeObjectURL = () => undefined
    HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) {
        saved.push({ download: this.download, href: this.href })
    }
    setPhone(false)
})

afterEach(() => {
    cleanup()
    setConnectionsDemo(null)
    globalThis.fetch = originalFetch
    delete (window as any).Razorpay
    URL.createObjectURL = originalCreateObjectURL
    URL.revokeObjectURL = originalRevokeObjectURL
    HTMLAnchorElement.prototype.click = originalAnchorClick
    window.matchMedia = originalMatchMedia
})

describe('billing page: balance and states', () => {
    test('shows the balance from the server, with the page title and its grey line', async () => {
        const view = renderBilling()
        await waitFor(() => expect(view.getByTestId('credit-balance').textContent).toBe('$40.00'))
        expect(
            view.getByRole('heading', { name: 'Billing' }) ?? view.getByText('Billing')
        ).toBeTruthy()
        expect(view.getByText('Manage your credits and payments.')).toBeTruthy()
        expect(view.getByRole('button', { name: 'Add credits' })).toBeTruthy()
    })

    test('a balance under zero shows as -$0.40, not $-0.40', async () => {
        balance = -40
        const view = renderBilling()
        await waitFor(() => expect(view.getByTestId('credit-balance').textContent).toBe('-$0.40'))
    })

    test('a balance with part cents is rounded to whole cents', async () => {
        balance = 1234.5678
        const view = renderBilling()
        await waitFor(() => expect(view.getByTestId('credit-balance').textContent).toBe('$12.35'))
    })

    test('says so when billing does not load', async () => {
        overviewReply = () => json({ success: false, message: 'server down' }, 500)
        const view = renderBilling()
        await view.findByText('Billing did not load. Reload the page to try again.')
        expect(view.queryByRole('button', { name: 'Add credits' })).toBeNull()
    })

    test('has no Demo pill: every section is real', async () => {
        const view = renderBilling()
        await view.findByTestId('credit-balance')
        expect(view.queryByText('Demo')).toBeNull()
    })
})

describe('billing page: history', () => {
    test('asks the server for the first page of 10 and shows each kind of row', async () => {
        const view = renderBilling()
        await waitFor(() => expect(historyRows(view.container)).toHaveLength(5))

        expect(transactionCalls()[0]?.query.get('limit')).toBe('10')
        expect(transactionCalls()[0]?.query.get('offset')).toBe('0')
        expect(within(rowOf(view.container, 'Free credits')).getAllByText('+$5.00').length).toBe(2)
        // an admin took credits out: a minus amount
        expect(within(rowOf(view.container, 'Credit change')).getAllByText('-$3.00').length).toBe(2)
        expect(rowOf(view.container, 'Code GIFT')).toBeTruthy()
    })

    test('a payment says Paid, credits say Added, and a failed payment is struck through', async () => {
        const view = renderBilling()
        await waitFor(() => expect(historyRows(view.container)).toHaveLength(5))

        const [paid, failed] = historyRows(view.container)
        expect(within(paid!).getAllByText('Paid').length).toBeGreaterThan(0)
        expect(within(failed!).getAllByText('Failed').length).toBeGreaterThan(0)
        expect(within(failed!).getAllByText('+$20.00')[0]!.className).toContain('line-through')
        expect(within(rowOf(view.container, 'Free credits')).getAllByText('Added').length).toBe(2)
    })

    test('shows no internal ids', async () => {
        const view = renderBilling()
        await waitFor(() => expect(historyRows(view.container)).toHaveLength(5))
        expect(view.container.textContent).not.toContain('tx_')
        expect(view.container.textContent).not.toContain('tx-paid-0001')
    })

    test('an empty history says so and has no pager', async () => {
        items = []
        const view = renderBilling()
        const empty = await view.findByRole('heading', { name: 'No payments yet' })
        expect(empty.parentElement!.querySelector('svg')).not.toBeNull()
        expect(view.queryByRole('button', { name: 'Next page' })).toBeNull()
    })

    test('a history that did not load says so, and the balance still shows', async () => {
        transactionsReply = () => json({ success: false, message: 'no' }, 500)
        const view = renderBilling()
        await view.findByText('History did not load. Reload the page.')
        expect(view.getByTestId('credit-balance').textContent).toBe('$40.00')
    })

    test('Next and Previous page through the server with limit and offset', async () => {
        items = Array.from({ length: 23 }, (_, index) =>
            item(`tx-${index}`, 'grant', { amountInCents: 100 + index })
        )
        const view = renderBilling()
        await view.findByText('1 of 3')

        fireEvent.click(view.getByRole('button', { name: 'Next page' }))
        await view.findByText('2 of 3')
        expect(transactionCalls().at(-1)?.query.get('offset')).toBe('10')

        fireEvent.click(view.getByRole('button', { name: 'Next page' }))
        await view.findByText('3 of 3')
        await waitFor(() => expect(historyRows(view.container)).toHaveLength(3))
        expect(
            (view.getByRole('button', { name: 'Next page' }) as HTMLButtonElement).disabled
        ).toBe(true)

        expect(transactionCalls().at(-1)?.query.get('offset')).toBe('20')

        // page 2 comes back from the cache of the earlier fetch
        fireEvent.click(view.getByRole('button', { name: 'Previous page' }))
        await view.findByText('2 of 3')
        await waitFor(() => expect(historyRows(view.container)).toHaveLength(10))
    })

    test('Show 20 asks for pages of 20 and goes back to the first page', async () => {
        items = Array.from({ length: 45 }, (_, index) => item(`tx-${index}`, 'grant'))
        const view = renderBilling()
        await view.findByText('1 of 5')
        fireEvent.click(view.getByRole('button', { name: 'Next page' }))
        await view.findByText('2 of 5')

        fireEvent.click(view.getByRole('button', { name: 'Rows per page' }))
        fireEvent.click(await view.findByRole('option', { name: '20' }))

        await view.findByText('1 of 3')
        const last = transactionCalls().at(-1)!
        expect(last.query.get('limit')).toBe('20')
        expect(last.query.get('offset')).toBe('0')
    })

    test('the pager is a plain select: no native select on the page', async () => {
        items = Array.from({ length: 12 }, (_, index) => item(`tx-${index}`, 'grant'))
        const view = renderBilling()
        await view.findByText('1 of 2')
        expect(view.container.querySelector('select')).toBeNull()
    })
})

describe('billing page: receipts', () => {
    test('only a payment that went through has a PDF link', async () => {
        const view = renderBilling()
        await waitFor(() => expect(historyRows(view.container)).toHaveLength(5))

        expect(view.getByText('Receipt')).toBeTruthy()
        // one in the desktop row and one in the phone row of the one payment
        expect(view.getAllByRole('button', { name: /Download the receipt/ })).toHaveLength(2)
        for (const text of ['Free credits', 'Credit change', 'Code GIFT']) {
            expect(rowOf(view.container, text).textContent).not.toContain('PDF')
        }
        const failed = historyRows(view.container)[1]!
        expect(failed.textContent).not.toContain('PDF')
    })

    test('PDF asks for the receipt with the sign-in and saves the file', async () => {
        const view = renderBilling()
        await waitFor(() => expect(historyRows(view.container)).toHaveLength(5))

        fireEvent.click(view.getAllByRole('button', { name: /Download the receipt/ })[0]!)

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

    test('a double click asks for one receipt', async () => {
        let release: () => void = () => undefined
        receiptReply = () => {
            throw new Error('replaced below')
        }
        const gate = new Promise<void>((resolve) => {
            release = resolve
        })
        const pdf = () =>
            new Response(new Blob(['%PDF'], { type: 'application/pdf' }), { status: 200 })
        globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
            if (String(input).endsWith('/receipt')) {
                calls.push({
                    path: '/receipt',
                    method: 'GET',
                    query: new URLSearchParams(),
                    body: undefined,
                })
                await gate
                return pdf()
            }
            return fakeServer(input, init)
        }) as typeof fetch
        const view = renderBilling()
        await waitFor(() => expect(historyRows(view.container)).toHaveLength(5))

        const [desktop, phone] = view.getAllByRole('button', { name: /Download the receipt/ })
        fireEvent.click(desktop!)
        fireEvent.click(phone!)
        release()

        await waitFor(() => expect(saved).toHaveLength(1))
        expect(calls.filter((call) => call.path === '/receipt')).toHaveLength(1)
    })

    test('names the file from the day of the payment when the browser cannot read the name', async () => {
        receiptReply = () =>
            new Response(new Blob(['%PDF-1.4 test'], { type: 'application/pdf' }), {
                status: 200,
                headers: { 'Content-Type': 'application/pdf' },
            })
        const view = renderBilling()
        await waitFor(() => expect(historyRows(view.container)).toHaveLength(5))

        fireEvent.click(view.getAllByRole('button', { name: /Download the receipt/ })[0]!)

        await waitFor(() => expect(saved).toHaveLength(1))
        expect(saved[0]?.download).toBe('december-receipt-2026-03-11.pdf')
    })

    test('says so when the receipt does not download', async () => {
        receiptReply = () => json({ success: false, message: 'receipt not found' }, 404)
        const view = renderBilling()
        await waitFor(() => expect(historyRows(view.container)).toHaveLength(5))

        fireEvent.click(view.getAllByRole('button', { name: /Download the receipt/ })[0]!)

        await view.findByText('The receipt did not download. Try again.')
        expect(saved).toHaveLength(0)
    })
})

describe('billing page: add credits', () => {
    const openDialog = async () => {
        const view = renderBilling()
        await view.findByTestId('credit-balance')
        fireEvent.click(view.getByRole('button', { name: 'Add credits' }))
        await view.findByLabelText('Amount in US dollars')
        return view
    }

    test('opens with $10 and the INR price at the rate of the server', async () => {
        const view = await openDialog()
        expect((view.getByLabelText('Amount in US dollars') as HTMLInputElement).value).toBe('10')
        expect(view.getByText('From $1 to $50 for each payment.')).toBeTruthy()
        expect(view.getByRole('button', { name: 'Pay ₹900' })).toBeTruthy()
    })

    test('a quick amount fills the box and marks the button as picked', async () => {
        const view = await openDialog()
        fireEvent.click(view.getByRole('button', { name: '$25' }))
        expect((view.getByLabelText('Amount in US dollars') as HTMLInputElement).value).toBe('25')
        expect(view.getByRole('button', { name: '$25' }).getAttribute('aria-pressed')).toBe('true')
        expect(view.getByRole('button', { name: 'Pay ₹2,250' })).toBeTruthy()
    })

    test('an amount out of range says so and Pay is off', async () => {
        const view = await openDialog()
        const input = view.getByLabelText('Amount in US dollars')

        typeInto(input, '51')
        expect(view.getByText('Enter a whole number from $1 to $50.')).toBeTruthy()
        expect((view.getByRole('button', { name: 'Pay $51' }) as HTMLButtonElement).disabled).toBe(
            true
        )

        typeInto(input, '0')
        expect((view.getByRole('button', { name: 'Pay $0' }) as HTMLButtonElement).disabled).toBe(
            true
        )

        // an empty box has no message, and Pay stays off
        typeInto(input, '')
        expect(view.queryByText('Enter a whole number from $1 to $50.')).toBeNull()
        expect((view.getByRole('button', { name: 'Pay $0' }) as HTMLButtonElement).disabled).toBe(
            true
        )
    })

    test('letters and points are removed: only whole dollars', async () => {
        const view = await openDialog()
        const input = view.getByLabelText('Amount in US dollars') as HTMLInputElement
        typeInto(input, '1a2.5')
        expect(input.value).toBe('125')
    })

    test('Pay sends only the cents and opens the checkout of the server order', async () => {
        const view = await openDialog()
        fireEvent.click(view.getByRole('button', { name: 'Pay ₹900' }))

        await waitFor(() => expect(checkouts).toHaveLength(1))
        const order = calls.find((call) => call.path.endsWith('/wallet/order/razorpay'))
        expect(order?.body).toEqual({ amountInCents: 1000 })
        expect(checkouts[0]?.opened).toBe(true)
        expect(checkouts[0]?.options.order_id).toBe('order_1')
        expect(checkouts[0]?.options.amount).toBe(90000)
        expect(checkouts[0]?.options.key).toBe('rzp_test')
    })

    test('two quick submits make one order and one checkout', async () => {
        const view = await openDialog()
        const form = view.getByLabelText('Amount in US dollars').closest('form')!
        fireEvent.submit(form)
        fireEvent.submit(form)

        await waitFor(() => expect(checkouts).toHaveLength(1))
        await new Promise((resolve) => setTimeout(resolve, 20))
        expect(calls.filter((call) => call.path.endsWith('/wallet/order/razorpay'))).toHaveLength(1)
    })

    test('a paid checkout is verified, the dialog closes and the balance updates', async () => {
        const view = await openDialog()
        fireEvent.click(view.getByRole('button', { name: 'Pay ₹900' }))
        await waitFor(() => expect(checkouts).toHaveLength(1))

        void checkouts[0]!.options.handler({
            razorpay_order_id: 'order_1',
            razorpay_payment_id: 'pay_1',
            razorpay_signature: 'sig',
        })
        // the verify, the refresh and the close run one after the other
        await new Promise((resolve) => setTimeout(resolve, 300))
        await waitFor(() => expect(view.queryByLabelText('Amount in US dollars')).toBeNull())
        await waitFor(() => expect(view.getByTestId('credit-balance').textContent).toBe('$50.00'))
        const verify = calls.find((call) => call.path.endsWith('/wallet/verify/razorpay'))
        expect(verify?.body).toEqual({
            razorpay_order_id: 'order_1',
            razorpay_payment_id: 'pay_1',
            razorpay_signature: 'sig',
        })
        // the history is asked again: the new payment shows
        await waitFor(() => expect(transactionCalls().length).toBeGreaterThan(1))
    })

    test('a verify that fails says so, keeps the dialog and lets Pay work again', async () => {
        verifyReply = () => json({ success: false, message: 'invalid razorpay signature' }, 400)
        const view = await openDialog()
        fireEvent.click(view.getByRole('button', { name: 'Pay ₹900' }))
        await waitFor(() => expect(checkouts).toHaveLength(1))

        void checkouts[0]!.options.handler({
            razorpay_order_id: 'order_1',
            razorpay_payment_id: 'pay_1',
            razorpay_signature: 'bad',
        })

        await view.findByText(
            'invalid razorpay signature If you paid, the credits show in a few minutes.'
        )
        expect(view.getByLabelText('Amount in US dollars')).toBeTruthy()
        expect((view.getByRole('button', { name: 'Pay ₹900' }) as HTMLButtonElement).disabled).toBe(
            false
        )
    })

    test('an order the server refuses says so and makes no checkout', async () => {
        orderReply = () => json({ success: false, message: 'Failed to create payment order' }, 502)
        const view = await openDialog()
        fireEvent.click(view.getByRole('button', { name: 'Pay ₹900' }))

        await view.findByText('Failed to create payment order')
        expect(checkouts).toHaveLength(0)
        expect((view.getByRole('button', { name: 'Pay ₹900' }) as HTMLButtonElement).disabled).toBe(
            false
        )
    })

    test('closing the checkout lets the user pay again', async () => {
        const view = await openDialog()
        fireEvent.click(view.getByRole('button', { name: 'Pay ₹900' }))
        await waitFor(() => expect(checkouts).toHaveLength(1))

        checkouts[0]!.options.modal.ondismiss()

        await waitFor(() =>
            expect(
                (view.getByRole('button', { name: 'Pay ₹900' }) as HTMLButtonElement).disabled
            ).toBe(false)
        )
        fireEvent.click(view.getByRole('button', { name: 'Pay ₹900' }))
        await waitFor(() => expect(checkouts).toHaveLength(2))
    })

    test('a checkout script that does not load says so', async () => {
        delete (window as any).Razorpay
        const originalAppend = document.body.appendChild.bind(document.body)
        document.body.appendChild = ((node: Node) => {
            const result = originalAppend(node)
            if (node instanceof HTMLScriptElement) {
                setTimeout(() => node.onerror?.(new Event('error')), 0)
            }
            return result
        }) as typeof document.body.appendChild
        try {
            const view = await openDialog()
            fireEvent.click(view.getByRole('button', { name: 'Pay ₹900' }))
            await view.findByText(
                'Failed to load Razorpay payment SDK. Check your internet connection.'
            )
            expect(calls.some((call) => call.path.endsWith('/wallet/order/razorpay'))).toBe(false)
        } finally {
            document.body.appendChild = originalAppend as typeof document.body.appendChild
        }
    })

    test('the dialog has a title and one grey line, and Cancel closes it', async () => {
        const view = await openDialog()
        expect(view.getAllByText('Add credits').length).toBeGreaterThan(0)
        fireEvent.click(view.getByRole('button', { name: 'Cancel' }))
        await waitFor(() => expect(view.queryByLabelText('Amount in US dollars')).toBeNull())
    })
})

describe('billing page: phones', () => {
    test('the history rows have a phone layout with no wide grid', async () => {
        setPhone(true)
        const view = renderBilling()
        await waitFor(() => expect(historyRows(view.container)).toHaveLength(5))
        const phoneRow = historyRows(view.container)[0]!.querySelector('.md\\:hidden')
        expect(phoneRow).toBeTruthy()
        expect(phoneRow?.className).not.toContain('grid')
        // the date and the status are on the second line of the phone row
        expect(phoneRow?.textContent).toContain('Paid')
        // the desktop grid of the row and of the header is hidden under md: no row shows twice
        expect(view.container.querySelectorAll('[class*="grid-cols-[120px"]')).toHaveLength(6)
        for (const grid of view.container.querySelectorAll('[class*="grid-cols-[120px"]')) {
            expect(grid.className.split(' ')).toContain('hidden')
            expect(grid.className.split(' ')).toContain('md:grid')
            expect(grid.className.split(' ')).not.toContain('grid')
        }
    })

    test('the "Show" control is only for wide screens', async () => {
        items = Array.from({ length: 12 }, (_, index) => item(`tx-${index}`, 'grant'))
        const view = renderBilling()
        await view.findByText('1 of 2')
        const show = view.getByRole('button', { name: 'Rows per page' })
        expect(show.closest('.hidden.md\\:flex')).toBeTruthy()
    })

    test('a one-page history has no pager on phones', async () => {
        const view = renderBilling()
        await waitFor(() => expect(historyRows(view.container)).toHaveLength(5))
        const pager = view.getByText('1 of 1').closest('div.items-center.justify-between')
        expect(pager?.className).toContain('hidden md:flex')
    })

    test('Pay is a full-width button in the phone sheet, with Razorpay under it', async () => {
        setPhone(true)
        const view = renderBilling()
        await view.findByTestId('credit-balance')
        fireEvent.click(view.getByRole('button', { name: 'Add credits' }))
        const pay = await view.findByRole('button', { name: 'Pay ₹900' })
        expect(view.getByText('Razorpay')).toBeTruthy()
        // the sheet has no Cancel button: back and drag close it
        if (pay.className.includes('w-full')) {
            expect(view.queryByRole('button', { name: 'Cancel' })).toBeNull()
        }
    })
})
