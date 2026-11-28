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
const { MemoryRouter } = await import('react-router-dom')
const { ConnectionsPage } = await import('../src/features/connections/components/ConnectionsPage')
const { setConnectionsDemo } = await import('../src/features/connections/lib/connectionsDemo')

// import setup on the real routes (#637 section 6). only fetch is replaced: the tests read
// what the dialog shows and which request it sends.

type Call = { method: string; path: string; body: any }

const originalFetch = globalThis.fetch

const repo = (fullName: string, id: number, provider: 'GITHUB' | 'GITLAB' = 'GITHUB') => ({
    id,
    name: fullName.split('/').pop(),
    fullName,
    private: true,
    defaultBranch: 'main',
    updatedAt: '2026-11-24T10:00:00.000Z',
    htmlUrl: `https://github.com/${fullName}`,
    cloneUrl: `https://github.com/${fullName}.git`,
    language: null,
    description: null,
    owner: { login: fullName.split('/')[0], avatarUrl: '' },
    provider,
})

const webPreview = {
    repoFullName: 'acme/web',
    provider: 'GITHUB',
    skills: [
        {
            name: 'deploy',
            description: 'Ship the app',
            path: '.december/skills/deploy/SKILL.md',
            exists: false,
            importable: true,
        },
        {
            name: 'release-notes',
            description: 'Write the release notes',
            path: '.claude/skills/release-notes/SKILL.md',
            exists: true,
            importable: true,
        },
        {
            name: 'huge',
            description: '',
            path: '.december/skills/huge/SKILL.md',
            exists: false,
            importable: false,
            reason: 'The file is larger than 64 KB.',
        },
    ],
    mcps: [
        {
            name: 'linear',
            url: 'https://mcp.linear.app/mcp',
            transport: 'http',
            headerNames: ['Authorization'],
            exists: false,
            importable: true,
            note: 'Add the header values after the import.',
        },
        {
            name: 'docs',
            url: 'https://docs.example.com/sse',
            transport: 'sse',
            headerNames: [],
            exists: true,
            importable: true,
        },
        {
            name: 'files',
            url: null,
            transport: 'stdio',
            headerNames: [],
            exists: false,
            importable: false,
            reason: 'It runs a command. Only a server with a url can be imported.',
        },
    ],
    rules: [
        { path: 'AGENTS.md', name: 'web-agents', exists: false, importable: true },
        {
            path: 'CLAUDE.md',
            name: 'web-claude',
            exists: false,
            importable: false,
            reason: 'The file is larger than 16 KiB.',
        },
    ],
    truncated: false,
}

let calls: Call[] = []
let previewReply: { status: number; payload: Record<string, unknown> }
let importReply: { status: number; payload: Record<string, unknown> }

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

    if (path === '/setting') return reply(200, { data: { id: 'u1', githubConnected: true } })
    if (path === '/setting/me') {
        return reply(200, { data: { fullName: 'Jo', isGithubConnected: true } })
    }
    if (path === '/integrations/gitlab') {
        return reply(200, { data: { available: false, connected: false, username: null } })
    }
    if (path === '/platform/github/repos') {
        return reply(200, { data: [repo('acme/web', 1), repo('acme/api', 2)] })
    }
    if (path === '/connections/import/preview')
        return reply(previewReply.status, previewReply.payload)
    if (path === '/connections/import') return reply(importReply.status, importReply.payload)
    if (path === '/connections/skills') return reply(200, { data: { skills: [] } })
    if (path === '/connections/mcps') return reply(200, { data: { mcps: [] } })
    if (path === '/connections/rules') return reply(200, { data: { rules: [] } })
    return reply(404, { message: 'not found' })
}) as typeof fetch

const posts = (path: string) => calls.filter((call) => call.method === 'POST' && call.path === path)
const gets = (path: string) => calls.filter((call) => call.method === 'GET' && call.path === path)

let client: InstanceType<typeof QueryClient>

const renderPage = () => {
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    return render(
        <QueryClientProvider client={client}>
            <MemoryRouter initialEntries={['/settings/connections/skills']}>
                <ConnectionsPage />
            </MemoryRouter>
        </QueryClientProvider>
    )
}

// the dialog of the app has no dialog role: its content is a named group
const dialog = () => screen.getByRole('group', { name: 'Import setup' })
const isClosed = () => screen.queryByRole('group', { name: 'Import setup' }) === null
const box = (label: string) =>
    within(dialog()).getByRole('checkbox', { name: label }) as HTMLInputElement

/** opens the dialog, picks acme/web and waits for the lists */
const openWebPreview = async () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Import setup' }))
    fireEvent.click(await within(dialog()).findByRole('button', { name: /web/ }))
    await within(dialog()).findByText('deploy')
}

beforeEach(() => {
    cleanup()
    setConnectionsDemo(false)
    calls = []
    previewReply = { status: 200, payload: { data: webPreview } }
    importReply = {
        status: 200,
        payload: { data: { imported: { skills: ['deploy'], mcps: ['linear'] }, skipped: [] } },
    }
    globalThis.fetch = fakeServer
})

afterEach(() => {
    cleanup()
    setConnectionsDemo(null)
    globalThis.fetch = originalFetch
})

describe('import setup', () => {
    test('every user has the button, with no demo pill, and nothing is read before it opens', async () => {
        renderPage()
        const button = screen.getByRole('button', { name: 'Import setup' })
        expect(within(button).queryByText('Demo') === null).toBe(true)
        await waitFor(() => expect(gets('/connections/skills').length).toBe(1))
        expect(gets('/platform/github/repos')).toEqual([])
        expect(posts('/connections/import/preview')).toEqual([])
    })

    test('a picked repository is read, and the dialog lists what it has', async () => {
        await openWebPreview()

        expect(posts('/connections/import/preview').map((call) => call.body)).toEqual([
            { repoFullName: 'acme/web', provider: 'GITHUB' },
        ])
        const view = within(dialog())
        expect(view.getByText('acme/web')).toBeDefined()
        // skills
        expect(view.getByText('deploy')).toBeDefined()
        expect(view.getByText('Ship the app')).toBeDefined()
        expect(view.getByText('release-notes')).toBeDefined()
        // mcp servers, with the note about the header values
        expect(view.getByText('linear')).toBeDefined()
        expect(view.getByText('https://mcp.linear.app/mcp')).toBeDefined()
        expect(view.getByText('Add the header values after the import.')).toBeDefined()
        expect(view.getByText('docs')).toBeDefined()
        // rule files, with the account rule each one becomes
        expect(view.getByText('AGENTS.md')).toBeDefined()
        expect(view.getByText('Saved as web-agents')).toBeDefined()
        expect(view.getByText('The file is larger than 16 KiB.')).toBeDefined()
    })

    test('saved rows start unticked, new rows start ticked', async () => {
        await openWebPreview()

        expect(box('Import skill deploy').checked).toBe(true)
        expect(box('Import skill release-notes').checked).toBe(false)
        expect(box('Import MCP linear').checked).toBe(true)
        expect(box('Import MCP docs').checked).toBe(false)
        // both saved rows say so
        expect(within(dialog()).getAllByText('Saved').length).toBe(2)
    })

    test('a row that cannot be imported is off, with its reason', async () => {
        await openWebPreview()

        expect(box('Import skill huge').disabled).toBe(true)
        expect(box('Import skill huge').checked).toBe(false)
        expect(within(dialog()).getByText('The file is larger than 64 KB.')).toBeDefined()
        expect(box('Import MCP files').disabled).toBe(true)
        expect(
            within(dialog()).getByText(
                'It runs a command. Only a server with a url can be imported.'
            )
        ).toBeDefined()
    })

    test('import sends only the ticked names, then reads the lists again', async () => {
        await openWebPreview()
        client.setQueryData(['connections', 'mcps'], [])
        client.setQueryData(['connections', 'prompt-box'], { skills: [], plugins: [], mcps: [] })
        const skillReads = gets('/connections/skills').length

        fireEvent.click(box('Import MCP linear'))
        fireEvent.click(within(dialog()).getByRole('button', { name: 'Import' }))

        await waitFor(() => expect(posts('/connections/import').length).toBe(1))
        expect(posts('/connections/import')[0]?.body).toEqual({
            repoFullName: 'acme/web',
            provider: 'GITHUB',
            skills: ['deploy'],
            mcps: [],
            rules: [],
            overwrite: false,
        })
        // the dialog closes, and the three lists of connections are read again
        await waitFor(() => expect(isClosed()).toBe(true))
        await waitFor(() => expect(gets('/connections/skills').length).toBe(skillReads + 1))
        expect(client.getQueryState(['connections', 'mcps'])?.isInvalidated).toBe(true)
        expect(client.getQueryState(['connections', 'prompt-box'])?.isInvalidated).toBe(true)
    })

    test('a ticked saved row is replaced: the request says overwrite', async () => {
        await openWebPreview()

        fireEvent.click(box('Import skill release-notes'))
        fireEvent.click(within(dialog()).getByRole('button', { name: 'Import' }))

        await waitFor(() => expect(posts('/connections/import').length).toBe(1))
        expect(posts('/connections/import')[0]?.body).toEqual({
            repoFullName: 'acme/web',
            provider: 'GITHUB',
            skills: ['deploy', 'release-notes'],
            mcps: ['linear'],
            rules: [],
            overwrite: true,
        })
    })

    test('import is off when nothing is ticked', async () => {
        await openWebPreview()

        fireEvent.click(box('Import skill deploy'))
        fireEvent.click(box('Import MCP linear'))

        const submit = within(dialog()).getByRole('button', { name: 'Import' }) as HTMLButtonElement
        expect(submit.disabled).toBe(true)
    })

    test('what the server skipped stays on the dialog, with the reason', async () => {
        importReply = {
            status: 200,
            payload: {
                data: {
                    imported: { skills: [], mcps: ['linear'], rules: [] },
                    skipped: [
                        { kind: 'skill', name: 'deploy', reason: 'You can save up to 100 skills.' },
                    ],
                },
            },
        }
        await openWebPreview()

        fireEvent.click(within(dialog()).getByRole('button', { name: 'Import' }))

        expect(
            await within(dialog()).findByText('deploy: You can save up to 100 skills.')
        ).toBeDefined()
    })

    test('a repository that cannot be read shows what the server says', async () => {
        previewReply = { status: 404, payload: { message: 'Repository not found.' } }
        renderPage()
        fireEvent.click(screen.getByRole('button', { name: 'Import setup' }))
        fireEvent.click(await within(dialog()).findByRole('button', { name: /web/ }))

        expect(await within(dialog()).findByText('Repository not found.')).toBeDefined()
        expect(within(dialog()).queryByRole('button', { name: 'Import' }) === null).toBe(true)
    })

    test('a repository with no setup says so', async () => {
        previewReply = {
            status: 200,
            payload: {
                data: { ...webPreview, skills: [], mcps: [], rules: [] },
            },
        }
        renderPage()
        fireEvent.click(screen.getByRole('button', { name: 'Import setup' }))
        fireEvent.click(await within(dialog()).findByRole('button', { name: /web/ }))

        expect(await within(dialog()).findByText('Nothing to import here.')).toBeDefined()
    })

    test('rule files start unticked, a ticked one is sent by path, and the rules read again', async () => {
        await openWebPreview()
        client.setQueryData(['connections', 'rules'], [])

        expect(box('Import rule AGENTS.md').checked).toBe(false)
        expect(box('Import rule CLAUDE.md').disabled).toBe(true)
        fireEvent.click(box('Import skill deploy'))
        fireEvent.click(box('Import MCP linear'))
        fireEvent.click(box('Import rule AGENTS.md'))
        fireEvent.click(within(dialog()).getByRole('button', { name: 'Import' }))

        await waitFor(() => expect(posts('/connections/import').length).toBe(1))
        expect(posts('/connections/import')[0]?.body).toEqual({
            repoFullName: 'acme/web',
            provider: 'GITHUB',
            skills: [],
            mcps: [],
            rules: ['AGENTS.md'],
            overwrite: false,
        })
        await waitFor(() => expect(isClosed()).toBe(true))
        expect(client.getQueryState(['connections', 'rules'])?.isInvalidated).toBe(true)
    })

    test('with the preview on, the dialog still reads the real repositories', async () => {
        setConnectionsDemo(true)
        await openWebPreview()
        expect(posts('/connections/import/preview').length).toBe(1)
        expect(screen.queryByText('6 found')).toBeNull()
    })
})
