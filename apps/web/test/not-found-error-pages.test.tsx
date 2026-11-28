import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { expect, test, describe, afterEach, beforeEach, mock } from 'bun:test'
import React from 'react'

if (!globalThis.document) {
    GlobalRegistrator.register()
}

const { render, screen, fireEvent, cleanup, waitFor, act } = await import('@testing-library/react')
const { MemoryRouter } = await import('react-router-dom')
const { isAppPath } = await import('../src/app/types')
const { useAppController } = await import('../src/app/hooks/useAppController')
const { useAppStore } = await import('../src/app/store')
const { sessionAPI } = await import('../src/features/sessions/api/session')
const { profileAPI } = await import('../src/features/profile/api/profile')
const { ApiError } = await import('../src/shared/api/client')
const { NotFoundPage, SessionNotFoundPage } =
    await import('../src/features/errors/components/NotFoundPage')
const { PanelErrorBoundary } = await import('../src/features/errors/components/PanelErrorBoundary')
const { AppErrorBoundary } = await import('../src/features/errors/components/AppErrorBoundary')

const originals = {
    getSessionDetail: sessionAPI.getSessionDetail,
    getSessions: sessionAPI.getSessions,
    getQuickInfo: profileAPI.getQuickInfo,
    getProfile: profileAPI.getProfile,
    consoleError: console.error,
}

afterEach(() => {
    cleanup()
    sessionAPI.getSessionDetail = originals.getSessionDetail
    sessionAPI.getSessions = originals.getSessions
    profileAPI.getQuickInfo = originals.getQuickInfo
    profileAPI.getProfile = originals.getProfile
    console.error = originals.consoleError
    useAppStore.setState({
        isAuthenticated: false,
        isAuthRestored: false,
        activeProjectId: null,
        isProjectOpening: false,
        messages: [],
    })
})

/** a part that throws while drawing, until told not to */
const crash = { on: true }
const Thrower: React.FC = () => {
    if (crash.on) throw new Error('boom')
    return <p>Drawn fine</p>
}

describe('isAppPath', () => {
    test('knows every page the app draws', () => {
        for (const path of [
            '/',
            '/login',
            '/signup',
            '/onboarding',
            '/search',
            '/sessions',
            '/sessions/',
            '/pull-requests',
            '/settings',
            '/settings/usage',
            '/connections/skills/new',
            '/profile',
            '/sessions/abc',
            '/session/abc',
            '/project/abc',
        ]) {
            expect(isAppPath(path)).toBe(true)
        }
    })

    test('unknown paths are not app paths', () => {
        for (const path of ['/foo', '/setings', '/session', '/pullrequests', '/admin-x']) {
            expect(isAppPath(path)).toBe(false)
        }
    })
})

describe('not found pages', () => {
    test('page not found has the title, the grey line and Go home', () => {
        const onGoHome = mock(() => {})
        render(<NotFoundPage onGoHome={onGoHome} />)
        expect(screen.getByText('Page not found')).toBeDefined()
        expect(screen.getByText('Check the link, or go home.')).toBeDefined()
        fireEvent.click(screen.getByText('Go home'))
        expect(onGoHome).toHaveBeenCalledTimes(1)
    })

    test('session not found has Go to sessions', () => {
        const onGo = mock(() => {})
        render(<SessionNotFoundPage onGoToSessions={onGo} />)
        expect(screen.getByText('Session not found')).toBeDefined()
        fireEvent.click(screen.getByText('Go to sessions'))
        expect(onGo).toHaveBeenCalledTimes(1)
    })
})

describe('PanelErrorBoundary', () => {
    beforeEach(() => {
        crash.on = true
        // React logs every caught error; the test expects them
        console.error = () => {}
    })

    test('a crash shows the panel error, and Try again draws the part again', () => {
        render(
            <div>
                <p>Rest of the app</p>
                <PanelErrorBoundary>
                    <Thrower />
                </PanelErrorBoundary>
            </div>
        )
        expect(screen.getByText('This panel could not load')).toBeDefined()
        expect(screen.getByText('Rest of the app')).toBeDefined()

        crash.on = false
        fireEvent.click(screen.getByText('Try again'))
        expect(screen.getByText('Drawn fine')).toBeDefined()
    })

    test('a new resetKey tries again on its own', () => {
        const { rerender } = render(
            <PanelErrorBoundary title="This page could not load" resetKey="/a">
                <Thrower />
            </PanelErrorBoundary>
        )
        expect(screen.getByText('This page could not load')).toBeDefined()
        crash.on = false
        rerender(
            <PanelErrorBoundary title="This page could not load" resetKey="/b">
                <Thrower />
            </PanelErrorBoundary>
        )
        expect(screen.getByText('Drawn fine')).toBeDefined()
    })

    test('render catches a throw in inline markup of the parent', () => {
        const Parent: React.FC = () => (
            <PanelErrorBoundary
                title="Inbox could not load"
                size="small"
                render={() => {
                    throw new Error('bad row')
                }}
            />
        )
        render(<Parent />)
        expect(screen.getByText('Inbox could not load')).toBeDefined()
    })
})

describe('AppErrorBoundary', () => {
    beforeEach(() => {
        crash.on = true
        console.error = () => {}
    })

    test('a crash shows Something went wrong with Reload, Go home and Copy error', async () => {
        const writeText = mock((_text: string) => Promise.resolve())
        Object.defineProperty(navigator, 'clipboard', {
            value: { writeText },
            configurable: true,
        })
        render(
            <AppErrorBoundary>
                <Thrower />
            </AppErrorBoundary>
        )
        expect(screen.getByText('Something went wrong')).toBeDefined()
        expect(screen.getByText('Reload')).toBeDefined()
        expect(screen.getByText('Go home')).toBeDefined()

        await act(async () => {
            fireEvent.click(screen.getByText('Copy error'))
        })
        expect(writeText).toHaveBeenCalledTimes(1)
        expect(writeText.mock.calls[0][0]).toContain('boom')
        expect(screen.getByText('Copied')).toBeDefined()
    })
})

describe('session links that match no session', () => {
    const Probe: React.FC = () => {
        const { isSessionNotFound } = useAppController()
        return <p>{isSessionNotFound ? 'not found' : 'looking'}</p>
    }

    const renderAt = (path: string) => {
        const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
        return render(
            <QueryClientProvider client={queryClient}>
                <MemoryRouter initialEntries={[path]}>
                    <Probe />
                </MemoryRouter>
            </QueryClientProvider>
        )
    }

    beforeEach(() => {
        profileAPI.getQuickInfo = (() => Promise.resolve({})) as any
        profileAPI.getProfile = (() =>
            Promise.resolve({ onboardingCompletedAt: '2026-11-01T00:00:00.000Z' })) as any
        useAppStore.setState({ isAuthenticated: true, isAuthRestored: true })
    })

    test('the server says not found: the page shows Session not found', async () => {
        sessionAPI.getSessionDetail = (() =>
            Promise.reject(new ApiError('Session not found', 404))) as any
        sessionAPI.getSessions = (() => Promise.resolve({ sessions: [] })) as any
        renderAt('/sessions/gone-id')
        await waitFor(() => expect(screen.getByText('not found')).toBeDefined())
    })

    test('a server or network error keeps looking, it does not claim not found', async () => {
        sessionAPI.getSessionDetail = (() =>
            Promise.reject(new ApiError('Server error', 500))) as any
        let listCalls = 0
        sessionAPI.getSessions = (() => {
            listCalls += 1
            return Promise.resolve({ sessions: [] })
        }) as any
        renderAt('/sessions/some-id')
        await waitFor(() => expect(listCalls).toBeGreaterThan(0))
        expect(screen.getByText('looking')).toBeDefined()
    })
})
