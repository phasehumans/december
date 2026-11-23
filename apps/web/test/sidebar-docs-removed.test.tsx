import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { expect, test, describe, afterEach, beforeEach } from 'bun:test'
import React from 'react'
import { MemoryRouter } from 'react-router-dom'

if (!globalThis.document) {
    GlobalRegistrator.register()
}

const { render, screen, cleanup } = await import('@testing-library/react')

import { useAppStore } from '../src/app/store'
import { getViewForPath, isPublicPath } from '../src/app/types'
import { HomeHero } from '../src/features/home/components/HomeHero'
import { MobileMenuSheet } from '../src/features/navigation/components/MobileMenuSheet'
import Sidebar from '../src/features/navigation/components/Sidebar'

describe('Documentation removal from web & sidebar', () => {
    let queryClient: QueryClient

    beforeEach(() => {
        cleanup()
        queryClient = new QueryClient({
            defaultOptions: {
                queries: { retry: false },
            },
        })
    })

    afterEach(() => {
        cleanup()
        useAppStore.setState({ isAuthenticated: false, isMobileSidebarOpen: false })
    })

    test('Desktop Sidebar does not include Documentation button', () => {
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
                </MemoryRouter>
            </QueryClientProvider>
        )

        expect(screen.queryByText('Documentation')).toBeNull()
        expect(screen.queryByRole('button', { name: /Documentation/i })).toBeNull()
    })

    test('Mobile Sidebar does not include Documentation button', () => {
        useAppStore.setState({ isMobileSidebarOpen: true, mobileSheetStart: 'menu' })
        render(
            <QueryClientProvider client={queryClient}>
                <MemoryRouter initialEntries={['/']}>
                    <MobileMenuSheet
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

        expect(screen.queryByText('Documentation')).toBeNull()
        expect(screen.queryByRole('button', { name: /Documentation/i })).toBeNull()
    })

    test('isPublicPath allows /docs and subroutes without authentication for redirect handling', () => {
        expect(isPublicPath('/docs')).toBe(true)
        expect(isPublicPath('/docs/quickstart')).toBe(true)
        expect(isPublicPath('/docs/architecture')).toBe(true)
    })

    test('getViewForPath resolves /docs to chat default view', () => {
        expect(getViewForPath('/docs')).toBe('chat')
        expect(getViewForPath('/docs/quickstart')).toBe('chat')
    })

    test('HomeHero shows the Docs link to signed-out visitors', () => {
        useAppStore.setState({ isAuthenticated: false, isMobileSidebarOpen: false })
        render(
            <QueryClientProvider client={queryClient}>
                <MemoryRouter>
                    <HomeHero onPromptSubmit={() => {}} onOpenAuth={() => {}} />
                </MemoryRouter>
            </QueryClientProvider>
        )

        const docsLink = screen.getByRole('link', { name: /Docs/i })
        expect(docsLink.getAttribute('href')).toBe('/docs')
        expect(docsLink.getAttribute('target')).toBe('_blank')
    })
})
