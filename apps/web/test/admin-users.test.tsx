import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import React from 'react'

import { adminAPI, type AdminUserFilter } from '../src/features/admin/api/admin'
import { AdminUsers } from '../src/features/admin/components/AdminUsers'

if (!globalThis.document) {
    GlobalRegistrator.register()
}

const { render, cleanup, waitFor, fireEvent } = await import('@testing-library/react')

// focus, change, keyup: typing that works whatever order the test files load react-dom in
const typeInto = (el: HTMLElement, value: string) => {
    fireEvent.focusIn(el)
    fireEvent.change(el, { target: { value } })
    fireEvent.keyUp(el)
    fireEvent.focusOut(el)
}

const Stateful: React.FC = () => {
    const [filter, setFilter] = React.useState<AdminUserFilter>('all')
    return <AdminUsers filter={filter} onFilter={setFilter} />
}

const renderTab = () =>
    render(
        <QueryClientProvider
            client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
        >
            <Stateful />
        </QueryClientProvider>
    )

const pages: Array<{ q: string; page: number; filter?: string }> = []
const added: Array<{ id: string; cents: number }> = []

beforeEach(() => {
    pages.length = 0
    added.length = 0
    adminAPI.listUsers = (async (q: string, page = 1, filter = 'all') => {
        pages.push({ q, page, filter })
        return {
            page,
            pageSize: 25,
            total: 45,
            pages: 2,
            items: [
                {
                    id: `u${page}`,
                    name: `User ${page}`,
                    email: `user${page}@example.com`,
                    createdAt: new Date().toISOString(),
                    lastActiveAt: null,
                    creditBalance: 250,
                    disposable: page === 1,
                },
            ],
        }
    }) as any
    adminAPI.getCreditLedger = (async () => ({
        cap: { usedCents: 1000, capCents: 5000, userCapCents: 1000 },
        items: [],
    })) as any
    adminAPI.getUser = (async (id: string) => ({
        id,
        name: 'User 1',
        email: 'user1@example.com',
        disposable: true,
        createdAt: new Date().toISOString(),
        lastActiveAt: null,
        account: {
            signupMethod: 'github',
            googleLinked: false,
            emailVerified: true,
            onboarding: 'done',
            onboardingDoneAt: null,
            timezone: 'Asia/Kolkata',
            notifyLevel: 'IMPORTANT',
            notifyEmail: true,
            notifyPush: false,
            digest: '09:00',
            productEmails: true,
            securityAlerts: true,
            lastExport: null,
        },
        defaults: {
            modelSource: 'CREDITS',
            ownKeyModel: null,
            planFirst: false,
            effort: 'deep',
            openPullRequest: true,
            repository: 'last used',
            baseBranch: 'default',
            idleStopMinutes: 10,
            archiveAfterDays: null,
            lowBalanceAlertCents: 100,
            sessionLimitCents: null,
            dayLimitCents: 500,
            blockedTools: 0,
        },
        connected: {
            github: { username: 'octo', appInstalled: true, installations: 2 },
            gitlab: null,
            ownKeys: [
                {
                    provider: 'openai',
                    model: 'gpt-x',
                    verifiedAt: new Date().toISOString(),
                    lastUsedAt: null,
                },
            ],
            skills: 1,
            mcpServers: 0,
            secrets: 3,
            projects: 0,
            pushBrowsers: 0,
        },
        devices: [
            {
                label: 'Chrome on Linux',
                kind: 'web',
                signedInAt: new Date().toISOString(),
                lastActiveAt: new Date().toISOString(),
            },
        ],
        usage: {
            spentCents: 321,
            spent30Cents: 120,
            spentDayCents: 20,
            calls: 40,
            tokens: 12000,
            cliCalls: 7,
            ownKeyCalls: 0,
            firstAt: new Date().toISOString(),
            lastAt: new Date().toISOString(),
            topModels: [{ model: 'claude-x', calls: 9, cents: 300 }],
            daily: [],
        },
        sessions: { total: 4, archived: 1, running: 1, waiting: 0, githubRuns: 0, repos: 2 },
        prs: { opened: 3, merged: 2, closed: 1, additions: 120, deletions: 30 },
        money: {
            balanceCents: 250,
            paidCents: 0,
            freeCents: 500,
            failedPayments: 0,
            wallet: [
                {
                    id: 'w1',
                    provider: 'GRANT',
                    amountInCents: 500,
                    status: 'SUCCESS',
                    createdAt: new Date().toISOString(),
                },
            ],
        },
        referral: { code: null, invitedBy: null, invited: [] },
        creditRequest: {
            id: 'r1',
            status: 'APPROVED',
            buildPlan: 'a todo app',
            heardFrom: 'twitter',
            agreedToFeedback: true,
            rejectReason: null,
            reviewedAt: null,
            createdAt: new Date().toISOString(),
        },
        feedback: {
            total: 1,
            items: [
                {
                    id: 'f1',
                    rating: 'good',
                    feedback: 'love it',
                    createdAt: new Date().toISOString(),
                },
            ],
        },
        adminHistory: [
            {
                id: 'a1',
                action: 'credit_request.approve',
                amountInCents: null,
                createdAt: new Date().toISOString(),
            },
        ],
    })) as any
    adminAPI.adjustCredits = (async (id: string, cents: number) => {
        added.push({ id, cents })
        return {}
    }) as any
})

afterEach(() => {
    cleanup()
})

describe('admin users tab', () => {
    test('a table of name, email, last active and balance, with the limit left today', async () => {
        const view = renderTab()
        await waitFor(() => expect(view.getByText('user1@example.com')).toBeTruthy())
        for (const header of ['Name', 'Email', 'Last active', 'Balance']) {
            expect(view.getByText(header)).toBeTruthy()
        }
        expect(view.getByText('User 1')).toBeTruthy()
        expect(view.getByText('$2.50')).toBeTruthy()
        expect(view.getByText('never')).toBeTruthy()
        expect(view.getByText(/You can add \$40\.00 more today/)).toBeTruthy()
        expect(view.queryByText(/keys/)).toBeNull()
        expect(view.queryByText(/sessions/)).toBeNull()
    })

    test('25 a page: "Showing 1–25 of 45 users", then Prev, page numbers and Next', async () => {
        const view = renderTab()
        await waitFor(() => expect(view.getByText('user1@example.com')).toBeTruthy())
        const nav = () => view.getByRole('navigation', { name: 'Pages' })
        expect(nav().textContent).toContain('Showing 1–25 of 45 users')
        expect(
            (view.getByRole('button', { name: 'Previous page' }) as HTMLButtonElement).disabled
        ).toBe(true)

        fireEvent.click(view.getByRole('button', { name: '2' }))
        await waitFor(() => expect(view.getByText('user2@example.com')).toBeTruthy())
        expect(pages.at(-1)).toEqual({ q: '', page: 2, filter: 'all' })
        expect(nav().textContent).toContain('Showing 26–45 of 45 users')
        expect(
            (view.getByRole('button', { name: 'Next page' }) as HTMLButtonElement).disabled
        ).toBe(true)

        fireEvent.click(view.getByRole('button', { name: 'Previous page' }))
        await waitFor(() => expect(view.getByText('user1@example.com')).toBeTruthy())
        expect(pages.at(-1)).toEqual({ q: '', page: 1, filter: 'all' })
    })

    test('add credits opens a popup that asks for the dollars only', async () => {
        const view = renderTab()
        await waitFor(() => expect(view.getByText('user1@example.com')).toBeTruthy())
        fireEvent.click(view.getAllByRole('button', { name: 'Add credits' })[0]!)
        const dialog = view.getByRole('dialog', { name: 'Add credits for user1@example.com' })
        expect(view.queryByLabelText('Reason')).toBeNull()
        typeInto(view.getByLabelText('Dollars to add'), '5')
        fireEvent.click(view.getByRole('button', { name: 'Add $5.00' }))
        await waitFor(() => expect(added).toEqual([{ id: 'u1', cents: 500 }]))
        await waitFor(() => expect(view.queryByRole('dialog')).toBeNull())
        expect(dialog).toBeTruthy()
    })

    test('the popup closes on Cancel without adding', async () => {
        const view = renderTab()
        await waitFor(() => expect(view.getByText('user1@example.com')).toBeTruthy())
        fireEvent.click(view.getAllByRole('button', { name: 'Add credits' })[0]!)
        fireEvent.click(view.getByRole('button', { name: 'Cancel' }))
        expect(view.queryByRole('dialog')).toBeNull()
        expect(added).toEqual([])
    })

    test('filters: picking one reloads page 1 with that filter', async () => {
        const view = renderTab()
        await waitFor(() => expect(view.getByText('user1@example.com')).toBeTruthy())
        fireEvent.click(view.getByRole('tab', { name: /Asked for credits/ }))
        await waitFor(() => expect(pages.at(-1)).toEqual({ q: '', page: 1, filter: 'asked' }))
    })

    test('new and disposable tags, and a copy button for the email', async () => {
        const view = renderTab()
        await waitFor(() => expect(view.getByText('user1@example.com')).toBeTruthy())
        expect(view.getByText('new')).toBeTruthy()
        expect(view.getByText('disposable')).toBeTruthy()
        const copied: string[] = []
        Object.defineProperty(navigator, 'clipboard', {
            value: { writeText: async (text: string) => void copied.push(text) },
            configurable: true,
        })
        fireEvent.click(view.getByRole('button', { name: 'Copy user1@example.com' }))
        await waitFor(() => expect(copied).toEqual(['user1@example.com']))
        expect(view.queryByRole('dialog')).toBeNull()
    })

    test('a click on a user opens the card with everything, no buttons but the x', async () => {
        const view = renderTab()
        await waitFor(() => expect(view.getByText('user1@example.com')).toBeTruthy())
        fireEvent.click(view.getByRole('button', { name: 'Details for user1@example.com' }))
        const card = await waitFor(() =>
            view.getByRole('dialog', { name: 'Details for user1@example.com' })
        )
        await waitFor(() => expect(view.getByText('Chrome on Linux')).toBeTruthy())
        for (const text of [
            '$3.21',
            '2 of 3',
            'octo · app on 2',
            'gpt-x · used never',
            'a todo app',
            'love it',
            '9 calls · $3.00',
            'Approved the $5 request',
            '+120',
            '09:00',
        ]) {
            expect(view.getByText(text)).toBeTruthy()
        }
        // repositories are a count only
        expect(view.getByText('Repositories').nextElementSibling?.textContent).toBe('2')
        // no Add credits or Close button at the bottom, only the x
        const buttons = [...card.querySelectorAll('button')].map(
            (b) => b.getAttribute('aria-label') ?? b.textContent
        )
        expect(buttons).not.toContain('Add credits')
        expect(buttons).toContain('Close')
        expect(card.innerHTML).not.toContain('border-t')
        fireEvent.click(view.getByRole('button', { name: 'Close' }))
        expect(view.queryByRole('dialog')).toBeNull()
    })

    test('on a phone each user is a row, not a wide table', async () => {
        const saved = window.matchMedia
        window.matchMedia = ((query: string) => ({
            matches: query === '(max-width: 767px)',
            media: query,
            addEventListener: () => {},
            removeEventListener: () => {},
        })) as any
        try {
            const view = renderTab()
            await waitFor(() => expect(view.getByText('user1@example.com')).toBeTruthy())
            expect(view.container.querySelector('table')).toBeNull()
            expect(view.getByText('Never active')).toBeTruthy()
            fireEvent.click(view.getByRole('button', { name: 'Add credits' }))
            expect(
                view.getByRole('dialog', { name: 'Add credits for user1@example.com' })
            ).toBeTruthy()
        } finally {
            window.matchMedia = saved
        }
    })

    test('B3: a page past the end (its last row was just handled) goes back a page', async () => {
        adminAPI.listUsers = (async (q: string, page = 1, filter = 'all') => {
            pages.push({ q, page, filter })
            // page 2 emptied out: 25 users left, one page
            return {
                page,
                pageSize: 25,
                total: 25,
                pages: 1,
                items:
                    page === 1
                        ? [
                              {
                                  id: 'u1',
                                  name: 'User 1',
                                  email: 'user1@example.com',
                                  createdAt: new Date().toISOString(),
                                  lastActiveAt: null,
                                  creditBalance: 0,
                                  disposable: false,
                                  pendingRequest: null,
                                  latestFeedback: null,
                              },
                          ]
                        : [],
            }
        }) as any
        const view = renderTab()
        await waitFor(() => expect(view.getByText('user1@example.com')).toBeTruthy())
        expect(pages.every((p) => p.page === 1)).toBe(true)
    })
})
