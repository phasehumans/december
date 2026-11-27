import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test'
import React from 'react'

if (!globalThis.document) {
    GlobalRegistrator.register()
}

const { render, screen, fireEvent, cleanup, waitFor, within } =
    await import('@testing-library/react')
const { MemoryRouter } = await import('react-router-dom')
const { useAppStore } = await import('../src/app/store')
const { notificationAPI } = await import('../src/features/notification/api/notification')
const { generationAPI } = await import('../src/features/generation/api/generation')
const { PullRequestsPage } =
    await import('../src/features/pullrequests/components/PullRequestsPage')
const { sessionAPI } = await import('../src/features/sessions/api/session')

// the ⋯ menu, phone sheet and dialogs of the Pull requests rows (review page
// 5dLGLxX7ZfJgqPFg33DzYF): the same menu as the Sessions rows, without Rename and Pin

type Row = {
    sessionId: string
    title: string
    repo: string | null
    gitProvider: 'GITHUB' | 'GITLAB'
    prNumber: number
    prState: 'open' | 'draft' | 'merged' | 'closed'
    prUrl: string | null
    prBranch: string | null
    tags: string[]
    vmStatus: string
    isArchived: boolean
    pinnedAt?: string | null
}

const makeRows = (): Row[] => [
    {
        sessionId: 'open-1',
        title: 'feat: ollama provider',
        repo: 'acme/web',
        gitProvider: 'GITHUB',
        prNumber: 651,
        prState: 'open',
        prUrl: 'https://github.com/acme/web/pull/651',
        prBranch: 'feat/ollama',
        tags: ['cli'],
        vmStatus: 'STOPPED',
        isArchived: false,
    },
    {
        sessionId: 'merged-1',
        title: 'fix: token refresh',
        repo: 'acme/web',
        gitProvider: 'GITHUB',
        prNumber: 648,
        prState: 'merged',
        prUrl: 'https://github.com/acme/web/pull/648',
        prBranch: 'fix/refresh',
        tags: [],
        vmStatus: 'STOPPED',
        // archived on merge: still listed
        isArchived: true,
    },
    {
        sessionId: 'running-1',
        title: 'feat: archive confirm',
        repo: 'acme/web',
        gitProvider: 'GITHUB',
        prNumber: 646,
        prState: 'draft',
        prUrl: 'https://github.com/acme/web/pull/646',
        prBranch: 'feat/archive-confirm',
        tags: [],
        vmStatus: 'RUNNING',
        isArchived: false,
    },
    {
        sessionId: 'gitlab-1',
        title: 'ci: cache bun install',
        repo: 'acme/infra',
        gitProvider: 'GITLAB',
        prNumber: 31,
        prState: 'open',
        prUrl: 'https://gitlab.com/acme/infra/-/merge_requests/31',
        prBranch: 'ci/bun-cache',
        tags: [],
        vmStatus: 'STOPPED',
        isArchived: false,
    },
    {
        sessionId: 'nolink-1',
        title: 'docs: landing quotes',
        repo: null,
        gitProvider: 'GITHUB',
        prNumber: 9,
        prState: 'closed',
        prUrl: null,
        prBranch: null,
        tags: [],
        vmStatus: 'STOPPED',
        isArchived: false,
    },
]

let db: Row[] = []

// like GET /session/pull-requests: an archived open pull request leaves the list
const listed = () =>
    db.filter((row) => !row.isArchived || row.prState === 'merged' || row.prState === 'closed')

const asResponse = (rows: Row[]) => ({
    pullRequests: rows.map((row) => ({
        ...row,
        prTitle: null,
        additions: null,
        deletions: null,
        prOpenedAt: null,
        prMergedAt: null,
        prClosedAt: null,
        prUpdatedAt: null,
        createdAt: '2026-11-20T10:00:00.000Z',
        updatedAt: '2026-11-21T10:00:00.000Z',
    })),
    pagination: { page: 1, limit: 30, total: rows.length, totalPages: 1 },
})

const spies = () => {
    spyOn(sessionAPI, 'getPullRequests').mockImplementation((async () =>
        asResponse(listed())) as any)
    spyOn(sessionAPI, 'getSessionFacets').mockImplementation(
        async () => ({ repos: [], tags: [] }) as any
    )
    spyOn(sessionAPI, 'getSessionCounts').mockImplementation(async () => ({
        running: 1,
        needsAnswer: 0,
        needsYou: 1,
        openPullRequests: 2,
        merged: 0,
    }))
    spyOn(sessionAPI, 'getSessions').mockImplementation(async () => ({ sessions: [] }) as any)
    spyOn(notificationAPI, 'getUnreadCount').mockImplementation(async () => ({ count: 0 }))
    const setArchived = (id: string, isArchived: boolean) => {
        db = db.map((row) => (row.sessionId === id ? { ...row, isArchived } : row))
        return {} as any
    }
    return {
        archive: spyOn(sessionAPI, 'archiveSession').mockImplementation(async (id: string) =>
            setArchived(id, true)
        ),
        unarchive: spyOn(sessionAPI, 'unarchiveSession').mockImplementation(async (id: string) =>
            setArchived(id, false)
        ),
        remove: spyOn(sessionAPI, 'deleteSession').mockImplementation(async (id: string) => {
            db = db.filter((row) => row.sessionId !== id)
        }),
        tags: spyOn(sessionAPI, 'updateSessionTags').mockImplementation(
            async (id: string, tags: string[]) => {
                db = db.map((row) => (row.sessionId === id ? { ...row, tags } : row))
                return {} as any
            }
        ),
        stop: spyOn(generationAPI, 'stopSessionStream').mockImplementation(() => {}),
    }
}

const renderPage = () => {
    const api = spies()
    const client = new QueryClient({
        defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    })
    client.setQueryData(['profile'], { id: 'user-1', githubConnected: true })
    client.setQueryData(['quickinfo'], { fullName: 'Test', githubConnected: true })
    client.setQueryData(['integrations', 'gitlab'], {
        available: true,
        connected: false,
        username: null,
    })
    const onOpenProject = mock((_id: string) => {})
    render(
        <QueryClientProvider client={client}>
            <MemoryRouter initialEntries={['/pull-requests']}>
                <PullRequestsPage onOpenProject={onOpenProject} />
            </MemoryRouter>
        </QueryClientProvider>
    )
    return { api, onOpenProject }
}

/** the desktop row of a title */
const rowOf = async (title: string) =>
    (await screen.findByText(title)).closest('.group') as HTMLElement

const openMenu = async (title: string) => {
    const row = await rowOf(title)
    fireEvent.click(within(row).getByRole('button', { name: 'Pull request options' }))
    return screen.getByRole('menu')
}

const itemNames = (menu: HTMLElement) =>
    within(menu)
        .getAllByRole('menuitem')
        .map((item) => item.textContent)

const withPhone = async (run: () => Promise<void>) => {
    const original = window.matchMedia
    window.matchMedia = ((query: string) => ({
        matches: query.includes('max-width'),
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
    })) as never
    try {
        await run()
    } finally {
        window.matchMedia = original
    }
}

beforeEach(() => {
    cleanup()
    localStorage.clear()
    db = makeRows()
    useAppStore.setState({ isAuthenticated: true })
})

afterEach(() => {
    cleanup()
    mock.restore()
    useAppStore.setState({ isAuthenticated: false })
})

describe('pull request row menu', () => {
    test('an open row: open on GitHub, new in this repo, tags, archive, delete', async () => {
        renderPage()
        const menu = await openMenu('feat: ollama provider')
        expect(itemNames(menu)).toEqual([
            'Open on GitHub',
            'New in this repo',
            'Tags',
            'Archive',
            'Delete',
        ])
        // the row shows the pull request title, so no rename; this list has no pins
        expect(menu.textContent).not.toContain('Rename')
        expect(menu.textContent).not.toContain('Pin')
        expect(menu.textContent).not.toContain('Stop')
    })

    test('a running row shows Running and Stop, and Stop stops the run', async () => {
        const { api } = renderPage()
        const row = await rowOf('feat: archive confirm')
        expect(within(row).getByText('Running')).not.toBeNull()
        const menu = await openMenu('feat: archive confirm')
        fireEvent.click(within(menu).getByRole('menuitem', { name: 'Stop' }))
        expect(api.stop).toHaveBeenCalledWith('running-1')
        expect(screen.queryByRole('menu')).toBeNull()
    })

    test('an archived merged row says Unarchive, with no dialog', async () => {
        const { api } = renderPage()
        const menu = await openMenu('fix: token refresh')
        expect(itemNames(menu)).toContain('Unarchive')
        fireEvent.click(within(menu).getByRole('menuitem', { name: 'Unarchive' }))
        await waitFor(() => expect(api.unarchive).toHaveBeenCalledWith('merged-1'))
        expect(screen.queryByText('Archive session')).toBeNull()
    })

    test('a GitLab row names GitLab and has no new session in the repo', async () => {
        renderPage()
        const menu = await openMenu('ci: cache bun install')
        expect(itemNames(menu)).toEqual(['Open on GitLab', 'Tags', 'Archive', 'Delete'])
    })

    test('a row with no link and no repository has only the manage rows', async () => {
        renderPage()
        const menu = await openMenu('docs: landing quotes')
        expect(itemNames(menu)).toEqual(['Tags', 'Archive', 'Delete'])
    })

    test('Open on GitHub opens the pull request and not the session', async () => {
        const { onOpenProject } = renderPage()
        const open = spyOn(window, 'open').mockImplementation(() => null)
        const menu = await openMenu('feat: ollama provider')
        fireEvent.click(within(menu).getByRole('menuitem', { name: 'Open on GitHub' }))
        expect(open).toHaveBeenCalledWith(
            'https://github.com/acme/web/pull/651',
            '_blank',
            'noopener,noreferrer'
        )
        expect(onOpenProject).not.toHaveBeenCalled()
    })

    test('archive asks first, then leaves "Archived · Undo"; Undo brings the row back', async () => {
        const { api } = renderPage()
        const menu = await openMenu('feat: ollama provider')
        fireEvent.click(within(menu).getByRole('menuitem', { name: 'Archive' }))
        expect(screen.getByText('Archive session')).not.toBeNull()
        expect(
            screen.getByText(
                'It leaves this list while the pull request is open. Unarchive it on the Sessions page.'
            )
        ).not.toBeNull()
        expect(api.archive).not.toHaveBeenCalled()

        fireEvent.click(screen.getByRole('button', { name: 'Archive' }))
        await waitFor(() => expect(api.archive).toHaveBeenCalledWith('open-1'))
        expect(screen.queryAllByText('feat: ollama provider').length).toBe(0)
        expect(screen.getByRole('status').textContent).toContain('Archived')

        fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
        await waitFor(() => expect(api.unarchive).toHaveBeenCalledWith('open-1'))
        expect(await screen.findByText('feat: ollama provider')).not.toBeNull()
    })

    test('Undo of a pinned row puts its pin back, like the Sessions page', async () => {
        db = db.map((row) =>
            row.sessionId === 'open-1' ? { ...row, pinnedAt: '2026-11-25T08:00:00.000Z' } : row
        )
        const { api } = renderPage()
        const restore = spyOn(sessionAPI, 'unarchiveSessions').mockImplementation((async (
            ids: string[]
        ) => {
            for (const id of ids) {
                db = db.map((row) => (row.sessionId === id ? { ...row, isArchived: false } : row))
            }
            return { sessionIds: ids }
        }) as any)
        const menu = await openMenu('feat: ollama provider')
        fireEvent.click(within(menu).getByRole('menuitem', { name: 'Archive' }))
        fireEvent.click(screen.getByRole('button', { name: 'Archive' }))
        await waitFor(() => expect(api.archive).toHaveBeenCalledWith('open-1'))

        fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
        await waitFor(() =>
            expect(restore).toHaveBeenCalledWith(
                ['open-1'],
                [{ sessionId: 'open-1', pinnedAt: '2026-11-25T08:00:00.000Z' }]
            )
        )
        expect(api.unarchive).not.toHaveBeenCalled()
        expect(await screen.findByText('feat: ollama provider')).not.toBeNull()
    })

    test('archiving a closed row keeps it listed, with no undo line', async () => {
        const { api } = renderPage()
        const menu = await openMenu('docs: landing quotes')
        fireEvent.click(within(menu).getByRole('menuitem', { name: 'Archive' }))
        fireEvent.click(screen.getByRole('button', { name: 'Archive' }))
        await waitFor(() => expect(api.archive).toHaveBeenCalledWith('nolink-1'))
        expect(screen.queryByRole('status')).toBeNull()
        expect(screen.getByText('docs: landing quotes')).not.toBeNull()
        await waitFor(async () =>
            expect(itemNames(await openMenu('docs: landing quotes'))).toContain('Unarchive')
        )
    })

    test('delete says the pull request stays, then removes the row', async () => {
        const { api } = renderPage()
        const menu = await openMenu('ci: cache bun install')
        fireEvent.click(within(menu).getByRole('menuitem', { name: 'Delete' }))
        expect(screen.getByText('Delete session')).not.toBeNull()
        expect(
            screen.getByText(
                'Its sandbox stops. The pull request on GitLab stays. You cannot undo this.'
            )
        ).not.toBeNull()
        fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
        await waitFor(() => expect(api.remove).toHaveBeenCalledWith('gitlab-1'))
        await waitFor(() => expect(screen.queryAllByText('ci: cache bun install').length).toBe(0))
    })

    test('tags from the menu save the new tag and show it on the row', async () => {
        const { api } = renderPage()
        const menu = await openMenu('feat: ollama provider')
        fireEvent.click(within(menu).getByRole('menuitem', { name: 'Tags' }))
        expect(
            screen.getByText('One tag per session. Filter by it on Sessions and Pull requests.')
        ).not.toBeNull()
        const input = screen.getByLabelText('Tag name') as HTMLInputElement
        expect(input.value).toBe('cli')
        fireEvent.change(input, { target: { value: 'provider' } })
        fireEvent.click(screen.getByRole('button', { name: 'Save' }))
        await waitFor(() => expect(api.tags).toHaveBeenCalledWith('open-1', ['provider']))
        const row = await rowOf('feat: ollama provider')
        await waitFor(() => expect(within(row).getByText('provider')).not.toBeNull())
    })

    test('a failed archive shows the error and keeps the row', async () => {
        const { api } = renderPage()
        api.archive.mockImplementation(async () => {
            throw new Error('Could not archive session')
        })
        const menu = await openMenu('feat: ollama provider')
        fireEvent.click(within(menu).getByRole('menuitem', { name: 'Archive' }))
        fireEvent.click(screen.getByRole('button', { name: 'Archive' }))
        expect(await screen.findByText('Could not archive session')).not.toBeNull()
        expect(await screen.findByText('feat: ollama provider')).not.toBeNull()
        expect(screen.queryByRole('status')).toBeNull()
    })

    test('a right-click opens the same menu at the pointer', async () => {
        renderPage()
        const row = await rowOf('feat: ollama provider')
        fireEvent.contextMenu(row, { clientX: 300, clientY: 120 })
        const menu = screen.getByRole('menu')
        expect(menu.style.left).not.toBe('')
        expect(itemNames(menu)).toContain('Open on GitHub')
    })

    test('a row click opens the session; the menu does not', async () => {
        const { onOpenProject } = renderPage()
        await openMenu('feat: ollama provider')
        expect(onOpenProject).not.toHaveBeenCalled()
        fireEvent.click(await screen.findByText('fix: token refresh'))
        expect(onOpenProject).toHaveBeenCalledWith('merged-1')
    })
})

describe('pull request row sheet on phones', () => {
    test('two-line row with ⋯, no host icon; the sheet has the host and repo rows', async () => {
        await withPhone(async () => {
            renderPage()
            await screen.findByText('feat: ollama provider')
            // the host link moves into the sheet
            expect(screen.queryAllByLabelText(/^Open pull request \d+ on/).length).toBe(0)
            const buttons = screen.getAllByRole('button', { name: 'Pull request options' })
            fireEvent.click(buttons[0])
            const sheet = await screen.findByRole('dialog', { name: 'Pull request options' })
            const text = sheet.textContent ?? ''
            expect(text).toContain('Open on GitHub')
            expect(text).toContain('New session in this repo')
            expect(text).toContain('Tags')
            expect(text).toContain('Archive')
            expect(text).toContain('Delete')
            expect(text).not.toContain('Rename')
        })
    })
})
