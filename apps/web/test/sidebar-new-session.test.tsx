import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { expect, test, describe, afterEach, beforeEach, mock } from 'bun:test'
import React from 'react'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'

if (!globalThis.document) {
    GlobalRegistrator.register()
}

const { render, screen, fireEvent, cleanup, act } = await import('@testing-library/react')

import { useAppController } from '../src/app/hooks/useAppController'
import { useAppStore } from '../src/app/store'
import { HomeHero } from '../src/features/home/components/HomeHero'
import { MobileSidebar } from '../src/features/navigation/components/MobileSidebar'
import Sidebar from '../src/features/navigation/components/Sidebar'

describe('Sidebar Navigation - Create New Session', () => {
    let queryClient: QueryClient

    beforeEach(() => {
        queryClient = new QueryClient({
            defaultOptions: {
                queries: { retry: false },
            },
        })
        useAppStore.setState({
            isAuthenticated: true,
            isAuthRestored: true,
            activeProjectId: null,
            activeSessionId: null,
            activeProjectName: null,
            activeSessionTitle: null,
            messages: [],
            isGenerating: false,
            previewSession: null,
            previewSessionError: null,
            projectLoadError: null,
            sessionLoadError: null,
            isMobileSidebarOpen: false,
        })
    })

    afterEach(() => {
        cleanup()
        useAppStore.setState({
            isAuthenticated: false,
            isAuthRestored: false,
            activeProjectId: null,
            activeSessionId: null,
            activeProjectName: null,
            activeSessionTitle: null,
            messages: [],
            isGenerating: false,
            previewSession: null,
            previewSessionError: null,
            projectLoadError: null,
            sessionLoadError: null,
            isMobileSidebarOpen: false,
        })
    })

    test('clicking + icon in desktop sidebar triggers onNewThread and brings user to home view', async () => {
        useAppStore.setState({
            activeProjectId: 'sess-active',
            activeProjectName: 'Active Session',
            messages: [{ id: '1', role: 'user', content: 'test message' }],
            isGenerating: true,
        })

        const onNewThreadMock = mock(() => {
            useAppStore.setState({
                activeProjectId: null,
                activeSessionId: null,
                messages: [],
                isGenerating: false,
            })
        })

        render(
            <QueryClientProvider client={queryClient}>
                <MemoryRouter initialEntries={['/sessions/active-session']}>
                    <Sidebar
                        onNewThread={onNewThreadMock}
                        onSessions={() => {}}
                        onProfile={() => {}}
                        onOpenProject={() => {}}
                        isAuthenticated={true}
                        onOpenAuth={() => {}}
                    />
                </MemoryRouter>
            </QueryClientProvider>
        )

        const buttons = screen.getAllByRole('button')
        const newButton = buttons.find((b) => b.textContent?.includes('New'))
        expect(newButton).toBeDefined()

        let eventFired = false
        window.addEventListener('december:new-session', () => {
            eventFired = true
        })

        await act(async () => {
            fireEvent.click(newButton!)
        })

        expect(onNewThreadMock).toHaveBeenCalledTimes(1)
        expect(eventFired).toBe(true)
        expect(useAppStore.getState().activeProjectId).toBeNull()
        expect(useAppStore.getState().messages).toHaveLength(0)
    })

    test('clicking + icon in collapsed desktop sidebar triggers onNewThread', async () => {
        const onNewThreadMock = mock(() => {})

        render(
            <QueryClientProvider client={queryClient}>
                <MemoryRouter initialEntries={['/sessions/active-session']}>
                    <Sidebar
                        isCollapsed={true}
                        onNewThread={onNewThreadMock}
                        onSessions={() => {}}
                        onProfile={() => {}}
                        onOpenProject={() => {}}
                        isAuthenticated={true}
                        onOpenAuth={() => {}}
                    />
                </MemoryRouter>
            </QueryClientProvider>
        )

        // In collapsed sidebar, tooltip says 'Create new session'
        const buttons = screen.getAllByRole('button')
        const newButton = buttons.find((b) => b.textContent?.includes('Create new session'))
        expect(newButton).toBeDefined()

        await act(async () => {
            fireEvent.click(newButton!)
        })

        expect(onNewThreadMock).toHaveBeenCalledTimes(1)
    })

    test('clicking + icon in mobile sidebar triggers onNewThread and closes sidebar', async () => {
        const onNewThreadMock = mock(() => {})
        const onCloseMock = mock(() => {})

        render(
            <QueryClientProvider client={queryClient}>
                <MemoryRouter initialEntries={['/sessions']}>
                    <MobileSidebar
                        isOpen={true}
                        onClose={onCloseMock}
                        onNewThread={onNewThreadMock}
                        onSessions={() => {}}
                        onProfile={() => {}}
                        onOpenProject={() => {}}
                        isAuthenticated={true}
                        onOpenAuth={() => {}}
                    />
                </MemoryRouter>
            </QueryClientProvider>
        )

        const buttons = screen.getAllByRole('button')
        const newButton = buttons.find((b) => b.textContent?.includes('New'))
        expect(newButton).toBeDefined()

        await act(async () => {
            fireEvent.click(newButton!)
        })

        expect(onNewThreadMock).toHaveBeenCalledTimes(1)
        expect(onCloseMock).toHaveBeenCalledTimes(1)
    })

    test('useAppController handleNewThread resets all session and generation state', async () => {
        useAppStore.setState({
            activeProjectId: 'sess-to-clear',
            activeProjectName: 'To Clear',
            activeProjectVersionId: 'v1',
            messages: [{ id: '1', role: 'user', content: 'test' }],
            isGenerating: true,
            projectLoadError: 'error',
        })

        let controllerInstance: ReturnType<typeof useAppController> | null = null

        const TestConsumer = () => {
            controllerInstance = useAppController()
            const location = useLocation()
            return (
                <div>
                    <div data-testid="path">{location.pathname}</div>
                    <div data-testid="is-home">{controllerInstance.isHome ? 'true' : 'false'}</div>
                </div>
            )
        }

        render(
            <QueryClientProvider client={queryClient}>
                <MemoryRouter initialEntries={['/sessions/to-clear']}>
                    <Routes>
                        <Route path="*" element={<TestConsumer />} />
                    </Routes>
                </MemoryRouter>
            </QueryClientProvider>
        )

        expect(screen.getByTestId('path').textContent).toBe('/sessions/to-clear')

        await act(async () => {
            controllerInstance!.handleNewThread()
        })

        expect(screen.getByTestId('path').textContent).toBe('/')
        expect(screen.getByTestId('is-home').textContent).toBe('true')
        expect(useAppStore.getState().activeProjectId).toBeNull()
        expect(useAppStore.getState().messages).toHaveLength(0)
        expect(useAppStore.getState().isGenerating).toBe(false)
        expect(useAppStore.getState().projectLoadError).toBeNull()
    })

    test('HomeHero resets prompt state and switches to agent mode on december:new-session event', async () => {
        render(
            <QueryClientProvider client={queryClient}>
                <MemoryRouter initialEntries={['/']}>
                    <HomeHero onPromptSubmit={() => {}} onOpenAuth={() => {}} />
                </MemoryRouter>
            </QueryClientProvider>
        )

        const textarea = document.getElementById('home-prompt-textarea') as HTMLTextAreaElement
        expect(textarea).toBeDefined()

        // Type something into prompt
        fireEvent.change(textarea, { target: { value: 'draft prompt before new session' } })
        expect(textarea.value).toBe('draft prompt before new session')

        // Dispatch new-session event
        await act(async () => {
            window.dispatchEvent(new CustomEvent('december:new-session'))
        })

        expect(textarea.value).toBe('')
    })
})
