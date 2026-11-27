import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import React from 'react'

if (!globalThis.document) {
    GlobalRegistrator.register()
}

const { render, screen, cleanup, fireEvent } = await import('@testing-library/react')

const { setConnectionsDemo } = await import('../src/features/connections/lib/connectionsDemo')
const { AccountNotificationsSection } =
    await import('../src/features/profile/components/AccountNotificationsSection')
const { resetPreviewValues } = await import('../src/features/profile/components/SettingsUi')

const wrap = (ui: React.ReactNode) =>
    render(
        <QueryClientProvider
            client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
        >
            {ui}
        </QueryClientProvider>
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

    // the members page (#640) and the sandbox page (#637) are on the server now: see
    // team-members.test.tsx and settings-sandbox.test.tsx

    // notifications are on the server now (#636): every row shows without the preview
    test('account notifications: all rows without the preview, security alerts stay on', () => {
        const calls: Record<string, unknown>[] = []
        wrap(<AccountNotificationsSection onNotificationChange={(value) => calls.push(value)} />)

        expect(screen.getByRole('radio', { name: 'Important' }).getAttribute('aria-checked')).toBe(
            'true'
        )
        // no email and no daily summary rows: the inbox and push only (inbox review S1, S2)
        expect(screen.queryByRole('switch', { name: 'Email' })).toBeNull()
        expect(screen.queryByRole('switch', { name: 'Daily summary' })).toBeNull()
        const security = screen.getByRole('switch', { name: 'Security alerts' })
        expect(security.hasAttribute('disabled')).toBe(true)

        fireEvent.click(screen.getByRole('switch', { name: 'Product updates' }))
        expect(calls).toEqual([{ notifyProductUpdates: false }])
    })
})
