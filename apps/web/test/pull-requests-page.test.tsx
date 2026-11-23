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
const { filterPullRequests, toPullRequestRows } =
    await import('../src/features/pullrequests/lib/pullRequests')

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

const renderPage = (list: unknown[] = sessions, githubConnected = true) => {
    const client = new QueryClient({
        defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    })
    client.setQueryData(['sessions', { limit: 100, sortBy: 'updatedAt', sortOrder: 'desc' }], {
        sessions: list,
    })
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

beforeEach(() => {
    cleanup()
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
            url: 'https://github.com/acme/web/pull/412',
        })
    })

    test('a draft counts as open', () => {
        const rows = toPullRequestRows(sessions as never)
        expect(filterPullRequests(rows, 'open').map((row) => row.number)).toEqual([412, 77])
        expect(filterPullRequests(rows, 'merged').map((row) => row.number)).toEqual([409])
        expect(filterPullRequests(rows, 'closed').map((row) => row.number)).toEqual([75])
    })
})

describe('Pull requests page', () => {
    test('has its own route', () => {
        expect(getViewForPath('/pull-requests')).toBe('pullrequests')
        expect(getPathForView('pullrequests')).toBe('/pull-requests')
    })

    test('lists pull requests and filters them', () => {
        renderPage()
        expect(screen.getByText('fix: login redirect loop')).not.toBeNull()
        expect(screen.getByText('refactor: billing')).not.toBeNull()
        expect(screen.queryByText('No pull request here')).toBeNull()

        fireEvent.click(screen.getByRole('radio', { name: 'Merged' }))
        expect(screen.getByText('feat: csv export')).not.toBeNull()
        expect(screen.queryByText('fix: login redirect loop')).toBeNull()
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
        expect(screen.getByText('No pull requests yet.')).not.toBeNull()
        cleanup()

        renderPage([], false)
        expect(screen.getByText('Connect GitHub to see pull requests.')).not.toBeNull()
        expect(screen.getByText('Connect GitHub')).not.toBeNull()
    })
})
