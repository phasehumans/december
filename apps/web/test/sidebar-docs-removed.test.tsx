import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { expect, test, describe, afterEach, beforeEach } from 'bun:test'
import React from 'react'
import { MemoryRouter } from 'react-router-dom'

if (!globalThis.document) {
    GlobalRegistrator.register()
}

const { render, screen, cleanup } = await import('@testing-library/react')

import { getViewForPath, isPublicPath } from '../src/app/types'
import { HomeHero } from '../src/features/home/components/HomeHero'
import { MobileSidebar } from '../src/features/navigation/components/MobileSidebar'
import Sidebar from '../src/features/navigation/components/Sidebar'
import { getWebUrl } from '../src/shared/config/env'

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
        render(
            <QueryClientProvider client={queryClient}>
                <MemoryRouter initialEntries={['/']}>
                    <MobileSidebar
                        isOpen={true}
                        onClose={() => {}}
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

    test('HomeHero Read Docs link points to external documentation site', () => {
        render(
            <QueryClientProvider client={queryClient}>
                <MemoryRouter>
                    <HomeHero onPromptSubmit={() => {}} onOpenAuth={() => {}} />
                </MemoryRouter>
            </QueryClientProvider>
        )

        const readDocsLink = screen.getByRole('link', { name: /Read Docs/i })
        expect(readDocsLink).not.toBeNull()
        expect(readDocsLink.getAttribute('href')).toBe(`${getWebUrl()}/docs`)
        expect(readDocsLink.getAttribute('target')).toBe('_blank')
    })
})
