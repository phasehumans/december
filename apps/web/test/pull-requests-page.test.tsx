import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test'
import React from 'react'

if (!globalThis.document) {
    GlobalRegistrator.register()
}

const { render, screen, fireEvent, cleanup, waitFor } = await import('@testing-library/react')
const { MemoryRouter } = await import('react-router-dom')
const { useAppStore } = await import('../src/app/store')
const { getPathForView, getViewForPath } = await import('../src/app/types')
const { notificationAPI } = await import('../src/features/notification/api/notification')
const { peekWorkspaceTabRequest, clearWorkspaceTabRequest } =
    await import('../src/features/preview/lib/workspaceTabRequest')
const { PullRequestsPage } =
    await import('../src/features/pullrequests/components/PullRequestsPage')
const { toPullRequestRows } = await import('../src/features/pullrequests/lib/pullRequests')
const {
    DEFAULT_PULL_REQUESTS_VIEW,
    activePullRequestFilters,
    pullRequestsViewParams,
    readPullRequestsView,
    writePullRequestsView,
} = await import('../src/features/pullrequests/lib/pullRequestsView')
const { sessionAPI } = await import('../src/features/sessions/api/session')

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

// the rows GET /session/pull-requests returns for these sessions (#632)
const asPullRequests = (list: any[]) =>
    list
        .filter((session) => session.prNumber != null)
        .map((session) => ({
            sessionId: session.id,
            title: session.title,
            tags: session.tags ?? [],
            gitProvider: (session.gitProvider ?? 'GITHUB') as 'GITHUB' | 'GITLAB',
            repo: session.githubRepoName ?? null,
            prNumber: session.prNumber,
            prState: session.prState ?? 'open',
            prTitle: null,
            prUrl:
                session.prUrl ??
                `https://github.com/${session.githubRepoName}/pull/${session.prNumber}`,
            prBranch: session.prBranch ?? null,
            additions: session.additions ?? null,
            deletions: session.deletions ?? null,
            prOpenedAt: session.prOpenedAt ?? null,
            prMergedAt: null,
            prClosedAt: null,
            prUpdatedAt: session.prUpdatedAt ?? null,
            createdAt: session.createdAt,
            updatedAt: session.updatedAt,
        }))

type ListParams = Parameters<typeof sessionAPI.getPullRequests>[0]

const time = (iso: string | null) => (iso ? new Date(iso).getTime() : 0)

/** a small fake server: it filters, sorts and pages like GET /session/pull-requests */
const serve = (list: any[]) => async (params: ListParams) => {
    const states = params.state?.split(',')
    const needle = params.search?.toLowerCase().replace(/^#/, '')
    const rows = asPullRequests(list)
        .filter(
            (pr) =>
                (!states || states.includes(pr.prState)) &&
                (!params.repo || pr.repo === params.repo) &&
                (!params.tag || pr.tags.includes(params.tag)) &&
                (!needle ||
                    [pr.title, pr.prBranch, pr.repo, String(pr.prNumber)].some((value) =>
                        (value || '').toLowerCase().includes(needle)
                    ))
        )
        .sort((a, b) => {
            const by = (pr: typeof a) =>
                params.sortBy === 'prOpenedAt'
                    ? time(pr.prOpenedAt ?? pr.createdAt)
                    : params.sortBy === 'prUpdatedAt'
                      ? time(pr.prUpdatedAt ?? pr.updatedAt)
                      : time(pr.updatedAt)
            return params.sortOrder === 'asc' ? by(a) - by(b) : by(b) - by(a)
        })
    const limit = params.limit ?? 50
    // the real cursor holds the last row's sort values; here the offset is enough
    const start = params.cursor ? Number(params.cursor) : ((params.page ?? 1) - 1) * limit
    const end = start + limit
    return {
        pullRequests: rows.slice(start, end),
        pagination: {
            page: params.page ?? 1,
            limit,
            total: rows.length,
            totalPages: Math.ceil(rows.length / limit),
            nextCursor: end < rows.length ? String(end) : null,
        },
    }
}

let getPullRequests: ReturnType<typeof spyOn>
let getSessionFacets: ReturnType<typeof spyOn>

/** the list requests so far, without the paging fields */
const requests = () =>
    getPullRequests.mock.calls.map((call: any[]) => {
        const { page: _page, limit: _limit, ...rest } = call[0]
        return rest
    })
const lastRequest = () => requests().at(-1)

const renderPage = (
    list: unknown[] = sessions,
    options: {
        githubConnected?: boolean
        gitlabConnected?: boolean
        open?: number
        facets?: object
        /** the Open count the first page of the list brings */
        listOpenCount?: number
    } = {}
) => {
    const { githubConnected = true, gitlabConnected = false, open = 2, facets } = options
    const served = serve(list as any[])
    getPullRequests = spyOn(sessionAPI, 'getPullRequests').mockImplementation((async (
        params: ListParams
    ) => {
        const page = await served(params)
        return options.listOpenCount === undefined || params.cursor
            ? page
            : { ...page, openCount: options.listOpenCount }
    }) as any)
    getSessionFacets = spyOn(sessionAPI, 'getSessionFacets').mockImplementation(
        async () => (facets ?? { repos: ['acme/api', 'acme/web'], tags: ['bug'] }) as any
    )
    spyOn(sessionAPI, 'getSessionCounts').mockImplementation(async () => ({
        running: 0,
        needsAnswer: 0,
        needsYou: 0,
        openPullRequests: open,
        merged: 0,
    }))
    spyOn(sessionAPI, 'getSessions').mockImplementation(async () => ({ sessions: [] }))
    spyOn(notificationAPI, 'getUnreadCount').mockImplementation(async () => ({ count: 0 }))

    const client = new QueryClient({
        defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    })
    client.setQueryData(['profile'], { id: 'user-1', githubConnected })
    client.setQueryData(['quickinfo'], { fullName: 'Test', githubConnected })
    client.setQueryData(['integrations', 'gitlab'], {
        available: true,
        connected: gitlabConnected,
        username: gitlabConnected ? 'tester' : null,
    })
    const onOpenProject = mock((_id: string) => {})
    const view = render(
        <QueryClientProvider client={client}>
            <MemoryRouter initialEntries={['/pull-requests']}>
                <PullRequestsPage onOpenProject={onOpenProject} />
            </MemoryRouter>
        </QueryClientProvider>
    )
    return { onOpenProject, container: view.container }
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

const gone = (text: string) => waitFor(() => expect(screen.queryAllByText(text).length).toBe(0))

beforeEach(() => {
    cleanup()
    localStorage.clear()
    useAppStore.setState({ isAuthenticated: true })
    clearWorkspaceTabRequest()
})

afterEach(() => {
    cleanup()
    mock.restore()
    useAppStore.setState({ isAuthenticated: false })
})

describe('pull request rows', () => {
    test('keep the order of the server, with the saved details', () => {
        const rows = toPullRequestRows(asPullRequests([sessions[2], sessions[0], sessions[1]]))
        expect(rows.map((row) => row.number)).toEqual([77, 412, 409])
        expect(rows[1]).toMatchObject({
            sessionId: 's1',
            repo: 'acme/web',
            state: 'open',
            branch: 'fix/login-loop',
            url: 'https://github.com/acme/web/pull/412',
        })
    })

    test('a saved pull request link wins over the one built from the repository', () => {
        const rows = toPullRequestRows(
            asPullRequests([{ ...sessions[1], prUrl: 'https://github.com/acme/other/pull/409' }])
        )
        expect(rows[0].url).toBe('https://github.com/acme/other/pull/409')
    })

    test('a link that is not a web link is dropped, so it never reaches an href', () => {
        const rows = toPullRequestRows(
            asPullRequests([
                { ...sessions[0], prUrl: 'javascript:alert(1)' },
                { ...sessions[1], prUrl: ' data:text/html,hi' },
            ])
        )
        expect(rows.map((row) => row.url)).toEqual([null, null])
    })

    test('the updated date is the last change of the pull request, the session date before', () => {
        const rows = toPullRequestRows(
            asPullRequests([
                { ...sessions[0], prUpdatedAt: '2026-11-25T09:00:00.000Z' },
                sessions[1],
            ])
        )
        expect(rows.map((row) => row.updatedAt)).toEqual([
            '2026-11-25T09:00:00.000Z',
            sessions[1].updatedAt,
        ])
    })

    test('a session that comes twice (a row moved between pages) shows once', () => {
        const rows = toPullRequestRows(asPullRequests([sessions[0], sessions[1], sessions[0]]))
        expect(rows.map((row) => row.sessionId)).toEqual(['s1', 's2'])
    })

    test('the row knows its host', () => {
        const rows = toPullRequestRows(
            asPullRequests([sessions[0], { ...sessions[1], gitProvider: 'GITLAB' }])
        )
        expect(rows.map((row) => row.gitProvider)).toEqual(['GITHUB', 'GITLAB'])
    })

    test('the row date is the opened date, the session date for old rows', () => {
        const rows = toPullRequestRows(
            asPullRequests([
                { ...sessions[0], prOpenedAt: '2026-11-21T08:00:00.000Z' },
                sessions[1],
            ])
        )
        expect(rows.map((row) => row.createdAt)).toEqual([
            '2026-11-21T08:00:00.000Z',
            '2026-11-20T10:00:00.000Z',
        ])
    })
})

describe('pull requests view', () => {
    const params = (view: object, onlyOpen = false, search = '') =>
        pullRequestsViewParams({ ...DEFAULT_PULL_REQUESTS_VIEW, ...view }, onlyOpen, search)

    test('the switch and the state rows go to the server as the state filter', () => {
        expect(params({}).state).toBeUndefined()
        // a draft is still open
        expect(params({}, true).state).toBe('open,draft')
        expect(params({ merged: true }).state).toBe('merged')
        expect(params({ closed: true }).state).toBe('closed')
        expect(params({ merged: true, closed: true }).state).toBe('merged,closed')
    })

    test('repository, tag and search go to the server, and nothing is sent when they are off', () => {
        expect(params({})).toEqual({
            state: undefined,
            repo: undefined,
            tag: undefined,
            search: undefined,
            sortBy: 'prUpdatedAt',
            sortOrder: 'desc',
        })
        expect(params({ repo: 'acme/api', tag: 'bug' }, false, '  #409 ')).toMatchObject({
            repo: 'acme/api',
            tag: 'bug',
            search: '#409',
        })
    })

    test('Newest and Oldest sort by the opened date', () => {
        expect(params({ sort: 'updated' })).toMatchObject({
            sortBy: 'prUpdatedAt',
            sortOrder: 'desc',
        })
        expect(params({ sort: 'newest' })).toMatchObject({
            sortBy: 'prOpenedAt',
            sortOrder: 'desc',
        })
        expect(params({ sort: 'oldest' })).toMatchObject({ sortBy: 'prOpenedAt', sortOrder: 'asc' })
    })

    test('the button names the filters that are on', () => {
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

    test('lists pull requests, with an All | Open switch in place of the four tabs', async () => {
        // the server counts 7 open pull requests; only 2 of them are on this page
        renderPage(sessions, { open: 7 })
        expect(await screen.findByText('fix: login redirect loop')).not.toBeNull()
        expect(screen.getByText('refactor: billing')).not.toBeNull()
        expect(screen.queryAllByText('No pull request here').length).toBe(0)
        expect(screen.queryAllByRole('radio', { name: 'Merged' }).length).toBe(0)
        // the first request: last updated first, 30 rows, no filter
        expect(getPullRequests.mock.calls[0][0]).toEqual({
            state: undefined,
            repo: undefined,
            tag: undefined,
            search: undefined,
            sortBy: 'prUpdatedAt',
            sortOrder: 'desc',
            page: 1,
            limit: 30,
        })

        // the count beside Open is the server count, not the loaded rows
        await waitFor(() => expect(openSwitch().textContent).toBe('Open7'))
        fireEvent.click(openSwitch())
        // open and draft count as open; the server filters
        await gone('feat: csv export')
        expect(lastRequest().state).toBe('open,draft')
        expect(screen.getByText('fix: login redirect loop')).not.toBeNull()
        expect(screen.getByText('chore: upgrade react')).not.toBeNull()
        expect(screen.queryAllByText('refactor: billing').length).toBe(0)
    })

    test('the sort and filter menu filters by state and turns the switch back to All', async () => {
        renderPage()
        await screen.findByText('fix: login redirect loop')
        fireEvent.click(openSwitch())
        fireEvent.click(screen.getByRole('button', { name: 'Sort and filter' }))
        fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Merged' }))

        await gone('fix: login redirect loop')
        expect(lastRequest().state).toBe('merged')
        expect(screen.getByText('feat: csv export')).not.toBeNull()
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
        expect(await screen.findByText('fix: login redirect loop')).not.toBeNull()
        // the open rows again (asked before, so the page has them)
        expect(screen.queryAllByText('feat: csv export').length).toBe(0)
        expect(readPullRequestsView().merged).toBe(false)
    })

    test('the menu sorts on the server, and rows show the opened time under Newest and Oldest', async () => {
        renderPage([
            { ...sessions[0], prOpenedAt: '2026-11-01T10:00:00.000Z' },
            { ...sessions[1], prOpenedAt: '2026-11-10T10:00:00.000Z' },
        ])
        await screen.findByText('fix: login redirect loop')
        expect(screen.queryAllByText(/Opened/).length).toBe(0)
        const titles = () =>
            screen
                .getAllByText(/^(fix: login redirect loop|feat: csv export)$/)
                .map((el) => el.textContent)
        expect(titles()).toEqual(['fix: login redirect loop', 'feat: csv export'])

        fireEvent.click(screen.getByRole('button', { name: 'Sort and filter' }))
        fireEvent.click(screen.getByRole('menuitemradio', { name: 'Newest' }))
        // one for each of the 2 rows (the hover text with the full date matches too)
        await waitFor(() => expect(screen.getAllByText(/Opened/).length).toBeGreaterThanOrEqual(2))
        expect(lastRequest()).toMatchObject({ sortBy: 'prOpenedAt', sortOrder: 'desc' })
        await waitFor(() =>
            expect(titles()).toEqual(['feat: csv export', 'fix: login redirect loop'])
        )

        fireEvent.click(screen.getByRole('menuitemradio', { name: 'Oldest' }))
        await waitFor(() =>
            expect(titles()).toEqual(['fix: login redirect loop', 'feat: csv export'])
        )
        expect(lastRequest()).toMatchObject({ sortBy: 'prOpenedAt', sortOrder: 'asc' })
    })

    test('the Repository and Tag lists come from the server, for sessions with a pull request', async () => {
        renderPage(sessions, {
            // "archive" and "old-tag" are on no loaded row
            facets: { repos: ['acme/archive', 'acme/web'], tags: ['bug', 'old-tag'] },
        })
        await screen.findByText('fix: login redirect loop')
        expect(getSessionFacets.mock.calls[0][0]).toEqual({ hasPr: true })

        fireEvent.click(screen.getByRole('button', { name: 'Sort and filter' }))
        fireEvent.click(await screen.findByRole('menuitem', { name: /Repository/ }))
        expect(screen.getByRole('menuitemradio', { name: 'archive' })).not.toBeNull()
        expect(screen.getByRole('menuitemradio', { name: 'web' })).not.toBeNull()
        fireEvent.click(screen.getByRole('menuitem', { name: /Tag/ }))
        expect(screen.getByRole('menuitemradio', { name: 'old-tag' })).not.toBeNull()

        fireEvent.click(screen.getByRole('menuitemradio', { name: 'bug' }))
        await waitFor(() => expect(lastRequest().tag).toBe('bug'))
    })

    test('the Repository list filters on the server, and no results offers Clear filters', async () => {
        renderPage([...sessions.slice(0, 2), { ...sessions[2], githubRepoName: 'acme/api' }])
        await screen.findByText('fix: login redirect loop')
        fireEvent.click(screen.getByRole('button', { name: 'Sort and filter' }))
        fireEvent.click(await screen.findByRole('menuitem', { name: /Repository/ }))
        fireEvent.click(screen.getByRole('menuitemradio', { name: 'api' }))
        await gone('feat: csv export')
        expect(lastRequest().repo).toBe('acme/api')
        expect(screen.getByText('chore: upgrade react')).not.toBeNull()

        // api has no merged pull request
        fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Merged' }))
        expect(await screen.findByText('No pull requests found')).not.toBeNull()
        expect(lastRequest()).toMatchObject({ repo: 'acme/api', state: 'merged' })
        fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }))
        expect(await screen.findByText('feat: csv export')).not.toBeNull()
        expect(screen.getByText('chore: upgrade react')).not.toBeNull()
        // every row is back, and the saved view has no filter
        expect(screen.getByText('fix: login redirect loop')).not.toBeNull()
        expect(readPullRequestsView()).toMatchObject({ merged: false, repo: null })
    })

    test('search goes to the server and matches title, branch and number', async () => {
        renderPage()
        await screen.findByText('fix: login redirect loop')
        const search = screen.getByRole('textbox', { name: 'Search pull requests' })
        typeInto(search, 'login-loop')
        await gone('feat: csv export')
        expect(lastRequest().search).toBe('login-loop')
        expect(screen.getByText('fix: login redirect loop')).not.toBeNull()

        typeInto(search, '#409')
        expect(await screen.findByText('feat: csv export')).not.toBeNull()
        expect(lastRequest().search).toBe('#409')

        typeInto(search, 'nothing like this')
        expect(await screen.findByText('No pull requests found')).not.toBeNull()
        // search alone is not a filter to clear
        expect(screen.queryAllByRole('button', { name: 'Clear filters' }).length).toBe(0)
    })

    const manyPullRequests = () =>
        Array.from({ length: 35 }, (_, index) => ({
            ...base,
            id: `many-${index}`,
            title: `pull request ${index + 1}`,
            // 1 is the last updated
            updatedAt: new Date(Date.UTC(2026, 10, 23, 12, 0) - index * 60_000).toISOString(),
            prNumber: 500 + index,
            prState: 'open' as const,
        }))

    // happy-dom lays nothing out: the scroll box gets the sizes a browser would give it
    const setBoxSize = (
        box: HTMLElement,
        size: { scrollHeight: number; clientHeight: number; scrollTop: number }
    ) => {
        for (const [key, value] of Object.entries(size)) {
            Object.defineProperty(box, key, { configurable: true, get: () => value })
        }
    }

    test('more rows load on scroll, 30 at a time', async () => {
        const { container } = renderPage(manyPullRequests())
        const box = container.firstElementChild as HTMLElement
        // 30 rows are taller than the screen
        setBoxSize(box, { scrollHeight: 2000, clientHeight: 800, scrollTop: 0 })
        await screen.findByText('pull request 1')
        expect(screen.getByText('pull request 30')).not.toBeNull()
        expect(screen.queryAllByText('pull request 31').length).toBe(0)

        // the page scrolls inside its own box, to near the end
        setBoxSize(box, { scrollHeight: 2000, clientHeight: 800, scrollTop: 1150 })
        fireEvent.scroll(box)
        expect(await screen.findByText('pull request 35')).not.toBeNull()
        expect(getPullRequests.mock.calls.at(-1)[0]).toMatchObject({ cursor: '30', limit: 30 })

        // every row is loaded: another scroll asks for nothing
        const calls = getPullRequests.mock.calls.length
        fireEvent.scroll(box)
        expect(getPullRequests.mock.calls.length).toBe(calls)
    })

    test('on a tall screen the next rows load when the first ones fit with no scroll', async () => {
        const { container } = renderPage(manyPullRequests())
        // the screen is taller than 30 rows: no scroll bar, so no scroll ever comes
        setBoxSize(container.firstElementChild as HTMLElement, {
            scrollHeight: 900,
            clientHeight: 1400,
            scrollTop: 0,
        })
        expect(await screen.findByText('pull request 35')).not.toBeNull()
        expect(getPullRequests.mock.calls.at(-1)[0]).toMatchObject({ cursor: '30', limit: 30 })
    })

    test('a row opens its session on the pull request view', async () => {
        const { onOpenProject } = renderPage()
        fireEvent.click(await screen.findByText('feat: csv export'))
        expect(onOpenProject).toHaveBeenCalledWith('s2')
        expect(peekWorkspaceTabRequest()).toBe('pull_requests')
    })

    test('the GitHub icon links to the pull request and does not open the session', async () => {
        const { onOpenProject } = renderPage()
        const link = await screen.findByLabelText('Open pull request 412 on GitHub')
        expect(link.getAttribute('href')).toBe('https://github.com/acme/web/pull/412')
        fireEvent.click(link)
        expect(onOpenProject).not.toHaveBeenCalled()
    })

    test('the Open count comes with the rows when the server sends it', async () => {
        // the counts query says 2; the list, read after the host was asked, says 5
        renderPage(sessions, { open: 2, listOpenCount: 5 })
        await screen.findByText('fix: login redirect loop')
        await waitFor(() => expect(openSwitch().textContent).toBe('Open5'))
    })

    test('the search box takes no more than the server does', async () => {
        renderPage()
        const box = screen.getByRole('textbox', { name: 'Search pull requests' })
        expect(box.getAttribute('maxlength')).toBe('200')
    })

    test('a GitLab row names GitLab on its link', async () => {
        renderPage([{ ...sessions[0], gitProvider: 'GITLAB' }])
        expect(await screen.findByLabelText('Open pull request 412 on GitLab')).not.toBeNull()
        expect(screen.queryAllByLabelText('Open pull request 412 on GitHub').length).toBe(0)
    })

    test('a user with GitLab connected is not asked to connect GitHub', async () => {
        renderPage([], { githubConnected: false, gitlabConnected: true })
        expect(await screen.findByText('No pull requests yet')).not.toBeNull()
        expect(screen.queryAllByText('Connect GitHub to see pull requests').length).toBe(0)
    })

    test('empty states', async () => {
        renderPage([sessions[4]])
        expect(await screen.findByText('No pull requests yet')).not.toBeNull()
        cleanup()
        mock.restore()

        // not connected: the same box as the empty list, one line, then the button
        const { container } = renderPage([], { githubConnected: false })
        const title = await screen.findByText('Connect GitHub to see pull requests')
        expect(title.tagName).toBe('H2')
        expect(screen.getByText('Connect GitHub').tagName).toBe('A')
        expect(container.querySelector('svg feDisplacementMap')).not.toBeNull()
        // the toolbar stays
        expect(screen.getByRole('textbox', { name: 'Search pull requests' })).not.toBeNull()
    })
})
