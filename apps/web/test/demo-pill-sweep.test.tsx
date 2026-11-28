import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import React from 'react'

if (!globalThis.document) {
    GlobalRegistrator.register()
}

// load react-dom and the app only after the dom exists, or react skips its input events
const { render, screen, fireEvent, cleanup, within } = await import('@testing-library/react')
const { MemoryRouter } = await import('react-router-dom')
const { ConnectionsPage } = await import('../src/features/connections/components/ConnectionsPage')
const { useConnectionsStore } =
    await import('../src/features/connections/hooks/useConnectionsStore')
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
const initialStore = useConnectionsStore.getState()

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
    '/setting/sandbox': { idleStopMinutes: 10, archiveAfterDays: null, setupCommands: [] },
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
    '/connections/prompt-box': { skills: [], plugins: [], mcps: [] },
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

const SAMPLE_TABS = [
    ['plugins', 'Plugins', 'Plugins are coming soon'],
    ['hooks', 'Hooks', 'Hooks are coming soon'],
    ['rules', 'Rules', 'Rules are coming soon'],
    ['memory', 'Memory', 'Memory is coming soon'],
] as const

beforeEach(() => {
    cleanup()
    resetPreviewValues()
    useConnectionsStore.setState(initialStore, true)
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

    test('connections: the Plugins, Hooks, Rules and Memory tabs', () => {
        page(<ConnectionsPage />, '/settings/connections/apps')

        for (const [, label] of SAMPLE_TABS) {
            expect(within(tab(label)).queryByText('Demo') !== null).toBe(true)
        }
        expect(within(tab('Apps')).queryByText('Demo') === null).toBe(true)
        cleanup()

        // the tabs open on their sample values, not on "coming soon"
        for (const [slug, , soonText] of SAMPLE_TABS) {
            page(<ConnectionsPage />, `/settings/connections/${slug}`)
            expect(shows(soonText)).toBe(false)
            cleanup()
        }
    })

    test('connections: the Skills and MCPs tabs list sample values, so they have the pill too', () => {
        page(<ConnectionsPage />, '/settings/connections/apps')

        expect(within(tab('Skills')).queryByText('Demo') !== null).toBe(true)
        expect(within(tab('MCPs')).queryByText('Demo') !== null).toBe(true)
        expect(within(tab('Apps')).queryByText('Demo') === null).toBe(true)
    })

    test('connections: the import setup dialog on sample values', () => {
        page(<ConnectionsPage />, '/settings/connections/apps')
        fireEvent.click(screen.getByRole('button', { name: 'Import setup' }))

        expect(shows('6 found')).toBe(true)
        // the pill sits next to the label of the sample repository list
        expect(within(screen.getByText('Repository')).queryAllByText('Demo')).toHaveLength(1)
        expect(calls.filter((call) => call.path.startsWith('/connections/import'))).toEqual([])
    })

    test('prompt box: the Plugins row of the + menu', () => {
        footer()
        fireEvent.click(screen.getByLabelText('Add'))

        const row = within(screen.getByRole('menuitem', { name: /Plugins/ }))
        expect(row.queryByText('Demo') !== null).toBe(true)
        expect(shows('Soon')).toBe(false)
    })

    test('prompt box: the Skills and MCPs rows of the + menu, the headings of the sample lists', () => {
        footer()
        fireEvent.click(screen.getByLabelText('Add'))

        for (const name of [/Skills/, /MCPs/]) {
            const row = within(screen.getByRole('menuitem', { name }))
            expect(row.queryByText('Demo') !== null).toBe(true)
        }
        // Plugins, Skills and MCPs. the other rows read the server
        expect(count('Demo')).toBe(3)
    })

    test('prompt box: the Skills label of the slash menu', async () => {
        page(<SessionBox />)
        typeInBox('/')

        // the skills of the account and the skills of the sample plugin: one label each
        for (const name of ['Skills', 'release-kit']) {
            const label = await screen.findByText(name)
            expect(within(label.parentElement!).queryByText('Demo') !== null).toBe(true)
        }
        expect(within(screen.getByText('Commands').parentElement!).queryByText('Demo')).toBeNull()
        expect(count('Demo')).toBe(2)
    })

    test('prompt box: each MCP row of /check', async () => {
        page(<SessionBox />)
        const el = typeInBox('/check')
        fireEvent.keyDown(el, { key: 'Enter' })

        const rows = (await screen.findAllByText(/^MCP: /)).map(
            (label) => label.closest('[role="option"]') as HTMLElement
        )
        expect(rows.length > 0).toBe(true)
        for (const row of rows) {
            expect(within(row).queryByText('Demo') !== null).toBe(true)
        }
        expect(count('Demo')).toBe(rows.length)
    })

    test('sandbox: machine size', async () => {
        page(<ProfileSandboxSettings />)
        await screen.findByRole('radio', { name: '10 min' })

        const label = screen.getByText('Machine size')
        expect(within(label).queryByText('Demo') !== null).toBe(true)
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

    test('connections: the four tabs say "coming soon" and no tab has a pill', () => {
        for (const [slug, , soonText] of SAMPLE_TABS) {
            page(<ConnectionsPage />, `/settings/connections/${slug}`)
            expect(shows(soonText)).toBe(true)
            expect(shows('Demo')).toBe(false)
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

    test('prompt box: the Plugins row says "Soon"', () => {
        footer()
        fireEvent.click(screen.getByLabelText('Add'))

        const row = within(screen.getByRole('menuitem', { name: /Plugins/ }))
        expect(row.queryByText('Soon') !== null).toBe(true)
        expect(count('Soon')).toBe(1)
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
    // the model source row lives on the API keys page for every user, with no pill
    for (const flag of [false, true]) {
        test(`api keys page, flag ${flag ? 'on' : 'off'}: model source and keys, no pill`, async () => {
            setConnectionsDemo(flag)
            page(<ProfileModelKeysSettings />)
            await screen.findByText('Saved keys')

            expect(shows('Model source')).toBe(true)
            expect(shows('Demo')).toBe(false)
            expect(shows('Soon')).toBe(false)
        })
    }
})
