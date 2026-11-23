import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test'
import React from 'react'

if (!globalThis.document) {
    GlobalRegistrator.register()
}

// load react-dom and the app only after the dom exists, or react skips its input events
const { render, screen, fireEvent, cleanup, within } = await import('@testing-library/react')
const { MemoryRouter, useLocation } = await import('react-router-dom')
const { useAppStore } = await import('../src/app/store')
const { ChatPromptInput } = await import('../src/features/chat/components/ChatPromptInput')
const { setConnectionsDemo } = await import('../src/features/connections/lib/connectionsDemo')
const { PromptInput } = await import('../src/features/home/components/PromptInput')
const { useModelSelection } = await import('../src/features/home/model-selection')
const { BASE_PROMPT_CONFIG, usePromptConfig } = await import('../src/features/home/promptConfig')
const { sessionAPI } = await import('../src/features/sessions/api/session')
const { PromptFooter } = await import('../src/shared/components/ui/PromptFooter')

const LocationProbe: React.FC = () => <div data-testid="location">{useLocation().pathname}</div>

const savedKeys = {
    providers: [
        { id: 'anthropic', name: 'Anthropic', keyUrl: '' },
        { id: 'openai', name: 'OpenAI', keyUrl: '' },
    ],
    credentials: [
        {
            provider: 'anthropic',
            keyHint: 'a1b2',
            models: ['claude-sonnet-5', 'claude-opus-5'],
            defaultModel: 'claude-sonnet-5',
            verifiedAt: '2026-11-01T00:00:00.000Z',
            lastUsedAt: null,
        },
        {
            provider: 'openai',
            keyHint: 'c3d4',
            models: ['gpt-5.6-sol'],
            defaultModel: 'gpt-5.6-sol',
            verifiedAt: '2026-11-01T00:00:00.000Z',
            lastUsedAt: null,
        },
    ],
}

const wrap = (ui: React.ReactNode, options: { keys?: boolean } = {}) => {
    // the cache answers the saved-keys request, so nothing goes to the network
    const client = new QueryClient({
        defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    })
    client.setQueryData(['byok'], options.keys ? savedKeys : { providers: [], credentials: [] })
    return render(
        <QueryClientProvider client={client}>
            <MemoryRouter>
                {ui}
                <LocationProbe />
            </MemoryRouter>
        </QueryClientProvider>
    )
}

const HomeBox: React.FC<{
    onSubmit?: (prompt: string, options?: unknown) => void
    onModelChange?: (model: string, provider?: string) => void
    isAuthenticated?: boolean
    onOpenAuth?: () => void
}> = ({ onSubmit = () => {}, onModelChange, isAuthenticated = true, onOpenAuth }) => {
    const [value, setValue] = React.useState('')
    return (
        <PromptInput
            value={value}
            onChange={setValue}
            onSubmit={onSubmit}
            isLoading={false}
            isAuthenticated={isAuthenticated}
            onOpenAuth={onOpenAuth}
            onModelChange={onModelChange}
            mode="agent"
        />
    )
}

const SessionBox: React.FC<{ onSubmit?: () => void }> = ({ onSubmit = () => {} }) => {
    const [value, setValue] = React.useState('')
    return <ChatPromptInput value={value} onChange={setValue} onSubmit={onSubmit} isAuthenticated />
}

const box = () => document.querySelector('textarea') as HTMLTextAreaElement

/** types text with the caret at the end, the way a keyboard does */
const type = (value: string) => {
    const el = box()
    fireEvent.focusIn(el)
    fireEvent.change(el, { target: { value } })
    el.setSelectionRange(value.length, value.length)
    fireEvent.keyUp(el)
}

const press = (key: string, options: { shiftKey?: boolean } = {}) =>
    fireEvent.keyDown(box(), { key, ...options })

const list = () => within(screen.getByRole('listbox'))

beforeEach(() => {
    cleanup()
    useModelSelection.getState().reset()
    usePromptConfig.setState({
        values: BASE_PROMPT_CONFIG,
        defaults: BASE_PROMPT_CONFIG,
        pluginsOff: [],
        mcpsOff: [],
    })
})

afterEach(() => {
    cleanup()
    setConnectionsDemo(null)
    mock.restore()
})

describe('slash menu on Home', () => {
    test('is a small list of names with a few words each, and no tabs', () => {
        wrap(<HomeBox />)
        type('/')

        expect(list().getByText('/model')).not.toBeNull()
        expect(list().getByText('Pick a model')).not.toBeNull()
        expect(list().getByText('/effort')).not.toBeNull()
        expect(list().getByText('/help')).not.toBeNull()
        // these need the server, so they stay out until demo mode
        expect(list().queryByText('/plan')).toBeNull()
        expect(list().queryByText('/skills')).toBeNull()
        // session commands are not on Home
        expect(list().queryByText('/rename')).toBeNull()
        expect(screen.queryByRole('tablist')).toBeNull()
        // a list of commands only needs no group label
        expect(list().queryByText('Commands')).toBeNull()
    })

    test('the list narrows while typing, and nothing found still sends the prompt', () => {
        const onSubmit = mock((_prompt: string) => {})
        wrap(<HomeBox onSubmit={onSubmit} />)

        type('/mo')
        expect(list().getByText('/model')).not.toBeNull()
        expect(list().getByText('/memory')).not.toBeNull()
        expect(list().queryByText('/docs')).toBeNull()

        type('/xyz')
        expect(screen.getByText('No commands found.')).not.toBeNull()
        press('Enter')
        expect(onSubmit).toHaveBeenCalledTimes(1)
        expect(onSubmit.mock.calls[0][0]).toBe('/xyz')
    })

    test('the Tab key does not pick a row', () => {
        wrap(<HomeBox />)
        type('/mcp')
        press('Tab')
        expect(box().value).toBe('/mcp')
        expect(screen.getByTestId('location').textContent).toBe('/')
    })

    test('/effort and /model show Fast and Deep on credits, and Enter picks one', () => {
        const onModelChange = mock((_model: string, _provider?: string) => {})
        wrap(<HomeBox onModelChange={onModelChange} />)

        type('/effort')
        press('Enter')
        expect(list().getByText('Fast')).not.toBeNull()
        expect(list().getByText('Deep')).not.toBeNull()
        // Deep is the default, so it is the selected row. Up moves to Fast
        press('ArrowUp')
        press('Enter')
        expect(onModelChange).toHaveBeenCalledWith('gemini-2.5-flash', 'gemini')
        expect(box().value).toBe('')
        expect(screen.queryByRole('listbox')).toBeNull()

        type('/model')
        press('Enter')
        expect(list().getByText('Deep')).not.toBeNull()
        expect(list().queryByText('GPT-4o')).toBeNull()
    })

    test('Esc goes back from the choices, then closes the menu', () => {
        wrap(<HomeBox />)
        type('/model')
        press('Enter')
        expect(list().getByText('Deep')).not.toBeNull()

        press('Escape')
        expect(list().getByText('/model')).not.toBeNull()
        press('Escape')
        expect(screen.queryByRole('listbox')).toBeNull()
    })

    test('/switch with no saved key offers to add one', () => {
        wrap(<HomeBox />)
        type('/switch')
        press('Enter')
        expect(list().getByText('December credits')).not.toBeNull()
        fireEvent.click(list().getByText('Add your own key'))
        expect(screen.getByTestId('location').textContent).toBe('/settings/models')
    })

    test('/switch with a saved key moves the run to that key and back', () => {
        wrap(<HomeBox />, { keys: true })
        type('/switch')
        press('Enter')
        fireEvent.click(list().getByText('Your keys'))
        expect(useModelSelection.getState()).toMatchObject({
            source: 'OWN_KEY',
            model: 'claude-sonnet-5',
            provider: 'anthropic',
        })
        // /effort is for December credits only
        type('/eff')
        expect(screen.getByText('No commands found.')).not.toBeNull()
        // /model now lists the key models
        type('/model')
        press('Enter')
        expect(list().getByText('claude-opus-5')).not.toBeNull()
        expect(list().getByText('gpt-5.6-sol')).not.toBeNull()
    })

    test('a command that opens a page goes there', () => {
        wrap(<HomeBox />)
        type('/mcp')
        press('Enter')
        expect(screen.getByTestId('location').textContent).toBe('/settings/connections/mcps')
    })

    test('/help and /keybindings open the help panel on their tab', () => {
        wrap(<HomeBox />)
        type('/keyb')
        press('Enter')
        expect(screen.getByRole('tab', { name: 'Shortcuts' }).getAttribute('aria-selected')).toBe(
            'true'
        )
        expect(screen.getByText('Ctrl K')).not.toBeNull()

        fireEvent.click(screen.getByRole('tab', { name: 'Commands' }))
        expect(screen.getByText('Check your setup')).not.toBeNull()
    })

    test('/check lists what the web can check', () => {
        wrap(<HomeBox />)
        type('/check')
        press('Enter')
        expect(list().getByText('GitHub')).not.toBeNull()
        expect(list().getByText('December credits')).not.toBeNull()
        expect(list().getByText('None saved')).not.toBeNull()
    })

    test('a slash in the middle of a sentence does not open the menu', () => {
        wrap(<HomeBox />)
        type('look in src /')
        expect(screen.queryByRole('listbox')).toBeNull()
    })

    test('the slash icon types a slash and opens the menu', () => {
        wrap(<HomeBox />)
        fireEvent.click(screen.getByLabelText('Commands'))
        expect(box().value).toBe('/')
        expect(screen.getByRole('listbox')).not.toBeNull()
    })

    test('signed out: the menu opens and a pick opens sign-up', () => {
        const onOpenAuth = mock(() => {})
        wrap(<HomeBox isAuthenticated={false} onOpenAuth={onOpenAuth} />)
        type('/mcp')
        press('Enter')
        expect(onOpenAuth).toHaveBeenCalledTimes(1)
        expect(screen.getByTestId('location').textContent).toBe('/')
    })
})

describe('slash menu in demo mode', () => {
    beforeEach(() => setConnectionsDemo(true))

    test('skills follow the commands under small labels', () => {
        wrap(<HomeBox />)
        type('/')
        expect(list().getByText('Commands')).not.toBeNull()
        expect(list().getByText('Skills')).not.toBeNull()
        expect(list().getByText('release-kit')).not.toBeNull()
        expect(list().getByText('/write-tests')).not.toBeNull()
        expect(screen.queryByRole('tablist')).toBeNull()
    })

    test('Enter picks a skill as a chip, and Backspace removes it', () => {
        wrap(<HomeBox />)
        type('/wri')
        press('Enter')
        expect(screen.getByLabelText('Remove /write-tests')).not.toBeNull()
        expect(box().value).toBe('')

        press('Backspace')
        expect(screen.queryByLabelText('Remove /write-tests')).toBeNull()
    })

    test('/plan turns on Plan first and shows a chip', () => {
        wrap(<HomeBox />)
        type('/plan')
        press('Enter')
        expect(usePromptConfig.getState().values.planFirst).toBe(true)

        fireEvent.click(screen.getByLabelText('Remove /plan'))
        expect(usePromptConfig.getState().values.planFirst).toBe(false)
    })

    test('a slash in the middle of a sentence lists only skills', () => {
        wrap(<HomeBox />)
        type('fix the login bug and /wri')
        expect(list().getByText('/write-tests')).not.toBeNull()
        expect(list().queryByText('Commands')).toBeNull()
    })
})

describe('slash menu in a session', () => {
    test('lists the session commands', () => {
        wrap(<SessionBox />)
        type('/')
        expect(list().getByText('/rename')).not.toBeNull()
        expect(list().getByText('/diff')).not.toBeNull()
        expect(list().getByText('/tasks')).not.toBeNull()
        expect(list().getByText('/exit')).not.toBeNull()
    })

    test('/rename with a title renames the session and is not sent as a prompt', async () => {
        const rename = spyOn(sessionAPI, 'renameSession').mockResolvedValue({} as never)
        const onSubmit = mock(() => {})
        useAppStore.setState({ activeProjectId: 'session-1' })
        wrap(<SessionBox onSubmit={onSubmit} />)

        type('/rename Billing webhooks')
        press('Enter')

        expect(rename).toHaveBeenCalledWith('session-1', 'Billing webhooks')
        expect(onSubmit).not.toHaveBeenCalled()
        expect(await screen.findByText('Session renamed.')).not.toBeNull()
        useAppStore.setState({ activeProjectId: null })
    })

    test('/usage shows the tokens of the session in one line', async () => {
        useAppStore.setState({
            messages: [
                { id: '1', role: 'user', content: 'hi' },
                { id: '2', role: 'assistant', content: 'done', tokensUsed: 84_000 },
            ] as never,
        })
        wrap(<SessionBox />)
        type('/usage')
        press('Enter')
        expect(await screen.findByText('This session: 84k tokens.')).not.toBeNull()
        useAppStore.setState({ messages: [] })
    })
})

describe('model control', () => {
    const footer = (
        props: Partial<React.ComponentProps<typeof PromptFooter>> = {},
        options: { keys?: boolean } = {}
    ) =>
        wrap(
            <PromptFooter
                onUpload={() => {}}
                onSubmit={() => {}}
                hasInput={false}
                isLoading={false}
                isAuthenticated
                {...props}
            />,
            options
        )

    test('with no saved key the source switch still shows, and there is no GitHub icon', () => {
        const onSelectModel = mock((_m: string, _p?: string, _s?: string) => {})
        footer({ onSelectModel })
        expect(screen.getByRole('radiogroup', { name: 'Speed' })).not.toBeNull()
        expect(screen.getByRole('radiogroup', { name: 'Model source' })).not.toBeNull()
        expect(screen.queryByText('Attach repo')).toBeNull()

        // the key side opens the keys page instead of switching
        fireEvent.click(screen.getByRole('radio', { name: 'Your keys' }))
        expect(onSelectModel).not.toHaveBeenCalled()
    })

    test('on a phone Fast and Deep move into Configuration', () => {
        const original = window.matchMedia
        window.matchMedia = ((query: string) => ({
            matches: query.includes('max-width'),
            media: query,
            addEventListener: () => {},
            removeEventListener: () => {},
        })) as never
        try {
            footer()
            expect(screen.queryByRole('radiogroup', { name: 'Speed' })).toBeNull()
            expect(screen.getByRole('radiogroup', { name: 'Model source' })).not.toBeNull()

            fireEvent.click(screen.getByRole('button', { name: 'Configuration' }))
            expect(screen.getByRole('radiogroup', { name: 'Speed' })).not.toBeNull()
        } finally {
            window.matchMedia = original
        }
    })

    test('the source switch moves between credits and a saved key', () => {
        const onSelectModel = mock((_m: string, _p?: string, _s?: string) => {})
        footer({ onSelectModel }, { keys: true })

        fireEvent.click(screen.getByRole('radio', { name: 'Your keys' }))
        expect(onSelectModel).toHaveBeenCalledWith('claude-sonnet-5', 'anthropic', 'OWN_KEY')
    })

    test('on a key the model button lists the keys, and the models of a key open beside it', () => {
        const onSelectModel = mock((_m: string, _p?: string, _s?: string) => {})
        footer(
            {
                onSelectModel,
                selectedSource: 'OWN_KEY',
                selectedModel: 'claude-sonnet-5',
                selectedProvider: 'anthropic',
            },
            { keys: true }
        )
        // no Fast and Deep on a key, and no star or key icon text on the button
        expect(screen.queryByRole('radiogroup', { name: 'Speed' })).toBeNull()
        const button = screen.getByRole('button', { name: 'Select Model' })
        expect(button.textContent).toBe('claude-sonnet-5')

        fireEvent.click(button)
        expect(screen.getByText('2 models')).not.toBeNull()
        fireEvent.click(screen.getByText('OpenAI'))
        fireEvent.click(screen.getByText('gpt-5.6-sol'))
        expect(onSelectModel).toHaveBeenCalledWith('gpt-5.6-sol', 'openai', 'OWN_KEY')

        fireEvent.click(screen.getByRole('radio', { name: 'December credits' }))
        expect(onSelectModel).toHaveBeenCalledWith('gemini-2.5-pro', 'gemini', 'CREDITS')
    })
})

describe('prompt footer menus', () => {
    const footer = (props: Partial<React.ComponentProps<typeof PromptFooter>> = {}) =>
        wrap(
            <PromptFooter
                onUpload={() => {}}
                onSubmit={() => {}}
                hasInput={false}
                isLoading={false}
                isAuthenticated
                {...props}
            />
        )

    test('the + menu has Skills, Plugins and MCPs marked Soon', () => {
        footer()
        fireEvent.click(screen.getByLabelText('Add'))

        expect(screen.getByText('Skills')).not.toBeNull()
        expect(screen.getByText('Plugins')).not.toBeNull()
        expect(screen.getByText('MCPs')).not.toBeNull()
        expect(screen.getAllByText('Soon')).toHaveLength(3)
        expect(screen.queryByText('Manage connections')).toBeNull()

        // a Soon row does nothing
        fireEvent.click(screen.getByText('Plugins'))
        expect(screen.queryByRole('switch')).toBeNull()
        expect(screen.getByText('Upload attachment')).not.toBeNull()
    })

    test('a row with a pick handler opens its list beside the menu', () => {
        const onPickSecret = mock((_secret: { name: string }) => {})
        const client = new QueryClient({
            defaultOptions: { queries: { retry: false, staleTime: Infinity } },
        })
        client.setQueryData(['byok'], { providers: [], credentials: [] })
        client.setQueryData(['secrets', 'mention'], {
            secrets: [{ id: 's1', name: 'STRIPE_KEY', note: null }],
        })
        render(
            <QueryClientProvider client={client}>
                <MemoryRouter>
                    <PromptFooter
                        onUpload={() => {}}
                        onSubmit={() => {}}
                        hasInput={false}
                        isLoading={false}
                        isAuthenticated
                        onPickSecret={onPickSecret}
                    />
                </MemoryRouter>
            </QueryClientProvider>
        )
        fireEvent.click(screen.getByLabelText('Add'))
        const row = screen.getByRole('menuitem', { name: 'Secrets' })
        expect(row.getAttribute('aria-haspopup')).toBe('menu')

        fireEvent.click(row)
        // the main menu stays in view beside the list
        expect(screen.getByText('Upload attachment')).not.toBeNull()
        fireEvent.click(screen.getByText('STRIPE_KEY'))
        expect(onPickSecret).toHaveBeenCalledTimes(1)
        expect(screen.queryByText('Upload attachment')).toBeNull()
    })

    test('demo mode: Plugins opens a list with a switch for this session', () => {
        setConnectionsDemo(true)
        footer()
        fireEvent.click(screen.getByLabelText('Add'))
        expect(screen.queryByText('Soon')).toBeNull()

        fireEvent.click(screen.getByText('Plugins'))
        const toggle = screen.getByLabelText('Use playwright in this session')
        expect(toggle.getAttribute('aria-checked')).toBe('true')
        fireEvent.click(toggle)
        expect(usePromptConfig.getState().pluginsOff).toEqual(['playwright'])
        // the list stays open while switches are flipped
        expect(screen.getByLabelText('Use release-kit in this session')).not.toBeNull()
    })

    test('demo mode: a skill picked from the + menu becomes a chip', () => {
        setConnectionsDemo(true)
        wrap(<HomeBox />)
        fireEvent.click(screen.getByLabelText('Add'))
        fireEvent.click(screen.getByText('Skills'))
        fireEvent.click(screen.getByText('write-tests'))
        expect(screen.getByLabelText('Remove /write-tests')).not.toBeNull()
    })

    test('a session has no Repositories, Plugins or MCPs rows', () => {
        setConnectionsDemo(true)
        footer({ mode: 'chat' })
        fireEvent.click(screen.getByLabelText('Add'))
        expect(screen.getByText('Skills')).not.toBeNull()
        expect(screen.queryByText('Repositories')).toBeNull()
        expect(screen.queryByText('Plugins')).toBeNull()
        expect(screen.queryByText('MCPs')).toBeNull()
    })

    test('configuration shows Soon rows until the server can read the settings', () => {
        footer()
        fireEvent.click(screen.getByLabelText('Configuration'))
        const menu = screen.getByRole('group', { name: 'Configuration' })
        expect(within(menu).getByText('Plan first')).not.toBeNull()
        expect(within(menu).getByText('Open pull request')).not.toBeNull()
        // Fast and Deep moved to the footer
        expect(within(menu).queryByText('Effort')).toBeNull()
        expect(within(menu).getAllByText('Soon')).toHaveLength(2)
    })

    test('demo mode: a changed setting shows a dot, and Set as default saves it', () => {
        setConnectionsDemo(true)
        footer()
        fireEvent.click(screen.getByLabelText('Configuration'))
        expect(screen.queryByTestId('config-changed-dot')).toBeNull()

        fireEvent.click(screen.getByRole('switch', { name: 'Plan first' }))
        expect(screen.getByTestId('config-changed-dot')).not.toBeNull()
        expect(screen.getByText('Reset')).not.toBeNull()

        fireEvent.click(screen.getByText('Set as default'))
        expect(screen.getByText('Saved')).not.toBeNull()
        expect(usePromptConfig.getState().defaults.planFirst).toBe(true)
        expect(screen.queryByTestId('config-changed-dot')).toBeNull()
    })
})
