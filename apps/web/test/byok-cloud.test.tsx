import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from 'bun:test'
import React from 'react'
import { MemoryRouter } from 'react-router-dom'

if (!globalThis.document) {
    GlobalRegistrator.register()
}

const { render, fireEvent, screen, cleanup, waitFor } = await import('@testing-library/react')
const { PromptFooter } = await import('../src/shared/components/ui/PromptFooter')
const { ProfileModelKeysSettings } =
    await import('../src/features/profile/components/ProfileModelKeysSettings')
const { byokAPI } = await import('../src/features/profile/api/byok')
const { profileAPI } = await import('../src/features/profile/api/profile')
const { sessionAPI } = await import('../src/features/sessions/api/session')
const { generationAPI, getSharedSocket, isOwnKeyError } =
    await import('../src/features/generation/api/generation')
const { useModelSelection } = await import('../src/features/home/model-selection')
const { useAppStore } = await import('../src/app/store')

const GROQ = {
    provider: 'groq',
    keyHint: 'abcd',
    models: ['llama-3.3-70b-versatile', 'qwen-qwq-32b'],
    defaultModel: 'llama-3.3-70b-versatile',
    verifiedAt: '2026-11-22T00:00:00.000Z',
    lastUsedAt: null,
}
const PROVIDERS = [
    { id: 'groq', name: 'Groq', keyUrl: 'https://console.groq.com/keys' },
    {
        id: 'watsonx',
        name: 'watsonx.ai',
        keyUrl: 'https://cloud.ibm.com/iam/apikeys',
        keyHint: 'Enter it as API_KEY:PROJECT_ID',
    },
]

const renderWithClient = (ui: React.ReactElement) => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    return render(
        <MemoryRouter>
            <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
        </MemoryRouter>
    )
}

// under happy-dom, input events inside a react portal (the Modal) never reach react,
// while clicks do. call the onChange handler react attached to the element instead.
// typing in a real browser is checked by hand.
const typeInto = (input: HTMLInputElement, value: string) => {
    const propsKey = Object.keys(input).find((key) => key.startsWith('__reactProps'))
    if (!propsKey) throw new Error('not a react-managed input')
    input.value = value
    ;(input as any)[propsKey].onChange({ target: input, currentTarget: input })
}

const spies: Array<{ mockRestore: () => void }> = []

beforeEach(() => {
    useModelSelection.getState().reset()
    spies.push(
        spyOn(profileAPI, 'getProfile').mockImplementation(
            async () => ({ id: 'u1', defaultModelSource: 'CREDITS' }) as any
        )
    )
})

afterEach(() => {
    cleanup()
    useModelSelection.getState().reset()
    while (spies.length) spies.pop()!.mockRestore()
})

describe('model picker with own keys', () => {
    it('shows a source switch when a key is saved, and "Your keys" selects that key as OWN_KEY', async () => {
        spies.push(
            spyOn(byokAPI, 'list').mockImplementation(async () => ({
                providers: PROVIDERS,
                credentials: [GROQ],
            }))
        )
        const onSelectModel = mock(() => {})
        renderWithClient(
            <PromptFooter
                onUpload={() => {}}
                onSubmit={() => {}}
                hasInput
                isLoading={false}
                isAuthenticated
                selectedModel="gemini-2.5-pro"
                selectedProvider="gemini"
                onSelectModel={onSelectModel}
            />
        )

        // on december credits the footer has Fast and Deep, and no model names
        expect(screen.getByRole('radio', { name: 'Deep' })).toBeDefined()
        const yourKeys = await screen.findByRole('radio', { name: 'Your keys' })

        fireEvent.click(yourKeys)
        expect(onSelectModel).toHaveBeenCalledWith(GROQ.defaultModel, 'groq', 'OWN_KEY')
    })

    it('keeps the source switch on credits when no key is saved', async () => {
        spies.push(
            spyOn(byokAPI, 'list').mockImplementation(async () => ({
                providers: PROVIDERS,
                credentials: [],
            }))
        )
        renderWithClient(
            <PromptFooter
                onUpload={() => {}}
                onSubmit={() => {}}
                hasInput
                isLoading={false}
                isAuthenticated
            />
        )
        expect(await screen.findByRole('radiogroup', { name: 'Speed' })).toBeDefined()
        const keys = screen.getByRole('radio', { name: 'Your keys' })
        expect(keys.getAttribute('aria-checked')).toBe('false')
        expect(screen.queryByRole('button', { name: /Select Model/i })).toBeNull()
    })
})

describe('sending a prompt on an own key', () => {
    it('creates the session with the own-key source and sends it with the prompt', async () => {
        useModelSelection
            .getState()
            .select({ model: 'llama-3.3-70b-versatile', provider: 'groq', source: 'OWN_KEY' })

        let createdWith: any = null
        spies.push(
            spyOn(sessionAPI, 'createSession').mockImplementation(async (data: any) => {
                createdWith = data
                return { id: 'session-own-key' } as any
            })
        )
        const socket = getSharedSocket()
        Object.defineProperty(socket, 'connected', { get: () => true, configurable: true })
        let emitted: any = null
        socket.emit = mock((event: string, data: any) => {
            if (event === 'send_prompt') emitted = data
        }) as any

        void generationAPI.generateProjectStream({
            prompt: 'build a todo app',
            model: 'llama-3.3-70b-versatile',
            provider: 'groq',
            billingSource: 'OWN_KEY',
            onEvent: () => {},
        })

        await waitFor(() => expect(emitted).not.toBeNull())
        expect(createdWith).toMatchObject({
            billingSource: 'OWN_KEY',
            provider: 'groq',
            model: 'llama-3.3-70b-versatile',
        })
        expect(emitted).toMatchObject({
            sessionId: 'session-own-key',
            model: 'llama-3.3-70b-versatile',
            provider: 'groq',
            billingSource: 'OWN_KEY',
        })
    })

    it('uses the picked model when a caller sends none (in-session prompt box)', async () => {
        useModelSelection
            .getState()
            .select({ model: 'qwen-qwq-32b', provider: 'groq', source: 'OWN_KEY' })
        const socket = getSharedSocket()
        Object.defineProperty(socket, 'connected', { get: () => true, configurable: true })
        let emitted: any = null
        socket.emit = mock((event: string, data: any) => {
            if (event === 'send_prompt') emitted = data
        }) as any

        void generationAPI.applyProjectEdit({
            sessionId: 'existing-session',
            prompt: 'add dark mode',
            onEvent: () => {},
        })

        await waitFor(() => expect(emitted).not.toBeNull())
        expect(emitted).toMatchObject({
            model: 'qwen-qwq-32b',
            provider: 'groq',
            billingSource: 'OWN_KEY',
        })
    })
})

describe('API keys settings page', () => {
    it('shows saved keys by hint only', async () => {
        spies.push(
            spyOn(byokAPI, 'list').mockImplementation(async () => ({
                providers: PROVIDERS,
                credentials: [GROQ],
            }))
        )
        renderWithClient(<ProfileModelKeysSettings />)
        const row = await screen.findByTestId('byok-row-groq')
        expect(row.textContent).toContain('Groq')
        expect(row.textContent).toContain('••••abcd')
        expect(row.textContent).toContain('2 models')
    })

    it('checks and saves a new key, and shows the provider error when it fails', async () => {
        spies.push(
            spyOn(byokAPI, 'list').mockImplementation(async () => ({
                providers: PROVIDERS,
                credentials: [],
            }))
        )
        const saveSpy = spyOn(byokAPI, 'save').mockImplementation(async () => {
            throw new Error('Groq rejected this key. Check that you copied the whole key.')
        })
        spies.push(saveSpy)

        renderWithClient(<ProfileModelKeysSettings />)
        fireEvent.click(await screen.findByRole('button', { name: /Add key/i }))
        fireEvent.click(await screen.findByRole('button', { name: /^Groq$/ }))

        expect(screen.getByRole('link', { name: /Get a Groq key/i })).toBeDefined()
        const keyInput = screen.getByLabelText('API key') as HTMLInputElement
        typeInto(keyInput, 'gsk_bad_key')
        // the page and the dialog both have an "Add key" button, so take the dialog's submit
        const saveButton = keyInput
            .closest('form')!
            .querySelector('button[type="submit"]') as HTMLButtonElement
        await waitFor(() => expect(saveButton.disabled).toBe(false))
        // happy-dom does not submit a form on a button click
        fireEvent.submit(keyInput.closest('form')!)

        expect(await screen.findByRole('alert')).toBeDefined()
        expect(screen.getByRole('alert').textContent).toContain('Groq rejected this key')
        expect(saveSpy).toHaveBeenCalledWith('groq', 'gsk_bad_key')
    })

    it('shows the model source, on December credits by default', async () => {
        spies.push(
            spyOn(byokAPI, 'list').mockImplementation(async () => ({
                providers: PROVIDERS,
                credentials: [],
            }))
        )
        renderWithClient(<ProfileModelKeysSettings />)

        expect(await screen.findByText('Model source')).toBeDefined()
        const credits = await screen.findByRole('radio', { name: 'December credits' })
        await waitFor(() => expect(credits.getAttribute('aria-checked')).toBe('true'))
        // no key saved: "Your keys" cannot be picked
        const yourKeys = screen.getByRole('radio', { name: 'Your keys' }) as HTMLButtonElement
        expect(yourKeys.getAttribute('aria-checked')).toBe('false')
        expect(yourKeys.disabled).toBe(true)
    })

    it('switches the model source to your keys when a key is saved, and back', async () => {
        let source: 'CREDITS' | 'OWN_KEY' = 'CREDITS'
        spies.pop()!.mockRestore()
        spies.push(
            spyOn(profileAPI, 'getProfile').mockImplementation(
                async () => ({ id: 'u1', defaultModelSource: source }) as any
            ),
            spyOn(byokAPI, 'list').mockImplementation(async () => ({
                providers: PROVIDERS,
                credentials: [GROQ],
            }))
        )
        const updateSpy = spyOn(profileAPI, 'updateModelSource').mockImplementation(
            async (next) => {
                source = next
                return { defaultModelSource: next }
            }
        )
        spies.push(updateSpy)
        renderWithClient(<ProfileModelKeysSettings />)

        const yourKeys = (await screen.findByRole('radio', {
            name: 'Your keys',
        })) as HTMLButtonElement
        await waitFor(() => expect(yourKeys.disabled).toBe(false))
        fireEvent.click(yourKeys)
        await waitFor(() => expect(updateSpy).toHaveBeenCalledWith('OWN_KEY'))
        await waitFor(() =>
            expect(
                screen.getByRole('radio', { name: 'Your keys' }).getAttribute('aria-checked')
            ).toBe('true')
        )

        fireEvent.click(screen.getByRole('radio', { name: 'December credits' }))
        await waitFor(() => expect(updateSpy).toHaveBeenCalledWith('CREDITS'))
        await waitFor(() =>
            expect(
                screen.getByRole('radio', { name: 'December credits' }).getAttribute('aria-checked')
            ).toBe('true')
        )
    })

    it('shows the error of a model source change under the row', async () => {
        spies.push(
            spyOn(byokAPI, 'list').mockImplementation(async () => ({
                providers: PROVIDERS,
                credentials: [GROQ],
            })),
            spyOn(profileAPI, 'updateModelSource').mockImplementation(async () => {
                throw new Error('add an API key before you switch to your keys')
            })
        )
        renderWithClient(<ProfileModelKeysSettings />)

        const yourKeys = (await screen.findByRole('radio', {
            name: 'Your keys',
        })) as HTMLButtonElement
        await waitFor(() => expect(yourKeys.disabled).toBe(false))
        fireEvent.click(yourKeys)
        expect(
            await screen.findByText('add an API key before you switch to your keys')
        ).toBeDefined()
        expect(
            screen.getByRole('radio', { name: 'December credits' }).getAttribute('aria-checked')
        ).toBe('true')
    })

    it('explains the watsonx key format', async () => {
        spies.push(
            spyOn(byokAPI, 'list').mockImplementation(async () => ({
                providers: PROVIDERS,
                credentials: [],
            }))
        )
        renderWithClient(<ProfileModelKeysSettings />)
        fireEvent.click(await screen.findByRole('button', { name: /Add key/i }))
        fireEvent.click(await screen.findByRole('button', { name: /watsonx.ai/ }))
        expect(screen.getAllByText('Enter it as API_KEY:PROJECT_ID').length).toBeGreaterThan(0)
    })
})

describe('own-key errors in the chat', () => {
    it('keeps the provider message and offers to switch to december credits', () => {
        const messageId = 'assistant-own-key-error'
        useAppStore.setState({
            messages: [{ id: messageId, role: 'assistant', content: '', blocks: [] }] as any,
        } as any)

        useAppStore
            .getState()
            .setAssistantError(messageId, 'Groq says this account has no credits.', {
                ownKey: true,
            })
        const ownKey = useAppStore.getState().messages.find((m: any) => m.id === messageId) as any
        expect(ownKey.blocks.at(-1)).toEqual({
            type: 'error',
            error: 'Groq says this account has no credits.',
            action: 'switch_to_credits',
        })

        useAppStore.getState().setAssistantError(messageId, 'Insufficient wallet credits')
        const credits = useAppStore.getState().messages.find((m: any) => m.id === messageId) as any
        expect(credits.blocks.at(-1).action).toBeUndefined()
        expect(credits.blocks.at(-1).error).toContain('Settings > Billing')
    })
})

describe('own-key failures over the socket', () => {
    // captures the agent_event handler a run registers, so a test can play server events
    const connectedSocketWithHandler = () => {
        const socket = getSharedSocket()
        Object.defineProperty(socket, 'connected', { get: () => true, configurable: true })
        socket.emit = mock(() => {}) as any
        const handlers: Record<string, (payload: any) => void> = {}
        const originalOn = socket.on.bind(socket)
        socket.on = ((event: string, handler: any) => {
            handlers[event] = handler
            return originalOn(event, handler)
        }) as any
        return { socket, handlers, restore: () => (socket.on = originalOn as any) }
    }

    it('rejects with an own-key error the chat does not show twice', async () => {
        const { handlers, restore } = connectedSocketWithHandler()
        try {
            const run = generationAPI.applyProjectEdit({
                sessionId: 'session-key-failed',
                prompt: 'add dark mode',
                model: 'gpt-5',
                provider: 'openai',
                billingSource: 'OWN_KEY',
                onEvent: () => {},
            })
            await waitFor(() => expect(handlers.agent_event).toBeDefined())
            handlers.agent_event!({
                type: 'AgentError',
                code: 'BYOK_KEY_FAILED',
                keyFailure: 'no_credits',
                error: 'OpenAI says this account has no credits.',
            })
            const error = await run.catch((e) => e)
            expect(isOwnKeyError(error)).toBe(true)
            expect(error.code).toBe('BYOK_KEY_FAILED')
        } finally {
            restore()
        }
    })

    it('shows a rejected new own-key session as an own-key error, once', async () => {
        const { ApiError } = await import('../src/shared/api/client')
        spies.push(
            spyOn(sessionAPI, 'createSession').mockImplementation(async () => {
                throw new ApiError('add your OpenAI key in settings first', 400)
            })
        )
        const events: any[] = []
        const error = await generationAPI
            .generateProjectStream({
                prompt: 'build a todo app',
                model: 'gpt-5',
                provider: 'openai',
                billingSource: 'OWN_KEY',
                onEvent: (event: any) => events.push(event),
            })
            .catch((e) => e)

        // the chat gets the error event with a BYOK_ code, so it offers "switch to december
        // credits", and the rejection is an own-key error, so the chat does not show it twice
        expect(events).toEqual([
            {
                type: 'AgentError',
                data: { error: 'add your OpenAI key in settings first', code: 'BYOK_KEY_MISSING' },
            },
        ])
        expect(isOwnKeyError(error)).toBe(true)
    })

    it('rejects other agent errors as before', async () => {
        const { handlers, restore } = connectedSocketWithHandler()
        try {
            const run = generationAPI.applyProjectEdit({
                sessionId: 'session-other-error',
                prompt: 'add dark mode',
                onEvent: () => {},
            })
            await waitFor(() => expect(handlers.agent_event).toBeDefined())
            handlers.agent_event!({ type: 'AgentError', error: 'Insufficient wallet credits' })
            const error = await run.catch((e) => e)
            expect(isOwnKeyError(error)).toBe(false)
            expect(error.message).toBe('Insufficient wallet credits')
        } finally {
            restore()
        }
    })
})
