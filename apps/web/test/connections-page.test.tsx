import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import React from 'react'

if (!globalThis.document) {
    GlobalRegistrator.register()
}

// load react-dom and the app only after the dom exists, or react skips its input events
const { render, screen, fireEvent, cleanup, act } = await import('@testing-library/react')
const { MemoryRouter, useLocation } = await import('react-router-dom')
const { getViewForPath } = await import('../src/app/types')
const { ConnectionsPage } = await import('../src/features/connections/components/ConnectionsPage')
const { useConnectionsStore } =
    await import('../src/features/connections/hooks/useConnectionsStore')
const { setConnectionsDemo } = await import('../src/features/connections/lib/connectionsDemo')
const { SETTINGS_PAGES } = await import('../src/features/navigation/search/searchItems')

const initialStore = useConnectionsStore.getState()

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
    useConnectionsStore.setState(initialStore, true)
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
        renderAt('/settings/repositories')
        expect(location()).toBe('/settings/connections/apps/github')
        cleanup()
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
        expect(paths).not.toContain('/settings/repositories')
    })
})

describe('without demo mode', () => {
    beforeEach(() => setConnectionsDemo(false))

    test('apps tab lists github with connect, other apps are soon', () => {
        renderAt('/settings/connections/apps')
        expect(screen.getByRole('heading', { name: 'Connections' })).toBeDefined()
        expect(screen.getByText('GitHub')).toBeDefined()
        expect(screen.getByRole('button', { name: 'Connect' })).toBeDefined()
        expect(screen.getAllByText('Soon').length).toBe(3)
    })

    test('connected github shows the connected pill and account', () => {
        renderAt('/settings/connections/apps', { githubConnected: true, githubUsername: 'octo' })
        expect(screen.getByText('Connected')).toBeDefined()
        expect(screen.getByText('octo')).toBeDefined()
    })

    test('tabs without a backend say they are coming soon', () => {
        renderAt('/settings/connections/skills')
        expect(screen.getByText('Skills are coming soon')).toBeDefined()
        expect(screen.queryByText('write-tests')).toBeNull()
        cleanup()
        renderAt('/settings/connections/memory')
        expect(screen.getByText('Memory is coming soon')).toBeDefined()
    })

    test('the tab buttons switch the url', () => {
        renderAt('/settings/connections/apps')
        fireEvent.click(screen.getByRole('radio', { name: 'MCPs' }))
        expect(location()).toBe('/settings/connections/mcps')
    })
})

describe('demo mode', () => {
    beforeEach(() => setConnectionsDemo(true))

    test('skills list shows source and a working switch', () => {
        renderAt('/settings/connections/skills')
        expect(screen.getByText('write-tests')).toBeDefined()
        expect(screen.getByText('release-notes')).toBeDefined()
        fireEvent.click(screen.getByRole('switch', { name: 'Turn write-tests on or off' }))
        expect(
            useConnectionsStore.getState().skills.find((s) => s.name === 'write-tests')?.enabled
        ).toBe(false)
    })

    test('new skill checks the name and saves', () => {
        renderAt('/settings/connections/skills/new')
        const save = screen.getByRole('button', { name: 'Save skill' }) as HTMLButtonElement
        expect(save.disabled).toBe(true)

        typeInto(screen.getByLabelText('Name'), 'Write Tests')
        expect(screen.getByText('Use lowercase letters, numbers and hyphens')).toBeDefined()

        typeInto(screen.getByLabelText('Name'), 'pr-summary')
        expect(screen.getByText('You already have a skill with this name')).toBeDefined()

        typeInto(screen.getByLabelText('Name'), 'lint-fix')
        typeInto(screen.getByLabelText('Description'), 'Fix lint errors')
        expect(save.disabled).toBe(false)
        fireEvent.click(save)

        expect(useConnectionsStore.getState().skills.some((s) => s.name === 'lint-fix')).toBe(true)
        expect(location()).toBe('/settings/connections/skills/lint-fix')
        expect(screen.getByText('Saved')).toBeDefined()
    })

    test('turning a plugin off locks its items', () => {
        useConnectionsStore.getState().setPluginEnabled('release-kit', false)
        renderAt('/settings/connections/skills')
        const sw = screen.getByRole('switch', {
            name: 'Turn release-notes on or off',
        }) as HTMLButtonElement
        expect(sw.disabled).toBe(true)
    })

    test('uninstalled plugin items are hidden', () => {
        useConnectionsStore.getState().setPluginInstalled('release-kit', false)
        renderAt('/settings/connections/skills')
        expect(screen.queryByText('release-notes')).toBeNull()
    })

    test('mcp list shows each status, and remove asks first', () => {
        renderAt('/settings/connections/mcps')
        expect(screen.getAllByText('Connected').length).toBeGreaterThan(0)
        expect(screen.getAllByText('Needs sign-in').length).toBeGreaterThan(0)
        expect(screen.getAllByText('Error').length).toBeGreaterThan(0)
        expect(screen.getAllByText('Off').length).toBeGreaterThan(0)

        cleanup()
        renderAt('/settings/connections/mcps/sentry')
        fireEvent.click(screen.getByRole('button', { name: 'MCP options' }))
        fireEvent.click(screen.getByText('Remove MCP'))
        expect(screen.getByText('Remove sentry?')).toBeDefined()
        fireEvent.click(screen.getByRole('button', { name: 'Remove' }))
        expect(useConnectionsStore.getState().mcps.some((m) => m.name === 'sentry')).toBe(false)
        expect(location()).toBe('/settings/connections/mcps')
    })

    test('add mcp modal opens from ?add and checks the url', () => {
        renderAt('/settings/connections/mcps?add=1')
        expect(screen.getByText('Add MCP', { selector: 'h2' })).toBeDefined()
        typeInto(screen.getByLabelText('Name'), 'vercel')
        typeInto(screen.getByLabelText('Server URL'), 'mcp.vercel')
        expect(screen.getByText('Enter a full URL starting with https://')).toBeDefined()
        typeInto(screen.getByLabelText('Server URL'), 'https://mcp.vercel.com')
        fireEvent.click(screen.getByText('Add MCP', { selector: 'button[type="submit"]' }))
        expect(useConnectionsStore.getState().mcps.some((m) => m.name === 'vercel')).toBe(true)
        expect(location()).toBe('/settings/connections/mcps/vercel')
    })

    test('hooks json view rejects invalid json', () => {
        renderAt('/settings/connections/hooks')
        expect(screen.getByText('./scripts/check.sh')).toBeDefined()
        fireEvent.click(screen.getByRole('radio', { name: 'JSON' }))
        const editor = screen.getByLabelText('hooks.json') as HTMLTextAreaElement
        expect(editor.value).toContain('"PreToolUse"')
        typeInto(editor, '{ "hooks": { "Nope": [] } }')
        expect(screen.getByText('Unknown event "Nope"')).toBeDefined()
        expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(
            true
        )
    })

    test('rule editor warns past 16 KiB', () => {
        renderAt('/settings/connections/rules/new')
        typeInto(screen.getByLabelText('Rule'), 'x'.repeat(17000))
        expect(screen.getByText('Only the first 16 KiB is used.')).toBeDefined()
    })

    test('memory: delete all asks first, then empties the list', () => {
        renderAt('/settings/connections/memory')
        expect(screen.getByText('Prefers bun over npm')).toBeDefined()
        fireEvent.click(screen.getByRole('button', { name: 'Memory options' }))
        fireEvent.click(screen.getByText('Delete all'))
        expect(screen.getByText('Delete all 3 memories?')).toBeDefined()
        fireEvent.click(screen.getByRole('button', { name: 'Delete all' }))
        expect(screen.getByText('No memories yet')).toBeDefined()
    })

    test('plugin install shows the notice once', async () => {
        renderAt('/settings/connections/plugins')
        fireEvent.click(screen.getAllByRole('button', { name: 'Install' })[0])
        expect(screen.getByText('Plugins can run commands in your sessions.')).toBeDefined()
        fireEvent.click(screen.getAllByRole('button', { name: 'Install' }).at(-1) as HTMLElement)
        expect(useConnectionsStore.getState().hasSeenInstallNotice).toBe(true)
        await act(async () => {
            await new Promise((r) => setTimeout(r, 950))
        })
        expect(screen.getAllByText('Installed').length).toBeGreaterThan(0)
    })
})
