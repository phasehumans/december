import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { GoogleOAuthProvider } from '@react-oauth/google'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { expect, test, describe, beforeEach, afterEach, mock } from 'bun:test'
import React from 'react'
import { MemoryRouter } from 'react-router-dom'

import App from '../src/App'
import { useAppStore } from '../src/app/store'
import { useNavigationController } from '../src/features/navigation/hooks/useNavigationController'
import { profileAPI } from '../src/features/profile/api/profile'
import { getWebUrl } from '../src/shared/config/env'

if (!globalThis.document) {
    GlobalRegistrator.register()
}

const { render, cleanup, screen } = await import('@testing-library/react')

describe('Authentication & Multi-Domain Redirection Flow', () => {
    let queryClient: QueryClient
    let originalReplace: typeof window.location.replace

    beforeEach(() => {
        queryClient = new QueryClient({
            defaultOptions: { queries: { retry: false } },
        })
        originalReplace = window.location.replace
        window.location.replace = mock((url: string) => {})
    })

    afterEach(() => {
        cleanup()
        window.location.replace = originalReplace
        useAppStore.setState({
            isAuthenticated: false,
            isAuthRestored: false,
            showAuthModal: false,
        })
    })

    test('renders only loading screen while session is being restored (isAuthRestored: false)', () => {
        useAppStore.setState({
            isAuthenticated: false,
            isAuthRestored: false,
        })

        const { container } = render(
            <MemoryRouter initialEntries={['/']}>
                <QueryClientProvider client={queryClient}>
                    <GoogleOAuthProvider clientId="test-client-id">
                        <App />
                    </GoogleOAuthProvider>
                </QueryClientProvider>
            </MemoryRouter>
        )

        // Must NOT render navigation or content view
        expect(container.querySelector('[aria-label="New Thread"]')).toBeNull()
        // Must render minimalist dark loader
        expect(container.querySelector('.fixed.inset-0.z-\\[100\\]')).not.toBeNull()
    })

    test('renders standalone login modal and no application frame when unauthenticated on /login', () => {
        useAppStore.setState({
            isAuthenticated: false,
            isAuthRestored: true,
        })

        const { container } = render(
            <MemoryRouter initialEntries={['/login']}>
                <QueryClientProvider client={queryClient}>
                    <GoogleOAuthProvider clientId="test-client-id">
                        <App />
                    </GoogleOAuthProvider>
                </QueryClientProvider>
            </MemoryRouter>
        )

        // Must render login modal
        expect(screen.getByText(/Sign in to continue building/i)).not.toBeNull()
        // Must NOT render sidebar or workspace
        expect(container.querySelector('[aria-label="New Thread"]')).toBeNull()
        expect(container.querySelector('nav')).toBeNull()
    })

    test('unauthenticated visitor on / redirects to /login and renders login modal without application frame', () => {
        useAppStore.setState({
            isAuthenticated: false,
            isAuthRestored: true,
        })

        const { container } = render(
            <MemoryRouter initialEntries={['/']}>
                <QueryClientProvider client={queryClient}>
                    <GoogleOAuthProvider clientId="test-client-id">
                        <App />
                    </GoogleOAuthProvider>
                </QueryClientProvider>
            </MemoryRouter>
        )

        expect(screen.getByText(/Sign in to continue building/i)).not.toBeNull()
        expect(container.querySelector('[aria-label="New Thread"]')).toBeNull()
        expect(container.querySelector('nav')).toBeNull()
    })

    test('signout clears cookies and instantly redirects to landingUrl (trydecember.com)', async () => {
        const signoutMock = mock(() => Promise.resolve())
        const originalSignout = profileAPI.signout
        profileAPI.signout = signoutMock as any

        useAppStore.setState({
            isAuthenticated: true,
            isAuthRestored: true,
        })

        let capturedSignOut: (() => Promise<void>) | null = null
        const TestComponent = () => {
            const { handleSignOut } = useNavigationController()
            capturedSignOut = handleSignOut
            return null
        }

        render(
            <MemoryRouter initialEntries={['/']}>
                <QueryClientProvider client={queryClient}>
                    <TestComponent />
                </QueryClientProvider>
            </MemoryRouter>
        )

        expect(capturedSignOut).not.toBeNull()
        await capturedSignOut!()

        const expectedLandingUrl = getWebUrl()

        expect(signoutMock).toHaveBeenCalledTimes(1)
        expect(useAppStore.getState().isAuthenticated).toBe(false)
        expect(window.location.replace).toHaveBeenCalledWith(expectedLandingUrl)

        profileAPI.signout = originalSignout
    })
})
