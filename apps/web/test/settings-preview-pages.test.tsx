import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import React from 'react'

if (!globalThis.document) {
    GlobalRegistrator.register()
}

const { render, screen, cleanup, fireEvent } = await import('@testing-library/react')

const { setConnectionsDemo } = await import('../src/features/connections/lib/connectionsDemo')
const { ProfileMembersSettings } =
    await import('../src/features/profile/components/ProfileMembersSettings')
const { ProfileNotificationsSettings } =
    await import('../src/features/profile/components/ProfileNotificationsSettings')
const { ProfilePullRequestSettings } =
    await import('../src/features/profile/components/ProfilePullRequestSettings')
const { ProfileSandboxSettings } =
    await import('../src/features/profile/components/ProfileSandboxSettings')
const { resetPreviewValues } = await import('../src/features/profile/components/SettingsUi')

// react listens to more than "change" on an input, so send the whole sequence. a bare
// change event is dropped when another test file loaded react-dom first
const typeInto = (el: HTMLElement, value: string) => {
    fireEvent.focusIn(el)
    fireEvent.change(el, { target: { value } })
    fireEvent.keyUp(el)
    fireEvent.focusOut(el)
}

const wrap = (ui: React.ReactNode) =>
    render(
        <QueryClientProvider
            client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
        >
            {ui}
        </QueryClientProvider>
    )

const notifications = (
    <ProfileNotificationsSettings
        productUpdates={true}
        securityAlerts={true}
        onNotificationToggle={() => {}}
    />
)

describe('settings pages that are ui only', () => {
    beforeEach(() => {
        cleanup()
        resetPreviewValues()
        setConnectionsDemo(null)
    })

    afterEach(() => {
        cleanup()
        setConnectionsDemo(null)
    })

    test('without the preview every page says coming soon and shows no controls', () => {
        setConnectionsDemo(false)
        wrap(
            <>
                {notifications}
                <ProfilePullRequestSettings />
                <ProfileSandboxSettings />
                <ProfileMembersSettings ownerName="Test User" ownerEmail="test@example.com" />
            </>
        )
        expect(screen.getByText('Notification settings are coming soon')).toBeDefined()
        expect(screen.getByText('Pull request settings are coming soon')).toBeDefined()
        expect(screen.getByText('Sandbox settings are coming soon')).toBeDefined()
        expect(screen.getByText('Team accounts are coming soon')).toBeDefined()
        expect(screen.queryAllByRole('switch').length).toBe(0)
        expect(screen.queryAllByRole('radiogroup').length).toBe(0)
    })

    test('notifications: one level, and the real product and security switches', () => {
        setConnectionsDemo(true)
        const calls: [string, boolean][] = []
        wrap(
            <ProfileNotificationsSettings
                productUpdates={false}
                securityAlerts={true}
                onNotificationToggle={(field, value) => calls.push([field, value])}
            />
        )
        const important = screen.getByRole('radio', { name: 'Important' })
        expect(important.getAttribute('aria-checked')).toBe('true')
        fireEvent.click(screen.getByRole('radio', { name: 'Everything' }))
        expect(screen.getByRole('radio', { name: 'Everything' }).getAttribute('aria-checked')).toBe(
            'true'
        )

        fireEvent.click(screen.getByRole('switch', { name: 'Product updates' }))
        expect(calls).toEqual([['notifyProductUpdates', true]])
    })

    test('sandbox: Stop takes the row out of the running list', () => {
        setConnectionsDemo(true)
        wrap(<ProfileSandboxSettings />)
        expect(screen.getByText('2 running')).toBeDefined()
        fireEvent.click(screen.getByRole('button', { name: 'Stop fix-login-redirect' }))
        expect(screen.queryByText('fix-login-redirect')).toBeNull()
        expect(screen.getByText('1 running')).toBeDefined()
    })

    test('members: an invite needs a real email and adds an invited row', () => {
        setConnectionsDemo(true)
        wrap(<ProfileMembersSettings ownerName="Test User" ownerEmail="test@example.com" />)
        expect(screen.getByText('Test User')).toBeDefined()

        fireEvent.click(screen.getByRole('button', { name: 'Invite' }))
        const email = screen.getByLabelText('Email')
        typeInto(email, 'not-an-email')
        fireEvent.submit(email.closest('form')!)
        expect(screen.getByRole('alert').textContent).toContain('Enter an email address')

        typeInto(email, 'sam@example.com')
        fireEvent.submit(email.closest('form')!)
        expect(screen.getByText('sam@example.com')).toBeDefined()
    })
})
