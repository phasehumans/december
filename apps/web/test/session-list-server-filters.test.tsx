import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { expect, test, describe, spyOn, afterEach, beforeEach, mock } from 'bun:test'
import React from 'react'
import { MemoryRouter } from 'react-router-dom'

if (!globalThis.document) {
    GlobalRegistrator.register()
}

const { render, screen, fireEvent, cleanup, waitFor } = await import('@testing-library/react')

import { useAppStore } from '../src/app/store'
import { notificationAPI } from '../src/features/notification/api/notification'
import { sessionAPI, type SessionFilters } from '../src/features/sessions/api/session'
import { SessionList } from '../src/features/sessions/components/SessionList'

// issue 641: the Sessions page filters by repository and tag on the server, and reads the
// menu lists and the Running count from the server too

const at = '2026-11-20T10:00:00.000Z'
const session = (over: Record<string, unknown>) => ({
    id: 's',
    title: 'Session',
    type: 'WEB',
    isArchived: false,
    createdAt: at,
    updatedAt: at,
    lastMessage: null,
    vmStatus: null,
    tags: [],
    githubRepoOwner: null,
    githubRepoName: null,
    ...over,
})

const SESSIONS = [
    session({
        id: 'web-1',
        title: 'Web session',
        githubRepoOwner: 'acme',
        githubRepoName: 'web',
        tags: ['bug'],
        vmStatus: 'RUNNING',
    }),
    session({
        id: 'api-1',
        title: 'Api session',
        githubRepoOwner: 'acme',
        githubRepoName: 'api',
        tags: ['copy'],
    }),
    session({ id: 'plain', title: 'Plain session' }),
]

/** a small fake server: it filters by repository and tag like the list API */
const listFor = (filters?: SessionFilters) =>
    SESSIONS.filter(
        (row: any) =>
            (!filters?.repoName ||
                `${row.githubRepoOwner}/${row.githubRepoName}` === filters.repoName) &&
            (!filters?.tags?.length || filters.tags.every((tag) => row.tags.includes(tag)))
    )

const renderList = () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    return render(
        <QueryClientProvider client={client}>
            <MemoryRouter initialEntries={['/sessions']}>
                <SessionList onOpenProject={mock()} />
            </MemoryRouter>
        </QueryClientProvider>
    )
}

const openMenu = () => fireEvent.click(screen.getByRole('button', { name: 'Sort and filter' }))

describe('Sessions page: server filters, lists and counts (#641)', () => {
    let getSessions: ReturnType<typeof spyOn>

    beforeEach(() => {
        cleanup()
        localStorage.clear()
        useAppStore.setState({ isAuthenticated: true, isAuthRestored: true })
        getSessions = spyOn(sessionAPI, 'getSessions').mockImplementation(
            async (filters?: SessionFilters) => ({ sessions: listFor(filters) as any })
        )
        // the server knows more than the three loaded rows
        spyOn(sessionAPI, 'getSessionFacets').mockImplementation(async () => ({
            repos: ['acme/api', 'acme/web', 'beta/archive'],
            tags: ['bug', 'copy', 'old-tag'],
        }))
        spyOn(sessionAPI, 'getSessionCounts').mockImplementation(async () => ({
            running: 12,
            needsAnswer: 0,
            needsYou: 12,
            openPullRequests: 0,
            merged: 0,
        }))
        spyOn(notificationAPI, 'getUnreadCount').mockImplementation(async () => ({ count: 0 }))
    })

    afterEach(() => {
        cleanup()
        mock.restore()
        useAppStore.setState({ isAuthenticated: false, isAuthRestored: false })
    })

    test('the Running switch shows the count of the server, not of the loaded rows', async () => {
        renderList()
        await screen.findAllByText('Web session')
        // one loaded row runs; the server counts 12
        await waitFor(() =>
            expect(
                screen.getByRole('button', { name: /^Running/, pressed: false }).textContent
            ).toBe('Running12')
        )
    })

    test('Repository and Tag show for every user, with the lists of the facets route', async () => {
        renderList()
        await screen.findAllByText('Web session')
        openMenu()

        fireEvent.click(await screen.findByRole('menuitem', { name: /Repository/ }))
        // "archive" is on no loaded row
        for (const name of ['api', 'web', 'archive']) {
            expect(screen.getByRole('menuitemradio', { name })).not.toBeNull()
        }
        fireEvent.click(screen.getByRole('menuitem', { name: /Tag/ }))
        for (const name of ['bug', 'copy', 'old-tag']) {
            expect(screen.getByRole('menuitemradio', { name })).not.toBeNull()
        }
    })

    test('a picked repository goes to the server as owner/name, and its rows show', async () => {
        renderList()
        await screen.findAllByText('Web session')
        openMenu()
        fireEvent.click(await screen.findByRole('menuitem', { name: /Repository/ }))
        fireEvent.click(screen.getByRole('menuitemradio', { name: 'api' }))

        await waitFor(() =>
            expect(
                getSessions.mock.calls.some((call: any[]) => call[0]?.repoName === 'acme/api')
            ).toBe(true)
        )
        await waitFor(() => expect(screen.queryAllByText('Web session').length).toBe(0))
        expect(screen.queryAllByText('Api session').length).toBeGreaterThan(0)
        expect(screen.queryAllByText('Plain session').length).toBe(0)
    })

    test('a picked tag goes to the server, and its rows show', async () => {
        renderList()
        await screen.findAllByText('Web session')
        openMenu()
        fireEvent.click(await screen.findByRole('menuitem', { name: /Tag/ }))
        fireEvent.click(screen.getByRole('menuitemradio', { name: 'bug' }))

        await waitFor(() =>
            expect(
                getSessions.mock.calls.some(
                    (call: any[]) => call[0]?.tags?.length === 1 && call[0].tags[0] === 'bug'
                )
            ).toBe(true)
        )
        await waitFor(() => expect(screen.queryAllByText('Api session').length).toBe(0))
        expect(screen.queryAllByText('Web session').length).toBeGreaterThan(0)
    })

    test('a saved repository and tag are sent with the first request', async () => {
        localStorage.setItem(
            'december:sessions-view',
            JSON.stringify({ sort: 'updated', repo: 'acme/web', tag: 'bug' })
        )
        renderList()
        await screen.findAllByText('Web session')

        // the page list asks with a page number; the top bar asks for its own list
        const pageCalls = getSessions.mock.calls.filter((call: any[]) => call[0]?.page === 1)
        expect(pageCalls[0][0]).toMatchObject({ repoName: 'acme/web', tags: ['bug'] })
        expect(screen.queryAllByText('Api session').length).toBe(0)
    })
})
