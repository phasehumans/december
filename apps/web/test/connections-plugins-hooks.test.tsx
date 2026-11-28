import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import React from 'react'

if (!globalThis.document) {
    GlobalRegistrator.register()
}

// load react-dom and the app only after the dom exists, or react skips its input events
const { render, screen, fireEvent, cleanup, waitFor, within } =
    await import('@testing-library/react')
const { MemoryRouter, useLocation } = await import('react-router-dom')
const { ConnectionsPage } = await import('../src/features/connections/components/ConnectionsPage')
const { setConnectionsDemo } = await import('../src/features/connections/lib/connectionsDemo')
const { parseHooksJson, toHooksJson } =
    await import('../src/features/connections/components/HooksTab')

// the Plugins and Hooks tabs on the real api. only fetch is replaced: the tests read what
// the page shows and which requests it sends

type Call = { method: string; path: string; body: any }

const plugin = (name: string, extra: Record<string, unknown> = {}) => ({
    name,
    description: `what ${name} does`,
    version: '1.0.0',
    author: null,
    sourceKind: 'github',
    source: `acme/${name}`,
    commitSha: 'a'.repeat(40),
    enabled: true,
    skills: [
        { name: 'ship', description: 'ship it' },
        { name: 'notes', description: 'write notes' },
    ],
    mcpServers: [{ name: 'docs', transport: 'stdio', target: 'node server.js' }],
    env: [],
    updateAvailable: false,
    fileCount: 4,
    sizeBytes: 2048,
    installedAt: '2026-11-28T10:00:00.000Z',
    updatedAt: '2026-11-28T10:00:00.000Z',
    ...extra,
})

const catalogEntry = (name: string, installed = false) => ({
    name,
    description: `${name} server`,
    category: 'Testing',
    author: 'Someone',
    version: '1.0.0',
    env: name === 'github' ? ['GITHUB_PERSONAL_ACCESS_TOKEN'] : [],
    mcpServers: [name],
    installed,
    updateAvailable: false,
})

const hook = (id: string, extra: Record<string, unknown> = {}) => ({
    id,
    event: 'PreToolUse',
    matcher: 'bash',
    command: `./check-${id}.sh`,
    timeout: 30,
    enabled: true,
    position: 0,
    updatedAt: '2026-11-28T10:00:00.000Z',
    ...extra,
})

const originalFetch = globalThis.fetch
let calls: Call[] = []
let plugins: any[] = []
let catalog: any[] = []
let hooks: any[] = []
let failNext: { match: string; method?: string; status: number; message: string } | null = null
let failReads = false
let updateChanged = true

const reply = (status: number, payload: Record<string, unknown>) =>
    new Response(JSON.stringify({ success: status < 400, ...payload }), {
        status,
        headers: { 'Content-Type': 'application/json' },
    })

const fakeServer = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    const path = url.slice(url.indexOf('/api/v1') + '/api/v1'.length)
    const method = init?.method ?? 'GET'
    const body = init?.body ? JSON.parse(String(init.body)) : undefined
    calls.push({ method, path, body })

    if (
        failNext &&
        path.includes(failNext.match) &&
        (!failNext.method || failNext.method === method)
    ) {
        const { status, message } = failNext
        failNext = null
        return reply(status, { message })
    }
    if (method === 'GET' && failReads) return reply(500, { message: 'down' })

    if (path === '/connections/plugins/marketplace') {
        return reply(200, {
            data: {
                marketplaces: [{ name: 'december-official', description: 'd', plugins: catalog }],
            },
        })
    }
    if (path.startsWith('/connections/plugins')) {
        const name = decodeURIComponent(path.split('/')[3] ?? '')
        if (method === 'GET') return reply(200, { data: { plugins } })
        if (method === 'POST' && !name) {
            const created = plugin(body.source.split('/').pop(), { source: body.source })
            plugins = [...plugins, created]
            catalog = catalog.map((entry) =>
                entry.name === created.name ? { ...entry, installed: true } : entry
            )
            return reply(201, { data: { plugin: created } })
        }
        if (method === 'PATCH') {
            plugins = plugins.map((row) => (row.name === name ? { ...row, ...body } : row))
            return reply(200, { data: { plugin: plugins.find((row) => row.name === name) } })
        }
        if (method === 'POST' && path.endsWith('/update')) {
            plugins = plugins.map((row) =>
                row.name === name ? { ...row, version: '1.1.0', updateAvailable: false } : row
            )
            return reply(200, {
                data: { plugin: plugins.find((row) => row.name === name), changed: updateChanged },
            })
        }
        if (method === 'DELETE') {
            plugins = plugins.filter((row) => row.name !== name)
            return reply(200, { data: { deleted: true } })
        }
    }
    if (path.startsWith('/connections/hooks')) {
        const id = decodeURIComponent(path.split('/')[3] ?? '')
        if (method === 'GET') return reply(200, { data: { hooks } })
        if (method === 'POST') {
            const created = { ...hook(`h${hooks.length + 1}`), ...body, position: hooks.length }
            hooks = [...hooks, created]
            return reply(201, { data: { hook: created } })
        }
        if (method === 'PATCH') {
            hooks = hooks.map((row) => (row.id === id ? { ...row, ...body } : row))
            return reply(200, { data: { hook: hooks.find((row) => row.id === id) } })
        }
        if (method === 'DELETE') {
            hooks = hooks.filter((row) => row.id !== id)
            return reply(200, { data: { deleted: true } })
        }
        if (method === 'PUT') {
            hooks = body.hooks.map((row: any, position: number) => ({
                ...hook(`p${position}`),
                ...row,
                position,
            }))
            return reply(200, { data: { hooks } })
        }
    }
    return reply(200, { data: { skills: [], plugins: [], mcps: [] } })
}) as typeof fetch

const LocationProbe: React.FC = () => {
    const location = useLocation()
    return <div data-testid="location">{location.pathname + location.search}</div>
}

const renderAt = (path: string) =>
    render(
        <QueryClientProvider
            client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
        >
            <MemoryRouter initialEntries={[path]}>
                <ConnectionsPage />
                <LocationProbe />
            </MemoryRouter>
        </QueryClientProvider>
    )

const location = () => screen.getByTestId('location').textContent
const writes = () => calls.filter((call) => call.method !== 'GET')
const shows = (text: string) => screen.queryByText(text) !== null
const rowOf = async (name: string) =>
    (await screen.findByText(name)).closest('[role="button"]') as HTMLElement
/** the dialog with this title: the closest box around its heading that holds a form */
const dialog = (name: string) => {
    let el: HTMLElement | null = screen.getByRole('heading', { name })
    while (el && !el.querySelector('form')) el = el.parentElement
    return el as HTMLElement
}

/** types into a controlled field (see connections-page.test.tsx) */
const typeInto = (el: HTMLElement, value: string) => {
    fireEvent.focusIn(el)
    fireEvent.change(el, { target: { value } })
    fireEvent.keyUp(el)
    fireEvent.focusOut(el)
}

beforeEach(() => {
    cleanup()
    setConnectionsDemo(false)
    calls = []
    plugins = [
        plugin('release'),
        plugin('lint', { enabled: false, skills: [], mcpServers: [], updateAvailable: true }),
    ]
    catalog = [catalogEntry('playwright'), catalogEntry('github'), catalogEntry('release', true)]
    hooks = [
        hook('h1'),
        hook('h2', {
            event: 'Stop',
            matcher: '',
            command: 'npm test',
            enabled: false,
            position: 1,
        }),
    ]
    failNext = null
    failReads = false
    updateChanged = true
    globalThis.fetch = fakeServer
})

afterEach(() => {
    cleanup()
    setConnectionsDemo(null)
    globalThis.fetch = originalFetch
})

describe('plugins tab', () => {
    test('lists the installed plugins and the marketplace, with no sample data or pill', async () => {
        renderAt('/settings/connections/plugins')
        const release = await rowOf('release')
        expect(within(release).getAllByText('2 skills, 1 MCP').length).toBeGreaterThan(0)
        expect(within(release).getByText('1.0.0')).toBeDefined()
        expect(within(await rowOf('lint')).getByText('Update')).toBeDefined()
        expect(
            screen.getByRole('switch', { name: 'Turn lint on or off' }).getAttribute('aria-checked')
        ).toBe('false')
        // marketplace: entries not installed yet
        expect(await screen.findByText('playwright')).toBeDefined()
        expect(screen.getByText('github')).toBeDefined()
        expect(shows('Demo')).toBe(false)
        expect(shows('Plugins are coming soon')).toBe(false)
        expect(calls.some((call) => call.path === '/connections/plugins/marketplace')).toBe(true)
    })

    test('shows the empty state and the load error', async () => {
        plugins = []
        renderAt('/settings/connections/plugins')
        expect(await screen.findByText('No plugins yet')).toBeDefined()
        cleanup()
        failReads = true
        renderAt('/settings/connections/plugins')
        expect(await screen.findByText('Could not load plugins')).toBeDefined()
        expect(await screen.findByText('Could not load the marketplace')).toBeDefined()
    })

    test('search filters both lists', async () => {
        renderAt('/settings/connections/plugins')
        await rowOf('release')
        typeInto(screen.getByLabelText('Search plugins'), 'play')
        await waitFor(() => expect(shows('release')).toBe(false))
        expect(screen.getByText('playwright')).toBeDefined()
        expect(screen.getByText('No results for "play"')).toBeDefined()
    })

    test('installs a marketplace plugin after a confirm that says plugins run commands', async () => {
        renderAt('/settings/connections/plugins')
        await screen.findByText('playwright')
        const card = screen.getByText('playwright').parentElement as HTMLElement
        fireEvent.click(within(card).getByRole('button', { name: 'Install' }))
        expect(screen.getByText('Install playwright?')).toBeDefined()
        expect(screen.getByText('Plugins can run commands in your sessions.')).toBeDefined()
        expect(writes()).toEqual([])

        fireEvent.click(
            within(dialog('Install playwright?')).getByRole('button', { name: 'Install' })
        )
        await waitFor(() =>
            expect(writes()).toEqual([
                { method: 'POST', path: '/connections/plugins', body: { source: 'playwright' } },
            ])
        )
        await waitFor(() =>
            expect(screen.getByRole('switch', { name: 'Turn playwright on or off' })).toBeDefined()
        )
        expect((await screen.findAllByText('Installed')).length).toBeGreaterThan(0)
    })

    test('adds a plugin by owner/repo and opens its page', async () => {
        renderAt('/settings/connections/plugins?add=repo')
        const input = screen.getByLabelText('GitHub repository or plugin name')
        typeInto(input, 'acme/tools')
        fireEvent.click(within(dialog('Add plugin')).getByRole('button', { name: 'Install' }))
        await waitFor(() => expect(location()).toBe('/settings/connections/plugins/tools'))
        expect(writes()[0]).toEqual({
            method: 'POST',
            path: '/connections/plugins',
            body: { source: 'acme/tools' },
        })
        expect(await screen.findByText('acme/tools')).toBeDefined()
    })

    test('an install the server refuses keeps the dialog open and says why', async () => {
        failNext = {
            match: '/connections/plugins',
            method: 'POST',
            status: 400,
            message: 'Only public GitHub repositories can be installed.',
        }
        renderAt('/settings/connections/plugins?add=repo')
        typeInto(
            screen.getByLabelText('GitHub repository or plugin name'),
            'https://gitlab.com/a/b'
        )
        fireEvent.click(within(dialog('Add plugin')).getByRole('button', { name: 'Install' }))
        expect((await within(dialog('Add plugin')).findByRole('alert')).textContent).toBe(
            'Only public GitHub repositories can be installed.'
        )
        expect(location()).toBe('/settings/connections/plugins?add=repo')
    })

    test('the install button waits for a source', () => {
        renderAt('/settings/connections/plugins?add=repo')
        const install = within(dialog('Add plugin')).getByRole('button', {
            name: 'Install',
        }) as HTMLButtonElement
        expect(install.disabled).toBe(true)
    })

    test('the switch sends the PATCH, and moves back when the server refuses', async () => {
        renderAt('/settings/connections/plugins')
        const name = 'Turn release on or off'
        fireEvent.click(await screen.findByRole('switch', { name }))
        await waitFor(() =>
            expect(writes()).toEqual([
                { method: 'PATCH', path: '/connections/plugins/release', body: { enabled: false } },
            ])
        )
        await waitFor(() =>
            expect(screen.getByRole('switch', { name }).getAttribute('aria-checked')).toBe('false')
        )

        failNext = {
            match: '/plugins/lint',
            status: 404,
            message: 'No plugin named lint is installed.',
        }
        fireEvent.click(screen.getByRole('switch', { name: 'Turn lint on or off' }))
        expect((await screen.findByRole('alert')).textContent).toBe(
            'No plugin named lint is installed.'
        )
        expect(
            screen.getByRole('switch', { name: 'Turn lint on or off' }).getAttribute('aria-checked')
        ).toBe('false')
    })

    test('uninstall asks first and names what goes with it', async () => {
        renderAt('/settings/connections/plugins')
        fireEvent.click(within(await rowOf('release')).getByLabelText('Delete plugin'))
        expect(screen.getByText('Uninstall release?')).toBeDefined()
        expect(screen.getByText('Its 2 skills, 1 MCP are removed too.')).toBeDefined()
        fireEvent.click(screen.getByRole('button', { name: 'Uninstall' }))
        await waitFor(() => expect(shows('release')).toBe(false))
        expect(writes()).toEqual([
            { method: 'DELETE', path: '/connections/plugins/release', body: undefined },
        ])
    })

    test('the phone top bar + opens the add dialog', async () => {
        renderAt('/settings/connections/plugins')
        fireEvent.click(screen.getByLabelText('Add to Plugins'))
        expect(location()).toBe('/settings/connections/plugins?add=repo')
        expect(screen.getByLabelText('GitHub repository or plugin name')).toBeDefined()
    })
})

describe('plugin page', () => {
    test('shows the source, version, files, needed secrets and contents', async () => {
        plugins = [
            plugin('github', {
                sourceKind: 'marketplace',
                source: 'github@december-official',
                env: ['GITHUB_PERSONAL_ACCESS_TOKEN'],
                skills: [],
                commitSha: null,
            }),
        ]
        renderAt('/settings/connections/plugins/github')
        expect(await screen.findByText('github@december-official')).toBeDefined()
        expect(screen.getByText('GITHUB_PERSONAL_ACCESS_TOKEN')).toBeDefined()
        expect(screen.getByText('4 files · 2 KB')).toBeDefined()
        expect(screen.getByText('docs')).toBeDefined()
        expect(screen.getByText('MCP (command)')).toBeDefined()
    })

    test('update says when the plugin is up to date or updated', async () => {
        renderAt('/settings/connections/plugins/release')
        fireEvent.click(await screen.findByRole('button', { name: 'Update' }))
        expect(await screen.findByText('Updated')).toBeDefined()
        expect(writes()).toEqual([
            { method: 'POST', path: '/connections/plugins/release/update', body: undefined },
        ])
        updateChanged = false
        fireEvent.click(screen.getByRole('button', { name: 'Update' }))
        expect(await screen.findByText('Up to date')).toBeDefined()
    })

    test('an update the server refuses says why', async () => {
        failNext = { match: '/update', status: 502, message: 'GitHub could not be reached.' }
        renderAt('/settings/connections/plugins/release')
        fireEvent.click(await screen.findByRole('button', { name: 'Update' }))
        expect((await screen.findByRole('alert')).textContent).toBe('GitHub could not be reached.')
    })

    test('uninstall from the page goes back to the list', async () => {
        renderAt('/settings/connections/plugins/release')
        fireEvent.click(await screen.findByLabelText('Plugin options'))
        fireEvent.click(screen.getByRole('button', { name: 'Uninstall' }))
        fireEvent.click(
            within(dialog('Uninstall release?')).getByRole('button', { name: 'Uninstall' })
        )
        await waitFor(() => expect(location()).toBe('/settings/connections/plugins'))
    })

    test('a plugin that is not installed says so', async () => {
        renderAt('/settings/connections/plugins/nothing')
        expect(await screen.findByText('Plugin not found')).toBeDefined()
    })
})

describe('hooks tab', () => {
    test('lists the hooks of the account in order, with no pill', async () => {
        renderAt('/settings/connections/hooks')
        expect(await screen.findByText('./check-h1.sh')).toBeDefined()
        expect(screen.getByText('npm test')).toBeDefined()
        expect(shows('Demo')).toBe(false)
        expect(shows('Hooks are coming soon')).toBe(false)
        const switches = screen.getAllByRole('switch', { name: 'Turn this hook on or off' })
        expect(switches.map((s) => s.getAttribute('aria-checked'))).toEqual(['true', 'false'])
    })

    test('shows the empty state and the load error', async () => {
        hooks = []
        renderAt('/settings/connections/hooks')
        expect(await screen.findByText('No hooks yet')).toBeDefined()
        cleanup()
        failReads = true
        renderAt('/settings/connections/hooks')
        expect(await screen.findByText('Could not load hooks')).toBeDefined()
    })

    test('adds a hook: the event menu, the tools match for tool events only, and the checks', async () => {
        renderAt('/settings/connections/hooks?add=1')
        await screen.findByText('./check-h1.sh')
        expect(screen.getByLabelText('Tools (empty means all)')).toBeDefined()

        fireEvent.click(screen.getByRole('button', { name: 'When' }))
        fireEvent.click(screen.getByRole('option', { name: 'Agent stops' }))
        expect(screen.queryByLabelText('Tools (empty means all)')).toBeNull()

        typeInto(screen.getByLabelText('Timeout (seconds)'), '900')
        expect(screen.getByText('Use a whole number from 1 to 600')).toBeDefined()
        typeInto(screen.getByLabelText('Timeout (seconds)'), '20')

        fireEvent.click(within(dialog('New hook')).getByRole('button', { name: 'Add hook' }))
        expect(screen.getByText('Add a command')).toBeDefined()
        expect(writes()).toEqual([])

        typeInto(screen.getByLabelText('Command'), 'npm run lint')
        fireEvent.click(within(dialog('New hook')).getByRole('button', { name: 'Add hook' }))
        await waitFor(() =>
            expect(writes()).toEqual([
                {
                    method: 'POST',
                    path: '/connections/hooks',
                    body: {
                        event: 'Stop',
                        matcher: '',
                        command: 'npm run lint',
                        timeout: 20,
                        enabled: true,
                    },
                },
            ])
        )
        expect(await screen.findByText('npm run lint')).toBeDefined()
    })

    test('a bad tools match is refused before it is sent', async () => {
        renderAt('/settings/connections/hooks?add=1')
        await screen.findByText('./check-h1.sh')
        typeInto(screen.getByLabelText('Tools (empty means all)'), '(bash')
        expect(screen.getByText('This is not a valid regex')).toBeDefined()
        expect(
            (
                within(dialog('New hook')).getByRole('button', {
                    name: 'Add hook',
                }) as HTMLButtonElement
            ).disabled
        ).toBe(true)
    })

    test('a save the server refuses keeps the dialog open and says why', async () => {
        failNext = {
            match: '/connections/hooks',
            method: 'POST',
            status: 409,
            message: 'You can save up to 50 hooks.',
        }
        renderAt('/settings/connections/hooks?add=1')
        await screen.findByText('./check-h1.sh')
        typeInto(screen.getByLabelText('Command'), 'echo hi')
        fireEvent.click(within(dialog('New hook')).getByRole('button', { name: 'Add hook' }))
        expect((await within(dialog('New hook')).findByRole('alert')).textContent).toBe(
            'You can save up to 50 hooks.'
        )
    })

    test('edits a hook from its row', async () => {
        renderAt('/settings/connections/hooks')
        fireEvent.click(await rowOf('./check-h1.sh'))
        expect(dialog('Edit hook')).toBeDefined()
        typeInto(screen.getByLabelText('Command'), './lint.sh')
        fireEvent.click(within(dialog('Edit hook')).getByRole('button', { name: 'Save' }))
        await waitFor(() =>
            expect(writes()).toEqual([
                {
                    method: 'PATCH',
                    path: '/connections/hooks/h1',
                    body: {
                        event: 'PreToolUse',
                        matcher: 'bash',
                        command: './lint.sh',
                        timeout: 30,
                        enabled: true,
                    },
                },
            ])
        )
        expect(await screen.findByText('./lint.sh')).toBeDefined()
    })

    test('the switch sends the PATCH and moves back when the server refuses', async () => {
        failNext = { match: '/hooks/h1', status: 404, message: 'Hook not found.' }
        renderAt('/settings/connections/hooks')
        await screen.findByText('./check-h1.sh')
        const [first] = screen.getAllByRole('switch', { name: 'Turn this hook on or off' })
        fireEvent.click(first as HTMLElement)
        expect((await screen.findByRole('alert')).textContent).toBe('Hook not found.')
        expect(
            screen
                .getAllByRole('switch', { name: 'Turn this hook on or off' })[0]
                ?.getAttribute('aria-checked')
        ).toBe('true')
        expect(writes()).toEqual([
            { method: 'PATCH', path: '/connections/hooks/h1', body: { enabled: false } },
        ])
    })

    test('delete asks first and sends the DELETE', async () => {
        renderAt('/settings/connections/hooks')
        fireEvent.click(within(await rowOf('npm test')).getByLabelText('Delete hook'))
        expect(screen.getByText('Delete this hook?')).toBeDefined()
        fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
        await waitFor(() => expect(shows('npm test')).toBe(false))
        expect(writes()).toEqual([
            { method: 'DELETE', path: '/connections/hooks/h2', body: undefined },
        ])
    })

    test('the JSON view shows hooks.json, refuses bad files and saves the whole list', async () => {
        renderAt('/settings/connections/hooks')
        await screen.findByText('./check-h1.sh')
        fireEvent.click(screen.getByRole('radio', { name: 'JSON' }))
        const editor = screen.getByLabelText('hooks.json') as HTMLTextAreaElement
        expect(JSON.parse(editor.value).hooks.PreToolUse[0]).toEqual({
            matcher: 'bash',
            hooks: [{ type: 'command', command: './check-h1.sh', timeout: 30 }],
        })

        typeInto(editor, '{ "hooks": { "Nope": [] } }')
        expect(screen.getByText('Unknown event "Nope"')).toBeDefined()
        expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(
            true
        )

        // npm test was off: a hook kept from before keeps its state
        typeInto(
            editor,
            JSON.stringify({
                hooks: {
                    Stop: [{ hooks: [{ command: 'npm test', timeout: 30 }] }],
                    SessionStart: [{ hooks: [{ type: 'command', command: 'git status' }] }],
                },
            })
        )
        fireEvent.click(screen.getByRole('button', { name: 'Save' }))
        await waitFor(() =>
            expect(writes()).toEqual([
                {
                    method: 'PUT',
                    path: '/connections/hooks',
                    body: {
                        hooks: [
                            {
                                event: 'Stop',
                                matcher: '',
                                command: 'npm test',
                                timeout: 30,
                                enabled: false,
                            },
                            {
                                event: 'SessionStart',
                                matcher: '',
                                command: 'git status',
                                timeout: 60,
                                enabled: true,
                            },
                        ],
                    },
                },
            ])
        )
        expect(await screen.findByText('Saved')).toBeDefined()
    })
})

describe('hooks.json parsing (the cli format)', () => {
    test('reads groups, matchers and default timeouts', () => {
        const parsed = parseHooksJson(
            JSON.stringify({
                hooks: {
                    PreToolUse: [
                        {
                            matcher: 'bash|edit_file',
                            hooks: [{ command: './a.sh' }, { command: './b.sh', timeout: 5 }],
                        },
                    ],
                    Notification: [{ matcher: 'ignored', hooks: [{ command: 'notify-send hi' }] }],
                },
            })
        )
        expect(parsed.hooks).toEqual([
            {
                event: 'PreToolUse',
                matcher: 'bash|edit_file',
                command: './a.sh',
                timeout: 60,
                enabled: true,
            },
            {
                event: 'PreToolUse',
                matcher: 'bash|edit_file',
                command: './b.sh',
                timeout: 5,
                enabled: true,
            },
            {
                event: 'Notification',
                matcher: '',
                command: 'notify-send hi',
                timeout: 60,
                enabled: true,
            },
        ])
    })

    test('refuses what the server refuses', () => {
        const error = (data: unknown) =>
            parseHooksJson(typeof data === 'string' ? data : JSON.stringify(data)).error
        expect(error('{')).toBe('This is not valid JSON')
        expect(error({})).toBe('Add a "hooks" object')
        expect(error({ hooks: { Stop: {} } })).toBe('"Stop" must be a list')
        expect(error({ hooks: { Stop: [{ hooks: [] }] } })).toBe(
            'A "Stop" entry has no "hooks" list'
        )
        expect(error({ hooks: { Stop: [{ hooks: [{ type: 'prompt', command: 'x' }] }] } })).toBe(
            'Use "type": "command" in "Stop"'
        )
        expect(error({ hooks: { Stop: [{ hooks: [{ command: '  ' }] }] } })).toBe(
            'A "Stop" hook has no command'
        )
        expect(error({ hooks: { Stop: [{ hooks: [{ command: 'x', timeout: 601 }] }] } })).toBe(
            'Use a timeout from 1 to 600 seconds'
        )
        expect(
            error({ hooks: { PreToolUse: [{ matcher: '(', hooks: [{ command: 'x' }] }] } })
        ).toBe('"PreToolUse" has a tools match that is not valid')
        const many = {
            hooks: {
                Stop: [{ hooks: Array.from({ length: 51 }, (_, i) => ({ command: `c${i}` })) }],
            },
        }
        expect(error(many)).toBe('You can save up to 50 hooks')
    })

    test('writes back the same file it reads', () => {
        const list = [
            { event: 'PreToolUse' as const, matcher: 'bash', command: './a.sh', timeout: 10 },
            { event: 'Stop' as const, matcher: '', command: 'npm test', timeout: 60 },
        ]
        expect(parseHooksJson(toHooksJson(list)).hooks).toEqual(
            list.map((hook) => ({ ...hook, enabled: true }))
        )
    })
})
