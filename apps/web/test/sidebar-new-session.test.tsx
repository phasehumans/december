import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { expect, test, describe, afterEach, beforeEach, mock } from 'bun:test'
import React from 'react'

if (!globalThis.document) {
    GlobalRegistrator.register()
}

const { render, screen, fireEvent, cleanup, act } = await import('@testing-library/react')
const { MemoryRouter, Routes, Route, useLocation } = await import('react-router-dom')
const { useAppController } = await import('../src/app/hooks/useAppController')
const { useAppStore } = await import('../src/app/store')
const { HomeHero } = await import('../src/features/home/components/HomeHero')
const { MobileMenuSheet } = await import('../src/features/navigation/components/MobileMenuSheet')
const { default: Sidebar } = await import('../src/features/navigation/components/Sidebar')
const { SuperCrewCard } = await import('../src/features/supercrew/components/SuperCrewCard')

describe('Sidebar Navigation - Create New Session', () => {
    let queryClient: QueryClient

    beforeEach(() => {
        cleanup()
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
            isSuperCrewOpen: false,
            showAuthModal: false,
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
            isSuperCrewOpen: false,
            showAuthModal: false,
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

    test('New in the mobile menu sheet closes the sheet and triggers onNewThread', async () => {
        const onNewThreadMock = mock(() => {})
        useAppStore.setState({ isMobileSidebarOpen: true, mobileSheetStart: 'menu' })

        render(
            <QueryClientProvider client={queryClient}>
                <MemoryRouter initialEntries={['/sessions']}>
                    <MobileMenuSheet
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

        const newButton = screen.getAllByRole('button').find((b) => b.textContent === 'New')
        expect(newButton).toBeDefined()

        await act(async () => {
            fireEvent.click(newButton!)
            // the sheet pops its history entry first, then runs the action
            await new Promise((resolve) => setTimeout(resolve, 50))
        })

        expect(onNewThreadMock).toHaveBeenCalledTimes(1)
        expect(useAppStore.getState().isMobileSidebarOpen).toBe(false)
    })

    test('useAppController handleNewThread resets all session and generation state', async () => {
        const { profileAPI } = await import('../src/features/profile/api/profile')
        const originalQuickInfo = profileAPI.getQuickInfo
        const originalGetProfile = profileAPI.getProfile
        profileAPI.getQuickInfo = async () =>
            ({ id: 'u1', fullName: 'User', email: 'user@example.com' }) as any
        // a user who finished onboarding, so the onboarding redirect stays out of this test
        profileAPI.getProfile = async () =>
            ({ id: 'u1', name: 'User', onboardingCompletedAt: '2026-11-22T10:00:00.000Z' }) as any

        useAppStore.setState({
            isAuthenticated: true,
            isAuthRestored: true,
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

        try {
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
        } finally {
            profileAPI.getQuickInfo = originalQuickInfo
            profileAPI.getProfile = originalGetProfile
        }
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

    test('HomeHero displays December Agent and keeps it when the prompt gets focus', async () => {
        render(
            <QueryClientProvider client={queryClient}>
                <MemoryRouter initialEntries={['/']}>
                    <HomeHero onPromptSubmit={() => {}} onOpenAuth={() => {}} />
                </MemoryRouter>
            </QueryClientProvider>
        )

        // Verify search switcher buttons are not present
        const searchModeBtn = screen.queryByRole('button', { name: 'Search' })
        expect(searchModeBtn).toBeNull()

        // Verify initial visible word is Agent
        const heading = screen.getByRole('heading', { level: 2 })
        expect(heading.textContent).toContain('December')
        expect(heading.textContent).toContain('Agent')

        const textarea = document.getElementById('home-prompt-textarea') as HTMLTextAreaElement
        expect(textarea).toBeDefined()

        // the Plan-Build-Agent word animation was removed (657e70bb): focus changes nothing
        await act(async () => {
            fireEvent.focus(textarea)
            await new Promise((resolve) => setTimeout(resolve, 50))
        })

        expect(heading.textContent).toBe('December Agent')
        expect(heading.textContent).not.toContain('Plan')
        expect(heading.textContent).not.toContain('Build')
    })

    test('clicking + icon falls back to onHomeClick or navigates to / when onNewThread is omitted', async () => {
        const onHomeClickMock = mock(() => {})

        const { unmount } = render(
            <QueryClientProvider client={queryClient}>
                <MemoryRouter initialEntries={['/sessions']}>
                    <Sidebar
                        onNewThread={undefined as unknown as () => void}
                        onHomeClick={onHomeClickMock}
                        onSessions={() => {}}
                        onProfile={() => {}}
                        onOpenProject={() => {}}
                        isAuthenticated={true}
                        onOpenAuth={() => {}}
                    />
                </MemoryRouter>
            </QueryClientProvider>
        )

        const newBtnWithHome = screen
            .getAllByRole('button')
            .find((b) => b.textContent?.includes('New'))
        expect(newBtnWithHome).toBeDefined()

        await act(async () => {
            fireEvent.click(newBtnWithHome!)
        })
        expect(onHomeClickMock).toHaveBeenCalledTimes(1)
        unmount()

        let currentPath = ''
        const LocationProbe = () => {
            currentPath = useLocation().pathname
            return null
        }

        render(
            <QueryClientProvider client={queryClient}>
                <MemoryRouter initialEntries={['/sessions']}>
                    <LocationProbe />
                    <Sidebar
                        onNewThread={undefined as unknown as () => void}
                        onSessions={() => {}}
                        onProfile={() => {}}
                        onOpenProject={() => {}}
                        isAuthenticated={true}
                        onOpenAuth={() => {}}
                    />
                </MemoryRouter>
            </QueryClientProvider>
        )

        expect(currentPath).toBe('/sessions')
        const newBtnFallback = screen
            .getAllByRole('button')
            .find((b) => b.textContent?.includes('New'))
        expect(newBtnFallback).toBeDefined()

        await act(async () => {
            fireEvent.click(newBtnFallback!)
        })
        expect(currentPath).toBe('/')
    })

    test('clicking + icon scrolls main-scroll-container to top and focuses home-prompt-textarea', async () => {
        const scrollContainer = document.createElement('div')
        scrollContainer.id = 'main-scroll-container'
        const scrollToMock = mock(() => {})
        ;(scrollContainer as unknown as { scrollTo: typeof scrollToMock }).scrollTo = scrollToMock
        document.body.appendChild(scrollContainer)

        const textarea = document.createElement('textarea')
        textarea.id = 'home-prompt-textarea'
        document.body.appendChild(textarea)

        try {
            render(
                <QueryClientProvider client={queryClient}>
                    <MemoryRouter initialEntries={['/sessions']}>
                        <Sidebar
                            onNewThread={() => {}}
                            onSessions={() => {}}
                            onProfile={() => {}}
                            onOpenProject={() => {}}
                            isAuthenticated={true}
                            onOpenAuth={() => {}}
                        />
                    </MemoryRouter>
                </QueryClientProvider>
            )

            const newButton = screen
                .getAllByRole('button')
                .find((b) => b.textContent?.includes('New'))
            expect(newButton).toBeDefined()

            await act(async () => {
                fireEvent.click(newButton!)
                await new Promise((resolve) => setTimeout(resolve, 70))
            })

            expect(scrollToMock).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' })
            expect(document.activeElement).toBe(textarea)
        } finally {
            scrollContainer.remove()
            textarea.remove()
        }
    })

    test('desktop sidebar highlights New only on / and opens SearchModal via Search button, Cmd/Ctrl+K, and OPEN_SEARCH_EVENT', async () => {
        const onOpenAuthMock = mock(() => {})

        const { rerender } = render(
            <QueryClientProvider client={queryClient}>
                <MemoryRouter initialEntries={['/']}>
                    <Sidebar
                        onNewThread={() => {}}
                        onSessions={() => {}}
                        onProfile={() => {}}
                        onOpenProject={() => {}}
                        isAuthenticated={true}
                        onOpenAuth={onOpenAuthMock}
                    />
                </MemoryRouter>
            </QueryClientProvider>
        )

        const newButton = screen.getAllByRole('button').find((b) => b.textContent?.includes('New'))
        expect(newButton?.className).toContain('bg-[#1F1F1F]')

        // Cmd/Ctrl+K toggles SearchModal open and moves active highlight to Search
        await act(async () => {
            fireEvent.keyDown(window, { key: 'k', metaKey: true })
        })
        expect(screen.getByPlaceholderText('Search')).toBeDefined()

        // Pressing Ctrl+K again closes it
        await act(async () => {
            fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
        })
        expect(screen.queryByPlaceholderText('Search')).toBeNull()

        // Custom OPEN_SEARCH_EVENT (/resume) opens SearchModal
        await act(async () => {
            window.dispatchEvent(new CustomEvent('december:open-search'))
        })
        expect(screen.getByPlaceholderText('Search')).toBeDefined()

        // Close SearchModal before testing unauthenticated Search button click
        await act(async () => {
            fireEvent.keyDown(window, { key: 'Escape' })
        })
        expect(screen.queryByPlaceholderText('Search')).toBeNull()

        rerender(
            <QueryClientProvider client={queryClient}>
                <MemoryRouter initialEntries={['/']}>
                    <Sidebar
                        onNewThread={() => {}}
                        onSessions={() => {}}
                        onProfile={() => {}}
                        onOpenProject={() => {}}
                        isAuthenticated={false}
                        onOpenAuth={onOpenAuthMock}
                    />
                </MemoryRouter>
            </QueryClientProvider>
        )

        const searchBtn = screen.getAllByRole('button').find((b) => b.textContent === 'Search')
        expect(searchBtn).toBeDefined()
        await act(async () => {
            fireEvent.click(searchBtn!)
        })
        expect(onOpenAuthMock).toHaveBeenCalledTimes(1)
        expect(screen.queryByPlaceholderText('Search')).toBeNull()
    })

    test('collapsed and expanded sidebar + buttons have accessible attributes, non-overlapping tooltip, and Super Crew toggle', async () => {
        const { rerender } = render(
            <QueryClientProvider client={queryClient}>
                <MemoryRouter initialEntries={['/']}>
                    <Sidebar
                        isCollapsed={true}
                        onNewThread={() => {}}
                        onSessions={() => {}}
                        onProfile={() => {}}
                        onOpenProject={() => {}}
                        isAuthenticated={true}
                        onOpenAuth={() => {}}
                    />
                </MemoryRouter>
            </QueryClientProvider>
        )

        const collapsedNewBtn = screen.getByRole('button', { name: 'Create new session' })
        expect(collapsedNewBtn.getAttribute('type')).toBe('button')
        expect(collapsedNewBtn.className).toContain('cursor-pointer')
        expect(collapsedNewBtn.className).toContain('bg-[#1F1F1F]')

        rerender(
            <QueryClientProvider client={queryClient}>
                <MemoryRouter initialEntries={['/']}>
                    <Sidebar
                        isCollapsed={false}
                        onNewThread={() => {}}
                        onSessions={() => {}}
                        onProfile={() => {}}
                        onOpenProject={() => {}}
                        isAuthenticated={true}
                        onOpenAuth={() => {}}
                    />
                </MemoryRouter>
            </QueryClientProvider>
        )

        const expandedNewBtn = screen
            .getAllByRole('button')
            .find((b) => b.textContent?.includes('New'))
        expect(expandedNewBtn).toBeDefined()
        expect(expandedNewBtn!.getAttribute('type')).toBe('button')
        expect(expandedNewBtn!.className).toContain('cursor-pointer')
        expect(expandedNewBtn!.innerHTML).toContain('left-[calc(100%+12px)]')
        expect(expandedNewBtn!.innerHTML).not.toContain('left-[120px]')

        const superCrewBtn = screen
            .getAllByRole('button')
            .find((b) => b.textContent?.includes('Super Crew'))
        expect(superCrewBtn).toBeDefined()
        await act(async () => {
            fireEvent.click(superCrewBtn!)
        })
        expect(useAppStore.getState().isSuperCrewOpen).toBe(true)
        expect(superCrewBtn!.className).toContain('bg-[#1F1F1F]')
    })

    test('SearchModal and SuperCrewCard are mutually exclusive in Sidebar, and Sign in closes SuperCrewCard', async () => {
        render(
            <QueryClientProvider client={queryClient}>
                <MemoryRouter initialEntries={['/']}>
                    <Sidebar
                        onNewThread={() => {}}
                        onSessions={() => {}}
                        onProfile={() => {}}
                        onOpenProject={() => {}}
                        isAuthenticated={true}
                        onOpenAuth={() => {}}
                    />
                    <SuperCrewCard isHome={true} />
                </MemoryRouter>
            </QueryClientProvider>
        )

        const superCrewBtn = screen
            .getAllByRole('button')
            .find((b) => b.textContent?.includes('Super Crew'))
        const searchBtn = screen.getAllByRole('button').find((b) => b.textContent === 'Search')
        expect(superCrewBtn).toBeDefined()
        expect(searchBtn).toBeDefined()

        // Open SuperCrewCard first
        await act(async () => {
            fireEvent.click(superCrewBtn!)
        })
        expect(useAppStore.getState().isSuperCrewOpen).toBe(true)

        // Opening SearchModal closes SuperCrewCard
        await act(async () => {
            fireEvent.click(searchBtn!)
        })
        expect(useAppStore.getState().isSuperCrewOpen).toBe(false)
        expect(screen.getByPlaceholderText('Search')).toBeDefined()

        // Opening SuperCrewCard closes SearchModal
        await act(async () => {
            fireEvent.click(superCrewBtn!)
        })
        expect(useAppStore.getState().isSuperCrewOpen).toBe(true)
        expect(screen.queryByPlaceholderText('Search')).toBeNull()

        // Cmd/Ctrl+K opening SearchModal also closes SuperCrewCard
        await act(async () => {
            fireEvent.keyDown(window, { key: 'k', metaKey: true })
        })
        expect(useAppStore.getState().isSuperCrewOpen).toBe(false)
        expect(screen.getByPlaceholderText('Search')).toBeDefined()

        // Unauthenticated SuperCrewCard "Sign in to get notified" closes card and opens AuthModal
        await act(async () => {
            fireEvent.keyDown(window, { key: 'Escape' })
            useAppStore.setState({ isAuthenticated: false, isSuperCrewOpen: true })
        })
        const signInBtn = screen.getByRole('button', { name: 'Sign in to get notified' })
        await act(async () => {
            fireEvent.click(signInBtn)
        })
        expect(useAppStore.getState().isSuperCrewOpen).toBe(false)
        expect(useAppStore.getState().showAuthModal).toBe(true)
    })
})
