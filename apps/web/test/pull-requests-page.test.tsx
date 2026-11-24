import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import React from 'react'

if (!globalThis.document) {
    GlobalRegistrator.register()
}

const { render, screen, fireEvent, cleanup } = await import('@testing-library/react')
const { MemoryRouter } = await import('react-router-dom')
const { useAppStore } = await import('../src/app/store')
const { getPathForView, getViewForPath } = await import('../src/app/types')
const { peekWorkspaceTabRequest, clearWorkspaceTabRequest } =
    await import('../src/features/preview/lib/workspaceTabRequest')
const { PullRequestsPage } =
    await import('../src/features/pullrequests/components/PullRequestsPage')
const { isOpenPullRequest, toPullRequestRows } =
    await import('../src/features/pullrequests/lib/pullRequests')
const {
    DEFAULT_PULL_REQUESTS_VIEW,
    activePullRequestFilters,
    applyPullRequestsView,
    pullRequestFacets,
    readPullRequestsView,
    writePullRequestsView,
} = await import('../src/features/pullrequests/lib/pullRequestsView')

const base = {
    type: 'WEB' as const,
    createdAt: '2026-11-20T10:00:00.000Z',
    lastMessage: null,
    repoUrl: 'https://github.com/acme/web.git',
    githubRepoName: 'acme/web',
}

const sessions = [
    {
        ...base,
        id: 's1',
        title: 'fix: login redirect loop',
        updatedAt: '2026-11-23T09:00:00.000Z',
        prNumber: 412,
        prState: 'open' as const,
        prBranch: 'fix/login-loop',
    },
    {
        ...base,
        id: 's2',
        title: 'feat: csv export',
        updatedAt: '2026-11-22T09:00:00.000Z',
        prNumber: 409,
        prState: 'merged' as const,
    },
    {
        ...base,
        id: 's3',
        title: 'chore: upgrade react',
        updatedAt: '2026-11-21T09:00:00.000Z',
        prNumber: 77,
        prState: 'draft' as const,
    },
    {
        ...base,
        id: 's4',
        title: 'refactor: billing',
        updatedAt: '2026-11-20T09:00:00.000Z',
        prNumber: 75,
        prState: 'closed' as const,
    },
    { ...base, id: 's5', title: 'No pull request here', updatedAt: '2026-11-23T10:00:00.000Z' },
]

const renderPageWithContainer = (list: unknown[] = sessions, githubConnected = true) => {
    const client = new QueryClient({
        defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    })
    client.setQueryData(
        ['sessions', { limit: 100, sortBy: 'updatedAt', sortOrder: 'desc', hasPr: true }],
        { sessions: list }
    )
    client.setQueryData(['profile'], { id: 'user-1', githubConnected })
    client.setQueryData(['quickinfo'], { fullName: 'Test', githubConnected })
    return render(
        <QueryClientProvider client={client}>
            <MemoryRouter initialEntries={['/pull-requests']}>
                <PullRequestsPage onOpenProject={() => {}} />
            </MemoryRouter>
        </QueryClientProvider>
    )
}

const renderPage = (list: unknown[] = sessions, githubConnected = true) => {
    const client = new QueryClient({
        defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    })
    client.setQueryData(
        ['sessions', { limit: 100, sortBy: 'updatedAt', sortOrder: 'desc', hasPr: true }],
        {
            sessions: list,
        }
    )
    client.setQueryData(['profile'], { id: 'user-1', githubConnected })
    client.setQueryData(['quickinfo'], { fullName: 'Test', githubConnected })
    const onOpenProject = mock((_id: string) => {})
    render(
        <QueryClientProvider client={client}>
            <MemoryRouter initialEntries={['/pull-requests']}>
                <PullRequestsPage onOpenProject={onOpenProject} />
            </MemoryRouter>
        </QueryClientProvider>
    )
    return onOpenProject
}

// the Open side of the All | Open switch (the top bar also has an "Open menu" button)
const openSwitch = () =>
    screen
        .getAllByRole('button', { name: /^Open/ })
        .find((button) => button.hasAttribute('aria-pressed')) as HTMLElement

// focus, change, keyup: typing that works whatever order the test files load react-dom in
const typeInto = (el: HTMLElement, value: string) => {
    fireEvent.focusIn(el)
    fireEvent.change(el, { target: { value } })
    fireEvent.keyUp(el)
    fireEvent.focusOut(el)
}

beforeEach(() => {
    cleanup()
    localStorage.clear()
    useAppStore.setState({ isAuthenticated: true })
    clearWorkspaceTabRequest()
})

afterEach(() => {
    cleanup()
    useAppStore.setState({ isAuthenticated: false })
})

describe('pull request rows', () => {
    test('come from sessions that opened a pull request, newest first', () => {
        const rows = toPullRequestRows(sessions as never)
        expect(rows.map((row) => row.number)).toEqual([412, 409, 77, 75])
        expect(rows[0]).toMatchObject({
            sessionId: 's1',
            repo: 'acme/web',
            state: 'open',
            branch: 'fix/login-loop',
            url: 'https://github.com/acme/web/pull/412',
        })
    })

    test('a saved pull request link wins over the one built from the repository', () => {
        const rows = toPullRequestRows([
            { ...sessions[1], prUrl: 'https://github.com/acme/other/pull/409' },
        ] as never)
        expect(rows[0].url).toBe('https://github.com/acme/other/pull/409')
    })

    test('a draft counts as open', () => {
        const rows = toPullRequestRows(sessions as never)
        expect(rows.filter(isOpenPullRequest).map((row) => row.number)).toEqual([412, 77])
    })
})

describe('pull requests view', () => {
    const rows = toPullRequestRows([
        { ...sessions[0], createdAt: '2026-11-01T10:00:00.000Z', tags: ['bug'] },
        { ...sessions[1], createdAt: '2026-11-10T10:00:00.000Z', githubRepoName: 'acme/api' },
        { ...sessions[2], createdAt: '2026-11-05T10:00:00.000Z' },
        { ...sessions[3], createdAt: '2026-11-20T10:00:00.000Z' },
    ] as never)
    const numbers = (view: object, onlyOpen = false) =>
        applyPullRequestsView(rows, { ...DEFAULT_PULL_REQUESTS_VIEW, ...view }, onlyOpen).map(
            (row) => row.number
        )

    test('the switch, the state rows, repository and tag filter the rows', () => {
        expect(numbers({})).toEqual([412, 409, 77, 75])
        expect(numbers({}, true)).toEqual([412, 77])
        expect(numbers({ merged: true })).toEqual([409])
        expect(numbers({ closed: true })).toEqual([75])
        expect(numbers({ merged: true, closed: true })).toEqual([409, 75])
        expect(numbers({ repo: 'acme/api' })).toEqual([409])
        expect(numbers({ tag: 'bug' })).toEqual([412])
    })

    test('Newest and Oldest go by the created date of the session', () => {
        expect(numbers({ sort: 'newest' })).toEqual([75, 409, 77, 412])
        expect(numbers({ sort: 'oldest' })).toEqual([412, 77, 409, 75])
    })

    test('the menu lists come from the rows, and the button names the filters', () => {
        expect(pullRequestFacets(rows)).toEqual({ repos: ['acme/api', 'acme/web'], tags: ['bug'] })
        expect(
            activePullRequestFilters({
                ...DEFAULT_PULL_REQUESTS_VIEW,
                merged: true,
                repo: 'acme/api',
                tag: 'bug',
            })
        ).toEqual(['Merged', 'api', 'bug'])
    })

    test('the view is saved and read back', () => {
        const view = { ...DEFAULT_PULL_REQUESTS_VIEW, sort: 'oldest' as const, closed: true }
        writePullRequestsView(view)
        expect(readPullRequestsView()).toEqual(view)
        localStorage.setItem('december:pull-requests-view', 'not json')
        expect(readPullRequestsView()).toEqual(DEFAULT_PULL_REQUESTS_VIEW)
    })
})

describe('Pull requests page', () => {
    test('has its own route', () => {
        expect(getViewForPath('/pull-requests')).toBe('pullrequests')
        expect(getPathForView('pullrequests')).toBe('/pull-requests')
    })

    test('lists pull requests, with an All | Open switch in place of the four tabs', () => {
        renderPage()
        expect(screen.getByText('fix: login redirect loop')).not.toBeNull()
        expect(screen.getByText('refactor: billing')).not.toBeNull()
        expect(screen.queryByText('No pull request here')).toBeNull()
        expect(screen.queryByRole('radio', { name: 'Merged' })).toBeNull()

        // open and draft count as open: 2 of the 4
        const open = openSwitch()
        expect(open.textContent).toBe('Open2')
        fireEvent.click(open)
        expect(screen.getByText('fix: login redirect loop')).not.toBeNull()
        expect(screen.getByText('chore: upgrade react')).not.toBeNull()
        expect(screen.queryByText('feat: csv export')).toBeNull()
        expect(screen.queryByText('refactor: billing')).toBeNull()
    })

    test('the sort and filter menu filters by state and turns the switch back to All', () => {
        renderPage()
        fireEvent.click(openSwitch())
        fireEvent.click(screen.getByRole('button', { name: 'Sort and filter' }))
        fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Merged' }))

        expect(screen.getByText('feat: csv export')).not.toBeNull()
        expect(screen.queryByText('fix: login redirect loop')).toBeNull()
        expect(screen.getByRole('button', { name: 'All' }).getAttribute('aria-pressed')).toBe(
            'true'
        )
        expect(screen.getByRole('button', { name: 'Sort and filter' }).textContent).toContain(
            'Merged'
        )
        // the pick is saved for the next visit
        expect(readPullRequestsView().merged).toBe(true)

        // Open on the switch takes Merged off again
        fireEvent.click(openSwitch())
        expect(screen.getByText('fix: login redirect loop')).not.toBeNull()
        expect(readPullRequestsView().merged).toBe(false)
    })

    test('the menu sorts, and rows show the created time under Newest and Oldest', () => {
        renderPage()
        expect(screen.queryByText(/Created/)).toBeNull()
        fireEvent.click(screen.getByRole('button', { name: 'Sort and filter' }))
        fireEvent.click(screen.getByRole('menuitemradio', { name: 'Newest' }))
        // one for each of the 4 rows (the hover text with the full date matches too)
        expect(screen.getAllByText(/Created/).length).toBeGreaterThanOrEqual(4)
    })

    test('the Repository list filters, and no results offers Clear filters', () => {
        renderPage([...sessions.slice(0, 2), { ...sessions[2], githubRepoName: 'acme/api' }])
        fireEvent.click(screen.getByRole('button', { name: 'Sort and filter' }))
        fireEvent.click(screen.getByRole('menuitem', { name: /Repository/ }))
        fireEvent.click(screen.getByRole('menuitemradio', { name: 'api' }))
        expect(screen.getByText('chore: upgrade react')).not.toBeNull()
        expect(screen.queryByText('feat: csv export')).toBeNull()

        // api has no merged pull request
        fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Merged' }))
        expect(screen.getByText('No pull requests found')).not.toBeNull()
        fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }))
        expect(screen.getByText('feat: csv export')).not.toBeNull()
        expect(screen.getByText('chore: upgrade react')).not.toBeNull()
    })

    test('search matches title, branch and number', () => {
        renderPage()
        const search = screen.getByRole('textbox', { name: 'Search pull requests' })
        typeInto(search, 'login-loop')
        expect(screen.getByText('fix: login redirect loop')).not.toBeNull()
        expect(screen.queryAllByText('feat: csv export')).toHaveLength(0)

        typeInto(search, '#409')
        expect(screen.getByText('feat: csv export')).not.toBeNull()

        typeInto(search, 'nothing like this')
        expect(screen.getByText('No pull requests found')).not.toBeNull()
        // search alone is not a filter to clear
        expect(screen.queryByRole('button', { name: 'Clear filters' })).toBeNull()
    })

    test('a row opens its session on the pull request view', () => {
        const onOpenProject = renderPage()
        fireEvent.click(screen.getByText('feat: csv export'))
        expect(onOpenProject).toHaveBeenCalledWith('s2')
        expect(peekWorkspaceTabRequest()).toBe('pull_requests')
    })

    test('the GitHub icon links to the pull request and does not open the session', () => {
        const onOpenProject = renderPage()
        const link = screen.getByLabelText('Open pull request 412 on GitHub')
        expect(link.getAttribute('href')).toBe('https://github.com/acme/web/pull/412')
        fireEvent.click(link)
        expect(onOpenProject).not.toHaveBeenCalled()
    })

    test('empty states', () => {
        renderPage([sessions[4]])
        expect(screen.getByText('No pull requests yet')).not.toBeNull()
        cleanup()

        // not connected: the same box as the empty list, one line, then the button
        const { container } = renderPageWithContainer([], false)
        const title = screen.getByText('Connect GitHub to see pull requests')
        expect(title.tagName).toBe('H2')
        expect(screen.getByText('Connect GitHub').tagName).toBe('A')
        expect(container.querySelector('svg feDisplacementMap')).not.toBeNull()
        // the toolbar stays
        expect(screen.getByRole('textbox', { name: 'Search pull requests' })).not.toBeNull()
    })
})
