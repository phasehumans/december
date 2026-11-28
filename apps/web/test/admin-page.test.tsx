import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, describe, expect, test } from 'bun:test'
import React from 'react'
import { MemoryRouter } from 'react-router-dom'

import { adminAPI } from '../src/features/admin/api/admin'
import { AdminPage } from '../src/features/admin/components/AdminPage'
import { ApiError } from '../src/shared/api/client'

if (!globalThis.document) {
    GlobalRegistrator.register()
}

const { render, cleanup, waitFor, fireEvent } = await import('@testing-library/react')

const renderPage = () =>
    render(
        <QueryClientProvider
            client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
        >
            <MemoryRouter>
                <AdminPage />
            </MemoryRouter>
        </QueryClientProvider>
    )

afterEach(() => {
    cleanup()
})

// focus, change, keyup: typing that works whatever order the test files load react-dom in
const typeInto = (el: HTMLElement, value: string) => {
    fireEvent.focusIn(el)
    fireEvent.change(el, { target: { value } })
    fireEvent.keyUp(el)
    fireEvent.focusOut(el)
}

const askingUser = {
    id: 'user-1',
    name: 'Some One',
    email: 'some.one@gmail.com',
    createdAt: new Date().toISOString(),
    lastActiveAt: null,
    creditBalance: 0,
    disposable: false,
    pendingRequest: {
        id: 'req-1',
        buildPlan: 'a game',
        heardFrom: 'a friend',
        createdAt: new Date().toISOString(),
        signals: {
            accountAgeDays: 0,
            signupMethod: 'email',
            githubUsername: null,
            otherAccountsSameInbox: 2,
            otherRequestsSameIp: 0,
        },
    },
    latestFeedback: null,
}

// the Overview chart (O1) asks for its own data; an empty history unless a test sets one
adminAPI.getTrend = (async (days: number) => ({ days, points: [] })) as any
adminAPI.getVisitors = (async () => ({ connected: false })) as any

const future = () => new Date(Date.now() + 60 * 60 * 1000).toISOString()

const me = (totp: Partial<Record<string, unknown>> = {}) => ({
    id: 'admin-1',
    email: 'admin@example.com',
    name: 'Admin',
    adminPath: '/ops-test',
    totp: { enabled: true, lockedUntil: null, verifiedAt: null, verifiedUntil: future(), ...totp },
})

const overview = {
    signupsToday: 4,
    signups7d: 11,
    activeDay: 9,
    agentsWorking: 2,
    sandboxesRunning: 3,
    creditsSpentTodayCents: 1250,
    paid30dCents: 5000,
    needsYou: { pendingRequests: 1, feedbackWeek: 0, failedJobsDay: 0, unassignedInstalls: 0 },
}

// the server decides who is an admin and whether the code is fresh; the page only follows it
describe('admin page', () => {
    test('a user the server refuses (404) sees no admin sections', async () => {
        adminAPI.getMe = (async () => {
            throw new ApiError('Cannot GET', 404)
        }) as any

        const view = renderPage()
        await waitFor(() => expect(view.getByText('This page is for admins only.')).toBeTruthy())
        expect(view.queryByRole('navigation', { name: 'Admin sections' })).toBeNull()
    })

    test('B5: a server error is not "admins only": it says so and can be tried again', async () => {
        let calls = 0
        adminAPI.getMe = (async () => {
            calls++
            if (calls <= 3) throw new ApiError('Service unavailable', 503)
            return me()
        }) as any
        adminAPI.getOverview = (async () => overview) as any

        const view = renderPage()
        await waitFor(() => expect(view.getByText('Service unavailable')).toBeTruthy(), {
            timeout: 8000,
        })
        expect(view.queryByText('This page is for admins only.')).toBeNull()
        fireEvent.click(view.getByRole('button', { name: 'Try again' }))
        await waitFor(() =>
            expect(view.getByRole('navigation', { name: 'Admin sections' })).toBeTruthy()
        )
    })

    test('B4: when the server asks for the code again, the code screen comes back', async () => {
        let verified = true
        adminAPI.getMe = (async () => me({ verifiedUntil: verified ? future() : null })) as any
        adminAPI.getOverview = (async () => {
            verified = false
            throw new ApiError('Enter the code from your authenticator app', 403, {
                code: 'admin_code_required',
            })
        }) as any

        const view = renderPage()
        await waitFor(() => expect(view.getByText('Enter your code')).toBeTruthy())
        expect(view.queryByRole('navigation', { name: 'Admin sections' })).toBeNull()
    })

    test('B7: a section that fails to draw shows a line, the tabs stay', async () => {
        adminAPI.getMe = (async () => me()) as any
        // an answer in a shape the page does not know
        adminAPI.getOverview = (async () => ({ ...overview, needsYou: undefined })) as any
        const saved = console.error
        console.error = () => {}
        try {
            const view = renderPage()
            await waitFor(() =>
                expect(
                    view.getByText('This section could not be shown', { exact: false })
                ).toBeTruthy()
            )
            expect(view.getByRole('navigation', { name: 'Admin sections' })).toBeTruthy()
        } finally {
            console.error = saved
        }
    })

    test('an admin with no authenticator yet sees the setup, and nothing else', async () => {
        adminAPI.getMe = (async () => me({ enabled: false, verifiedUntil: null })) as any
        let setupCalls = 0
        adminAPI.startTotpSetup = (async () => {
            setupCalls++
            return { qrDataUrl: 'data:image/png;base64,AAAA', key: 'ABCD EFGH' }
        }) as any

        const view = renderPage()
        await waitFor(() =>
            expect(view.getByText('Set up authenticator', { selector: 'h2' })).toBeTruthy()
        )
        expect(view.queryByRole('navigation', { name: 'Admin sections' })).toBeNull()

        fireEvent.click(view.getByRole('button', { name: 'Set up authenticator' }))
        await waitFor(() => expect(view.getByText('ABCD EFGH')).toBeTruthy())
        expect(setupCalls).toBe(1)
    })

    test('an admin whose code ran out enters a new one before seeing anything', async () => {
        let verified = false
        adminAPI.getMe = (async () => me({ verifiedUntil: verified ? future() : null })) as any
        adminAPI.getOverview = (async () => overview) as any
        adminAPI.verifyTotp = (async (code: string) => {
            verified = code === '123456'
            return {}
        }) as any

        const view = renderPage()
        await waitFor(() => expect(view.getByText('Enter your code')).toBeTruthy())
        expect(view.queryByRole('navigation', { name: 'Admin sections' })).toBeNull()

        typeInto(view.getByLabelText('6-digit code'), '123456')
        fireEvent.click(view.getByRole('button', { name: 'Continue' }))
        await waitFor(() =>
            expect(view.getByRole('navigation', { name: 'Admin sections' })).toBeTruthy()
        )
        expect(view.getByText('Signups today')).toBeTruthy()
    })

    test('an admin sees the overview first, with the waiting count on Users', async () => {
        adminAPI.getMe = (async () => me()) as any
        adminAPI.getOverview = (async () => overview) as any

        const view = renderPage()
        await waitFor(() => expect(view.getByText('Agents working now')).toBeTruthy())
        expect(view.getByText('$12.50')).toBeTruthy()
        expect(view.getByText('11 in 7 days')).toBeTruthy()
        expect(view.getByRole('button', { name: /Users\s*1/ })).toBeTruthy()
        // one card for today's numbers; no System state and no chart on Overview
        const today = view.getByRole('region', { name: 'Today' })
        for (const label of [
            'Signups today',
            'Active users, 24 hours',
            'Agents working now',
            'Credits used today',
            'Paid, 30 days',
        ]) {
            expect(today.textContent).toContain(label)
        }
        expect(today.textContent).not.toContain('System')
        expect(view.queryByText('Last 30 days')).toBeNull()
        // M1, M4: no Credits or Feedback tab
        const tabs = view.getByRole('navigation', { name: 'Admin sections' }).textContent
        expect(tabs).not.toContain('Credits')
        expect(tabs).not.toContain('Feedback')
    })

    // the real bug came from <base href="/"> in index.html, which happy-dom does not apply;
    // the browser check is in the admin notes. This keeps the full path in the address
    test('switching tabs and filters keeps the admin path in the address', async () => {
        // happy-dom starts on about:blank, where paths do not resolve
        ;(window as any).happyDOM.setURL('http://localhost:3000/ops-test')
        adminAPI.getMe = (async () => me()) as any
        adminAPI.getOverview = (async () => overview) as any
        adminAPI.listUsers = (async () => ({
            page: 1,
            pageSize: 25,
            total: 0,
            pages: 1,
            items: [],
        })) as any
        try {
            const view = renderPage()
            await waitFor(() => expect(view.getByText('Agents working now')).toBeTruthy())
            fireEvent.click(view.getByRole('button', { name: /^Users/ }))
            expect(window.location.pathname).toBe('/ops-test')
            expect(window.location.hash).toBe('#users')
            fireEvent.click(view.getByRole('tab', { name: /Asked for credits/ }))
            expect(window.location.pathname).toBe('/ops-test')
            expect(window.location.hash).toBe('#users/asked')
        } finally {
            ;(window as any).happyDOM.setURL('about:blank')
        }
    })

    test('Analytics: one chart with every line, two axes, one window up to a year', async () => {
        const asked: number[] = []
        const cards: number[] = []
        window.history.replaceState(null, '', '#analytics')
        adminAPI.getMe = (async () => me()) as any
        adminAPI.getOverview = (async () => overview) as any
        const visitorDays: number[] = []
        adminAPI.getVisitors = (async (days: number) => {
            visitorDays.push(days)
            return {
                connected: true,
                error: null,
                requestedDays: days,
                days: Math.min(days, 90),
                landing: { host: 'trydecember.com', visits: 460, pageViews: 540 },
                app: { host: 'app.trydecember.com', visits: 170, pageViews: 520 },
                signups: 23,
                topPages: [{ path: '/', views: 400 }],
                referrers: [
                    { host: 'Direct', visits: 260 },
                    { host: 'www.google.com', visits: 80 },
                ],
            }
        }) as any
        adminAPI.getAnalytics = (async (days: number) => {
            cards.push(days)
            return {
                days,
                funnel: {
                    signedUp: 4,
                    onboarded: 3,
                    connectedGit: 2,
                    ranAgent: 2,
                    prOpened: 1,
                    prMerged: 1,
                },
                channels: [{ week: '2026-11-23', channel: 'cli', users: 2 }],
                outcomes: {
                    sessions: 10,
                    withPr: 4,
                    merged: 3,
                    closed: 1,
                    failed: 1,
                    medianMergeHours: 5.5,
                    additions: 1200,
                    deletions: 300,
                },
                features: {
                    active: 4,
                    cli: 2,
                    ownKey: 1,
                    githubApp: 0,
                    skills: 1,
                    mcp: 0,
                    planFirst: 2,
                    deep: 1,
                },
                models: [{ model: 'claude-x', calls: 40, cents: 250, ownKeyCalls: 10 }],
                keyProviders: [{ provider: 'openai', users: 1 }],
                signupMethods: { github: 2, google: 1, email: 1 },
                heardFrom: [{ answer: 'twitter', count: 3 }],
                referrals: { joined: 1, credited: 0 },
                active: { day: 1, week: 3, month: 4 },
                cohorts: { sizes: [], cells: [] },
                wallet: [],
                spent: [],
                prWeeks: [],
            }
        }) as any
        adminAPI.getTrend = (async (days: number) => {
            asked.push(days)
            const count = days === 365 ? 52 : days
            return {
                days,
                bucket: days === 365 ? 'week' : 'day',
                points: Array.from({ length: count }, (_, i) => ({
                    day: `2026-11-${String((i % 28) + 1).padStart(2, '0')}`,
                    signups: 1,
                    active: 2,
                    sessions: 3,
                    creditsCents: 150,
                    paidCents: 500,
                })),
            }
        }) as any

        const view = renderPage()
        await waitFor(() => expect(view.getByText('Last 30 days')).toBeTruthy())
        // every line in the legend, all on
        for (const name of [
            'Signups',
            'Active users',
            'Sessions started',
            'Credits used',
            'Paid',
        ]) {
            expect(view.getByRole('button', { name }).getAttribute('aria-pressed')).toBe('true')
        }
        // counts on the left axis, dollars on the right
        expect(view.getAllByText('$5').length).toBeGreaterThanOrEqual(1)
        // a legend item turns its line off
        fireEvent.click(view.getByRole('button', { name: 'Paid' }))
        expect(view.getByRole('button', { name: 'Paid' }).getAttribute('aria-pressed')).toBe(
            'false'
        )
        expect(
            view.getByRole('img', {
                name: 'Signups, Active users, Sessions started, Credits used over 30 days',
            })
        ).toBeTruthy()

        fireEvent.click(view.getByRole('tab', { name: '1 year' }))
        await waitFor(() => expect(view.getByText('Last year, by week')).toBeTruthy())
        expect(asked).toEqual([30, 365])
        // the other cards stop at 90 days
        await waitFor(() => expect(cards).toEqual([30, 90]))
        expect(view.getAllByRole('tab', { name: '7 days' })).toHaveLength(1)
        // the product side: funnel, outcomes, feature use, models, sign up
        for (const text of [
            'Finished onboarding',
            'Connected GitHub or GitLab',
            '40%',
            '5.5 h',
            'Feature use, of 4 active users',
            'claude-x',
            '25% of calls on own keys',
            'Where they heard of December, 3 answers',
            '25%',
        ]) {
            expect(view.getAllByText(text).length).toBeGreaterThanOrEqual(1)
        }
        // C1, C2: website visitors from Cloudflare, capped at its 90 days
        expect(view.getByText('Website, last 90 days (Cloudflare keeps 90)')).toBeTruthy()
        expect(view.getByText('www.google.com')).toBeTruthy()
        expect(view.getByText('5%')).toBeTruthy()
        expect(visitorDays).toEqual([30, 365])
        // A10: no "Signups per day" bars
        expect(view.queryByText('Signups per day')).toBeNull()
        window.history.replaceState(null, '', '#')
    })

    test('an old #credits link opens Users on Asked for credits, and approves there', async () => {
        const approved: string[] = []
        const rejected: Array<[string, string]> = []
        const filters: string[] = []
        window.history.replaceState(null, '', '#credits')
        adminAPI.getMe = (async () => me()) as any
        adminAPI.getOverview = (async () => overview) as any
        adminAPI.getCreditLedger = (async () => ({
            cap: { usedCents: 500, capCents: 5000, userCapCents: 1000 },
            items: [],
        })) as any
        adminAPI.listUsers = (async (_q: string, page: number, filter: string) => {
            filters.push(filter)
            return { page, pageSize: 25, total: 1, pages: 1, items: [askingUser] }
        }) as any
        adminAPI.approveCreditRequest = (async (id: string) => {
            approved.push(id)
            return {}
        }) as any
        adminAPI.rejectCreditRequest = (async (id: string, reason: string) => {
            rejected.push([id, reason])
            return {}
        }) as any

        const view = renderPage()
        await waitFor(() => expect(view.getByText('a game')).toBeTruthy())
        expect(filters.at(-1)).toBe('asked')
        expect(
            view.getByRole('tab', { name: /Asked for credits/ }).getAttribute('aria-selected')
        ).toBe('true')
        expect(view.getByText('2 other accounts, same inbox')).toBeTruthy()

        fireEvent.click(view.getByRole('button', { name: 'Approve $5' }))
        await waitFor(() => expect(approved).toEqual(['req-1']))

        fireEvent.click(view.getByRole('button', { name: 'Reject' }))
        const submit = () =>
            view.getAllByRole('button', { name: 'Reject' }).at(-1) as HTMLButtonElement
        expect(submit().disabled).toBe(true)
        typeInto(view.getByLabelText('Reason'), 'throwaway inbox')
        fireEvent.click(submit())
        await waitFor(() => expect(rejected).toEqual([['req-1', 'throwaway inbox']]))
        window.history.replaceState(null, '', '#')
    })

    test('the Feedback filter shows the latest message under each user', async () => {
        window.history.replaceState(null, '', '#users/feedback')
        adminAPI.getMe = (async () => me()) as any
        adminAPI.getOverview = (async () => overview) as any
        adminAPI.getCreditLedger = (async () => ({
            cap: { usedCents: 0, capCents: 5000, userCapCents: 1000 },
            items: [],
        })) as any
        adminAPI.listUsers = (async (_q: string, page: number) => ({
            page,
            pageSize: 25,
            total: 1,
            pages: 1,
            items: [
                {
                    ...askingUser,
                    pendingRequest: null,
                    latestFeedback: {
                        feedback: 'the diff view is great',
                        rating: 'good',
                        createdAt: new Date().toISOString(),
                    },
                },
            ],
        })) as any

        const view = renderPage()
        await waitFor(() => expect(view.getByText('the diff view is great')).toBeTruthy())
        expect(view.getByRole('button', { name: 'Add credits' })).toBeTruthy()
        window.history.replaceState(null, '', '#')
    })
})
