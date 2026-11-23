import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { expect, test, describe, afterEach, beforeEach, mock, spyOn } from 'bun:test'
import React from 'react'
import { MemoryRouter } from 'react-router-dom'

if (!globalThis.document) {
    GlobalRegistrator.register()
}

const { render, screen, fireEvent, cleanup, act } = await import('@testing-library/react')

import { useAppStore } from '../src/app/store'
import {
    MobileMenuSheet,
    openLabelForLink,
} from '../src/features/navigation/components/MobileMenuSheet'
import {
    MobileBackButton,
    MobileInboxButton,
    MobileTopBar,
} from '../src/features/navigation/components/MobileTopBar'
import { notificationAPI } from '../src/features/notification/api/notification'

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

    test('Settings row opens the Settings level, with no sign out or CLI row', () => {
        useAppStore.setState({ isMobileSidebarOpen: true, mobileSheetStart: 'menu' })
        wrap(<MobileMenuSheet {...props} />)
        const row = screen.getAllByRole('button').find((b) => b.textContent === 'Settings')
        fireEvent.click(row!)

        for (const label of [
            'Account',
            'Notifications',
            'Defaults',
            'Repositories',
            'Pull requests',
            'Sandbox',
            'Connections',
            'Secrets',
            'Your keys',
            'Billing',
            'Usage',
            'Members',
            'Send feedback',
        ]) {
            expect(screen.getByText(label)).toBeDefined()
        }
        expect(screen.queryByText('Sign out')).toBeNull()
        expect(screen.queryByText('Try December CLI')).toBeNull()
        expect(screen.queryByText('Super Crew')).toBeNull()

        fireEvent.click(screen.getByRole('button', { name: 'Back' }))
        expect(screen.getByText('Super Crew')).toBeDefined()
    })

    test('a settings page reopens the sheet on the Settings level', () => {
        useAppStore.setState({ isMobileSidebarOpen: true, mobileSheetStart: 'settings' })
        wrap(<MobileMenuSheet {...props} />, '/settings/billing')
        expect(screen.getByText('Your keys')).toBeDefined()
        const billing = screen.getAllByRole('button').find((b) => b.textContent === 'Billing')
        expect(billing?.className).toContain('bg-[#262626]')
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

describe('mobile inbox message', () => {
    const props = {
        onNewThread: () => {},
        onSessions: () => {},
        onProfile: () => {},
        onOpenProject: () => {},
        isAuthenticated: true,
        onOpenAuth: () => {},
    }
    const note = (patch: Record<string, unknown>) => ({
        id: 'n1',
        userId: 'u1',
        title: 'Session finished',
        message: 'Your session finished and opened a pull request.',
        isRead: false,
        type: 'INFO',
        link: '/pull-requests',
        createdAt: new Date().toISOString(),
        ...patch,
    })
    const spies: { mockRestore: () => void }[] = []

    beforeEach(() => cleanup())
    afterEach(() => {
        cleanup()
        spies.splice(0).forEach((s) => s.mockRestore())
        useAppStore.setState({ isMobileSidebarOpen: false, mobileSheetStart: 'menu' })
    })

    const openNote = async (n: ReturnType<typeof note>) => {
        spies.push(
            spyOn(notificationAPI, 'getNotifications').mockResolvedValue({
                notifications: [n],
                pagination: { total: 1, page: 1, limit: 20, totalPages: 1 },
            } as never),
            spyOn(notificationAPI, 'getUnreadCount').mockResolvedValue({ count: 1 } as never),
            spyOn(notificationAPI, 'markAsRead').mockResolvedValue({} as never)
        )
        useAppStore.setState({ isMobileSidebarOpen: true, mobileSheetStart: 'inbox' })
        wrap(<MobileMenuSheet {...props} />)
        fireEvent.click(await screen.findByText(n.title as string))
    }

    test('delete is an icon in the header and the Open button says where it goes', async () => {
        const remove = spyOn(notificationAPI, 'deleteNotification').mockResolvedValue(
            undefined as never
        )
        spies.push(remove)
        await openNote(note({}))

        expect(screen.getByText(/^Today, /)).toBeDefined()
        expect(screen.getByRole('button', { name: 'View pull requests' })).toBeDefined()
        expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull()

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Delete notification' }))
        })
        expect(remove).toHaveBeenCalledTimes(1)
        expect(remove.mock.calls[0][0]).toBe('n1')
    })

    test('a message with no link has no Open button', async () => {
        await openNote(note({ title: 'New sign in', link: null }))
        expect(screen.getByText('New sign in')).toBeDefined()
        expect(screen.queryByRole('button', { name: /open|view/i })).toBeNull()
    })

    test('Open labels follow the link', () => {
        expect(openLabelForLink('/pull-requests')).toBe('View pull requests')
        expect(openLabelForLink('/settings/billing')).toBe('Open billing')
        expect(openLabelForLink('/sessions/abc')).toBe('Open session')
        expect(openLabelForLink('https://trydecember.com/docs/changelog')).toBe('Open')
        expect(openLabelForLink('/somewhere')).toBe('Open')
    })
})
