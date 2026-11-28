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
const { ChatPromptInput } = await import('../src/features/chat/components/ChatPromptInput')
const { HomeTabs } = await import('../src/features/home/components/HomeTabs')
const { ProfileBillingSettings } =
    await import('../src/features/profile/components/ProfileBillingSettings')
const { ProfileMembersSettings } =
    await import('../src/features/profile/components/ProfileMembersSettings')
const { ProfileModelKeysSettings } =
    await import('../src/features/profile/components/ProfileModelKeysSettings')
const { ProfileSandboxSettings } =
    await import('../src/features/profile/components/ProfileSandboxSettings')
const { resetPreviewValues } = await import('../src/features/profile/components/SettingsUi')
const { PromptFooter } = await import('../src/shared/components/ui/PromptFooter')

// The rule for a ui part that still runs on sample values (no server behind it):
// with the preview flag on it shows the Demo pill next to its heading or label, and a
// normal user sees nothing of it, or "Soon". One check for each such part. Only fetch is
// replaced.

const originalFetch = globalThis.fetch

type Call = { path: string; method: string }
let calls: Call[] = []

const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify({ success: status < 400, message: 'ok', data }), {
        status,
        headers: { 'Content-Type': 'application/json' },
    })

const answers: Record<string, unknown> = {
    '/setting': { id: 'u1', name: 'Asha', email: 'asha@example.com', githubConnected: true },
    '/setting/me': { fullName: 'Asha', isGithubConnected: true },
    '/setting/sandbox': { idleStopMinutes: 10, archiveAfterDays: null },
    '/session/sandboxes': { items: [] },
    '/session': { sessions: [], total: 0 },
    '/integrations/gitlab': { available: false, connected: false, username: null },
    '/platform/github/repos': [],
    '/byok': { providers: [], credentials: [] },
    '/billing/overview': {
        creditBalance: 1500,
        giftedCredits: 0,
        createdAt: '2026-01-01T00:00:00.000Z',
        usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0, costInCents: 0 },
        claims: [],
        transactions: [],
    },
    '/billing/limits': { lowBalanceAlertCents: 100, sessionLimitCents: 500, dayLimitCents: null },
    '/team': {
        team: { id: 'team-1', name: 'Asha Rao', createdAt: '2026-11-01T10:00:00.000Z' },
        role: 'OWNER',
        members: [
            {
                userId: 'u1',
                name: 'Asha Rao',
                email: 'asha@example.com',
                role: 'OWNER',
                joinedAt: '2026-11-01T10:00:00.000Z',
            },
        ],
        invites: [],
        memberOf: [],
    },
    '/connections/skills': { skills: [] },
    '/connections/mcps': { mcps: [] },
    '/connections/rules': { rules: [] },
    '/connections/memory': { enabled: true, memories: [] },
    '/connections/prompt-box': { skills: [], plugins: [], mcps: [] },
    '/connections/plugins': { plugins: [] },
    '/connections/plugins/marketplace': { marketplaces: [] },
    '/connections/hooks': { hooks: [] },
    '/waitlist/super-crew': {
        feature: 'super-crew',
        joined: false,
        joinedAt: null,
        popupSeen: true,
        canShowPopup: false,
    },
}

const fakeServer = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input instanceof Request ? input.url : input), 'http://localhost')
    const path = url.pathname.replace(/^.*\/api\/v1/, '')
    calls.push({ path, method: init?.method ?? 'GET' })
    return path in answers ? json(answers[path]) : json(null)
}) as typeof fetch

const page = (ui: React.ReactNode, at = '/') =>
    render(
        <QueryClientProvider
            client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
        >
            <MemoryRouter initialEntries={[at]}>{ui}</MemoryRouter>
        </QueryClientProvider>
    )

/** true when the page shows this text. a boolean keeps a failed check short in the log */
const shows = (text: string) => screen.queryByText(text) !== null
const count = (text: string) => screen.queryAllByText(text).length

/** the requests that change something */
const writes = () => calls.filter((call) => call.method !== 'GET')

const tab = (name: string) =>
    within(screen.getByRole('radiogroup', { name: 'Connections sections' }))
        .getAllByRole('radio')
        .find((radio) => radio.textContent?.startsWith(name)) as HTMLElement

const footer = () =>
    page(
        <PromptFooter
            onUpload={() => {}}
            onSubmit={() => {}}
            hasInput={false}
            isLoading={false}
            isAuthenticated
        />
    )

/** a session prompt box, for the slash menu */
const SessionBox: React.FC = () => {
    const [value, setValue] = React.useState('')
    return <ChatPromptInput value={value} onChange={setValue} onSubmit={() => {}} isAuthenticated />
}

const typeInBox = (value: string) => {
    const el = document.querySelector('textarea') as HTMLTextAreaElement
    fireEvent.focusIn(el)
    fireEvent.change(el, { target: { value } })
    el.setSelectionRange(value.length, value.length)
    fireEvent.keyUp(el)
    return el
}

/** every connections tab has a server behind it: never a pill, never "coming soon" */
const LIVE_TABS = ['Apps', 'Plugins', 'Skills', 'MCPs', 'Hooks', 'Rules', 'Memory'] as const

/** the tabs that read their own list from the server when they open */
const SERVER_TABS = [
    ['plugins', '/connections/plugins'],
    ['hooks', '/connections/hooks'],
    ['rules', '/connections/rules'],
    ['memory', '/connections/memory'],
] as const

beforeEach(() => {
    cleanup()
    resetPreviewValues()
    localStorage.clear()
    calls = []
    globalThis.fetch = fakeServer
})

afterEach(() => {
    cleanup()
    setConnectionsDemo(null)
    globalThis.fetch = originalFetch
})

describe('with the preview flag on, each part on sample values shows the Demo pill', () => {
    beforeEach(() => setConnectionsDemo(true))

    test('connections: no tab has a pill, and every tab opens on the server', async () => {
        page(<ConnectionsPage />, '/settings/connections/apps')
        for (const name of LIVE_TABS) {
            expect(within(tab(name)).queryByText('Demo') === null).toBe(true)
        }
        cleanup()
        for (const [slug, path] of SERVER_TABS) {
            page(<ConnectionsPage />, `/settings/connections/${slug}`)
            expect(shows('coming soon')).toBe(false)
            await waitFor(() => expect(calls.some((call) => call.path === path)).toBe(true))
            cleanup()
        }
    })

    test('connections: the import setup dialog reads the real repositories', () => {
        page(<ConnectionsPage />, '/settings/connections/apps')
        fireEvent.click(screen.getByRole('button', { name: 'Import setup' }))

        const dialog = within(screen.getByRole('group', { name: 'Import setup' }))
        expect(dialog.queryByText('6 found') === null).toBe(true)
        expect(dialog.queryByText('Demo') === null).toBe(true)
    })

    test('prompt box: the Skills, Plugins and MCPs rows of the + menu read the server, so no pill', () => {
        footer()
        fireEvent.click(screen.getByLabelText('Add'))

        for (const name of [/Skills/, /Plugins/, /MCPs/]) {
            const row = within(screen.getByRole('menuitem', { name }))
            expect(row.queryByText('Demo') === null).toBe(true)
        }
        expect(count('Demo')).toBe(0)
        expect(shows('Soon')).toBe(false)
    })

    test('prompt box: the slash menu and /check list the real skills and servers, with no pill', async () => {
        answers['/connections/prompt-box'] = {
            skills: [{ name: 'write-tests', description: 'Write unit tests' }],
            plugins: [],
            mcps: [],
        }
        answers['/session/check'] = {
            github: { connected: true, appInstalled: true, accounts: ['acme'] },
            gitlab: { connected: false, username: null },
            credits: { balanceInCents: 1250, enoughToStart: true },
            keys: [],
            machine: null,
            mcpServers: [{ name: 'linear', enabled: true, status: 'connected', toolCount: 12 }],
        }
        try {
            page(<SessionBox />)
            const el = typeInBox('/')
            await screen.findByText('Skills')
            expect(shows('Demo')).toBe(false)

            typeInBox('/check')
            fireEvent.keyDown(el, { key: 'Enter' })
            await screen.findByText('MCP: linear')
            expect(shows('MCP: sentry')).toBe(false)
            expect(shows('Demo')).toBe(false)
        } finally {
            answers['/connections/prompt-box'] = { skills: [], plugins: [], mcps: [] }
            delete answers['/session/check']
        }
    })

    test('sandbox: machine size', async () => {
        page(<ProfileSandboxSettings />)
        await screen.findByRole('radio', { name: '10 min' })

        // the pill sits beside the section heading
        const heading = screen.getByRole('heading', { name: 'Machine size' })
        const headingRow = heading.parentElement?.parentElement as HTMLElement
        expect(within(headingRow).queryByText('Demo') !== null).toBe(true)
        expect(count('Demo')).toBe(1)
        fireEvent.click(screen.getByRole('radio', { name: 'Large' }))
        expect(writes()).toEqual([])
    })

    test('members: single sign-on has no sample control, so it keeps "Soon"', async () => {
        page(<ProfileMembersSettings ownerName="Asha Rao" ownerEmail="asha@example.com" />)
        await screen.findByText('Audit log')

        // the row has no sample control, so a Demo pill would mark nothing (review D2)
        const row = screen.getByText('Single sign-on').closest('div')!.parentElement!
        expect(within(row).queryByText('Soon') !== null).toBe(true)
        expect(count('Soon')).toBe(1)
        expect(shows('Demo')).toBe(false)
    })

    test('home: Super Crew has no sample data, so it keeps "Soon" and gets no Demo pill', async () => {
        page(<HomeTabs />)

        const crew = await screen.findByRole('tab', { name: /Super Crew/ })
        expect(within(crew).queryByText('Soon') !== null).toBe(true)
        expect(shows('Demo')).toBe(false)
    })
})

describe('with the preview flag off, the same parts show nothing or "Soon"', () => {
    beforeEach(() => setConnectionsDemo(false))

    test('connections: plugins and hooks open on the server, with no pill', async () => {
        for (const [slug, path] of SERVER_TABS.slice(0, 2)) {
            page(<ConnectionsPage />, `/settings/connections/${slug}`)
            expect(shows('coming soon')).toBe(false)
            expect(shows('Demo')).toBe(false)
            await waitFor(() => expect(calls.some((call) => call.path === path)).toBe(true))
            cleanup()
        }
    })

    test('connections: the import setup dialog reads the real repositories', async () => {
        page(<ConnectionsPage />, '/settings/connections/apps')
        fireEvent.click(screen.getByRole('button', { name: 'Import setup' }))

        const dialog = within(screen.getByRole('group', { name: 'Import setup' }))
        expect(dialog.queryByText('6 found') === null).toBe(true)
        expect(dialog.queryByText('Demo') === null).toBe(true)
    })

    test('prompt box: the Plugins row is live, with no "Soon"', () => {
        footer()
        fireEvent.click(screen.getByLabelText('Add'))

        const row = within(screen.getByRole('menuitem', { name: /Plugins/ }))
        expect(row.queryByText('Soon') === null).toBe(true)
        expect(shows('Demo')).toBe(false)
    })

    test('connections: the Skills and MCPs tabs have no pill', () => {
        page(<ConnectionsPage />, '/settings/connections/apps')

        for (const name of ['Apps', 'Skills', 'MCPs']) {
            expect(within(tab(name)).queryByText('Demo') === null).toBe(true)
        }
    })

    test('prompt box: the slash menu and /check have no pill', async () => {
        answers['/connections/prompt-box'] = {
            skills: [{ name: 'write-tests', description: 'Write unit tests' }],
            plugins: [],
            mcps: [],
        }
        answers['/session/check'] = {
            github: { connected: true, appInstalled: true, accounts: ['acme'] },
            gitlab: { connected: false, username: null },
            credits: { balanceInCents: 1250, enoughToStart: true },
            keys: [],
            machine: null,
            mcpServers: [{ name: 'linear', enabled: true, status: 'connected', toolCount: 12 }],
        }
        try {
            page(<SessionBox />)
            const el = typeInBox('/')
            await screen.findByText('Skills')
            expect(shows('Demo')).toBe(false)

            typeInBox('/check')
            fireEvent.keyDown(el, { key: 'Enter' })
            await screen.findByText('MCP: linear')
            expect(shows('Demo')).toBe(false)
        } finally {
            answers['/connections/prompt-box'] = { skills: [], plugins: [], mcps: [] }
            delete answers['/session/check']
        }
    })

    test('sandbox: no machine size', async () => {
        page(<ProfileSandboxSettings />)
        await screen.findByRole('radio', { name: '10 min' })

        expect(shows('Machine size')).toBe(false)
        expect(shows('Demo')).toBe(false)
        expect(shows('Soon')).toBe(false)
    })

    test('billing: no auto top-up, with the flag on or off', async () => {
        page(<ProfileBillingSettings profile={{ name: 'Asha', email: 'asha@example.com' }} />)
        await screen.findByText('Limits')

        expect(shows('Auto top-up')).toBe(false)
        expect(shows('Demo')).toBe(false)
        expect(shows('Soon')).toBe(false)
    })

    test('members: single sign-on says "Soon"', async () => {
        page(<ProfileMembersSettings ownerName="Asha Rao" ownerEmail="asha@example.com" />)
        await screen.findByText('Audit log')

        const row = screen.getByText('Single sign-on').closest('div')!.parentElement!
        expect(within(row).queryByText('Soon') !== null).toBe(true)
        expect(count('Soon')).toBe(1)
        expect(shows('Demo')).toBe(false)
    })

    test('home: Super Crew says "Soon"', async () => {
        page(<HomeTabs />)

        const crew = await screen.findByRole('tab', { name: /Super Crew/ })
        expect(within(crew).queryByText('Soon') !== null).toBe(true)
        expect(shows('Demo')).toBe(false)
    })
})

describe('parts that are connected to the server have no preview gate', () => {
    // the API keys page reads the server for every user, with no pill. the model source
    // section was removed: a run picks credits or a key on its own
    for (const flag of [false, true]) {
        test(`api keys page, flag ${flag ? 'on' : 'off'}: keys, no model source, no pill`, async () => {
            setConnectionsDemo(flag)
            page(<ProfileModelKeysSettings />)
            await screen.findByText('Saved keys')

            expect(shows('Model source')).toBe(false)
            expect(shows('Demo')).toBe(false)
            expect(shows('Soon')).toBe(false)
        })
    }
})
