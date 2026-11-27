import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test'
import React from 'react'

if (!globalThis.document) {
    GlobalRegistrator.register()
}

const { render, screen, fireEvent, cleanup, within } = await import('@testing-library/react')
const { MemoryRouter, useLocation } = await import('react-router-dom')
const { useAppStore } = await import('../src/app/store')
const { billingQueryKeys } = await import('../src/features/billing/hooks/useBillingData')
const { GITLAB_STATUS_KEY } = await import('../src/features/profile/hooks/useGitlabConnection')
const { HomeHero } = await import('../src/features/home/components/HomeHero')
const { useModelSelection } = await import('../src/features/home/model-selection')
const { peekWorkspaceTabRequest, clearWorkspaceTabRequest } =
    await import('../src/features/preview/lib/workspaceTabRequest')
const { sessionAPI } = await import('../src/features/sessions/api/session')
const { homeRecentRows } = await import('../src/features/home/components/HomeTabs')

const now = Date.now()
const minutesAgo = (minutes: number) => new Date(now - minutes * 60_000).toISOString()

const session = (
    id: string,
    title: string,
    minutes: number,
    extra: Record<string, unknown> = {}
) => ({
    id,
    title,
    type: 'WEB',
    createdAt: minutesAgo(minutes),
    updatedAt: minutesAgo(minutes),
    lastMessage: null,
    repoUrl: 'https://github.com/acme/web',
    githubRepoName: 'acme/web',
    ...extra,
})

const sessions = [
    session('s1', 'Fix login redirect loop', 1, { vmStatus: 'RUNNING' }),
    session('s2', 'Add CSV export to reports', 120, { prNumber: 412, prState: 'open' }),
    session('s3', 'Upgrade to React 19', 300, { prNumber: 77, prState: 'merged' }),
    session('s4', 'Refactor billing webhooks', 1500),
    session('s5', 'Search modal redesign', 3000),
    session('s6', 'Sixth session', 4000),
    session('s7', 'Old search', 10, { type: 'SEARCH' }),
]

type FakeSession = ReturnType<typeof session> & Record<string, any>

const working = (row: FakeSession) => row.vmStatus === 'RUNNING' || row.vmStatus === 'PROVISIONING'

// answers like the server: filters, pins first, newest first, the limit
const fakeSessions = (rows: FakeSession[], filters: any = {}) => {
    let list = rows.filter((row) => !filters.type || (row.type ?? 'WEB') === filters.type)
    if (filters.isArchived !== undefined)
        list = list.filter((row) => Boolean(row.isArchived) === filters.isArchived)
    if (filters.vmStatus === 'running') list = list.filter(working)
    if (filters.needsAnswer) list = list.filter((row) => row.needsAnswer)
    list = [...list].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    if (filters.pinnedFirst)
        list = [...list.filter((row) => row.pinnedAt), ...list.filter((row) => !row.pinnedAt)]
    return { sessions: list.slice(0, filters.limit ?? 50) }
}

const fakePullRequests = (rows: FakeSession[], params: any = {}) => {
    const states = params.state ? String(params.state).split(',') : null
    const list = rows
        .filter((row) => row.prNumber != null && row.type !== 'SEARCH')
        .filter((row) => !states || states.includes(row.prState ?? 'open'))
        .map((row) => ({
            sessionId: row.id,
            title: row.title,
            prTitle: null,
            repo: row.githubRepoName,
            prNumber: row.prNumber,
            prState: row.prState ?? 'open',
            prBranch: null,
            prUrl: null,
            additions: null,
            deletions: null,
            updatedAt: row.updatedAt,
            createdAt: row.createdAt,
            tags: [],
        }))
    const limit = params.limit ?? 30
    return {
        pullRequests: list.slice(0, limit),
        pagination: { page: 1, limit, total: list.length, totalPages: 1 },
    }
}

const fakeCounts = (rows: FakeSession[]) => {
    const live = rows.filter((row) => !row.isArchived)
    return {
        running: live.filter(working).length,
        needsAnswer: live.filter((row) => row.needsAnswer).length,
        needsYou: live.filter((row) => working(row) || row.needsAnswer).length,
        openPullRequests: fakePullRequests(live, { state: 'open,draft' }).pagination.total,
        merged: 0,
    }
}

const LocationProbe: React.FC = () => <div data-testid="location">{useLocation().pathname}</div>

interface Scenario {
    githubConnected?: boolean
    gitlabConnected?: boolean
    creditBalance?: number
    sessions?: unknown[]
    joined?: boolean
    keys?: boolean
    /** true while the session list request should fail */
    listFails?: () => boolean
}

const renderHome = (scenario: Scenario = {}, onOpenProject = mock((_id: string) => {})) => {
    // the cache answers every request, so nothing goes to the network
    const client = new QueryClient({
        defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    })
    const connected = scenario.githubConnected ?? true
    client.setQueryData(['profile'], { id: 'user-1', githubConnected: connected })
    client.setQueryData(['quickinfo'], { fullName: 'Test', githubConnected: connected })
    client.setQueryData(GITLAB_STATUS_KEY, {
        available: true,
        connected: scenario.gitlabConnected ?? false,
        username: null,
    })
    client.setQueryData(billingQueryKeys.overview, {
        creditBalance: scenario.creditBalance ?? 500,
    })
    const rows = (scenario.sessions ?? sessions) as FakeSession[]
    client.setQueryData(['sessions', undefined], { sessions: rows })
    const getSessions = spyOn(sessionAPI, 'getSessions').mockImplementation((async (
        filters: any
    ) => {
        if (scenario.listFails?.()) throw new Error('network')
        return fakeSessions(rows, filters)
    }) as any)
    spyOn(sessionAPI, 'getPullRequests').mockImplementation((async (params: any) =>
        fakePullRequests(rows, params)) as any)
    spyOn(sessionAPI, 'getSessionCounts').mockImplementation(async () => fakeCounts(rows))
    client.setQueryData(['byok'], {
        providers: [{ id: 'anthropic', name: 'Anthropic', keyUrl: '' }],
        credentials: scenario.keys
            ? [
                  {
                      provider: 'anthropic',
                      keyHint: 'a1b2',
                      models: ['claude-sonnet-5'],
                      defaultModel: 'claude-sonnet-5',
                      verifiedAt: '2026-11-01T00:00:00.000Z',
                      lastUsedAt: null,
                  },
              ]
            : [],
    })
    client.setQueryData(['waitlist', 'super-crew'], {
        feature: 'super-crew',
        joined: scenario.joined ?? false,
        joinedAt: null,
        popupSeen: true,
        canShowPopup: false,
    })

    const view = render(
        <QueryClientProvider client={client}>
            <MemoryRouter>
                <HomeHero
                    onPromptSubmit={() => {}}
                    onOpenAuth={() => {}}
                    onOpenProject={onOpenProject}
                />
                <LocationProbe />
            </MemoryRouter>
        </QueryClientProvider>
    )
    return { ...view, onOpenProject, getSessions }
}

beforeEach(() => {
    cleanup()
    window.localStorage.removeItem('december:home-tab')
    useModelSelection.getState().reset()
    useAppStore.setState({ isAuthenticated: true })
    clearWorkspaceTabRequest()
})

afterEach(() => {
    cleanup()
    mock.restore()
    useAppStore.setState({ isAuthenticated: false })
})

describe('status strip under the Home prompt box', () => {
    test('nothing needs action: no strip', () => {
        renderHome()
        expect(screen.queryByTestId('home-status-strip')).toBeNull()
    })

    test('GitHub is not connected: one line with Connect', () => {
        renderHome({ githubConnected: false })
        const strip = screen.getByTestId('home-status-strip')
        expect(within(strip).getByText('GitHub is not connected')).not.toBeNull()
        expect(within(strip).getByText('Connect').getAttribute('href')).toContain('github')
    })

    test('GitLab connected: no GitHub line', () => {
        renderHome({ githubConnected: false, gitlabConnected: true })
        expect(screen.queryByTestId('home-status-strip')).toBeNull()
    })

    test('a GitHub install that did not link says why', () => {
        const happyDOM = (window as any).happyDOM
        const before = window.location.href
        happyDOM.setURL('http://localhost/?github=in_use')
        try {
            renderHome({ githubConnected: false })
            const strip = screen.getByTestId('home-status-strip')
            expect(
                within(strip).getByText(
                    'This GitHub install is connected to another December account.'
                )
            ).not.toBeNull()
        } finally {
            happyDOM.setURL(before)
        }
    })

    test('no credits: Add credits opens billing', () => {
        renderHome({ creditBalance: 0 })
        const strip = screen.getByTestId('home-status-strip')
        expect(within(strip).getByText('Credits: $ 0.00')).not.toBeNull()
        fireEvent.click(within(strip).getByText('Add credits'))
        expect(screen.getByTestId('location').textContent).toBe('/settings/billing')
    })

    test('GitHub comes before credits, and only one line shows', () => {
        renderHome({ githubConnected: false, creditBalance: 0 })
        expect(screen.getAllByTestId('home-status-strip')).toHaveLength(1)
        expect(screen.getByText('GitHub is not connected')).not.toBeNull()
        expect(screen.queryByText('Add credits')).toBeNull()
    })

    test('no credits with a saved key: the strip also offers the key', () => {
        renderHome({ creditBalance: 0, keys: true })
        const strip = screen.getByTestId('home-status-strip')
        fireEvent.click(within(strip).getByText('Use your key'))
        expect(useModelSelection.getState()).toMatchObject({
            source: 'OWN_KEY',
            model: 'claude-sonnet-5',
        })
        // the run is now paid by the key, so the strip goes away
        expect(screen.queryByTestId('home-status-strip')).toBeNull()
    })

    test('a run on your own key does not need credits', () => {
        useModelSelection
            .getState()
            .select({ model: 'claude-sonnet-5', provider: 'anthropic', source: 'OWN_KEY' })
        renderHome({ creditBalance: 0, keys: true })
        expect(screen.queryByTestId('home-status-strip')).toBeNull()
    })
})

describe('tabs under the Home prompt box', () => {
    test('Recent: needs an answer, then running, then pinned, then newest; 5 rows', async () => {
        const rows = [
            session('a1', 'Newest idle', 2),
            session('a2', 'Waits for you', 30, { needsAnswer: true, vmStatus: 'STOPPED' }),
            session('a3', 'Runs now', 10, { vmStatus: 'RUNNING' }),
            session('a4', 'Starts now', 5, { vmStatus: 'PROVISIONING' }),
            session('a5', 'Old but pinned', 9000, { pinnedAt: minutesAgo(60) }),
            session('a6', 'Second idle', 60, { prNumber: 412, prState: 'open' }),
            session('a7', 'Third idle', 90),
            session('a8', 'Archived one', 1, { isArchived: true, vmStatus: 'RUNNING' }),
            session('a9', 'Old search', 1, { type: 'SEARCH' }),
        ]
        const { onOpenProject } = renderHome({ sessions: rows })
        const tabs = screen.getByTestId('home-tabs')
        await within(tabs).findByText('Waits for you')

        const titles = within(tabs)
            .getAllByRole('button')
            .map((button) => button.querySelector('.truncate')?.textContent)
            .filter(Boolean)
        expect(titles).toEqual([
            'Waits for you',
            'Starts now',
            'Runs now',
            'Old but pinned',
            'Newest idle',
        ])
        expect(within(tabs).getByText('Needs answer')).not.toBeNull()
        expect(within(tabs).getByText('Running')).not.toBeNull()
        expect(within(tabs).getByText('Starting')).not.toBeNull()
        expect(within(tabs).getByLabelText('Pinned')).not.toBeNull()
        expect(within(tabs).queryByText('Second idle')).toBeNull()
        expect(within(tabs).queryByText('Archived one')).toBeNull()

        fireEvent.click(within(tabs).getByText('Waits for you'))
        expect(onOpenProject).toHaveBeenCalledWith('a2')
    })

    test('nothing runs: the newest sessions fill the rows', async () => {
        renderHome({ sessions: sessions.map((row) => ({ ...row, vmStatus: 'STOPPED' })) })
        const tabs = screen.getByTestId('home-tabs')
        expect(await within(tabs).findByText('PR 412 · 2h ago')).not.toBeNull()
        expect(within(tabs).getByText('Search modal redesign')).not.toBeNull()
        expect(within(tabs).queryByText('Sixth session')).toBeNull()
        expect(within(tabs).queryByText('Old search')).toBeNull()
        expect(screen.queryByTestId('home-tab-count-recent')).toBeNull()
    })

    test('grey counts: sessions that need you, and open pull requests', async () => {
        renderHome({
            sessions: [
                ...sessions,
                session('n1', 'Waits and runs', 3, { needsAnswer: true, vmStatus: 'RUNNING' }),
                session('n2', 'Draft pull request', 3, { prNumber: 9, prState: 'draft' }),
            ],
        })
        // s1 runs, n1 runs and waits: counted once
        expect((await screen.findByTestId('home-tab-count-recent')).textContent).toBe('2')
        // s2 open, n2 draft
        expect(screen.getByTestId('home-tab-count-pull-requests').textContent).toBe('2')
    })

    test('View all opens the full list; phones get it as a row under the list', async () => {
        renderHome()
        await screen.findByText('Fix login redirect loop')
        const [desktop, phone] = screen.getAllByText('View all')
        expect(desktop.className).toContain('hidden sm:block')
        expect(phone.className).toContain('sm:hidden')
        fireEvent.click(phone)
        expect(screen.getByTestId('location').textContent).toBe('/sessions')
    })

    test('Pull requests lists open and draft ones only and opens the pull request view', async () => {
        const { onOpenProject } = renderHome({
            sessions: [
                ...sessions,
                session('d1', 'Draft work', 30, { prNumber: 90, prState: 'draft' }),
            ],
        })
        const tabs = screen.getByTestId('home-tabs')
        fireEvent.click(within(tabs).getByRole('tab', { name: /Pull requests/ }))

        expect(await within(tabs).findByText('Add CSV export to reports')).not.toBeNull()
        expect(within(tabs).getByText('Open')).not.toBeNull()
        expect(within(tabs).getByText('Draft')).not.toBeNull()
        expect(within(tabs).queryByText('Upgrade to React 19')).toBeNull()
        expect(within(tabs).queryByText('Merged')).toBeNull()

        fireEvent.click(within(tabs).getByText('Draft work'))
        expect(onOpenProject).toHaveBeenCalledWith('d1')
        expect(peekWorkspaceTabRequest()).toBe('pull_requests')

        fireEvent.click(screen.getAllByText('View all')[0])
        expect(screen.getByTestId('location').textContent).toBe('/pull-requests')
    })

    test('only merged pull requests: one line, and View all still opens the page', async () => {
        renderHome({
            sessions: [session('m1', 'Merged work', 30, { prNumber: 5, prState: 'merged' })],
        })
        fireEvent.click(screen.getByRole('tab', { name: /Pull requests/ }))
        expect(await screen.findByText('No open pull requests.')).not.toBeNull()
        expect(screen.queryByText('Merged work')).toBeNull()
        fireEvent.click(screen.getAllByText('View all')[0])
        expect(screen.getByTestId('location').textContent).toBe('/pull-requests')
    })

    test('no pull requests ever: one line, no View all', async () => {
        renderHome({ sessions: [session('x1', 'No pull request here', 30)] })
        fireEvent.click(screen.getByRole('tab', { name: /Pull requests/ }))
        expect(await screen.findByText('No pull requests yet.')).not.toBeNull()
        expect(screen.queryByText('View all')).toBeNull()
    })

    test('a failed load says so, and Try again reads the list again', async () => {
        let fails = true
        renderHome({ listFails: () => fails })
        expect(await screen.findByText('Could not load sessions.')).not.toBeNull()
        expect(screen.queryByText('No sessions yet.')).toBeNull()
        fails = false
        fireEvent.click(screen.getByText('Try again'))
        expect(await screen.findByText('Fix login redirect loop')).not.toBeNull()
    })

    test('homeRecentRows keeps each session once and the list order inside a group', () => {
        const a = session('r1', 'A', 1, { vmStatus: 'RUNNING' }) as any
        const b = session('r2', 'B', 2, { vmStatus: 'RUNNING' }) as any
        const c = session('r3', 'C', 3) as any
        expect(homeRecentRows([[], [b, a], [a, c, b]]).map((row) => row.id)).toEqual([
            'r2',
            'r1',
            'r3',
        ])
    })

    test('Super Crew shows the card line and Notify me, or that you are on the list', () => {
        renderHome()
        fireEvent.click(screen.getByRole('tab', { name: /Super Crew/ }))
        expect(
            screen.getByText("Your own team of agents, working while you're away.")
        ).not.toBeNull()
        expect(screen.getByText('Notify me')).not.toBeNull()
        expect(screen.queryByText('View all')).toBeNull()
        cleanup()

        // the tab is remembered, so the next visit opens on Super Crew
        renderHome({ joined: true })
        expect(screen.getByText("You're on the list")).not.toBeNull()
        expect(screen.queryByText('Notify me')).toBeNull()
    })

    test('a new account sees one line', async () => {
        renderHome({ sessions: [] })
        expect(await screen.findByText('No sessions yet.')).not.toBeNull()
        expect(screen.queryByText('View all')).toBeNull()
    })

    test('signed out: nothing below the box', () => {
        useAppStore.setState({ isAuthenticated: false })
        renderHome({ githubConnected: false })
        expect(screen.queryByTestId('home-tabs')).toBeNull()
        expect(screen.queryByTestId('home-status-strip')).toBeNull()
    })
})
