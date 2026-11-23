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
        const handleNotificationToggle = mock(() => {})

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
                        emailNotifications={true}
                        productUpdates={false}
                        securityAlerts={true}
                        isNotificationPending={false}
                        onOpenNameModal={() => {}}
                        onOpenUsernameModal={() => {}}
                        onNotificationToggle={handleNotificationToggle}
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
        expect(screen.getByRole('heading', { name: 'Sign in' })).toBeDefined()

        // Account header: name and email, with no username or password rows
        expect(screen.getByText('Test User')).toBeDefined()
        expect(screen.getByText('test@example.com')).toBeDefined()
        expect(screen.getByRole('button', { name: 'Edit name' })).toBeDefined()
        expect(screen.queryByText('Username')).toBeNull()
        expect(screen.queryByText('Password')).toBeNull()

        // each button says its action and does not repeat the row label
        expect(screen.getByRole('button', { name: 'Sign out everywhere' })).toBeDefined()
        expect(screen.getByRole('button', { name: 'Delete' })).toBeDefined()

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

        // Notification switches: Product updates and Security alerts
        const productUpdates = screen.getByRole('switch', { name: 'Product updates' })
        const securityAlerts = screen.getByRole('switch', { name: 'Security alerts' })

        fireEvent.click(productUpdates)
        expect(handleNotificationToggle).toHaveBeenCalledWith('notifyProductUpdates', true)

        fireEvent.click(securityAlerts)
        expect(handleNotificationToggle).toHaveBeenCalledWith('notifySecurityAlerts', false)
    })
})
