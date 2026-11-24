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
import { RecentSessions } from '../src/features/navigation/components/RecentSessions'
import { sessionAPI } from '../src/features/sessions/api/session'
import { SessionsViewMenu } from '../src/features/sessions/components/SessionsViewMenu'
import {
    DEFAULT_SESSIONS_VIEW,
    applySessionsView,
    sessionsViewFilters,
} from '../src/features/sessions/lib/sessionsView'

// issue 644: pinned sessions (L1), sessions that wait for an answer (L2), archive merged (L3)

const now = new Date().toISOString()
const session = (over: Record<string, unknown>) => ({
    id: 's1',
    title: 'Session',
    type: 'WEB',
    isArchived: false,
    isPinned: false,
    needsAnswer: false,
    createdAt: now,
    updatedAt: now,
    vmStatus: null,
    prNumber: null,
    prState: null,
    ...over,
})

const renderRecent = () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    return render(
        <QueryClientProvider client={client}>
            <MemoryRouter>
                <RecentSessions
                    isAuthenticated
                    onOpenProject={mock()}
                    onSessions={mock()}
                    onLeaveCurrent={mock()}
                />
            </MemoryRouter>
        </QueryClientProvider>
    )
}

const optionsOf = (title: string) =>
    screen
        .getByText(title)
        .closest('a')
        ?.parentElement?.querySelector('[aria-label="Session options"]') as HTMLElement

describe('Recent list: pin, needs answer, archive merged', () => {
    beforeEach(() => {
        cleanup()
        localStorage.clear()
        useAppStore.setState({ isAuthenticated: true, isAuthRestored: true, activeProjectId: null })
        spyOn(sessionAPI, 'getSessionCounts').mockImplementation(async () => ({
            running: 0,
            openPullRequests: 0,
            merged: 0,
        }))
    })

    afterEach(() => {
        cleanup()
        mock.restore()
    })

    test('asks for pinned sessions first, marks them, and the row menu pins and unpins', async () => {
        const pinned = new Set<string>(['a'])
        const getSessions = spyOn(sessionAPI, 'getSessions').mockImplementation(async () => ({
            sessions: [
                session({ id: 'a', title: 'Pinned one', isPinned: pinned.has('a') }),
                session({ id: 'b', title: 'Plain one', isPinned: pinned.has('b') }),
            ] as any,
        }))
        const pin = spyOn(sessionAPI, 'pinSession').mockImplementation(async (id: string) => {
            pinned.add(id)
            return {} as any
        })
        const unpin = spyOn(sessionAPI, 'unpinSession').mockImplementation(async (id: string) => {
            pinned.delete(id)
            return {} as any
        })
        renderRecent()
        await screen.findByText('Pinned one')

        expect(getSessions.mock.calls[0][0]).toMatchObject({ pinnedFirst: true })
        const pinnedRow = screen.getByText('Pinned one').closest('a') as HTMLElement
        expect(pinnedRow.querySelector('[aria-label="Pinned"]')).toBeTruthy()
        const plainRow = screen.getByText('Plain one').closest('a') as HTMLElement
        expect(plainRow.querySelector('[aria-label="Pinned"]')).toBeNull()

        fireEvent.click(optionsOf('Plain one'))
        fireEvent.click(screen.getByRole('menuitem', { name: 'Pin' }))
        await waitFor(() => expect(pin).toHaveBeenCalledWith('b'))

        fireEvent.click(optionsOf('Pinned one'))
        fireEvent.click(screen.getByRole('menuitem', { name: 'Unpin' }))
        await waitFor(() => expect(unpin).toHaveBeenCalledWith('a'))
    })

    test('Needs answer filters the list and marks waiting rows', async () => {
        const getSessions = spyOn(sessionAPI, 'getSessions').mockImplementation(async () => ({
            sessions: [
                session({ id: 'w', title: 'Waiting one', needsAnswer: true }),
                session({ id: 'i', title: 'Idle one' }),
            ] as any,
        }))
        renderRecent()
        await screen.findByText('Waiting one')

        const waitingRow = screen.getByText('Waiting one').closest('a') as HTMLElement
        expect(waitingRow.textContent).toContain('Needs answer')
        const idleRow = screen.getByText('Idle one').closest('a') as HTMLElement
        expect(idleRow.textContent).not.toContain('Needs answer')

        fireEvent.click(screen.getByLabelText('More options'))
        fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Needs answer' }))
        await waitFor(() =>
            expect(getSessions.mock.calls.at(-1)?.[0]).toMatchObject({ needsAnswer: true })
        )
        expect(screen.getByText(/· Needs answer/)).toBeTruthy()
    })

    test('Archive merged shows only with merged sessions, archives them and can be undone', async () => {
        const archived = new Set<string>()
        const rows = [
            session({ id: 'm1', title: 'Merged A', prNumber: 1, prState: 'merged' }),
            session({ id: 'm2', title: 'Merged B', prNumber: 2, prState: 'merged' }),
            session({ id: 'o', title: 'Open one', prNumber: 3, prState: 'open' }),
        ]
        spyOn(sessionAPI, 'getSessions').mockImplementation(async () => ({
            sessions: rows.filter((s) => !archived.has(s.id as string)) as any,
        }))
        spyOn(sessionAPI, 'getSessionCounts').mockImplementation(async () => ({
            running: 0,
            openPullRequests: 1,
            merged: 2 - archived.size,
        }))
        const archiveMerged = spyOn(sessionAPI, 'archiveMergedSessions').mockImplementation(
            async () => {
                archived.add('m1')
                archived.add('m2')
                return { sessionIds: ['m1', 'm2'] }
            }
        )
        const unarchive = spyOn(sessionAPI, 'unarchiveSessions').mockImplementation(
            async (ids: string[]) => {
                ids.forEach((id) => archived.delete(id))
                return { sessionIds: ids }
            }
        )
        renderRecent()
        await screen.findByText('Merged A')

        fireEvent.click(screen.getByLabelText('More options'))
        const row = await screen.findByRole('menuitem', { name: 'Archive merged, 2' })
        fireEvent.click(row)
        await waitFor(() => expect(archiveMerged).toHaveBeenCalledTimes(1))
        expect(await screen.findByText('Archived 2')).toBeTruthy()
        await waitFor(() => expect(screen.queryByText('Merged A')).toBeNull())
        expect(screen.getByText('Open one')).toBeTruthy()

        fireEvent.click(screen.getByText('Undo'))
        await waitFor(() => expect(unarchive).toHaveBeenCalledWith(['m1', 'm2']))
        expect(await screen.findByText('Merged A')).toBeTruthy()
    })

    test('no Archive merged row when nothing is merged', async () => {
        spyOn(sessionAPI, 'getSessions').mockImplementation(async () => ({
            sessions: [session({ id: 'o', title: 'Open one' })] as any,
        }))
        renderRecent()
        await screen.findByText('Open one')
        fireEvent.click(screen.getByLabelText('More options'))
        expect(screen.getByRole('menu', { name: 'Sort and filter' }).textContent).not.toContain(
            'Archive merged'
        )
    })
})

describe('Sessions page: needs answer filter', () => {
    afterEach(() => cleanup())

    test('the sort and filter menu has a Needs answer row', () => {
        const onChange = mock()
        render(
            <SessionsViewMenu
                view={DEFAULT_SESSIONS_VIEW}
                onChange={onChange}
                repos={[]}
                tags={[]}
            />
        )
        fireEvent.click(screen.getByRole('button', { name: 'Sort and filter' }))
        fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Needs answer' }))
        expect(onChange).toHaveBeenCalledWith({ needsAnswer: true })
    })

    test('the view sends needsAnswer and keeps only waiting rows', () => {
        const view = { ...DEFAULT_SESSIONS_VIEW, needsAnswer: true }
        expect(sessionsViewFilters(view).needsAnswer).toBe(true)
        expect(sessionsViewFilters(DEFAULT_SESSIONS_VIEW).needsAnswer).toBeUndefined()
        const rows = [session({ id: 'w', needsAnswer: true }), session({ id: 'i' })] as any
        expect(applySessionsView(rows, view).map((s) => s.id)).toEqual(['w'])
    })
})
