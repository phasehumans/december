import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { expect, test, describe, afterEach, beforeEach, mock } from 'bun:test'
import React from 'react'
import { MemoryRouter } from 'react-router-dom'

if (!globalThis.document) {
    GlobalRegistrator.register()
}

const { render, screen, fireEvent, cleanup, act } = await import('@testing-library/react')

import { useAppStore } from '../src/app/store'
import { MobileMenuSheet } from '../src/features/navigation/components/MobileMenuSheet'
import {
    MobileBackButton,
    MobileInboxButton,
    MobileTopBar,
} from '../src/features/navigation/components/MobileTopBar'

const wrap = (ui: React.ReactNode, path = '/') => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    return render(
        <QueryClientProvider client={client}>
            <MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter>
        </QueryClientProvider>
    )
}

describe('mobile top bar', () => {
    beforeEach(() => {
        cleanup()
        useAppStore.setState({
            isAuthenticated: false,
            isMobileSidebarOpen: false,
            mobileSheetStart: 'menu',
        })
    })
    afterEach(() => cleanup())

    test('menu button opens the menu sheet', () => {
        wrap(<MobileTopBar title="Sessions" />)
        expect(screen.getByText('Sessions')).toBeDefined()
        fireEvent.click(screen.getByRole('button', { name: 'Open menu' }))
        expect(useAppStore.getState().isMobileSidebarOpen).toBe(true)
        expect(useAppStore.getState().mobileSheetStart).toBe('menu')
    })

    test('inbox button opens the sheet straight on the inbox', () => {
        wrap(<MobileTopBar hasInboxButton right={<MobileInboxButton />} />)
        fireEvent.click(screen.getByRole('button', { name: 'Inbox' }))
        expect(useAppStore.getState().isMobileSidebarOpen).toBe(true)
        expect(useAppStore.getState().mobileSheetStart).toBe('inbox')
    })

    test('back button replaces the menu button on settings pages', () => {
        const onBack = mock(() => {})
        wrap(<MobileTopBar left={<MobileBackButton label="Settings" onClick={onBack} />} />)
        expect(screen.queryByRole('button', { name: 'Open menu' })).toBeNull()
        fireEvent.click(screen.getByText('Settings'))
        expect(onBack).toHaveBeenCalledTimes(1)
    })
})

describe('mobile menu sheet', () => {
    const props = {
        onNewThread: () => {},
        onSessions: () => {},
        onProfile: () => {},
        onOpenProject: () => {},
        isAuthenticated: false,
        onOpenAuth: () => {},
    }

    beforeEach(() => cleanup())
    afterEach(() => {
        cleanup()
        useAppStore.setState({ isMobileSidebarOpen: false, mobileSheetStart: 'menu' })
    })

    test('menu level lists the nav rows and marks the current screen', () => {
        useAppStore.setState({ isMobileSidebarOpen: true, mobileSheetStart: 'menu' })
        wrap(<MobileMenuSheet {...props} />, '/settings/account')
        for (const label of ['New', 'Search', 'Super Crew', 'Sessions', 'Settings']) {
            expect(screen.getAllByText(label).length).toBeGreaterThan(0)
        }
        const settingsRow = screen.getAllByRole('button').find((b) => b.textContent === 'Settings')
        expect(settingsRow?.className).toContain('bg-[#262626]')
    })

    test('opened from the bell it starts on the inbox with no back arrow', () => {
        useAppStore.setState({ isMobileSidebarOpen: true, mobileSheetStart: 'inbox' })
        wrap(<MobileMenuSheet {...props} />)
        expect(screen.getByText('Inbox')).toBeDefined()
        expect(screen.queryByRole('button', { name: 'Back' })).toBeNull()
        expect(screen.queryByText('Super Crew')).toBeNull()
    })

    test('Super Crew row closes the sheet and opens the card', async () => {
        useAppStore.setState({
            isMobileSidebarOpen: true,
            mobileSheetStart: 'menu',
            isSuperCrewOpen: false,
        })
        wrap(<MobileMenuSheet {...props} />)
        const row = screen
            .getAllByRole('button')
            .find((b) => b.textContent?.startsWith('Super Crew'))
        await act(async () => {
            fireEvent.click(row!)
            await new Promise((resolve) => setTimeout(resolve, 50))
        })
        expect(useAppStore.getState().isMobileSidebarOpen).toBe(false)
        expect(useAppStore.getState().isSuperCrewOpen).toBe(true)
    })
})
