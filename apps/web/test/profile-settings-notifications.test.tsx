import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { expect, test, describe, afterEach, beforeEach, mock } from 'bun:test'
import React from 'react'
import { MemoryRouter } from 'react-router-dom'

import { ProfileSettingsContent } from '../src/features/profile/components/ProfileSettingsContent'

if (!globalThis.document) {
    GlobalRegistrator.register()
}

const { render, screen, cleanup, fireEvent } = await import('@testing-library/react')

describe('Profile Settings Notifications Tab Placement', () => {
    let queryClient: QueryClient

    beforeEach(() => {
        queryClient = new QueryClient({
            defaultOptions: {
                queries: { retry: false },
            },
        })
    })

    afterEach(() => {
        mock.restore()
        cleanup()
    })

    test('ProfileSettingsContent (Account tab) renders Notifications section with toggles', () => {
        const handleNotificationChange = mock((_settings: Record<string, unknown>) => {})
        // the section reads the saved values from the profile query (#636)
        queryClient.setQueryData(['profile'], {
            id: 'test-user',
            notifyProductUpdates: false,
            notifySecurityAlerts: true,
            notifyLevel: 'IMPORTANT',
            notifyEmail: true,
            notifyPush: false,
            digestEnabled: false,
            digestTime: '09:00',
            timezone: 'UTC',
        })

        render(
            <QueryClientProvider client={queryClient}>
                <MemoryRouter>
                    <ProfileSettingsContent
                        profile={{
                            id: 'test-user',
                            name: 'Test User',
                            email: 'test@example.com',
                            username: 'testuser',
                            createdAt: new Date().toISOString(),
                            updatedAt: new Date().toISOString(),
                            emailVerified: true,
                            receiveNotification: true,
                            googleId: null,
                            githubConnected: false,
                        }}
                        resolvedName="Test User"
                        hasProfile={true}
                        isGithubConnected={false}
                        isNotificationPending={false}
                        onOpenNameModal={() => {}}
                        onOpenUsernameModal={() => {}}
                        onNotificationChange={handleNotificationChange}
                        onConnectGithub={() => {}}
                        onSignOut={() => {}}
                        onOpenSignOutAllSessionsModal={() => {}}
                        onOpenDeleteAccountModal={() => {}}
                    />
                </MemoryRouter>
            </QueryClientProvider>
        )

        // Headings
        expect(screen.getByRole('heading', { name: 'Account' })).toBeDefined()
        expect(screen.getByRole('heading', { name: 'Notifications' })).toBeDefined()
        // devices and data (#636) replace the old sign in box; the support switch is gone
        expect(screen.getByRole('heading', { name: 'Devices' })).toBeDefined()
        expect(screen.getByRole('heading', { name: 'Data' })).toBeDefined()
        expect(screen.queryByRole('heading', { name: 'Support' })).toBeNull()
        expect(
            screen.queryByRole('switch', { name: 'Let December support open my sessions' })
        ).toBeNull()
        expect(screen.getByText('Export my data')).toBeDefined()
        expect(screen.getByText('Delete all sessions')).toBeDefined()

        // Account header: name and email, with no username or password rows
        expect(screen.getByText('Test User')).toBeDefined()
        expect(screen.getByText('test@example.com')).toBeDefined()
        expect(screen.getByRole('button', { name: 'Edit name' })).toBeDefined()
        expect(screen.queryByText('Username')).toBeNull()
        expect(screen.queryByText('Password')).toBeNull()

        // each button says its action and does not repeat the row label
        expect(screen.getByRole('button', { name: 'Sign out everywhere' })).toBeDefined()
        expect(screen.getByRole('button', { name: 'Delete account' })).toBeDefined()

        // Notification options (Project activity should not be present)
        expect(screen.queryByText('Project activity')).toBeNull()
        expect(
            screen.queryByText('Get notification updates when someone interacts with your projects')
        ).toBeNull()
        // labels only, with no grey explainer lines under them
        expect(screen.getByText('Product updates')).toBeDefined()
        expect(
            screen.queryByText('Get notification updates about new features and improvements')
        ).toBeNull()
        expect(screen.getByText('Security alerts')).toBeDefined()
        expect(
            screen.queryByText('Get notification updates for important security notices')
        ).toBeNull()

        // Preferences is a section of this page
        expect(screen.getByRole('heading', { name: 'Preferences' })).toBeDefined()
        expect(screen.getByRole('radiogroup', { name: 'Send with' })).toBeDefined()

        // Notification switches: Product updates, and Security alerts that stay on
        const productUpdates = screen.getByRole('switch', { name: 'Product updates' })
        const securityAlerts = screen.getByRole('switch', { name: 'Security alerts' })

        fireEvent.click(productUpdates)
        expect(handleNotificationChange).toHaveBeenCalledWith({ notifyProductUpdates: true })

        expect(securityAlerts.getAttribute('aria-checked')).toBe('true')
        expect(securityAlerts.hasAttribute('disabled')).toBe(true)

        // the level, email and the daily summary save what changed (#636)
        fireEvent.click(screen.getByRole('radio', { name: 'Everything' }))
        expect(handleNotificationChange).toHaveBeenCalledWith({ notifyLevel: 'ALL' })

        fireEvent.click(screen.getByRole('switch', { name: 'Email' }))
        expect(handleNotificationChange).toHaveBeenCalledWith({ notifyEmail: false })

        fireEvent.click(screen.getByRole('switch', { name: 'Daily summary' }))
        const lastCall = handleNotificationChange.mock.calls.at(-1)?.[0]
        expect(lastCall?.digestEnabled).toBe(true)
        expect(typeof lastCall?.timezone).toBe('string')
    })
})
