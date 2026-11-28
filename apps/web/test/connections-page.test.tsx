import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import React from 'react'

if (!globalThis.document) {
    GlobalRegistrator.register()
}

// load react-dom and the app only after the dom exists, or react skips its input events
const { render, screen, fireEvent, cleanup, act, waitFor } = await import('@testing-library/react')
const { MemoryRouter, useLocation } = await import('react-router-dom')
const { getViewForPath } = await import('../src/app/types')
const { ConnectionsPage } = await import('../src/features/connections/components/ConnectionsPage')
const { setConnectionsDemo } = await import('../src/features/connections/lib/connectionsDemo')
const { SETTINGS_PAGES } = await import('../src/features/navigation/search/searchItems')

const profile = {
    id: 'user-1',
    name: 'Test',
    email: 'test@example.com',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    emailVerified: true,
    receiveNotification: true,
    googleId: null as string | null,
    githubConnected: false,
    githubUsername: undefined as string | undefined,
}

const LocationProbe: React.FC = () => {
    const location = useLocation()
    return <div data-testid="location">{location.pathname + location.search}</div>
}

const renderAt = (path: string, profileOverride: Partial<typeof profile> = {}) => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    client.setQueryData(['profile'], { ...profile, ...profileOverride })
    return render(
        <QueryClientProvider client={client}>
            <MemoryRouter initialEntries={[path]}>
                <ConnectionsPage />
                <LocationProbe />
            </MemoryRouter>
        </QueryClientProvider>
    )
}

const location = () => screen.getByTestId('location').textContent

/**
 * types into a controlled field. when another test file loaded react-dom before the
 * dom existed, react falls back to watching focus + key events instead of input
 * events, so send those too.
 */
const typeInto = (el: HTMLElement, value: string) => {
    fireEvent.focusIn(el)
    fireEvent.change(el, { target: { value } })
    fireEvent.keyUp(el)
    fireEvent.focusOut(el)
}

beforeEach(() => {
    cleanup()
})

afterEach(() => {
    cleanup()
    setConnectionsDemo(null)
})

describe('connections routes', () => {
    test('connections urls, old and new, open settings', () => {
        expect(getViewForPath('/settings/connections')).toBe('profile')
        expect(getViewForPath('/settings/connections/skills/new')).toBe('profile')
        expect(getViewForPath('/connections')).toBe('profile')
        expect(getViewForPath('/connections/skills/new')).toBe('profile')
        expect(getViewForPath('/settings/repositories')).toBe('profile')
        expect(getViewForPath('/settings/secrets')).toBe('profile')
    })

    test('old urls redirect into /settings/connections', () => {
        // /settings/repositories is its own settings page again, the Connections page does not
        // own or redirect it
        renderAt('/integrations')
        expect(location()).toBe('/settings/connections/apps')
        cleanup()
        renderAt('/connections')
        expect(location()).toBe('/settings/connections/apps')
        cleanup()
        renderAt('/connections/mcps/sentry')
        expect(location()).toBe('/settings/connections/mcps/sentry')
        cleanup()
        renderAt('/settings/connections')
        expect(location()).toBe('/settings/connections/apps')
        cleanup()
        renderAt('/settings/connections/nope')
        expect(location()).toBe('/settings/connections/apps')
    })

    test('search points at the pages under settings', () => {
        const paths = SETTINGS_PAGES.map((page) => page.path)
        expect(paths).toContain('/settings/connections/apps')
        expect(paths).toContain('/settings/connections/mcps')
        expect(paths).not.toContain('/connections/apps')
        expect(paths).toContain('/settings/repositories')
    })
})

describe('without demo mode', () => {
    beforeEach(() => setConnectionsDemo(false))

    test('apps tab lists github with connect, and no sample apps', () => {
        renderAt('/settings/connections/apps')
        expect(screen.getByRole('heading', { name: 'Connections' })).toBeDefined()
        expect(screen.getByText('GitHub')).toBeDefined()
        expect(screen.getByRole('button', { name: 'Connect' })).toBeDefined()
        expect(screen.queryByText('Soon')).toBeNull()
        expect(screen.queryByText('Slack')).toBeNull()
        expect(screen.queryByText('Linear')).toBeNull()
    })

    test('connected github shows the connected pill and account', () => {
        renderAt('/settings/connections/apps', { githubConnected: true, githubUsername: 'octo' })
        expect(screen.getByText('Connected')).toBeDefined()
        expect(screen.getByText('octo')).toBeDefined()
    })

    test('the tab buttons switch the url', () => {
        renderAt('/settings/connections/apps')
        fireEvent.click(screen.getByRole('radio', { name: 'MCPs' }))
        expect(location()).toBe('/settings/connections/mcps')
    })
})
