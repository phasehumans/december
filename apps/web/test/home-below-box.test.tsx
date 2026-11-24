import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import React from 'react'

if (!globalThis.document) {
    GlobalRegistrator.register()
}

const { render, screen, fireEvent, cleanup, within } = await import('@testing-library/react')
const { MemoryRouter, useLocation } = await import('react-router-dom')
const { useAppStore } = await import('../src/app/store')
const { billingQueryKeys } = await import('../src/features/billing/hooks/useBillingData')
const { HomeHero } = await import('../src/features/home/components/HomeHero')
const { useModelSelection } = await import('../src/features/home/model-selection')
const { peekWorkspaceTabRequest, clearWorkspaceTabRequest } =
    await import('../src/features/preview/lib/workspaceTabRequest')

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

const LocationProbe: React.FC = () => <div data-testid="location">{useLocation().pathname}</div>

interface Scenario {
    githubConnected?: boolean
    creditBalance?: number
    sessions?: unknown[]
    joined?: boolean
    keys?: boolean
}

const renderHome = (scenario: Scenario = {}, onOpenProject = mock((_id: string) => {})) => {
    // the cache answers every request, so nothing goes to the network
    const client = new QueryClient({
        defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    })
    const connected = scenario.githubConnected ?? true
    client.setQueryData(['profile'], { id: 'user-1', githubConnected: connected })
    client.setQueryData(['quickinfo'], { fullName: 'Test', githubConnected: connected })
    client.setQueryData(billingQueryKeys.overview, {
        creditBalance: scenario.creditBalance ?? 500,
    })
    client.setQueryData(['sessions', undefined], { sessions: scenario.sessions ?? sessions })
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
    return { ...view, onOpenProject }
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
    test('Recent shows the 5 newest sessions and opens one on click', () => {
        const { onOpenProject } = renderHome()
        const tabs = screen.getByTestId('home-tabs')
        expect(
            within(tabs)
                .getAllByRole('tab')
                .map((tab) => tab.textContent)
        ).toEqual(['Recent', 'Pull requests', 'Super CrewSoon'])

        expect(within(tabs).getByText('Fix login redirect loop')).not.toBeNull()
        expect(within(tabs).getByText('Running')).not.toBeNull()
        expect(within(tabs).getByText('PR 412 · 2h ago')).not.toBeNull()
        expect(within(tabs).getByText('Search modal redesign')).not.toBeNull()
        // only 5 rows, and search sessions are left out
        expect(within(tabs).queryByText('Sixth session')).toBeNull()
        expect(within(tabs).queryByText('Old search')).toBeNull()

        fireEvent.click(within(tabs).getByText('Refactor billing webhooks'))
        expect(onOpenProject).toHaveBeenCalledWith('s4')
    })

    test('View all opens the full list of the open tab', () => {
        renderHome()
        fireEvent.click(screen.getByText('View all'))
        expect(screen.getByTestId('location').textContent).toBe('/sessions')
    })

    test('Pull requests lists sessions with a pull request and opens the pull request view', () => {
        const { onOpenProject } = renderHome()
        const tabs = screen.getByTestId('home-tabs')
        fireEvent.click(within(tabs).getByRole('tab', { name: 'Pull requests' }))

        expect(within(tabs).getByText('Add CSV export to reports')).not.toBeNull()
        expect(within(tabs).getByText('Open')).not.toBeNull()
        expect(within(tabs).getByText('Merged')).not.toBeNull()
        expect(within(tabs).queryByText('Refactor billing webhooks')).toBeNull()

        fireEvent.click(within(tabs).getByText('Upgrade to React 19'))
        expect(onOpenProject).toHaveBeenCalledWith('s3')
        expect(peekWorkspaceTabRequest()).toBe('pull_requests')

        fireEvent.click(screen.getByText('View all'))
        expect(screen.getByTestId('location').textContent).toBe('/pull-requests')
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

    test('a new account sees one line', () => {
        renderHome({ sessions: [] })
        expect(screen.getByText('No sessions yet.')).not.toBeNull()
        expect(screen.queryByText('View all')).toBeNull()
    })

    test('signed out: nothing below the box', () => {
        useAppStore.setState({ isAuthenticated: false })
        renderHome({ githubConnected: false })
        expect(screen.queryByTestId('home-tabs')).toBeNull()
        expect(screen.queryByTestId('home-status-strip')).toBeNull()
    })
})
