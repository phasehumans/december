import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test'
import React from 'react'

if (!globalThis.document) {
    GlobalRegistrator.register()
}

// load react-dom and the app only after the dom exists, or react skips its input events
const { render, screen, fireEvent, cleanup, within, waitFor } =
    await import('@testing-library/react')
const { MemoryRouter, useLocation } = await import('react-router-dom')
const { useAppStore } = await import('../src/app/store')
const { ChatPromptInput } = await import('../src/features/chat/components/ChatPromptInput')
const { setConnectionsDemo } = await import('../src/features/connections/lib/connectionsDemo')
const { PromptInput } = await import('../src/features/home/components/PromptInput')
const { useModelSelection } = await import('../src/features/home/model-selection')
const { BASE_PROMPT_CONFIG, usePromptConfig } = await import('../src/features/home/promptConfig')
const { usePreferences } = await import('../src/features/profile/lib/preferences')
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

const press = (key: string, options: { shiftKey?: boolean; ctrlKey?: boolean } = {}) =>
    fireEvent.keyDown(box(), { key, ...options })

const list = () => within(screen.getByRole('listbox'))

/** runs the checks at phone width, where menus are bottom sheets */
const onPhone = async (run: () => void | Promise<void>) => {
    const original = window.matchMedia
    window.matchMedia = ((query: string) => ({
        matches: query.includes('max-width'),
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
    })) as never
    try {
        await run()
    } finally {
        window.matchMedia = original
    }
}

beforeEach(() => {
    cleanup()
    useModelSelection.getState().reset()
    usePromptConfig.setState({
        values: BASE_PROMPT_CONFIG,
        defaults: BASE_PROMPT_CONFIG,
        pluginsOff: [],
        mcpsOff: [],
    })
    usePreferences.setState({ sendKey: 'enter', soundOnFinish: false })
})

afterEach(() => {
    cleanup()
    setConnectionsDemo(null)
    mock.restore()
})

describe('home prompt box placeholder', () => {
    test('desktop shows the CLI line', () => {
        wrap(<HomeBox />)
        expect(box().placeholder).toBe(
            'Ask December to build features, fix bugs, or work on your code...'
        )
    })

    test('a phone shows the short line', () =>
        onPhone(() => {
            wrap(<HomeBox />)
            expect(box().placeholder).toBe('Ask December to build or fix...')
        }))

    test('with a repo picked the text asks for the change', () => {
        const client = new QueryClient({
            defaultOptions: { queries: { retry: false, staleTime: Infinity } },
        })
        client.setQueryData(['byok'], { providers: [], credentials: [] })
        client.setQueryData(['profile'], { id: 'u1', githubConnected: true })
        client.setQueryData(['quickinfo'], { fullName: 'Test', githubConnected: true })
        client.setQueryData(
            ['github-repos'],
            [
                {
                    id: 123,
                    name: 'december',
                    fullName: 'phasehumans/december',
                    htmlUrl: 'https://github.com/phasehumans/december',
                    cloneUrl: 'https://github.com/phasehumans/december.git',
                    defaultBranch: 'main',
                    owner: { login: 'phasehumans' },
                },
            ]
        )
        render(
            <QueryClientProvider client={client}>
                <MemoryRouter>
                    <HomeBox />
                </MemoryRouter>
            </QueryClientProvider>
        )
        fireEvent.click(screen.getByLabelText('Add'))
        fireEvent.click(screen.getByRole('menuitem', { name: 'Repositories' }))
        fireEvent.click(screen.getByText('december'))
        expect(screen.getByLabelText('Target Branch')).not.toBeNull()
        expect(box().placeholder).toBe('Describe the change...')
    })

    test('a session asks for a follow-up', () => {
        wrap(<SessionBox />)
        expect(box().placeholder).toBe('Ask a follow-up...')
    })
})

describe('slash menu on Home', () => {
    test('is a small list of names with a few words each, and no tabs', () => {
        wrap(<HomeBox />)
        type('/')

        expect(list().getByText('/model')).not.toBeNull()
        expect(list().getByText('Pick a model')).not.toBeNull()
        expect(list().getByText('/effort')).not.toBeNull()
        expect(list().getByText('/help')).not.toBeNull()
        // /plan works since the server reads plan first (#632); /skills waits for demo mode
        expect(list().getByText('/plan')).not.toBeNull()
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

    test('/check shows the one answer from the server', async () => {
        const check = spyOn(sessionAPI, 'getCheck').mockResolvedValue({
            github: { connected: true, appInstalled: true, accounts: ['acme'] },
            gitlab: { connected: false, username: null },
            credits: { balanceInCents: 1250, enoughToStart: true },
            keys: [],
            machine: null,
        })
        wrap(<HomeBox />)
        type('/check')
        press('Enter')
        expect(list().getByText('GitHub')).not.toBeNull()
        expect(await list().findByText('Connected')).not.toBeNull()
        expect(list().getByText('$ 12.50')).not.toBeNull()
        expect(list().getByText('None saved')).not.toBeNull()
        check.mockRestore()
    })

    test('/review with a link starts a review session that opens no pull request', () => {
        const onSubmit = mock((_prompt: string, _options?: unknown) => {})
        wrap(<HomeBox onSubmit={onSubmit} />)
        type('/review https://github.com/acme/shop/pull/42')
        press('Enter')
        expect(onSubmit).toHaveBeenCalledTimes(1)
        const [prompt, options] = onSubmit.mock.calls[0] as [string, any]
        expect(prompt).toContain('git fetch origin pull/42/head:review-42')
        expect(options.repoUrl).toBe('https://github.com/acme/shop')
        expect(options.runConfig).toEqual({ openPullRequest: false, planFirst: false })
    })

    test('a slash in the middle of a sentence does not open the menu', () => {
        wrap(<HomeBox />)
        type('look in src /')
        expect(screen.queryByRole('listbox')).toBeNull()
    })

    test('the Commands row of the + menu opens the command list beside it', () => {
        wrap(<HomeBox />)
        // the prompt box has no slash button of its own
        expect(screen.queryByLabelText('Commands')).toBeNull()
        fireEvent.click(screen.getByLabelText('Add'))
        const row = screen.getByRole('menuitem', { name: 'Commands' })
        expect(row.getAttribute('aria-haspopup')).toBe('menu')

        fireEvent.click(row)
        // the main menu stays in view beside the list, and nothing is typed
        expect(screen.getByText('Upload attachment')).not.toBeNull()
        expect(box().value).toBe('')
        expect(screen.getByText('/model')).not.toBeNull()
        // home has no session commands
        expect(screen.queryByText('/rename')).toBeNull()

        // a short fixed list: no search box
        expect(screen.queryByLabelText('Search commands')).toBeNull()

        // a pick runs the command and closes the + menu
        fireEvent.click(screen.getByText('/mcp'))
        expect(screen.getByTestId('location').textContent).toBe('/settings/connections/mcps')
        expect(screen.queryByText('Upload attachment')).toBeNull()
    })

    test('a command with choices picked in the + menu opens its choices', () => {
        wrap(<HomeBox />)
        type('fix the tests')
        fireEvent.click(screen.getByLabelText('Add'))
        fireEvent.click(screen.getByRole('menuitem', { name: 'Commands' }))
        fireEvent.click(screen.getByText('/effort'))

        // the command is typed after the prompt and its choices are open
        expect(box().value).toBe('fix the tests /effort')
        expect(list().getByText('Fast')).not.toBeNull()
        const deep = list().getByText('Deep').closest('[role="option"]')
        // the current value is the selected row
        expect(deep?.getAttribute('aria-selected')).toBe('true')

        // a pick takes the command out of the prompt again
        fireEvent.click(list().getByText('Fast'))
        expect(box().value).toBe('fix the tests ')
        expect(screen.queryByRole('listbox')).toBeNull()
    })

    test('signed out: the Commands row types a slash and opens the menu', () => {
        wrap(<HomeBox isAuthenticated={false} />)
        fireEvent.click(screen.getByLabelText('Add'))
        const row = screen.getByRole('menuitem', { name: 'Commands' })
        expect(row.getAttribute('aria-haspopup')).toBeNull()
        fireEvent.click(row)
        expect(box().value).toBe('/')
        expect(screen.getByRole('listbox')).not.toBeNull()
        expect(screen.queryByText('Upload attachment')).toBeNull()
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

    test('/usage shows the totals of the session from the server', async () => {
        useAppStore.setState({ activeProjectId: 'session-1' })
        const usage = spyOn(sessionAPI, 'getSessionUsage').mockResolvedValue({
            inputTokens: 80_000,
            outputTokens: 4_000,
            totalTokens: 84_000,
            costInCents: 31,
            byModel: [],
        })
        wrap(<SessionBox />)
        type('/usage')
        press('Enter')
        expect(await screen.findByText('84k')).not.toBeNull()
        expect(screen.getByText('$ 0.31')).not.toBeNull()
        expect(usage).toHaveBeenCalledWith('session-1')
        usage.mockRestore()
        useAppStore.setState({ activeProjectId: null })
    })

    test('/btw shows the answer and sends nothing to the agent', async () => {
        useAppStore.setState({ activeProjectId: 'session-1' })
        const ask = spyOn(sessionAPI, 'askSideQuestion').mockResolvedValue({
            answer: 'It uses stripe.',
        })
        const onSubmit = mock(() => {})
        wrap(<SessionBox onSubmit={onSubmit} />)
        type('/btw which payment provider?')
        press('Enter')
        expect(await screen.findByText('It uses stripe.')).not.toBeNull()
        expect(ask).toHaveBeenCalledWith('session-1', 'which payment provider?')
        expect(onSubmit).not.toHaveBeenCalled()
        ask.mockRestore()
        useAppStore.setState({ activeProjectId: null })
    })

    test('/rewind lists the prompts, and a pick puts that prompt back in the box', async () => {
        useAppStore.setState({ activeProjectId: 'session-1' })
        const turns = spyOn(sessionAPI, 'getTurns').mockResolvedValue({
            turns: [
                { sequence: 3, prompt: 'add tests', createdAt: '2026-11-25T10:00:00Z' },
                { sequence: 1, prompt: 'build the cart', createdAt: '2026-11-25T09:00:00Z' },
            ],
        })
        const rewind = spyOn(sessionAPI, 'rewindSession').mockResolvedValue({
            prompt: 'add tests',
            filesRestored: true,
            filesNote: null,
        })
        wrap(<SessionBox />)
        type('/rewind')
        press('Enter')
        fireEvent.click(await screen.findByText('add tests'))
        await waitFor(() => expect(rewind).toHaveBeenCalledWith('session-1', 3))
        await waitFor(() => expect(box().value).toBe('add tests'))
        turns.mockRestore()
        rewind.mockRestore()
        useAppStore.setState({ activeProjectId: null })
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

    test('on a phone the speed is text beside the mic, and the switches are in Configuration', () =>
        onPhone(() => {
            const onSelectModel = mock((_m: string, _p?: string, _s?: string) => {})
            footer({ onSelectModel }, { keys: true })
            // the footer has no switch: only the text
            expect(screen.queryByRole('radiogroup', { name: 'Speed' })).toBeNull()
            expect(screen.queryByRole('radiogroup', { name: 'Model source' })).toBeNull()
            const text = screen.getByRole('button', { name: 'Speed: Deep' })
            expect(text.textContent).toBe('Deep')

            fireEvent.click(text)
            const sheet = within(screen.getByRole('dialog', { name: 'Configuration' }))
            expect(sheet.getByText('Run on')).not.toBeNull()
            expect(sheet.getByRole('radiogroup', { name: 'Speed' })).not.toBeNull()
            expect(sheet.queryByText('Model')).toBeNull()

            fireEvent.click(sheet.getByRole('radio', { name: 'Your keys' }))
            expect(onSelectModel).toHaveBeenCalledWith('claude-sonnet-5', 'anthropic', 'OWN_KEY')
            // the sheet stays open after the source changes
            expect(screen.getByRole('dialog', { name: 'Configuration' })).not.toBeNull()
        }))

    test('on a phone and a key the text is the model name and opens the model list', () =>
        onPhone(async () => {
            const onSelectModel = mock((_m: string, _p?: string, _s?: string) => {})
            footer(
                {
                    onSelectModel,
                    selectedSource: 'OWN_KEY',
                    selectedModel: 'anthropic/claude-sonnet-5',
                    selectedProvider: 'anthropic',
                },
                { keys: true }
            )
            const text = screen.getByRole('button', { name: 'Select Model' })
            expect(text.textContent).toBe('claude-sonnet-5')

            fireEvent.click(text)
            const models = within(screen.getByRole('dialog', { name: 'Models' }))
            fireEvent.click(models.getByText('OpenAI'))
            fireEvent.click(models.getByText('gpt-5.6-sol'))
            expect(onSelectModel).toHaveBeenCalledWith('gpt-5.6-sol', 'openai', 'OWN_KEY')
            expect(screen.queryByRole('dialog', { name: 'Models' })).toBeNull()

            // Configuration has a Model row in place of Speed. It opens the same list
            fireEvent.click(screen.getByRole('button', { name: 'Configuration' }))
            const sheet = within(screen.getByRole('dialog', { name: 'Configuration' }))
            expect(sheet.queryByRole('radiogroup', { name: 'Speed' })).toBeNull()
            fireEvent.click(sheet.getByText('Model'))
            expect(await screen.findByRole('dialog', { name: 'Models' })).not.toBeNull()
            expect(screen.queryByRole('dialog', { name: 'Configuration' })).toBeNull()
        }))

    test('on a phone the model list is under Configuration: Back goes up to Run on', () =>
        onPhone(() => {
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
            fireEvent.click(screen.getByRole('button', { name: 'Select Model' }))
            const models = within(screen.getByRole('dialog', { name: 'Models' }))
            // two keys: a key first, then its models. Back goes up one step at a time
            fireEvent.click(models.getByText('OpenAI'))
            expect(models.getByText('gpt-5.6-sol')).not.toBeNull()
            fireEvent.click(models.getByRole('button', { name: 'Back' }))
            expect(models.getByText('Anthropic')).not.toBeNull()
            expect(models.queryByText('gpt-5.6-sol')).toBeNull()

            fireEvent.click(models.getByRole('button', { name: 'Back' }))
            const config = within(screen.getByRole('dialog', { name: 'Configuration' }))
            expect(config.getByText('Run on')).not.toBeNull()
            expect(config.queryByRole('button', { name: 'Back' })).toBeNull()
            fireEvent.click(config.getByRole('radio', { name: 'December credits' }))
            expect(onSelectModel).toHaveBeenCalledWith('gemini-2.5-pro', 'gemini', 'CREDITS')
        }))

    test('on a phone with no saved key, Your keys opens the keys page', () =>
        onPhone(async () => {
            const onSelectModel = mock((_m: string, _p?: string, _s?: string) => {})
            footer({ onSelectModel })
            fireEvent.click(screen.getByRole('button', { name: 'Configuration' }))
            fireEvent.click(screen.getByRole('radio', { name: 'Your keys' }))
            expect(onSelectModel).not.toHaveBeenCalled()
            await waitFor(() =>
                expect(screen.getByTestId('location').textContent).toBe('/settings/models')
            )
        }))

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

    test('configuration shows live switches: the server reads the settings (#632)', () => {
        footer()
        fireEvent.click(screen.getByLabelText('Configuration'))
        const menu = screen.getByRole('group', { name: 'Configuration' })
        expect(within(menu).getByRole('switch', { name: 'Plan first' })).not.toBeNull()
        expect(within(menu).getByRole('switch', { name: 'Open pull request' })).not.toBeNull()
        // Fast and Deep moved to the footer
        expect(within(menu).queryByText('Effort')).toBeNull()
        expect(within(menu).queryByText('Soon')).toBeNull()
    })

    test('a changed setting shows a dot, and Set as default saves it', () => {
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

describe('send key preference', () => {
    test('with "Ctrl + Enter", a plain Enter does not send and Ctrl Enter sends', () => {
        usePreferences.setState({ sendKey: 'mod-enter' })
        const onSubmit = mock((_prompt: string) => {})
        wrap(<HomeBox onSubmit={onSubmit} />)

        type('fix the login redirect')
        press('Enter')
        expect(onSubmit).toHaveBeenCalledTimes(0)

        press('Enter', { ctrlKey: true })
        expect(onSubmit).toHaveBeenCalledTimes(1)
        expect(onSubmit.mock.calls[0][0]).toBe('fix the login redirect')
    })

    test('with "Enter", a plain Enter sends', () => {
        const onSubmit = mock((_prompt: string) => {})
        wrap(<HomeBox onSubmit={onSubmit} />)

        type('fix the login redirect')
        press('Enter')
        expect(onSubmit).toHaveBeenCalledTimes(1)
    })
})
