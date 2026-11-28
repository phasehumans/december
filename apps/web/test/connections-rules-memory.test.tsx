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

// the Rules and Memory tabs on the real api, the Apps tab states, and the page shell. only
// fetch is replaced: the tests read what the page shows and which request it sends.

type Rule = { name: string; body: string; enabled: boolean; updatedAt: string }
type Memory = {
    id: string
    content: string
    source: 'agent' | 'user'
    sessionId: string | null
    sessionTitle: string | null
    createdAt: string
    updatedAt: string
}
type Call = { method: string; path: string; body: any }

const originalFetch = globalThis.fetch

let calls: Call[] = []
let rules: Rule[] = []
let memories: Memory[] = []
let memoryEnabled = true
let failNext: { match: string; method?: string; status: number; message: string } | null = null
let failReads: string[] = []
let nextId = 0

const reply = (status: number, payload: Record<string, unknown>) =>
    new Response(JSON.stringify({ success: status < 400, ...payload }), {
        status,
        headers: { 'Content-Type': 'application/json' },
    })

const memoryRow = (content: string, extra: Partial<Memory> = {}): Memory => ({
    id: `00000000-0000-4000-8000-${String(++nextId).padStart(12, '0')}`,
    content,
    source: 'user',
    sessionId: null,
    sessionTitle: null,
    createdAt: '2026-11-20T10:00:00.000Z',
    updatedAt: '2026-11-20T10:00:00.000Z',
    ...extra,
})

const fakeServer = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    const path = url.slice(url.indexOf('/api/v1') + '/api/v1'.length)
    const method = init?.method ?? 'GET'
    const body = init?.body ? JSON.parse(String(init.body)) : undefined
    calls.push({ method, path, body })

    if (method === 'GET' && failReads.some((match) => path.startsWith(match))) {
        return reply(500, { message: 'down' })
    }
    if (
        failNext &&
        path.includes(failNext.match) &&
        (!failNext.method || failNext.method === method)
    ) {
        const { status, message } = failNext
        failNext = null
        return reply(status, { message })
    }

    if (path === '/integrations/gitlab') {
        return reply(200, { data: { available: true, connected: true, username: 'jo-gl' } })
    }
    if (path.startsWith('/connections/rules')) {
        const name = decodeURIComponent(path.split('/')[3] ?? '')
        if (method === 'GET') return reply(200, { data: { rules } })
        if (method === 'PUT') {
            const rule: Rule = {
                name: body.name,
                body: body.body,
                enabled: body.enabled ?? true,
                updatedAt: '2026-11-28T10:00:00.000Z',
            }
            rules = [...rules.filter((r) => r.name !== name && r.name !== rule.name), rule]
            return reply(200, { data: { rule } })
        }
        if (method === 'PATCH') {
            rules = rules.map((r) => (r.name === name ? { ...r, ...body } : r))
            return reply(200, { data: { rule: rules.find((r) => r.name === name) } })
        }
        if (method === 'DELETE') {
            rules = rules.filter((r) => r.name !== name)
            return reply(200, { data: { deleted: true } })
        }
    }
    if (path.startsWith('/connections/memory')) {
        const id = path.split('/')[3] ?? ''
        if (method === 'GET') {
            return reply(200, { data: { enabled: memoryEnabled, memories } })
        }
        if (method === 'PUT' && id === 'settings') {
            memoryEnabled = body.enabled
            return reply(200, { data: { enabled: memoryEnabled } })
        }
        if (method === 'POST') {
            const memory = memoryRow(body.content)
            memories = [memory, ...memories]
            return reply(201, { data: { memory } })
        }
        if (method === 'PATCH') {
            const memory = { ...memories.find((m) => m.id === id)!, content: body.content }
            memories = [memory, ...memories.filter((m) => m.id !== id)]
            return reply(200, { data: { memory } })
        }
        if (method === 'DELETE' && id) {
            memories = memories.filter((m) => m.id !== id)
            return reply(200, { data: { deleted: true } })
        }
        if (method === 'DELETE') {
            const deleted = memories.length
            memories = []
            return reply(200, { data: { deleted } })
        }
    }
    return reply(404, { message: 'not found' })
}) as typeof fetch

const writes = () => calls.filter((call) => call.method !== 'GET')

const LocationProbe: React.FC = () => {
    const location = useLocation()
    return <div data-testid="location">{location.pathname + location.search}</div>
}

let client: InstanceType<typeof QueryClient>

const renderAt = (path: string, profile: Record<string, unknown> | null = {}) => {
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    if (profile) {
        client.setQueryData(['profile'], {
            id: 'u1',
            name: 'Jo',
            email: 'jo@example.com',
            githubConnected: false,
            ...profile,
        })
    }
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
const shows = (text: string) => screen.queryByText(text) !== null

const typeInto = (el: HTMLElement, value: string) => {
    fireEvent.focusIn(el)
    fireEvent.change(el, { target: { value } })
    fireEvent.keyUp(el)
    fireEvent.focusOut(el)
}

/** the open modal: it is drawn in a portal over the page */
const dialog = () => {
    const found = document.body.querySelector('[class*="z-[9999]"]')
    if (!found) throw new Error('no dialog is open')
    return found as HTMLElement
}
const isDialogOpen = () => document.body.querySelector('[class*="z-[9999]"]') !== null

beforeEach(() => {
    cleanup()
    setConnectionsDemo(false)
    calls = []
    nextId = 0
    rules = [
        { name: 'code-style', body: '- arrow functions', enabled: true, updatedAt: '' },
        { name: 'commits', body: 'lowercase', enabled: false, updatedAt: '' },
    ]
    memories = [
        memoryRow('prefers bun over npm', {
            source: 'agent',
            sessionId: 's1',
            sessionTitle: 'fix auth redirect',
        }),
        memoryRow('lowercase commit messages'),
    ]
    memoryEnabled = true
    failNext = null
    failReads = []
    globalThis.fetch = fakeServer
})

afterEach(() => {
    cleanup()
    setConnectionsDemo(null)
    globalThis.fetch = originalFetch
})

describe('rules tab', () => {
    test('lists the rules of the account with their size, not "coming soon"', async () => {
        renderAt('/settings/connections/rules')
        expect(await screen.findByText('code-style')).toBeDefined()
        expect(shows('commits')).toBe(true)
        expect(shows('Rules are coming soon')).toBe(false)
        expect(screen.getAllByText('0.0 KiB').length).toBeGreaterThan(0)
        expect(shows('Demo')).toBe(false)
    })

    test('an empty account says so and offers a new rule', async () => {
        rules = []
        renderAt('/settings/connections/rules')
        expect(await screen.findByText('No rules yet')).toBeDefined()
        fireEvent.click(screen.getByRole('button', { name: 'New rule' }))
        expect(location()).toBe('/settings/connections/rules/new')
    })

    test('a list that cannot load says so, and Try again reads it again', async () => {
        failReads = ['/connections/rules']
        renderAt('/settings/connections/rules')
        expect(await screen.findByText('Could not load rules')).toBeDefined()
        failReads = []
        fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
        expect(await screen.findByText('code-style')).toBeDefined()
    })

    test('the switch sends the PATCH, and moves back when the server refuses', async () => {
        renderAt('/settings/connections/rules')
        const sw = await screen.findByRole('switch', { name: 'Turn commits on or off' })
        fireEvent.click(sw)
        await waitFor(() =>
            expect(writes()).toEqual([
                { method: 'PATCH', path: '/connections/rules/commits', body: { enabled: true } },
            ])
        )

        failNext = {
            match: '/connections/rules/code-style',
            status: 400,
            message: 'the rule could not change',
        }
        const other = screen.getByRole('switch', { name: 'Turn code-style on or off' })
        fireEvent.click(other)
        expect(await screen.findByText('The rule could not change')).toBeDefined()
        await waitFor(() => expect(other.getAttribute('aria-checked')).toBe('true'))
    })

    test('delete asks first, then sends the DELETE', async () => {
        renderAt('/settings/connections/rules')
        await screen.findByText('code-style')
        fireEvent.click(screen.getAllByRole('button', { name: 'Delete rule' })[0]!)
        expect(screen.getByText('Delete code-style?')).toBeDefined()
        fireEvent.click(within(dialog()).getByRole('button', { name: 'Delete' }))
        await waitFor(() =>
            expect(writes()).toEqual([
                { method: 'DELETE', path: '/connections/rules/code-style', body: undefined },
            ])
        )
        await waitFor(() => expect(shows('code-style')).toBe(false))
    })

    test('a new rule checks the name and size, then sends the PUT and opens the rule', async () => {
        renderAt('/settings/connections/rules/new')
        const save = (await screen.findByRole('button', { name: 'Save rule' })) as HTMLButtonElement
        expect(save.disabled).toBe(true)

        typeInto(screen.getByLabelText('Name'), 'Code_Style')
        expect(shows('Use lowercase letters, numbers and dashes')).toBe(true)
        typeInto(screen.getByLabelText('Name'), 'commits')
        expect(shows('You already have a rule with this name')).toBe(true)

        typeInto(screen.getByLabelText('Name'), 'testing')
        typeInto(screen.getByLabelText('Rule'), 'x'.repeat(16 * 1024 + 1))
        expect(shows('A rule is at most 16 KiB')).toBe(true)
        expect(save.disabled).toBe(true)

        typeInto(screen.getByLabelText('Rule'), 'run bun test before you finish')
        expect(save.disabled).toBe(false)
        fireEvent.click(save)
        await waitFor(() =>
            expect(writes()).toEqual([
                {
                    method: 'PUT',
                    path: '/connections/rules/testing',
                    body: {
                        name: 'testing',
                        body: 'run bun test before you finish',
                        enabled: true,
                    },
                },
            ])
        )
        await waitFor(() => expect(location()).toBe('/settings/connections/rules/testing'))
        expect(shows('Saved')).toBe(true)
    })

    test('an edit keeps the switch, a rename goes to the saved name', async () => {
        renderAt('/settings/connections/rules/commits')
        const name = (await screen.findByLabelText('Name')) as HTMLInputElement
        expect(name.value).toBe('commits')
        typeInto(name, 'commit-style')
        fireEvent.click(screen.getByRole('button', { name: 'Save rule' }))
        await waitFor(() =>
            expect(writes()[0]).toEqual({
                method: 'PUT',
                path: '/connections/rules/commits',
                body: { name: 'commit-style', body: 'lowercase', enabled: false },
            })
        )
        await waitFor(() => expect(location()).toBe('/settings/connections/rules/commit-style'))
    })

    test('a save the server refuses shows its reason in the form', async () => {
        failNext = {
            match: '/connections/rules',
            method: 'PUT',
            status: 400,
            message: 'All rules together can be up to 32 KiB. Make a rule shorter.',
        }
        renderAt('/settings/connections/rules/new')
        typeInto(await screen.findByLabelText('Name'), 'big')
        typeInto(screen.getByLabelText('Rule'), 'text')
        fireEvent.click(screen.getByRole('button', { name: 'Save rule' }))
        expect(
            await screen.findByText('All rules together can be up to 32 KiB. Make a rule shorter.')
        ).toBeDefined()
        expect(location()).toBe('/settings/connections/rules/new')
    })

    test('a rule that is not on the account says so', async () => {
        renderAt('/settings/connections/rules/nope')
        expect(await screen.findByText('Rule not found')).toBeDefined()
    })

    test('the phone top bar + opens a new rule', async () => {
        renderAt('/settings/connections/rules')
        await screen.findByText('code-style')
        fireEvent.click(screen.getByRole('button', { name: 'Add to Rules' }))
        expect(location()).toBe('/settings/connections/rules/new')
    })
})

describe('memory tab', () => {
    test('lists the memories with where each came from, and the switch', async () => {
        renderAt('/settings/connections/memory')
        expect(await screen.findByText('prefers bun over npm')).toBeDefined()
        expect(shows('lowercase commit messages')).toBe(true)
        expect(screen.getAllByText('fix auth redirect').length).toBeGreaterThan(0)
        expect(screen.getAllByText('You').length).toBeGreaterThan(0)
        expect(shows('2 / 100')).toBe(true)
        const sw = screen.getByRole('switch', { name: 'Use memory' })
        expect(sw.getAttribute('aria-checked')).toBe('true')
        expect(shows('Memory is coming soon')).toBe(false)
    })

    test('the switch turns memory off with a PUT, and moves back on an error', async () => {
        renderAt('/settings/connections/memory')
        const sw = await screen.findByRole('switch', { name: 'Use memory' })
        await waitFor(() => expect((sw as HTMLButtonElement).disabled).toBe(false))
        fireEvent.click(sw)
        await waitFor(() =>
            expect(writes()).toEqual([
                { method: 'PUT', path: '/connections/memory/settings', body: { enabled: false } },
            ])
        )
        await waitFor(() => expect(sw.getAttribute('aria-checked')).toBe('false'))

        failNext = {
            match: '/connections/memory/settings',
            status: 400,
            message: 'memory could not change',
        }
        fireEvent.click(sw)
        expect(await screen.findByText('Memory could not change')).toBeDefined()
        await waitFor(() => expect(sw.getAttribute('aria-checked')).toBe('false'))
    })

    test('an empty account says so and adds a memory from the dialog', async () => {
        memories = []
        renderAt('/settings/connections/memory')
        expect(await screen.findByText('No memories yet')).toBeDefined()
        fireEvent.click(screen.getByRole('button', { name: 'Add memory' }))
        const field = within(dialog()).getByLabelText('Memory')
        typeInto(field, '  uses pnpm in acme/web  ')
        fireEvent.click(within(dialog()).getByRole('button', { name: 'Add memory' }))
        await waitFor(() =>
            expect(writes()).toEqual([
                {
                    method: 'POST',
                    path: '/connections/memory',
                    body: { content: 'uses pnpm in acme/web' },
                },
            ])
        )
        expect(await screen.findByText('uses pnpm in acme/web')).toBeDefined()
        await waitFor(() => expect(isDialogOpen()).toBe(false))
    })

    test('the dialog keeps the 500 character limit', async () => {
        renderAt('/settings/connections/memory?add=1')
        const field = await screen.findByLabelText('Memory')
        typeInto(field, 'x'.repeat(501))
        const submit = within(dialog()).getByRole('button', {
            name: 'Add memory',
        }) as HTMLButtonElement
        expect(submit.disabled).toBe(true)
        expect(within(dialog()).getByText('501 / 500')).toBeDefined()
    })

    test('a row opens the edit dialog, and a save sends the PATCH', async () => {
        renderAt('/settings/connections/memory')
        fireEvent.click(await screen.findByText('lowercase commit messages'))
        const field = within(dialog()).getByLabelText('Memory') as HTMLTextAreaElement
        expect(field.value).toBe('lowercase commit messages')
        const save = within(dialog()).getByRole('button', { name: 'Save' }) as HTMLButtonElement
        // nothing changed yet
        expect(save.disabled).toBe(true)
        typeInto(field, 'lowercase commits and pr titles')
        fireEvent.click(save)
        await waitFor(() => expect(writes().length).toBe(1))
        expect(writes()[0]?.method).toBe('PATCH')
        expect(writes()[0]?.body).toEqual({ content: 'lowercase commits and pr titles' })
        expect(await screen.findByText('lowercase commits and pr titles')).toBeDefined()
    })

    test('a save the server refuses stays in the dialog with the reason', async () => {
        failNext = {
            match: '/connections/memory',
            method: 'POST',
            status: 409,
            message: 'You can keep up to 100 memories. Delete one first.',
        }
        renderAt('/settings/connections/memory?add=1')
        typeInto(await screen.findByLabelText('Memory'), 'x')
        fireEvent.click(within(dialog()).getByRole('button', { name: 'Add memory' }))
        expect(
            await within(dialog()).findByText('You can keep up to 100 memories. Delete one first.')
        ).toBeDefined()
    })

    test('a full account cannot add more from the dialog', async () => {
        memories = Array.from({ length: 100 }, (_, i) => memoryRow(`fact ${i}`))
        renderAt('/settings/connections/memory?add=1')
        expect(
            await screen.findByText('You can keep up to 100 memories. Delete one first.')
        ).toBeDefined()
    })

    test('delete asks first and sends the DELETE of that memory', async () => {
        renderAt('/settings/connections/memory')
        await screen.findByText('prefers bun over npm')
        fireEvent.click(screen.getAllByRole('button', { name: 'Delete memory' })[0]!)
        expect(screen.getByText('Delete this memory?')).toBeDefined()
        fireEvent.click(within(dialog()).getByRole('button', { name: 'Delete' }))
        await waitFor(() => expect(writes()[0]?.method).toBe('DELETE'))
        expect(writes()[0]?.path).toBe('/connections/memory/00000000-0000-4000-8000-000000000001')
        await waitFor(() => expect(shows('prefers bun over npm')).toBe(false))
    })

    test('delete all asks first, then empties the list', async () => {
        renderAt('/settings/connections/memory')
        await screen.findByText('prefers bun over npm')
        fireEvent.click(screen.getByRole('button', { name: 'Memory options' }))
        fireEvent.click(screen.getByText('Delete all'))
        expect(screen.getByText('Delete all 2 memories?')).toBeDefined()
        fireEvent.click(within(dialog()).getByRole('button', { name: 'Delete all' }))
        await waitFor(() =>
            expect(writes()).toEqual([
                { method: 'DELETE', path: '/connections/memory', body: undefined },
            ])
        )
        expect(await screen.findByText('No memories yet')).toBeDefined()
    })

    test('a list that cannot load says so, with Try again', async () => {
        failReads = ['/connections/memory']
        renderAt('/settings/connections/memory')
        expect(await screen.findByText('Could not load memory')).toBeDefined()
        failReads = []
        fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
        expect(await screen.findByText('prefers bun over npm')).toBeDefined()
    })

    test('a memory link opens the tab, and the phone + opens the add dialog', async () => {
        renderAt('/settings/connections/memory/some-id')
        await waitFor(() => expect(location()).toBe('/settings/connections/memory'))
        await screen.findByText('prefers bun over npm')
        fireEvent.click(screen.getByRole('button', { name: 'Add to Memory' }))
        expect(await screen.findByText('Add memory', { selector: 'h2' })).toBeDefined()
    })

    test('search filters by text and by session', async () => {
        renderAt('/settings/connections/memory')
        await screen.findByText('prefers bun over npm')
        typeInto(screen.getByLabelText('Search memory'), 'auth redirect')
        expect(shows('prefers bun over npm')).toBe(true)
        expect(shows('lowercase commit messages')).toBe(false)
        typeInto(screen.getByLabelText('Search memory'), 'nothing like this')
        expect(shows('No results for "nothing like this"')).toBe(true)
    })
})

describe('apps tab', () => {
    test('shows gitlab when the server has it, and disconnect asks first', async () => {
        renderAt('/settings/connections/apps')
        expect(await screen.findByText('GitLab')).toBeDefined()
        expect(shows('Slack')).toBe(false)
        cleanup()
        calls = []
        renderAt('/settings/connections/apps/gitlab')
        fireEvent.click(await screen.findByRole('button', { name: 'Disconnect' }))
        expect(screen.getByText('Disconnect GitLab?')).toBeDefined()
        expect(writes()).toEqual([])
        fireEvent.click(within(dialog()).getByRole('button', { name: 'Disconnect' }))
        await waitFor(() =>
            expect(writes()).toEqual([
                { method: 'DELETE', path: '/integrations/gitlab', body: undefined },
            ])
        )
    })

    test('a profile that cannot load says so with Try again, not a Connect button', async () => {
        failReads = ['/setting']
        renderAt('/settings/connections/apps', null)
        expect(await screen.findByText('Could not load apps')).toBeDefined()
        expect(screen.queryByRole('button', { name: 'Connect' })).toBeNull()
        expect(screen.getByRole('button', { name: 'Try again' })).toBeDefined()
    })
})

describe('page shell', () => {
    test('the heading has one grey line and every tab is a button', async () => {
        renderAt('/settings/connections/apps')
        expect(screen.getByRole('heading', { name: 'Connections' })).toBeDefined()
        expect(shows('Manage the apps and tools December can use.')).toBe(true)
        const tabs = within(screen.getByRole('radiogroup', { name: 'Connections sections' }))
        for (const name of ['Apps', 'Plugins', 'Skills', 'MCPs', 'Hooks', 'Rules', 'Memory']) {
            expect(tabs.getByRole('radio', { name: new RegExp(`^${name}`) })).toBeDefined()
        }
        fireEvent.click(tabs.getByRole('radio', { name: 'Rules' }))
        expect(location()).toBe('/settings/connections/rules')
        fireEvent.click(tabs.getByRole('radio', { name: 'Memory' }))
        expect(location()).toBe('/settings/connections/memory')
    })

    test('a rule page has a back button to the list on phones', async () => {
        renderAt('/settings/connections/rules/code-style')
        await screen.findByLabelText('Name')
        expect(screen.queryByRole('heading', { name: 'Connections' })).toBeNull()
        const back = screen.getAllByRole('button', { name: /Rules/ })[0]!
        fireEvent.click(back)
        expect(location()).toBe('/settings/connections/rules')
    })
})
