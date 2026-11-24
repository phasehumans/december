import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { QueryClient } from '@tanstack/react-query'
import { describe, it, expect, mock, beforeEach } from 'bun:test'
import React from 'react'

if (!globalThis.document) {
    GlobalRegistrator.register()
}

const { render, screen, fireEvent } = await import('@testing-library/react')
const { SessionListView } = await import('../src/features/sessions/components/SessionListView')
const { SessionListRow } = await import('../src/features/sessions/components/SessionListRow')
const { DEFAULT_SESSIONS_VIEW } = await import('../src/features/sessions/lib/sessionsView')

describe('multi-session concurrency and afk background execution UI', () => {
    let queryClient: QueryClient

    beforeEach(() => {
        queryClient = new QueryClient({
            defaultOptions: { queries: { retry: false } },
        })
    })

    const sampleSessions = [
        {
            id: 'sess-1',
            title: 'backend refactor',
            vmStatus: 'RUNNING',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        },
        {
            id: 'sess-2',
            title: 'frontend styling',
            vmStatus: 'PROVISIONING',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        },
        {
            id: 'sess-3',
            title: 'database migration',
            vmStatus: 'STOPPED',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        },
    ]

    it('should show running and starting status in SessionListRow', () => {
        const onOpenProject = mock(() => {})
        const onToggleMenu = mock(() => {})

        const { rerender } = render(
            <SessionListRow
                project={sampleSessions[0]}
                isMenuOpen={false}
                onOpenProject={onOpenProject}
                onToggleMenu={onToggleMenu}
                onCloseMenu={mock(() => {})}
                onToggleArchiveFromMenu={mock(() => {})}
                onOpenRename={mock(() => {})}
                onOpenDelete={mock(() => {})}
                onOpenTags={mock(() => {})}
            />
        )

        expect(screen.getAllByText('Running').length).toBeGreaterThan(0)

        rerender(
            <SessionListRow
                project={sampleSessions[1]}
                isMenuOpen={false}
                onOpenProject={onOpenProject}
                onToggleMenu={onToggleMenu}
                onCloseMenu={mock(() => {})}
                onToggleArchiveFromMenu={mock(() => {})}
                onOpenRename={mock(() => {})}
                onOpenDelete={mock(() => {})}
                onOpenTags={mock(() => {})}
            />
        )

        expect(screen.getAllByText('Starting').length).toBeGreaterThan(0)
    })

    it('should allow stopping an active task from menu in SessionListRow', () => {
        const onStopSession = mock(() => {})

        render(
            <SessionListRow
                project={sampleSessions[0]}
                isMenuOpen={true}
                onOpenProject={mock(() => {})}
                onToggleMenu={mock(() => {})}
                onCloseMenu={mock(() => {})}
                onToggleArchiveFromMenu={mock(() => {})}
                onOpenRename={mock(() => {})}
                onOpenDelete={mock(() => {})}
                onOpenTags={mock(() => {})}
                onStopSession={onStopSession}
            />
        )

        const stopButtons = screen.getAllByText('Stop')
        expect(stopButtons.length).toBeGreaterThan(0)
        fireEvent.click(stopButtons[0])
        expect(onStopSession).toHaveBeenCalledWith('sess-1', expect.anything())
    })

    it('should support filtering running sessions in SessionListView', () => {
        const onStatusFilterChange = mock(() => {})

        render(
            <SessionListView
                projects={sampleSessions}
                onOpenProject={mock(() => {})}
                isInitialLoading={false}
                errorMessage={null}
                actionError={null}
                menuOpenId={null}
                onToggleMenu={mock(() => {})}
                onCloseMenu={mock(() => {})}
                onToggleArchiveFromMenu={mock(() => {})}
                onOpenRename={mock(() => {})}
                onOpenDelete={mock(() => {})}
                onOpenTags={mock(() => {})}
                searchQuery=""
                onSearchChange={mock(() => {})}
                view={DEFAULT_SESSIONS_VIEW}
                onViewChange={mock(() => {})}
                hasUnfilteredProjects={true}
                statusFilter="all"
                onStatusFilterChange={onStatusFilterChange}
                runningCount={2}
            />
        )

        const runningFilterButton = screen.getByRole('button', { name: /Running/i })
        fireEvent.click(runningFilterButton)
        expect(onStatusFilterChange).toHaveBeenCalledWith('running')
    })

    it('should provide listenToSessionStream and stopSessionStream in generationAPI', async () => {
        const { generationAPI, getSharedSocket } =
            await import('../src/features/generation/api/generation')
        const socket = getSharedSocket()
        Object.defineProperty(socket, 'disconnected', {
            get: () => false,
            configurable: true,
        })
        let emittedStopEvent: any = null
        socket.emit = mock((event: string, data: any) => {
            if (event === 'stop_session') {
                emittedStopEvent = data
            }
        }) as any

        generationAPI.stopSessionStream('sess-1')
        expect(emittedStopEvent).toEqual({ sessionId: 'sess-1' })
    })

    it('should provide rehydrateSession API on sessionAPI', async () => {
        const { sessionAPI } = await import('../src/features/sessions/api/session')
        expect(typeof sessionAPI.rehydrateSession).toBe('function')
    })
})
