import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { expect, test, describe, mock, afterEach } from 'bun:test'
import React from 'react'

import { SessionListView } from '../src/features/sessions/components/SessionListView'
import { SessionsViewMenu } from '../src/features/sessions/components/SessionsViewMenu'
import {
    DEFAULT_SESSIONS_VIEW,
    applySessionsView,
    collectSessionFacets,
    readSessionsView,
    sessionsViewFilters,
    sessionsViewLabel,
    writeSessionsView,
    type SessionsView,
} from '../src/features/sessions/lib/sessionsView'

import type { BackendSession } from '../src/features/sessions/api/session'

if (!globalThis.document) {
    GlobalRegistrator.register()
}

const { render, screen, fireEvent, cleanup } = await import('@testing-library/react')

afterEach(() => {
    cleanup()
    localStorage.clear()
})

const session = (overrides: Partial<BackendSession>): BackendSession => ({
    id: 'id',
    title: 'Session',
    type: 'WEB',
    createdAt: '2026-11-01T00:00:00.000Z',
    updatedAt: '2026-11-01T00:00:00.000Z',
    lastMessage: null,
    ...overrides,
})

const withPhone = (run: () => void) => {
    const original = window.matchMedia
    window.matchMedia = ((query: string) => ({
        matches: query.includes('max-width'),
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
    })) as never
    try {
        run()
    } finally {
        window.matchMedia = original
    }
}

const renderMenu = (
    view: Partial<SessionsView> = {},
    lists: { repos?: string[]; tags?: string[] } = {}
) => {
    const onChange = mock()
    render(
        <SessionsViewMenu
            view={{ ...DEFAULT_SESSIONS_VIEW, ...view }}
            onChange={onChange}
            repos={lists.repos ?? []}
            tags={lists.tags ?? []}
        />
    )
    return onChange
}

describe('sessions view', () => {
    test('the button names the filters that are on, then the sort', () => {
        expect(sessionsViewLabel(DEFAULT_SESSIONS_VIEW)).toEqual({
            filters: null,
            sort: 'Last updated',
        })
        expect(
            sessionsViewLabel({ ...DEFAULT_SESSIONS_VIEW, archived: true, sort: 'newest' })
        ).toEqual({
            filters: 'Archived',
            sort: 'Newest',
        })
        expect(
            sessionsViewLabel({ ...DEFAULT_SESSIONS_VIEW, hasPr: true, repo: 'acme/web' }).filters
        ).toBe('2 filters')
        expect(sessionsViewLabel({ ...DEFAULT_SESSIONS_VIEW, repo: 'acme/web' }).filters).toBe(
            'web'
        )
    })

    test('the view maps to list API filters, with archived out of the list by default', () => {
        expect(sessionsViewFilters(DEFAULT_SESSIONS_VIEW)).toEqual({
            sortBy: 'updatedAt',
            sortOrder: 'desc',
            hasPr: undefined,
            isArchived: false,
            tags: undefined,
            repoName: undefined,
        })
        const full: SessionsView = {
            sort: 'oldest',
            hasPr: true,
            archived: true,
            repo: 'acme/web',
            tag: 'bug',
        }
        // repository and tag are not sent until the list API is ready for them
        expect(sessionsViewFilters(full).tags).toBeUndefined()
        expect(sessionsViewFilters(full).repoName).toBeUndefined()
        expect(sessionsViewFilters(full, true)).toEqual({
            sortBy: 'createdAt',
            sortOrder: 'asc',
            hasPr: true,
            isArchived: true,
            tags: ['bug'],
            repoName: 'web',
        })
    })

    test('the view is saved and read back, and bad values fall back to the default', () => {
        const view: SessionsView = {
            sort: 'newest',
            hasPr: true,
            archived: false,
            repo: null,
            tag: 'bug',
        }
        writeSessionsView(view)
        expect(readSessionsView()).toEqual(view)

        localStorage.setItem('december:sessions-view', '{"sort":"sideways","archived":"yes"}')
        expect(readSessionsView()).toEqual(DEFAULT_SESSIONS_VIEW)

        localStorage.setItem('december:sessions-view', 'not json')
        expect(readSessionsView()).toEqual(DEFAULT_SESSIONS_VIEW)
    })

    test('loaded rows follow the view: archived, pull request, tag, repository and sort', () => {
        const rows = [
            session({
                id: 'a',
                updatedAt: '2026-11-03T00:00:00.000Z',
                createdAt: '2026-10-01T00:00:00.000Z',
            }),
            session({
                id: 'b',
                updatedAt: '2026-11-02T00:00:00.000Z',
                createdAt: '2026-10-20T00:00:00.000Z',
                prNumber: 7,
                tags: ['bug'],
                githubRepoName: 'acme/web',
            }),
            session({
                id: 'c',
                updatedAt: '2026-11-04T00:00:00.000Z',
                createdAt: '2026-10-10T00:00:00.000Z',
                isArchived: true,
            }),
        ]
        const ids = (view: Partial<SessionsView>) =>
            applySessionsView(rows, { ...DEFAULT_SESSIONS_VIEW, ...view }).map((row) => row.id)

        expect(ids({})).toEqual(['a', 'b'])
        expect(ids({ sort: 'newest' })).toEqual(['b', 'a'])
        expect(ids({ sort: 'oldest' })).toEqual(['a', 'b'])
        expect(ids({ archived: true })).toEqual(['c'])
        expect(ids({ hasPr: true })).toEqual(['b'])
        expect(ids({ tag: 'bug' })).toEqual(['b'])
        expect(ids({ repo: 'acme/web' })).toEqual(['b'])
        expect(ids({ repo: 'acme/api' })).toEqual([])
    })

    test('repositories and tags seen on loaded rows add up and keep the same object when nothing is new', () => {
        const first = collectSessionFacets(
            [session({ githubRepoName: 'acme/web', tags: ['bug'] })],
            { repos: [], tags: [] }
        )
        expect(first).toEqual({ repos: ['acme/web'], tags: ['bug'] })
        const second = collectSessionFacets(
            [session({ githubRepoName: 'acme/web', tags: ['bug'] })],
            first
        )
        expect(second).toBe(first)
        const third = collectSessionFacets(
            [session({ githubRepoName: 'acme/api', tags: ['api'] })],
            first
        )
        expect(third).toEqual({ repos: ['acme/api', 'acme/web'], tags: ['api', 'bug'] })
    })
})

describe('SessionsViewMenu', () => {
    test('the button shows the sort, and the filter in front of it when one is on', () => {
        renderMenu()
        expect(screen.getByRole('button', { name: 'Sort and filter' }).textContent).toBe(
            'Last updated'
        )
        cleanup()
        renderMenu({ archived: true })
        expect(screen.getByRole('button', { name: 'Sort and filter' }).textContent).toContain(
            'Archived'
        )
        expect(screen.queryByText('Sort:')).toBeNull()
    })

    test('one list with Sort by and Filter rows, and the menu stays open after a pick', () => {
        const onChange = renderMenu()
        fireEvent.click(screen.getByRole('button', { name: 'Sort and filter' }))

        expect(screen.getByText('Sort by')).not.toBeNull()
        expect(screen.getByText('Filter')).not.toBeNull()
        expect(
            screen.getByRole('menuitemradio', { name: 'Last updated' }).getAttribute('aria-checked')
        ).toBe('true')

        fireEvent.click(screen.getByRole('menuitemradio', { name: 'Newest' }))
        expect(onChange).toHaveBeenCalledWith({ sort: 'newest' })
        fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Has pull request' }))
        expect(onChange).toHaveBeenCalledWith({ hasPr: true })
        fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Archived' }))
        expect(onChange).toHaveBeenCalledWith({ archived: true })

        // still open
        expect(screen.getByRole('menu', { name: 'Sort and filter' })).not.toBeNull()
    })

    test('Repository and Tag rows only show when they have values, and open a second list', () => {
        renderMenu()
        fireEvent.click(screen.getByRole('button', { name: 'Sort and filter' }))
        expect(screen.queryByText('Repository')).toBeNull()
        expect(screen.queryByText('Tag')).toBeNull()
        cleanup()

        const onChange = renderMenu({ tag: 'bug' }, { repos: ['acme/web'], tags: ['bug', 'copy'] })
        fireEvent.click(screen.getByRole('button', { name: 'Sort and filter' }))
        fireEvent.click(screen.getByRole('menuitem', { name: /Tag/ }))
        expect(
            screen.getByRole('menuitemradio', { name: 'bug' }).getAttribute('aria-checked')
        ).toBe('true')
        fireEvent.click(screen.getByRole('menuitemradio', { name: 'copy' }))
        expect(onChange).toHaveBeenCalledWith({ tag: 'copy' })
        fireEvent.click(screen.getByRole('menuitemradio', { name: 'Any' }))
        expect(onChange).toHaveBeenCalledWith({ tag: null })

        fireEvent.click(screen.getByRole('menuitem', { name: /Repository/ }))
        fireEvent.click(screen.getByRole('menuitemradio', { name: 'web' }))
        expect(onChange).toHaveBeenCalledWith({ repo: 'acme/web' })
    })

    test('a click outside closes the menu', () => {
        renderMenu()
        fireEvent.click(screen.getByRole('button', { name: 'Sort and filter' }))
        expect(screen.queryByRole('menu', { name: 'Sort and filter' })).not.toBeNull()
        fireEvent.mouseDown(document.body)
        expect(screen.queryByRole('menu', { name: 'Sort and filter' })).toBeNull()
    })

    test('phones get a bottom sheet with the same rows and a second level for Tag', () => {
        withPhone(() => {
            const onChange = renderMenu({}, { tags: ['bug'] })
            fireEvent.click(screen.getByRole('button', { name: 'Sort and filter' }))

            const sheet = screen.getByRole('dialog', { name: 'Sort and filter' })
            expect(sheet.textContent).toContain('Sort by')
            expect(sheet.textContent).toContain('Has pull request')
            expect(screen.queryByRole('menu', { name: 'Sort and filter' })).toBeNull()

            fireEvent.click(screen.getByText('Oldest'))
            expect(onChange).toHaveBeenCalledWith({ sort: 'oldest' })

            fireEvent.click(screen.getByText('Tag'))
            fireEvent.click(screen.getByText('bug'))
            expect(onChange).toHaveBeenCalledWith({ tag: 'bug' })
            fireEvent.click(screen.getByRole('button', { name: 'Back' }))
            expect(screen.getByRole('dialog', { name: 'Sort and filter' }).textContent).toContain(
                'Sort by'
            )
        })
    })
})

describe('SessionListView with the view menu', () => {
    const baseProps = {
        onOpenProject: () => {},
        isInitialLoading: false,
        errorMessage: null,
        actionError: null,
        menuOpenId: null,
        onToggleMenu: () => {},
        onCloseMenu: () => {},
        onToggleArchiveFromMenu: () => {},
        onOpenRename: () => {},
        onOpenDelete: () => {},
        onOpenTags: () => {},
        searchQuery: '',
        onSearchChange: () => {},
        onViewChange: () => {},
    }

    test('no results with a filter on shows Clear filters', () => {
        const onClearFilters = mock()
        render(
            <SessionListView
                {...baseProps}
                projects={[]}
                view={{ ...DEFAULT_SESSIONS_VIEW, archived: true }}
                filtersOn
                onClearFilters={onClearFilters}
                hasUnfilteredProjects
            />
        )
        expect(screen.getByText('No sessions found')).not.toBeNull()
        fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }))
        expect(onClearFilters).toHaveBeenCalled()
    })

    test('no results from search alone has no Clear filters button', () => {
        render(
            <SessionListView
                {...baseProps}
                projects={[]}
                view={DEFAULT_SESSIONS_VIEW}
                searchQuery="zzz"
                hasUnfilteredProjects
            />
        )
        expect(screen.getByText('No sessions found')).not.toBeNull()
        expect(screen.queryByRole('button', { name: 'Clear filters' })).toBeNull()
    })

    test('an empty list offers the archived view when every session is archived', () => {
        const onShowArchived = mock()
        render(
            <SessionListView
                {...baseProps}
                projects={[]}
                view={DEFAULT_SESSIONS_VIEW}
                onShowArchived={onShowArchived}
                hasUnfilteredProjects={false}
            />
        )
        expect(screen.getByText('No sessions yet')).not.toBeNull()
        fireEvent.click(screen.getByRole('button', { name: 'Show archived' }))
        expect(onShowArchived).toHaveBeenCalled()
    })

    test('rows show the created time when the list is sorted by created date', () => {
        const row = {
            id: 's1',
            title: 'A session',
            createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
            updatedAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
            tags: [],
        }
        const { rerender } = render(
            <SessionListView
                {...baseProps}
                projects={[row]}
                view={DEFAULT_SESSIONS_VIEW}
                hasUnfilteredProjects
            />
        )
        expect(screen.getAllByText('5m ago').length).toBeGreaterThan(0)
        expect(screen.queryByText(/Created/)).toBeNull()

        rerender(
            <SessionListView
                {...baseProps}
                projects={[row]}
                view={{ ...DEFAULT_SESSIONS_VIEW, sort: 'newest' }}
                hasUnfilteredProjects
            />
        )
        expect(screen.getAllByText('3d ago').length).toBeGreaterThan(0)
        expect(screen.getAllByText(/Created/).length).toBeGreaterThan(0)
    })
})
