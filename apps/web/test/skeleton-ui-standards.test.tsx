import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { expect, test, describe, afterEach } from 'bun:test'
import React from 'react'
import { MemoryRouter } from 'react-router-dom'

import { useAppStore } from '../src/app/store'
import { HomeHeader } from '../src/features/home/components/HomeHeader'
import { NotificationsPopover } from '../src/features/navigation/components/NotificationsPopover'
import { ProfileBillingSettings } from '../src/features/profile/components/ProfileBillingSettings'
import { ProfileRepositoriesSettings } from '../src/features/profile/components/ProfileRepositoriesSettings'
import { ProfileSecretsSettings } from '../src/features/profile/components/ProfileSecretsSettings'
import { ProfileSettingsSkeleton } from '../src/features/profile/components/ProfileSettingsSkeleton'
import { ProfileUsageSettings } from '../src/features/profile/components/ProfileUsageSettings'
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
        expect(FORCE_SKELETON_PREVIEW).toBe(false)
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

    test('ProfileSettingsSkeleton renders accurate Account tab with skeleton section headers and without obsolete password row', () => {
        const { container } = render(<ProfileSettingsSkeleton activeTab="Account" />)

        // Verify section titles are skeleton bars and not rendered as plain text
        expect(container.textContent).not.toContain('Account')
        expect(container.textContent).not.toContain('Notifications')
        expect(container.textContent).not.toContain('System')

        // Verify exactly 2 toggle skeletons in Notifications
        const toggles = container.querySelectorAll('.rounded-full.bg-white\\/\\[0\\.04\\]')
        expect(toggles.length).toBe(2)
    })

    test('ProfileSettingsSkeleton renders connections rows matching actual connection layout without cards', () => {
        const { container } = render(<ProfileSettingsSkeleton activeTab="Connections" />)

        // Verify section title is skeleton bar, not plain text
        expect(container.textContent).not.toContain('Connections')

        // Verify icon boxes matching real connection items
        const iconBoxes = container.querySelectorAll('.w-9.h-9.sm\\:w-10.sm\\:h-10')
        expect(iconBoxes.length).toBe(8)

        // Verify rows do not have fake p-2.5 card backgrounds
        const fakeCards = container.querySelectorAll('.bg-white\\/\\[0\\.015\\]')
        expect(fakeCards.length).toBe(0)

        // Verify border outlines are removed from icon boxes and button skeletons
        expect(container.querySelectorAll('.border-\\[\\#383736\\]').length).toBe(0)
        expect(container.querySelectorAll('.border-\\[\\#383736\\]\\/40').length).toBe(0)
    })

    test('ProfileSettingsSkeleton renders Repositories tab with real header, description, search input, Connect button, and skeleton cards only', () => {
        const { container } = render(<ProfileSettingsSkeleton activeTab="Repositories" />)

        // Real header and description
        expect(container.textContent).toContain('Repositories')
        expect(container.textContent).toContain('Reference a repository with an at sign, e.g.')

        // Real search input and button
        const searchInput = container.querySelector('input[placeholder="Search repositories..."]')
        expect(searchInput).not.toBeNull()
        expect(container.textContent).toContain('Connect GitHub')

        // Skeletons only for repository cards without harsh card borders
        const cardGrid = container.querySelector('.grid.grid-cols-1.md\\:grid-cols-2')
        expect(cardGrid).not.toBeNull()
        expect(cardGrid?.children.length).toBe(6)
        for (const card of Array.from(cardGrid?.children || [])) {
            expect((card as HTMLElement).className).not.toContain('border-[#242323]')
        }
    })

    test('ProfileSettingsSkeleton renders Secrets tab with real header, description, search input, action buttons, table header, and skeleton rows only', () => {
        const { container } = render(<ProfileSettingsSkeleton activeTab="Secrets" />)

        // Real header and description
        expect(container.textContent).toContain('Secrets')
        expect(container.textContent).toContain('Reference a secret with a dollar sign, e.g.')

        // Real search input and action buttons
        const searchInput = container.querySelector('input[placeholder="Search secrets"]')
        expect(searchInput).not.toBeNull()
        expect(container.textContent).toContain('Bulk add')
        expect(container.textContent).toContain('Add secret')

        // Real table header
        expect(container.textContent).toContain('Name')
        expect(container.textContent).toContain('Note')
        expect(container.textContent).toContain('Updated at')

        // Skeletons only for secret rows
        const desktopRows = container.querySelectorAll('.hidden.md\\:grid.grid-cols-12')
        expect(desktopRows.length).toBeGreaterThanOrEqual(4)
        const mobileRows = container.querySelectorAll('.md\\:hidden')
        expect(mobileRows.length).toBeGreaterThanOrEqual(4)
    })

    test('ProfileSettingsSkeleton renders Usage tab with real header, description, filter buttons, Total spent label, table header, and skeleton rows only', () => {
        const { container } = render(<ProfileSettingsSkeleton activeTab="Usage" />)

        // Real header and description
        expect(container.textContent).toContain('Usage')
        expect(container.textContent).toContain('Track your token consumption, credit deductions')

        // Real quick filters
        expect(container.textContent).toContain('1d')
        expect(container.textContent).toContain('7d')
        expect(container.textContent).toContain('30d')
        expect(container.textContent).toContain('90d')

        // Total spent label
        expect(container.textContent).toContain('Total spent:')

        // Real table header
        expect(container.textContent).toContain('Date')
        expect(container.textContent).toContain('Project')
        expect(container.textContent).toContain('Model')
        expect(container.textContent).toContain('Token Usage')
        expect(container.textContent).toContain('Cost')

        // Skeletons only for rows
        const desktopRows = container.querySelectorAll('.hidden.md\\:flex, .hidden.md\\:grid')
        expect(desktopRows.length).toBeGreaterThanOrEqual(1)
    })

    test('ProfileSettingsSkeleton renders Billing tab with real Credits header, description, balance box with Add Credits button, Credits History header, table header, and skeleton rows only', () => {
        const { container } = render(<ProfileSettingsSkeleton activeTab="Billing" />)

        // Real Credits header and description
        expect(container.textContent).toContain('Credits')
        expect(container.textContent).toContain(
            'Prepaid credits are used to power AI model completions'
        )

        // Real balance box layout with Add Credits button
        expect(container.textContent).toContain('Wallet Balance')
        expect(container.textContent).toContain('USD')
        expect(container.textContent).toContain('Add Credits')

        // Real Credits History header and table header
        expect(container.textContent).toContain('Credits History')
        expect(container.textContent).toContain('Date')
        expect(container.textContent).toContain('Details')
        expect(container.textContent).toContain('Status')
        expect(container.textContent).toContain('Amount')

        // Skeletons for transaction history rows
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

    test('ProfileRepositoriesSettings in preview mode shows real header, description, search bar, and buttons with skeleton cards only', () => {
        setSkeletonPreview(true)
        const queryClient = new QueryClient({
            defaultOptions: { queries: { retry: false } },
        })

        const { container } = render(
            <QueryClientProvider client={queryClient}>
                <MemoryRouter>
                    <ProfileRepositoriesSettings
                        isGithubConnected={false}
                        onConnectGithub={() => {}}
                    />
                </MemoryRouter>
            </QueryClientProvider>
        )

        expect(container.textContent).toContain('Repositories')
        expect(container.textContent).toContain('Reference a repository with an at sign, e.g.')
        expect(
            container.querySelector('input[placeholder="Search repositories..."]')
        ).not.toBeNull()
        expect(container.textContent).toContain('Connect GitHub')

        const cardGrid = container.querySelector('.grid.grid-cols-1.md\\:grid-cols-2')
        expect(cardGrid).not.toBeNull()
        expect(cardGrid?.children.length).toBe(6)
        for (const card of Array.from(cardGrid?.children || [])) {
            expect((card as HTMLElement).className).not.toContain('border-[#242323]')
        }
    })

    test('ProfileBillingSettings in preview mode shows real Credits header, description, balance box with Add Credits button, Credits History, table header, and transaction skeletons', () => {
        setSkeletonPreview(true)
        const queryClient = new QueryClient({
            defaultOptions: { queries: { retry: false } },
        })

        const { container } = render(
            <QueryClientProvider client={queryClient}>
                <MemoryRouter>
                    <ProfileBillingSettings
                        profile={{
                            name: 'Test',
                            email: 'test@example.com',
                            username: 'test',
                        }}
                    />
                </MemoryRouter>
            </QueryClientProvider>
        )

        expect(container.textContent).toContain('Credits')
        expect(container.textContent).toContain(
            'Prepaid credits are used to power AI model completions'
        )
        expect(container.textContent).toContain('Wallet Balance')
        expect(container.textContent).toContain('USD')
        expect(container.textContent).toContain('Add Credits')
        expect(container.textContent).toContain('Credits History')
        expect(container.textContent).toContain('Date')
        expect(container.textContent).toContain('Details')
        expect(container.textContent).toContain('Status')
        expect(container.textContent).toContain('Amount')

        const historyRows = container.querySelectorAll('.grid-cols-12')
        expect(historyRows.length).toBeGreaterThanOrEqual(1)
    })

    test('ProfileSecretsSettings in preview mode shows real Secrets header, description, search bar, buttons, table header, and skeleton rows', () => {
        setSkeletonPreview(true)
        const queryClient = new QueryClient({
            defaultOptions: { queries: { retry: false } },
        })

        const { container } = render(
            <QueryClientProvider client={queryClient}>
                <MemoryRouter>
                    <ProfileSecretsSettings />
                </MemoryRouter>
            </QueryClientProvider>
        )

        expect(container.textContent).toContain('Secrets')
        expect(container.textContent).toContain('Reference a secret with a dollar sign, e.g.')
        expect(container.querySelector('input[placeholder="Search secrets"]')).not.toBeNull()
        expect(container.textContent).toContain('Bulk add')
        expect(container.textContent).toContain('Add secret')
        expect(container.textContent).toContain('Name')
        expect(container.textContent).toContain('Note')
        expect(container.textContent).toContain('Updated at')

        const desktopRows = container.querySelectorAll('.hidden.md\\:grid.grid-cols-12')
        expect(desktopRows.length).toBeGreaterThanOrEqual(4)
    })

    test('ProfileUsageSettings in preview mode shows real Usage header, description, filter buttons, Total spent label, table header, and skeleton rows', () => {
        setSkeletonPreview(true)
        const queryClient = new QueryClient({
            defaultOptions: { queries: { retry: false } },
        })

        const { container } = render(
            <QueryClientProvider client={queryClient}>
                <MemoryRouter>
                    <ProfileUsageSettings />
                </MemoryRouter>
            </QueryClientProvider>
        )

        expect(container.textContent).toContain('Usage')
        expect(container.textContent).toContain('Track your token consumption, credit deductions')
        expect(container.textContent).toContain('1d')
        expect(container.textContent).toContain('7d')
        expect(container.textContent).toContain('30d')
        expect(container.textContent).toContain('90d')
        expect(container.textContent).toContain('Total spent:')
        expect(container.textContent).toContain('Date')
        expect(container.textContent).toContain('Project')
        expect(container.textContent).toContain('Model')
        expect(container.textContent).toContain('Token Usage')
        expect(container.textContent).toContain('Cost')

        const desktopRows = container.querySelectorAll('.hidden.md\\:flex, .hidden.md\\:grid')
        expect(desktopRows.length).toBeGreaterThanOrEqual(1)
    })
})
