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
const { useConnectionsStore } =
    await import('../src/features/connections/hooks/useConnectionsStore')
const { setConnectionsDemo } = await import('../src/features/connections/lib/connectionsDemo')

// the Skills and MCPs tabs on the real api (#632 section 2). only fetch is replaced: the
// tests read what the page shows and which request it sends.

type Skill = {
    name: string
    description: string
    body: string
    runs: 'agent' | 'user'
    enabled: boolean
    updatedAt: string
}

type Mcp = {
    name: string
    url: string
    transport: 'http' | 'sse'
    auth: 'none' | 'header'
    headerKeys: string[]
    enabled: boolean
    disabledTools: string[]
    status: 'unknown' | 'connected' | 'error'
    lastError: string | null
    tools: string[]
    checkedAt: string | null
}

type Call = { method: string; path: string; body: any }

const initialStore = useConnectionsStore.getState()
const originalFetch = globalThis.fetch

let calls: Call[] = []
let skills: Skill[] = []
let mcps: Mcp[] = []
/** the next write to a path that has this text fails with this reply */
let failNext: { match: string; status: number; payload: Record<string, unknown> } | null = null
/** while set, the server holds its answer to every write until this resolves */
let hold: Promise<void> | null = null
/** while set, the server holds its answer to every list read until this resolves */
let holdReads: Promise<void> | null = null

const reply = (status: number, payload: Record<string, unknown>) =>
    new Response(JSON.stringify({ success: status < 400, ...payload }), {
        status,
        headers: { 'Content-Type': 'application/json' },
    })

/** a small stand-in for /api/v1/connections: it keeps the rows the way the server does */
const fakeServer = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    const path = url.slice(url.indexOf('/api/v1') + '/api/v1'.length)
    const method = init?.method ?? 'GET'
    const body = init?.body ? JSON.parse(String(init.body)) : undefined
    calls.push({ method, path, body })
    if (method !== 'GET' && hold) await hold

    if (method !== 'GET' && failNext && path.includes(failNext.match)) {
        const { status, payload } = failNext
        failNext = null
        return reply(status, payload)
    }

    const [, , kind, rawName] = path.split('/')
    const name = rawName ? decodeURIComponent(rawName) : ''

    if (method === 'GET' && holdReads) {
        // the answer is what the server had when the read came in
        const then = { skills, mcps }
        await holdReads
        return reply(200, {
            data: kind === 'skills' ? { skills: then.skills } : { mcps: then.mcps },
        })
    }

    if (kind === 'skills') {
        if (method === 'GET') return reply(200, { data: { skills } })
        if (method === 'PUT') {
            const skill: Skill = { ...body, updatedAt: '2026-11-25T10:00:00.000Z' }
            skills = [...skills.filter((s) => s.name !== name), skill]
            return reply(200, { data: { skill } })
        }
        if (method === 'PATCH') {
            skills = skills.map((s) => (s.name === name ? { ...s, ...body } : s))
            return reply(200, { data: { skill: skills.find((s) => s.name === name) } })
        }
        if (method === 'DELETE') {
            skills = skills.filter((s) => s.name !== name)
            return reply(200, { data: { deleted: true } })
        }
    }
    if (kind === 'mcps') {
        if (method === 'GET') return reply(200, { data: { mcps } })
        if (method === 'PUT') {
            const { headers, ...rest } = body
            const mcp: Mcp = {
                ...rest,
                headerKeys: headers.map((h: { key: string }) => h.key),
                status: 'unknown',
                lastError: null,
                tools: [],
                checkedAt: null,
            }
            mcps = [...mcps.filter((m) => m.name !== name), mcp]
            return reply(200, { data: { mcp } })
        }
        if (method === 'PATCH') {
            mcps = mcps.map((m) => (m.name === name ? { ...m, ...body } : m))
            return reply(200, { data: { mcp: mcps.find((m) => m.name === name) } })
        }
        if (method === 'DELETE') {
            mcps = mcps.filter((m) => m.name !== name)
            return reply(200, { data: { deleted: true } })
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

const renderAt = (path: string) => {
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
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

/** true when the page shows this text. a boolean keeps a failed check short in the log */
const shows = (text: string) => screen.queryByText(text) !== null

/** the list row that shows this name */
const rowOf = async (name: string) =>
    (await screen.findByText(name)).closest('[role="button"]') as HTMLElement

// focus, change, keyup: typing that works whatever order the test files load react-dom in
const typeInto = (el: HTMLElement, value: string) => {
    fireEvent.focusIn(el)
    fireEvent.change(el, { target: { value } })
    fireEvent.keyUp(el)
    fireEvent.focusOut(el)
}

const writeTests: Skill = {
    name: 'api-write-tests',
    description: 'Write tests for a change',
    body: '# Steps\n1. Read the diff',
    runs: 'agent',
    enabled: true,
    updatedAt: '2026-11-24T10:00:00.000Z',
}

const reviewPr: Skill = {
    name: 'api-review-pr',
    description: 'Review a pull request',
    body: 'Read the diff first.',
    runs: 'user',
    enabled: false,
    updatedAt: '2026-11-24T11:00:00.000Z',
}

const linear: Mcp = {
    name: 'api-linear',
    url: 'https://mcp.linear.app/mcp',
    transport: 'http',
    auth: 'header',
    headerKeys: ['Authorization'],
    enabled: true,
    disabledTools: ['delete_issue'],
    status: 'connected',
    lastError: null,
    tools: ['list_issues', 'create_issue', 'delete_issue'],
    checkedAt: '2026-11-25T09:00:00.000Z',
}

const broken: Mcp = {
    name: 'api-broken',
    url: 'https://mcp.broken.dev/sse',
    transport: 'sse',
    auth: 'none',
    headerKeys: [],
    enabled: true,
    disabledTools: [],
    status: 'error',
    lastError: 'The server did not answer in 20 seconds',
    tools: [],
    checkedAt: '2026-11-25T09:05:00.000Z',
}

/** saved, and no session has used it yet */
const fresh: Mcp = {
    name: 'api-fresh',
    url: 'https://mcp.fresh.dev/mcp',
    transport: 'http',
    auth: 'none',
    headerKeys: [],
    enabled: true,
    disabledTools: [],
    status: 'unknown',
    lastError: null,
    tools: [],
    checkedAt: null,
}

const paused: Mcp = { ...linear, name: 'api-paused', enabled: false }

beforeEach(() => {
    cleanup()
    useConnectionsStore.setState(initialStore, true)
    setConnectionsDemo(false)
    calls = []
    skills = [writeTests, reviewPr]
    mcps = [linear, broken, fresh, paused]
    failNext = null
    hold = null
    holdReads = null
    globalThis.fetch = fakeServer
})

afterEach(() => {
    cleanup()
    setConnectionsDemo(null)
    globalThis.fetch = originalFetch
})

describe('skills tab on the api', () => {
    test('lists the skills of the account, not the sample skills', async () => {
        renderAt('/settings/connections/skills')

        expect(await screen.findByText('api-write-tests')).toBeDefined()
        expect(screen.getByText('api-review-pr')).toBeDefined()
        expect(shows('Skills are coming soon')).toBe(false)
        // write-tests and release-notes are sample skills
        expect(shows('release-notes')).toBe(false)
        expect(calls[0]).toEqual({ method: 'GET', path: '/connections/skills', body: undefined })

        const on = screen.getByRole('switch', { name: 'Turn api-write-tests on or off' })
        const off = screen.getByRole('switch', { name: 'Turn api-review-pr on or off' })
        expect(on.getAttribute('aria-checked')).toBe('true')
        expect(off.getAttribute('aria-checked')).toBe('false')
    })

    test('the switch sends the PATCH and moves before the server answers', async () => {
        let answer = () => {}
        hold = new Promise<void>((resolve) => {
            answer = resolve
        })
        renderAt('/settings/connections/skills')
        const name = 'Turn api-write-tests on or off'
        const checked = () => screen.getByRole('switch', { name }).getAttribute('aria-checked')
        fireEvent.click(await screen.findByRole('switch', { name }))

        await waitFor(() => expect(checked()).toBe('false'))
        expect(writes()).toEqual([
            {
                method: 'PATCH',
                path: '/connections/skills/api-write-tests',
                body: { enabled: false },
            },
        ])
        // the server has not answered yet
        expect(skills.find((s) => s.name === 'api-write-tests')?.enabled).toBe(true)

        answer()
        await waitFor(() =>
            expect(skills.find((s) => s.name === 'api-write-tests')?.enabled).toBe(false)
        )
        expect(checked()).toBe('false')
    })

    test('a switch the server refuses moves back and says why', async () => {
        failNext = { match: '/skills/', status: 404, payload: { message: 'Skill not found' } }
        renderAt('/settings/connections/skills')
        const name = 'Turn api-write-tests on or off'
        fireEvent.click(await screen.findByRole('switch', { name }))

        expect((await screen.findByRole('alert')).textContent).toBe('Skill not found')
        expect(screen.getByRole('switch', { name }).getAttribute('aria-checked')).toBe('true')
    })
})

describe('skill delete on the api', () => {
    test('delete asks first, sends the DELETE and removes the row', async () => {
        renderAt('/settings/connections/skills')
        fireEvent.click(within(await rowOf('api-review-pr')).getByLabelText('Delete skill'))
        expect(screen.getByText('Delete api-review-pr?')).toBeDefined()
        expect(writes()).toEqual([])

        fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
        await waitFor(() => expect(shows('api-review-pr')).toBe(false))
        expect(writes()).toEqual([
            { method: 'DELETE', path: '/connections/skills/api-review-pr', body: undefined },
        ])
        expect(screen.getByText('api-write-tests')).toBeDefined()
    })

    test('a delete the server refuses keeps the row and says why', async () => {
        failNext = { match: '/skills/', status: 404, payload: { message: 'Skill not found' } }
        renderAt('/settings/connections/skills')
        fireEvent.click(within(await rowOf('api-review-pr')).getByLabelText('Delete skill'))
        fireEvent.click(screen.getByRole('button', { name: 'Delete' }))

        expect((await screen.findByRole('alert')).textContent).toBe('Skill not found')
        expect(screen.getByText('api-review-pr')).toBeDefined()
    })
})

describe('skill editor on the api', () => {
    test('a new skill sends the PUT and opens the saved skill', async () => {
        renderAt('/settings/connections/skills/new')
        const save = (await screen.findByRole('button', {
            name: 'Save skill',
        })) as HTMLButtonElement

        typeInto(screen.getByLabelText('Name'), 'lint-fix')
        typeInto(screen.getByLabelText('Description'), 'Fix lint errors')
        // the server refuses a skill with no instructions
        expect(save.disabled).toBe(true)
        typeInto(screen.getByLabelText('Instructions'), 'Run the linter.')
        expect(save.disabled).toBe(false)
        fireEvent.click(save)

        await waitFor(() => expect(location()).toBe('/settings/connections/skills/lint-fix'))
        expect(writes()).toEqual([
            {
                method: 'PUT',
                path: '/connections/skills/lint-fix',
                body: {
                    name: 'lint-fix',
                    description: 'Fix lint errors',
                    body: 'Run the linter.',
                    runs: 'agent',
                    enabled: true,
                },
            },
        ])
        expect(screen.getByText('Saved')).toBeDefined()
        expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe('lint-fix')
        expect(
            (screen.getByRole('button', { name: 'Save skill' }) as HTMLButtonElement).disabled
        ).toBe(true)
    })
})

describe('skill editor: a saved skill', () => {
    test('shows the saved skill, and a rename sends the PUT to the saved name', async () => {
        renderAt('/settings/connections/skills/api-review-pr')
        const name = (await screen.findByLabelText('Name')) as HTMLInputElement
        expect(name.value).toBe('api-review-pr')
        expect((screen.getByLabelText('Description') as HTMLInputElement).value).toBe(
            'Review a pull request'
        )
        expect((screen.getByLabelText('Instructions') as HTMLTextAreaElement).value).toBe(
            'Read the diff first.'
        )
        expect(screen.getByRole('radio', { name: 'Only you' }).getAttribute('aria-checked')).toBe(
            'true'
        )

        typeInto(name, 'api-review')
        fireEvent.click(screen.getByRole('radio', { name: 'You and the agent' }))
        fireEvent.click(screen.getByRole('button', { name: 'Save skill' }))

        await waitFor(() => expect(location()).toBe('/settings/connections/skills/api-review'))
        expect(writes()).toEqual([
            {
                method: 'PUT',
                path: '/connections/skills/api-review-pr',
                body: {
                    name: 'api-review',
                    description: 'Review a pull request',
                    body: 'Read the diff first.',
                    runs: 'agent',
                    // the skill was off, and a save keeps it off
                    enabled: false,
                },
            },
        ])
        expect(screen.getByText('Saved')).toBeDefined()
        expect(screen.getByRole('heading', { name: 'api-review' })).toBeDefined()
    })

    test('the switch sends the PATCH, and a save after it keeps the new state', async () => {
        renderAt('/settings/connections/skills/api-review-pr')
        const toggle = await screen.findByRole('switch', { name: 'Turn this skill on or off' })
        expect(toggle.getAttribute('aria-checked')).toBe('false')
        fireEvent.click(toggle)
        await waitFor(() => expect(toggle.getAttribute('aria-checked')).toBe('true'))
        await waitFor(() => expect(writes().length).toBe(1))
        expect(writes()[0]).toEqual({
            method: 'PATCH',
            path: '/connections/skills/api-review-pr',
            body: { enabled: true },
        })
        // the switch is saved by itself: the editor has nothing to save
        const save = screen.getByRole('button', { name: 'Save skill' }) as HTMLButtonElement
        expect(save.disabled).toBe(true)

        typeInto(screen.getByLabelText('Description'), 'Review a pull request in full')
        fireEvent.click(save)
        await waitFor(() => expect(writes().length).toBe(2))
        expect(writes()[1].body.enabled).toBe(true)
        expect(writes()[1].body.description).toBe('Review a pull request in full')
    })

    test('a skill that is not on the account says so', async () => {
        renderAt('/settings/connections/skills/write-tests')
        expect(await screen.findByText('Skill not found')).toBeDefined()
    })
})

describe('skill editor: the server refuses', () => {
    const fillNew = async () => {
        renderAt('/settings/connections/skills/new')
        typeInto(await screen.findByLabelText('Name'), 'lint-fix')
        typeInto(screen.getByLabelText('Description'), 'Fix lint errors')
        typeInto(screen.getByLabelText('Instructions'), 'Run the linter.')
        fireEvent.click(screen.getByRole('button', { name: 'Save skill' }))
    }

    test('the limit of 100 skills shows in the form', async () => {
        failNext = {
            match: '/skills/',
            status: 409,
            payload: { message: 'You can save up to 100 skills.' },
        }
        await fillNew()
        expect((await screen.findByRole('alert')).textContent).toBe(
            'You can save up to 100 skills.'
        )
        expect(location()).toBe('/settings/connections/skills/new')
        expect(shows('Saved')).toBe(false)
        // the form keeps what the user typed, and can send it again
        expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe('lint-fix')
        expect(
            (screen.getByRole('button', { name: 'Save skill' }) as HTMLButtonElement).disabled
        ).toBe(false)
    })

    test('a field the server refuses shows its reason', async () => {
        failNext = {
            match: '/skills/',
            status: 400,
            payload: {
                message: 'validation failed',
                errors: { name: ['use lowercase letters, numbers and dashes'] },
            },
        }
        await fillNew()
        expect((await screen.findByRole('alert')).textContent).toBe(
            'Use lowercase letters, numbers and dashes'
        )
    })

    test('a name another skill took shows the reason of the server', async () => {
        failNext = {
            match: '/skills/',
            status: 409,
            payload: { message: 'A skill named lint-fix already exists.' },
        }
        await fillNew()
        expect((await screen.findByRole('alert')).textContent).toBe(
            'A skill named lint-fix already exists.'
        )
    })
})

describe('mcps tab on the api', () => {
    test('lists the mcp servers of the account with the status of each', async () => {
        renderAt('/settings/connections/mcps')

        const pillOf = async (name: string) =>
            within(await rowOf(name))
                .getAllByText(/^(Connected|Error|Not used yet|Off)$/)
                .map((pill) => pill.textContent)
        expect(await pillOf('api-linear')).toContain('Connected')
        expect(await pillOf('api-broken')).toContain('Error')
        expect(await pillOf('api-fresh')).toContain('Not used yet')
        expect(await pillOf('api-paused')).toContain('Off')
        expect(calls[0]).toEqual({ method: 'GET', path: '/connections/mcps', body: undefined })

        // sentry and neon are sample servers
        expect(shows('sentry')).toBe(false)
        expect(shows('neon')).toBe(false)
        expect(shows('MCPs are coming soon')).toBe(false)
        // the api has no sign-in with oauth
        expect(screen.queryByRole('button', { name: 'Sign in' }) === null).toBe(true)
    })
})

describe('mcp switch and page on the api', () => {
    test('the list switch sends the PATCH', async () => {
        renderAt('/settings/connections/mcps')
        const name = 'Turn api-linear on or off'
        fireEvent.click(await screen.findByRole('switch', { name }))

        await waitFor(() =>
            expect(screen.getByRole('switch', { name }).getAttribute('aria-checked')).toBe('false')
        )
        await waitFor(() => expect(mcps.find((m) => m.name === 'api-linear')?.enabled).toBe(false))
        expect(writes()).toEqual([
            { method: 'PATCH', path: '/connections/mcps/api-linear', body: { enabled: false } },
        ])
    })

    test('the page shows the facts, and each tool has a switch that sends disabledTools', async () => {
        renderAt('/settings/connections/mcps/api-linear')
        expect(await screen.findByRole('heading', { name: 'api-linear' })).toBeDefined()
        expect(screen.getByText('Connected')).toBeDefined()
        expect(screen.getByText('https://mcp.linear.app/mcp')).toBeDefined()
        expect(screen.getByText('HTTP')).toBeDefined()
        // the name of the header, never its value
        expect(screen.getByText('Header: Authorization')).toBeDefined()
        // the api has no test route and no sign-in
        expect(screen.queryByRole('button', { name: 'Test' }) === null).toBe(true)
        expect(screen.queryByRole('button', { name: 'Sign in' }) === null).toBe(true)

        const tool = (name: string) => screen.getByRole('switch', { name: `Allow ${name}` })
        expect(tool('list_issues').getAttribute('aria-checked')).toBe('true')
        expect(tool('create_issue').getAttribute('aria-checked')).toBe('true')
        expect(tool('delete_issue').getAttribute('aria-checked')).toBe('false')

        fireEvent.click(tool('create_issue'))
        await waitFor(() => expect(tool('create_issue').getAttribute('aria-checked')).toBe('false'))
        await waitFor(() => expect(writes().length).toBe(1))
        expect(writes()[0]).toEqual({
            method: 'PATCH',
            path: '/connections/mcps/api-linear',
            body: { disabledTools: ['delete_issue', 'create_issue'] },
        })

        fireEvent.click(tool('delete_issue'))
        await waitFor(() => expect(writes().length).toBe(2))
        expect(writes()[1]).toEqual({
            method: 'PATCH',
            path: '/connections/mcps/api-linear',
            body: { disabledTools: ['create_issue'] },
        })
        await waitFor(() => expect(tool('delete_issue').getAttribute('aria-checked')).toBe('true'))
    })

    test('a server that failed shows the error of the last session', async () => {
        renderAt('/settings/connections/mcps/api-broken')
        expect(await screen.findByText('Error')).toBeDefined()
        expect(
            screen.getByText('Last session: The server did not answer in 20 seconds')
        ).toBeDefined()
        expect(screen.getByText('SSE')).toBeDefined()
        expect(screen.getByText('None')).toBeDefined()
    })

    test('a server that no session used says so, with no tools', async () => {
        renderAt('/settings/connections/mcps/api-fresh')
        expect(await screen.findByText('Not used yet')).toBeDefined()
        expect(screen.getByText('No session has used this MCP yet')).toBeDefined()
        expect(screen.queryAllByRole('switch', { name: /^Allow / }).length).toBe(0)
        expect(shows('Run Test to see tools')).toBe(false)
    })

    test('remove asks first, sends the DELETE and goes back to the list', async () => {
        renderAt('/settings/connections/mcps/api-fresh')
        fireEvent.click(await screen.findByRole('button', { name: 'MCP options' }))
        fireEvent.click(screen.getByText('Remove MCP'))
        expect(screen.getByText('Remove api-fresh?')).toBeDefined()
        expect(writes()).toEqual([])

        fireEvent.click(screen.getByRole('button', { name: 'Remove' }))
        await waitFor(() => expect(location()).toBe('/settings/connections/mcps'))
        expect(writes()).toEqual([
            { method: 'DELETE', path: '/connections/mcps/api-fresh', body: undefined },
        ])
        expect(shows('api-fresh')).toBe(false)
        expect(shows('api-linear')).toBe(true)
    })

    test('a remove the server refuses stays on the page and says why', async () => {
        failNext = { match: '/mcps/', status: 404, payload: { message: 'MCP server not found' } }
        renderAt('/settings/connections/mcps/api-fresh')
        fireEvent.click(await screen.findByRole('button', { name: 'MCP options' }))
        fireEvent.click(screen.getByText('Remove MCP'))
        fireEvent.click(screen.getByRole('button', { name: 'Remove' }))

        expect((await screen.findByRole('alert')).textContent).toBe('MCP server not found')
        expect(location()).toBe('/settings/connections/mcps/api-fresh')
    })
})

describe('mcp form on the api', () => {
    const submit = (label: string) =>
        fireEvent.click(screen.getByText(label, { selector: 'button[type="submit"]' }))

    test('the form has http or sse, and none or header: no oauth, no test', async () => {
        renderAt('/settings/connections/mcps?add=1')
        expect(await screen.findByText('Add MCP', { selector: 'h2' })).toBeDefined()
        const options = (group: string) =>
            within(screen.getByRole('radiogroup', { name: group }))
                .getAllByRole('radio')
                .map((radio) => radio.textContent)
        expect(options('Transport')).toEqual(['HTTP', 'SSE'])
        expect(options('Auth')).toEqual(['None', 'Header'])
        expect(screen.queryByRole('button', { name: 'Test' }) === null).toBe(true)
    })

    test('a server with a header sends the PUT, and the page never shows the value', async () => {
        renderAt('/settings/connections/mcps?add=1')
        typeInto(await screen.findByLabelText('Name'), 'api-new')
        typeInto(screen.getByLabelText('Server URL'), 'https://mcp.new.dev/mcp')
        fireEvent.click(screen.getByRole('radio', { name: 'SSE' }))
        fireEvent.click(screen.getByRole('radio', { name: 'Header' }))
        typeInto(screen.getByLabelText('Header name'), 'X-Api-Key')
        typeInto(screen.getByLabelText('Header value'), 'secret-123')
        submit('Add MCP')

        await waitFor(() => expect(location()).toBe('/settings/connections/mcps/api-new'))
        expect(writes()).toEqual([
            {
                method: 'PUT',
                path: '/connections/mcps/api-new',
                body: {
                    name: 'api-new',
                    url: 'https://mcp.new.dev/mcp',
                    transport: 'sse',
                    auth: 'header',
                    headers: [{ key: 'X-Api-Key', value: 'secret-123' }],
                    enabled: true,
                    disabledTools: [],
                },
            },
        ])

        // the new page: the header name, the "not used yet" state, and no value anywhere
        expect(await screen.findByText('Header: X-Api-Key')).toBeDefined()
        expect(screen.getByText('Not used yet')).toBeDefined()
        expect(document.body.innerHTML.includes('secret-123')).toBe(false)

        // edit: the saved header shows its name with an empty value
        fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
        expect((screen.getByLabelText('Header name') as HTMLInputElement).value).toBe('X-Api-Key')
        const value = screen.getByLabelText('Header value') as HTMLInputElement
        expect(value.value).toBe('')
        expect(value.type).toBe('password')
        expect(document.body.innerHTML.includes('secret-123')).toBe(false)

        // a save with the value left empty keeps the saved value on the server
        typeInto(screen.getByLabelText('Server URL'), 'https://mcp.new.dev/v2')
        submit('Save')
        await waitFor(() => expect(writes().length).toBe(2))
        expect(writes()[1]).toEqual({
            method: 'PUT',
            path: '/connections/mcps/api-new',
            body: {
                name: 'api-new',
                url: 'https://mcp.new.dev/v2',
                transport: 'sse',
                auth: 'header',
                headers: [{ key: 'X-Api-Key', value: '' }],
                enabled: true,
                disabledTools: [],
            },
        })
        expect(await screen.findByText('https://mcp.new.dev/v2')).toBeDefined()
    })

    test('a new header needs a value before anything is sent', async () => {
        renderAt('/settings/connections/mcps?add=1')
        typeInto(await screen.findByLabelText('Name'), 'api-new')
        typeInto(screen.getByLabelText('Server URL'), 'https://mcp.new.dev/mcp')
        fireEvent.click(screen.getByRole('radio', { name: 'Header' }))
        submit('Add MCP')

        expect((await screen.findByRole('alert')).textContent).toBe('Add the header name and value')
        expect(writes()).toEqual([])
    })

    test('an edit keeps the tools that are off, and a rename goes to the saved name', async () => {
        renderAt('/settings/connections/mcps/api-linear')
        fireEvent.click(await screen.findByRole('button', { name: 'Edit' }))
        typeInto(screen.getByLabelText('Name'), 'api-linear-2')
        submit('Save')

        await waitFor(() => expect(location()).toBe('/settings/connections/mcps/api-linear-2'))
        expect(writes()).toEqual([
            {
                method: 'PUT',
                path: '/connections/mcps/api-linear',
                body: {
                    name: 'api-linear-2',
                    url: 'https://mcp.linear.app/mcp',
                    transport: 'http',
                    auth: 'header',
                    headers: [{ key: 'Authorization', value: '' }],
                    enabled: true,
                    disabledTools: ['delete_issue'],
                },
            },
        ])
    })
})

describe('mcp form: the server refuses', () => {
    const fillAndSend = async (url = 'https://mcp.new.dev/mcp') => {
        renderAt('/settings/connections/mcps?add=1')
        typeInto(await screen.findByLabelText('Name'), 'api-new')
        typeInto(screen.getByLabelText('Server URL'), url)
        fireEvent.click(screen.getByText('Add MCP', { selector: 'button[type="submit"]' }))
    }

    test('a url the server does not allow shows the reason in the form', async () => {
        failNext = {
            match: '/mcps/',
            status: 400,
            payload: {
                message: 'This mcp server cannot be used: the server must be on a public address.',
            },
        }
        await fillAndSend('https://10.0.0.5/mcp')
        expect((await screen.findByRole('alert')).textContent).toBe(
            'This mcp server cannot be used: the server must be on a public address.'
        )
        // the form stays open with what the user typed
        expect(location()).toBe('/settings/connections/mcps?add=1')
        expect((screen.getByLabelText('Server URL') as HTMLInputElement).value).toBe(
            'https://10.0.0.5/mcp'
        )
        expect(shows('api-new')).toBe(false)
    })

    test('the limit of 20 mcp servers shows in the form', async () => {
        failNext = {
            match: '/mcps/',
            status: 409,
            payload: { message: 'You can save up to 20 mcp servers.' },
        }
        await fillAndSend()
        expect((await screen.findByRole('alert')).textContent).toBe(
            'You can save up to 20 mcp servers.'
        )
    })

    test('a name another server took shows in the form', async () => {
        failNext = {
            match: '/mcps/',
            status: 409,
            payload: { message: 'An mcp server named api-new already exists.' },
        }
        await fillAndSend()
        expect((await screen.findByRole('alert')).textContent).toBe(
            'An mcp server named api-new already exists.'
        )
    })
})

describe('the prompt box and late reads', () => {
    const PROMPT_BOX_KEY = ['connections', 'prompt-box']
    const promptBoxIsStale = () => client.getQueryState(PROMPT_BOX_KEY)?.isInvalidated

    test('a skill change marks the prompt box lists as old', async () => {
        renderAt('/settings/connections/skills')
        await screen.findByText('api-write-tests')
        client.setQueryData(PROMPT_BOX_KEY, { skills: [], plugins: [], mcps: [] })
        expect(promptBoxIsStale()).toBe(false)

        fireEvent.click(screen.getByRole('switch', { name: 'Turn api-write-tests on or off' }))
        await waitFor(() => expect(promptBoxIsStale()).toBe(true))

        client.setQueryData(PROMPT_BOX_KEY, { skills: [], plugins: [], mcps: [] })
        fireEvent.click(within(await rowOf('api-review-pr')).getByLabelText('Delete skill'))
        fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
        await waitFor(() => expect(promptBoxIsStale()).toBe(true))
    })

    test('a saved skill marks the prompt box lists as old', async () => {
        renderAt('/settings/connections/skills/api-review-pr')
        typeInto(await screen.findByLabelText('Description'), 'Review a pull request in full')
        client.setQueryData(PROMPT_BOX_KEY, { skills: [], plugins: [], mcps: [] })
        fireEvent.click(screen.getByRole('button', { name: 'Save skill' }))
        await waitFor(() => expect(promptBoxIsStale()).toBe(true))
    })

    test('an mcp change marks the prompt box lists as old', async () => {
        renderAt('/settings/connections/mcps/api-linear')
        await screen.findByRole('heading', { name: 'api-linear' })
        client.setQueryData(PROMPT_BOX_KEY, { skills: [], plugins: [], mcps: [] })

        fireEvent.click(screen.getByRole('switch', { name: 'Allow list_issues' }))
        await waitFor(() => expect(promptBoxIsStale()).toBe(true))

        client.setQueryData(PROMPT_BOX_KEY, { skills: [], plugins: [], mcps: [] })
        fireEvent.click(screen.getByRole('switch', { name: 'Turn this MCP on or off' }))
        await waitFor(() => expect(promptBoxIsStale()).toBe(true))

        client.setQueryData(PROMPT_BOX_KEY, { skills: [], plugins: [], mcps: [] })
        fireEvent.click(screen.getByRole('button', { name: 'MCP options' }))
        fireEvent.click(screen.getByText('Remove MCP'))
        fireEvent.click(screen.getByRole('button', { name: 'Remove' }))
        await waitFor(() => expect(promptBoxIsStale()).toBe(true))
    })

    test('a list read that started before a change does not undo the change', async () => {
        renderAt('/settings/connections/skills')
        const name = 'Turn api-write-tests on or off'
        const checked = () => screen.getByRole('switch', { name }).getAttribute('aria-checked')
        await screen.findByRole('switch', { name })

        // a read starts, and the server answers it late, with the list from before the change
        let answerRead = () => {}
        holdReads = new Promise<void>((resolve) => {
            answerRead = resolve
        })
        void client.refetchQueries({ queryKey: ['connections', 'skills'] })
        await waitFor(() => expect(calls.filter((c) => c.method === 'GET').length).toBe(2))

        fireEvent.click(screen.getByRole('switch', { name }))
        await waitFor(() => expect(writes().length).toBe(1))
        await waitFor(() => expect(checked()).toBe('false'))

        answerRead()
        await new Promise((resolve) => setTimeout(resolve, 60))
        expect(checked()).toBe('false')
    })
})

describe('with the preview on', () => {
    beforeEach(() => setConnectionsDemo(true))

    test('each tab on sample values carries the demo pill, import setup does not', () => {
        renderAt('/settings/connections/apps')
        const tab = (name: string) =>
            within(screen.getByRole('radiogroup', { name: 'Connections sections' }))
                .getAllByRole('radio')
                .find((radio) => radio.textContent?.startsWith(name)) as HTMLElement
        // with the preview on, Skills and MCPs list sample values too
        for (const name of ['Plugins', 'Hooks', 'Rules', 'Memory', 'Skills', 'MCPs']) {
            expect(within(tab(name)).getByText('Demo')).toBeDefined()
        }
        // Apps reads and writes the server, so it is not marked
        expect(within(tab('Apps')).queryByText('Demo') === null).toBe(true)
        // import setup has a server behind it (#637), so the button is not marked
        const importSetup = screen.getByRole('button', { name: /Import setup/ })
        expect(within(importSetup).queryByText('Demo') === null).toBe(true)
    })

    test('the sample tabs open, and the skills and mcps stay sample values', () => {
        renderAt('/settings/connections/plugins')
        expect(shows('Plugins are coming soon')).toBe(false)
        cleanup()
        renderAt('/settings/connections/skills')
        expect(shows('write-tests')).toBe(true)
        cleanup()
        renderAt('/settings/connections/mcps')
        expect(shows('sentry')).toBe(true)
        fireEvent.click(screen.getByRole('switch', { name: 'Turn sentry on or off' }))
        // nothing goes to the server
        expect(calls.filter((call) => call.path.startsWith('/connections'))).toEqual([])
    })

    test('the sample mcp form keeps oauth and test', () => {
        renderAt('/settings/connections/mcps?add=1')
        expect(screen.getByRole('radio', { name: 'OAuth' })).toBeDefined()
        expect(screen.getByRole('button', { name: 'Test' })).toBeDefined()
    })
})

describe('tabs with no server yet', () => {
    test('plugins, hooks, rules and memory stay soon for normal users', () => {
        const soon = [
            ['plugins', 'Plugins are coming soon'],
            ['hooks', 'Hooks are coming soon'],
            ['rules', 'Rules are coming soon'],
            ['memory', 'Memory is coming soon'],
        ]
        for (const [tab, text] of soon) {
            renderAt(`/settings/connections/${tab}`)
            expect(screen.getByText(text)).toBeDefined()
            expect(shows('Demo')).toBe(false)
            // import setup is for every user (#637). it reads nothing until it opens
            expect(screen.getByRole('button', { name: 'Import setup' })).toBeDefined()
            cleanup()
        }
        // nothing is asked of the server for these tabs
        expect(calls).toEqual([])
    })
})
