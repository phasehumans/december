import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { expect, test, describe, spyOn, afterEach, beforeEach, mock } from 'bun:test'
import React from 'react'
import { MemoryRouter } from 'react-router-dom'

if (!globalThis.document) {
    GlobalRegistrator.register()
}

const { render, screen, fireEvent, cleanup, waitFor, act } = await import('@testing-library/react')

import { useAppStore } from '../src/app/store'
import { MobileMenuSheet } from '../src/features/navigation/components/MobileMenuSheet'
import { RecentSessions } from '../src/features/navigation/components/RecentSessions'
import { sessionAPI } from '../src/features/sessions/api/session'
import { SessionDeleteModal } from '../src/features/sessions/components/SessionDeleteModal'

const now = new Date().toISOString()
const session = (over: Record<string, unknown>) => ({
    id: 's1',
    title: 'Fix login redirect loop',
    type: 'WEB',
    isArchived: false,
    createdAt: now,
    updatedAt: now,
    vmStatus: null,
    prNumber: null,
    prState: null,
    ...over,
})

const SESSIONS = [
    session({ id: 'run', title: 'Running one', vmStatus: 'RUNNING' }),
    session({ id: 'start', title: 'Starting one', vmStatus: 'PROVISIONING' }),
    session({ id: 'pr', title: 'Merged one', prNumber: 638, prState: 'merged' }),
]

const renderRecent = (props: Partial<React.ComponentProps<typeof RecentSessions>> = {}) => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    return render(
        <QueryClientProvider client={client}>
            <MemoryRouter>
                <RecentSessions
                    isAuthenticated
                    onOpenProject={mock()}
                    onSessions={mock()}
                    onLeaveCurrent={mock()}
                    {...props}
                />
            </MemoryRouter>
        </QueryClientProvider>
    )
}

describe('sidebar Recent list', () => {
    beforeEach(() => {
        cleanup()
        localStorage.clear()
        useAppStore.setState({ isAuthenticated: true, isAuthRestored: true, activeProjectId: null })
    })

    afterEach(() => {
        cleanup()
        mock.restore()
    })

    test('asks the server for 20 web sessions and shows status, PR colour and All sessions', async () => {
        const getSessions = spyOn(sessionAPI, 'getSessions').mockImplementation(async () => ({
            sessions: SESSIONS as any,
        }))
        renderRecent()

        expect(await screen.findByText('Running one')).toBeTruthy()
        expect(getSessions.mock.calls[0][0]).toMatchObject({
            type: 'WEB',
            isArchived: false,
            sortBy: 'updatedAt',
            limit: 20,
        })
        expect(screen.getByText('Running')).toBeTruthy()
        expect(screen.getByText('Starting')).toBeTruthy()
        expect(screen.queryByText('Provisioning')).toBeNull()
        expect(screen.getByText('638').parentElement?.className).toContain('text-[#C084FC]')
        expect(screen.getByText('All sessions')).toBeTruthy()
    })

    test('⋯ menu has sort and show only, closes on pick and remembers Running', async () => {
        const getSessions = spyOn(sessionAPI, 'getSessions').mockImplementation(
            async (filters?: any) => ({
                sessions: (filters?.vmStatus === 'running' ? [] : SESSIONS) as any,
            })
        )
        renderRecent()
        await screen.findByText('Running one')

        fireEvent.click(screen.getByLabelText('More options'))
        const menu = screen.getByRole('menu', { name: 'Sort and filter' })
        expect(menu.textContent).toContain('Last updated')
        expect(menu.textContent).toContain('Created')
        expect(menu.textContent).not.toContain('Web')
        expect(menu.textContent).not.toContain('Archived')
        expect(menu.textContent).not.toContain('View all sessions')

        fireEvent.click(screen.getByRole('menuitemradio', { name: 'Running' }))
        expect(screen.queryByRole('menu', { name: 'Sort and filter' })).toBeNull()
        expect(await screen.findByText('No running sessions')).toBeTruthy()
        expect(screen.getByText('· Running', { exact: false })).toBeTruthy()
        expect(JSON.parse(localStorage.getItem('december:recent-view') || '{}')).toEqual({
            sort: 'updated',
            show: 'running',
        })
        expect(getSessions.mock.calls.some((c: any[]) => c[0]?.vmStatus === 'running')).toBe(true)

        fireEvent.click(screen.getByText('Show all'))
        expect(await screen.findByText('Running one')).toBeTruthy()
    })

    test('Esc closes the ⋯ menu', async () => {
        spyOn(sessionAPI, 'getSessions').mockImplementation(async () => ({
            sessions: SESSIONS as any,
        }))
        renderRecent()
        await screen.findByText('Running one')
        fireEvent.click(screen.getByLabelText('More options'))
        expect(screen.getByRole('menu', { name: 'Sort and filter' })).toBeTruthy()
        fireEvent.keyDown(document, { key: 'Escape' })
        expect(screen.queryByRole('menu', { name: 'Sort and filter' })).toBeNull()
    })

    test('a failed load offers Try again', async () => {
        spyOn(sessionAPI, 'getSessions').mockImplementation(async () => {
            throw new Error('boom')
        })
        renderRecent()
        expect(await screen.findByText("Couldn't load sessions")).toBeTruthy()
        expect(screen.getByText('Try again')).toBeTruthy()
        expect(screen.queryByText('No recent sessions')).toBeNull()
    })

    test('signed out shows only a Sign in button', () => {
        renderRecent({ isAuthenticated: false })
        expect(screen.getByText('Sign in')).toBeTruthy()
        expect(screen.queryByText(/Sign in to view/)).toBeNull()
    })

    test('row ⋯ has the Sessions page items, and archive can be undone', async () => {
        // a small fake server: archived sessions drop out of the list like the real one
        const archived = new Set<string>()
        spyOn(sessionAPI, 'getSessions').mockImplementation(async () => ({
            sessions: SESSIONS.filter((s) => !archived.has(s.id)) as any,
        }))
        const archive = spyOn(sessionAPI, 'archiveSession').mockImplementation(
            async (id: string) => {
                archived.add(id)
                return {} as any
            }
        )
        const unarchive = spyOn(sessionAPI, 'unarchiveSession').mockImplementation(
            async (id: string) => {
                archived.delete(id)
                return {} as any
            }
        )
        renderRecent()
        await screen.findByText('Running one')

        fireEvent.click(screen.getAllByLabelText('Session options')[0])
        const menu = screen.getByRole('menu', { name: 'Session options' })
        for (const label of ['Rename', 'Tags', 'Archive', 'Stop', 'Delete']) {
            expect(menu.textContent).toContain(label)
        }

        fireEvent.click(screen.getByRole('menuitem', { name: /Archive/ }))
        await waitFor(() => expect(archive).toHaveBeenCalledWith('run'))
        expect(await screen.findByText('Undo')).toBeTruthy()

        expect(screen.queryByText('Running one')).toBeNull()

        fireEvent.click(screen.getByText('Undo'))
        await waitFor(() => expect(unarchive).toHaveBeenCalledWith('run'))
        expect(await screen.findByText('Running one')).toBeTruthy()
    })
})

describe('delete modal copy', () => {
    afterEach(() => cleanup())

    test('says session and shows the name', () => {
        render(
            <SessionDeleteModal
                isOpen
                projectTitle="Refactor session repository"
                isPending={false}
                onClose={mock()}
                onConfirm={mock()}
            />
        )
        expect(screen.getByText('Delete session')).toBeTruthy()
        expect(screen.getByText('Refactor session repository')).toBeTruthy()
        expect(screen.queryByText(/project/i)).toBeNull()
    })
})

describe('phone menu sheet Recent', () => {
    beforeEach(() => {
        cleanup()
        useAppStore.setState({
            isAuthenticated: true,
            isAuthRestored: true,
            activeProjectId: null,
            isMobileSidebarOpen: true,
            mobileSheetStart: 'menu',
        })
    })

    afterEach(() => {
        cleanup()
        mock.restore()
        useAppStore.setState({ isMobileSidebarOpen: false })
    })

    const renderSheet = () => {
        const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
        return render(
            <QueryClientProvider client={client}>
                <MemoryRouter>
                    <MobileMenuSheet
                        onNewThread={mock()}
                        onSessions={mock()}
                        onProfile={mock()}
                        onOpenProject={mock()}
                        isAuthenticated
                        onOpenAuth={mock()}
                    />
                </MemoryRouter>
            </QueryClientProvider>
        )
    }

    test('holding a row opens its options and Delete needs two taps', async () => {
        spyOn(sessionAPI, 'getSessions').mockImplementation(async () => ({
            sessions: SESSIONS as any,
        }))
        const del = spyOn(sessionAPI, 'deleteSession').mockImplementation(async () => ({}) as any)
        renderSheet()

        const row = (await screen.findByText('Merged one')).closest('button') as HTMLElement
        fireEvent.pointerDown(row, { clientX: 10, clientY: 10 })
        await act(() => new Promise((r) => setTimeout(r, 600)))
        fireEvent.pointerUp(row)

        expect(await screen.findByText('Rename')).toBeTruthy()
        fireEvent.click(screen.getByText('Delete'))
        expect(del).not.toHaveBeenCalled()
        fireEvent.click(screen.getByText('Tap again to delete'))
        await waitFor(() => expect(del).toHaveBeenCalledWith('pr'))
    })
})
