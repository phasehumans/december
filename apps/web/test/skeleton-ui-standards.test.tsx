import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { expect, test, describe, afterEach } from 'bun:test'
import React from 'react'
import { MemoryRouter } from 'react-router-dom'

import { useAppStore } from '../src/app/store'
import { HomeHeader } from '../src/features/home/components/HomeHeader'
import { NotificationsPopover } from '../src/features/navigation/components/NotificationsPopover'
import { ProfileSettingsSkeleton } from '../src/features/profile/components/ProfileSettingsSkeleton'
import { SessionListSkeleton } from '../src/features/sessions/components/SessionListSkeleton'
import {
    isSkeletonPreviewActive,
    setSkeletonPreview,
    FORCE_SKELETON_PREVIEW,
} from '../src/shared/lib/skeletonPreview'

if (!globalThis.document) {
    GlobalRegistrator.register()
}

const { render, cleanup } = await import('@testing-library/react')

afterEach(() => {
    cleanup()
    setSkeletonPreview(null)
    useAppStore.setState({
        isAuthenticated: false,
    })
})

describe('Skeleton UI Standards & Preview Mode', () => {
    test('skeleton preview helper is active when flag or override is enabled', () => {
        expect(FORCE_SKELETON_PREVIEW).toBe(true)
        setSkeletonPreview(true)
        expect(isSkeletonPreviewActive()).toBe(true)
        setSkeletonPreview(false)
        expect(isSkeletonPreviewActive()).toBe(false)
        setSkeletonPreview(null)
    })

    test('SessionListSkeleton renders both desktop grid and mobile card geometries', () => {
        const { container } = render(<SessionListSkeleton />)

        // Desktop grid rows present
        const desktopRows = container.querySelectorAll('.hidden.md\\:grid')
        expect(desktopRows.length).toBeGreaterThanOrEqual(7)

        // Mobile rows present
        const mobileRows = container.querySelectorAll('.md\\:hidden')
        expect(mobileRows.length).toBeGreaterThanOrEqual(7)
    })

    test('ProfileSettingsSkeleton renders accurate Account tab without obsolete password row', () => {
        const { container } = render(<ProfileSettingsSkeleton activeTab="Account" />)

        // Verify section titles: Account, Notifications, System
        expect(container.textContent).toContain('Account')
        expect(container.textContent).toContain('Notifications')
        expect(container.textContent).toContain('System')

        // Verify exactly 2 toggle skeletons in Notifications
        const toggles = container.querySelectorAll('.rounded-full.bg-white\\/\\[0\\.04\\]')
        expect(toggles.length).toBe(2)
    })

    test('ProfileSettingsSkeleton renders 2-column card grid for Repositories tab', () => {
        const { container } = render(<ProfileSettingsSkeleton activeTab="Repositories" />)

        // Should render grid with 2 columns on md
        const cardGrid = container.querySelector('.grid.grid-cols-1.md\\:grid-cols-2')
        expect(cardGrid).not.toBeNull()
        // Should have 6 repository card skeletons
        const cards = cardGrid?.children
        expect(cards?.length).toBe(6)
    })

    test('ProfileSettingsSkeleton renders 12-column table rows for Secrets tab', () => {
        const { container } = render(<ProfileSettingsSkeleton activeTab="Secrets" />)

        // Should render desktop 12-col grid rows matching real secrets table
        const desktopRows = container.querySelectorAll('.hidden.md\\:grid.grid-cols-12')
        expect(desktopRows.length).toBeGreaterThanOrEqual(4)

        // Should render mobile rows
        const mobileRows = container.querySelectorAll('.md\\:hidden')
        expect(mobileRows.length).toBeGreaterThanOrEqual(4)
    })

    test('ProfileSettingsSkeleton renders usage table skeleton for Usage tab', () => {
        const { container } = render(<ProfileSettingsSkeleton activeTab="Usage" />)

        // Should render desktop rows matching usage table
        const desktopRows = container.querySelectorAll('.hidden.md\\:flex, .hidden.md\\:grid')
        expect(desktopRows.length).toBeGreaterThanOrEqual(1)
    })

    test('ProfileSettingsSkeleton renders balance card and history table for Billing tab', () => {
        const { container } = render(<ProfileSettingsSkeleton activeTab="Billing" />)

        // Should render balance box
        const balanceBox = container.querySelector('.bg-\\[\\#191919\\]')
        expect(balanceBox).not.toBeNull()

        // Should render transaction history headers/rows
        const historyRows = container.querySelectorAll('.grid-cols-12')
        expect(historyRows.length).toBeGreaterThanOrEqual(1)
    })

    test('HomeHeader credit balance uses Skeleton and not Loader2 when loading', () => {
        useAppStore.setState({ isAuthenticated: true })

        const queryClient = new QueryClient({
            defaultOptions: {
                queries: { retry: false },
            },
        })

        const { container } = render(
            <QueryClientProvider client={queryClient}>
                <MemoryRouter>
                    <HomeHeader isAuthenticated={true} />
                </MemoryRouter>
            </QueryClientProvider>
        )

        // No animate-spin Loader2 inside credit button
        const loader = container.querySelector('.animate-spin')
        expect(loader).toBeNull()

        // Has skeleton element
        const skeleton = container.querySelector('.after\\:animate-\\[shimmer_2s_infinite\\]')
        expect(skeleton).not.toBeNull()
    })

    test('NotificationsPopover skeleton avoids conflicting animate-pulse on Skeleton items', () => {
        const queryClient = new QueryClient({
            defaultOptions: {
                queries: { retry: false },
            },
        })

        const { container } = render(
            <QueryClientProvider client={queryClient}>
                <MemoryRouter>
                    <NotificationsPopover />
                </MemoryRouter>
            </QueryClientProvider>
        )

        // Should not have animate-pulse on elements that have shimmer
        const pulsingSkeletons = container.querySelectorAll(
            '.after\\:animate-\\[shimmer_2s_infinite\\].animate-pulse'
        )
        expect(pulsingSkeletons.length).toBe(0)
    })
})
