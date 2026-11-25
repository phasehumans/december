import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test'
import React from 'react'

if (!globalThis.document) {
    GlobalRegistrator.register()
}

// load react-dom and the app only after the dom exists, or react skips its input events
const { render, screen, fireEvent, cleanup, waitFor, act } = await import('@testing-library/react')
const { MemoryRouter } = await import('react-router-dom')
const { useAppStore } = await import('../src/app/store')
const { ChatThread } = await import('../src/features/chat/components/ChatThread')
const { useChatController } = await import('../src/features/chat/hooks/useChatController')
const { decideRunEnd, decideSubmit, useMessageQueue } =
    await import('../src/features/chat/messageQueue')
const { setConnectionsDemo } = await import('../src/features/connections/lib/connectionsDemo')
const { getSharedSocket } = await import('../src/features/generation/api/generation')
const { profileAPI } = await import('../src/features/profile/api/profile')
const { AccountPreferencesSection } =
    await import('../src/features/profile/components/AccountPreferencesSection')
const { usePreferences } = await import('../src/features/profile/lib/preferences')
const { sessionAPI } = await import('../src/features/sessions/api/session')

const SESSION = 'session-1'

/** the open session: the chat with its prompt box, run by the chat controller of the app */
const Session: React.FC = () => {
    const abortRef = React.useRef<AbortController | null>(null)
    const assistantRef = React.useRef<string | null>(null)
    const originRef = React.useRef<any>('output')
    const autoFixRef = React.useRef<string | null>(null)
    const { handleOutputPromptSubmit } = useChatController(
        'output' as any,
        async () => {},
        abortRef,
        assistantRef,
        originRef,
        autoFixRef
    )
    const messages = useAppStore((state) => state.messages)
    const isGenerating = useAppStore((state) => state.isGenerating)
    const [prompt, setPrompt] = React.useState('')
    return (
        <ChatThread
            mode="mobile"
            messages={messages}
            onPromptSubmit={handleOutputPromptSubmit}
            onBack={() => {}}
            isGenerating={isGenerating}
            executionTime={0}
            editPrompt={prompt}
            setEditPrompt={setPrompt}
            handleApplyEdit={() => {}}
            isApplyingEdit={false}
            isCollapsed={false}
            isAuthenticated
            projectId={SESSION}
        />
    )
}

const renderSession = () => {
    // the cache answers the saved-keys and connections requests, so nothing goes to the network
    const client = new QueryClient({
        defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    })
    client.setQueryData(['byok'], { providers: [], credentials: [] })
    client.setQueryData(['connections', 'prompt-box'], { skills: [], plugins: [], mcps: [] })
    return render(
        <QueryClientProvider client={client}>
            <MemoryRouter>
                <Session />
            </MemoryRouter>
        </QueryClientProvider>
    )
}

const box = () => document.querySelector('textarea') as HTMLTextAreaElement
const sendButton = () => screen.getByRole('button', { name: 'Send' }) as HTMLButtonElement

/** writes a message in the prompt box and sends it */
const send = (value: string) => {
    const el = box()
    fireEvent.focusIn(el)
    fireEvent.change(el, { target: { value } })
    el.setSelectionRange(value.length, value.length)
    fireEvent.keyUp(el)
    fireEvent.click(sendButton())
}

/** the socket of the app: what the page sent, and events from the server */
const fakeServer = () => {
    const prompts: any[] = []
    const stops: any[] = []
    const socket = getSharedSocket()
    Object.defineProperty(socket, 'connected', { get: () => true, configurable: true })
    socket.emit = mock((event: string, data: any) => {
        if (event === 'send_prompt') prompts.push(data)
        if (event === 'stop_session') stops.push(data)
    }) as any
    const fire = (name: string, event: unknown) =>
        act(() => {
            for (const listener of [...socket.listeners(name)]) (listener as any)(event)
        })
    return {
        prompts,
        stops,
        agent: (event: Record<string, unknown>) => fire('agent_event', event),
        promptQueued: (event: Record<string, unknown>) => fire('prompt_queued', event),
        /** the run ends, and the worker is done with it: the session is free */
        runEnds: (end: Record<string, unknown> = { type: 'AgentEnd' }) => {
            fire('agent_event', end)
            fire('agent_event', { type: 'RunClosed', sessionId: SESSION, runFollows: false })
        },
    }
}

const queuedTexts = () =>
    [...document.querySelectorAll('[aria-label="Queued messages"] li')].map(
        (row) => row.firstElementChild?.textContent
    )
const userMessages = () =>
    useAppStore
        .getState()
        .messages.filter((message) => message.role === 'user')
        .map((message) => message.content)

describe('a new message while December works', () => {
    let server: ReturnType<typeof fakeServer>

    beforeEach(() => {
        cleanup()
        window.localStorage.clear()
        window.sessionStorage.clear()
        useMessageQueue.setState({ queued: [] })
        usePreferences.setState({ messageWhileWorking: 'queue' })
        useAppStore.setState({
            isAuthenticated: true,
            activeProjectId: SESSION,
            messages: [],
            isGenerating: false,
        } as any)
        server = fakeServer()
    })

    afterEach(() => {
        cleanup()
        const socket = getSharedSocket()
        socket.off('agent_event')
    })

    test('the decision: a run starts when nothing runs, else the preference decides', () => {
        expect(decideSubmit({ isWorking: false, mode: 'queue' })).toBe('run')
        expect(decideSubmit({ isWorking: false, mode: 'send' })).toBe('run')
        expect(decideSubmit({ isWorking: true, mode: 'queue' })).toBe('queue')
        expect(decideSubmit({ isWorking: true, mode: 'send' })).toBe('steer')
    })

    test('the end of a run: the queue waits after a stop, else the next message goes out', () => {
        expect(decideRunEnd({ stopped: true, unread: 1, queued: 2 })).toBe('wait')
        expect(decideRunEnd({ stopped: false, unread: 1, queued: 2 })).toBe('follow')
        expect(decideRunEnd({ stopped: false, unread: 0, queued: 2 })).toBe('send-next')
        expect(decideRunEnd({ stopped: false, unread: 0, queued: 0 })).toBe('wait')
    })

    test('queue: the queued messages of a tab come back after a reload', () => {
        const KEY = 'december.messageQueue'
        const queue = useMessageQueue.getState()
        queue.add({
            id: 'q1',
            sessionId: SESSION,
            text: 'then add tests',
            options: {
                billingSource: 'CREDITS',
                attachments: [{ id: 'att-1', name: 'notes.txt' }],
            },
        })
        queue.add({ id: 'q2', sessionId: 'session-2', text: 'for another session' })
        const saved = window.sessionStorage.getItem(KEY)
        expect(saved).not.toBeNull()

        // a reload: the store starts empty and reads what the tab kept
        useMessageQueue.setState({ queued: [] })
        window.sessionStorage.setItem(KEY, saved as string)
        useMessageQueue.getState().restore()

        expect(useMessageQueue.getState().queued).toEqual([
            {
                id: 'q1',
                sessionId: SESSION,
                text: 'then add tests',
                options: {
                    billingSource: 'CREDITS',
                    attachments: [{ id: 'att-1', name: 'notes.txt' }],
                },
            },
            { id: 'q2', sessionId: 'session-2', text: 'for another session' },
        ])

        // a message that went out is not kept
        useMessageQueue.getState().take(SESSION)
        expect(JSON.parse(window.sessionStorage.getItem(KEY) as string)).toHaveLength(1)
    })

    test('queue: kept text that is not a list of messages is left out', () => {
        const KEY = 'december.messageQueue'
        window.sessionStorage.setItem(KEY, '{"not":"a list"}')
        useMessageQueue.getState().restore()
        expect(useMessageQueue.getState().queued).toEqual([])

        window.sessionStorage.setItem(
            KEY,
            JSON.stringify([{ id: 'q1', sessionId: SESSION, text: 'ok' }, { id: 7 }, null])
        )
        useMessageQueue.getState().restore()
        expect(useMessageQueue.getState().queued).toEqual([
            { id: 'q1', sessionId: SESSION, text: 'ok' },
        ])
    })

    test('the prompt box takes a message during a run, and the stop button is there', async () => {
        renderSession()
        send('build the page')
        await waitFor(() => expect(server.prompts).toHaveLength(1))
        expect(useAppStore.getState().isGenerating).toBe(true)

        // one step of the run ended: December still works
        server.agent({ type: 'TurnStart' })
        server.agent({ type: 'TurnEnd' })
        expect(useAppStore.getState().isGenerating).toBe(true)

        fireEvent.change(box(), { target: { value: 'one more thing' } })
        expect(sendButton().disabled).toBe(false)

        fireEvent.click(screen.getByRole('button', { name: 'Stop' }))
        expect(server.stops).toEqual([{ sessionId: SESSION }])
    })

    test('queue: a message sent during a run waits, and goes out when the run ends', async () => {
        renderSession()
        send('build the page')
        await waitFor(() => expect(server.prompts).toHaveLength(1))

        send('then add a test')
        send('and update the docs')

        // nothing went to the server, and the session shows both, in order
        expect(server.prompts).toHaveLength(1)
        expect(queuedTexts()).toEqual(['then add a test', 'and update the docs'])
        expect(screen.getAllByText('Queued')).toHaveLength(2)
        expect(userMessages()).toEqual(['build the page'])

        // the run ended, but the worker still closes it (the pull request step): not yet
        server.agent({ type: 'AgentEnd' })
        await waitFor(() => expect(useAppStore.getState().isGenerating).toBe(false))
        expect(server.prompts).toHaveLength(1)

        server.agent({ type: 'RunClosed', sessionId: SESSION, runFollows: false })
        await waitFor(() => expect(server.prompts).toHaveLength(2))
        expect(server.prompts[1].prompt).toBe('then add a test')
        expect(server.prompts[1].sessionId).toBe(SESSION)
        expect(queuedTexts()).toEqual(['and update the docs'])
        expect(userMessages()).toEqual(['build the page', 'then add a test'])

        // the second one goes out when that run ends
        server.runEnds()
        await waitFor(() => expect(server.prompts).toHaveLength(3))
        expect(server.prompts[2].prompt).toBe('and update the docs')
        expect(queuedTexts()).toEqual([])

        // the last run ends with no error in the chat
        server.runEnds()
        await waitFor(() => expect(useAppStore.getState().isGenerating).toBe(false))
        await new Promise((resolve) => setTimeout(resolve, 20))
        expect(useAppStore.getState().messages.map((message) => message.status ?? null)).toEqual([
            null,
            'done',
            null,
            'done',
            null,
            'done',
        ])
    })

    test('queue: a removed message is never sent', async () => {
        renderSession()
        send('build the page')
        await waitFor(() => expect(server.prompts).toHaveLength(1))
        send('then add a test')
        send('and update the docs')

        fireEvent.click(screen.getByRole('button', { name: /Remove queued message: then add/ }))
        expect(queuedTexts()).toEqual(['and update the docs'])

        server.runEnds()
        await waitFor(() => expect(server.prompts).toHaveLength(2))
        expect(server.prompts[1].prompt).toBe('and update the docs')
    })

    test('queue: a run that ends with an error also sends the next message', async () => {
        renderSession()
        send('build the page')
        await waitFor(() => expect(server.prompts).toHaveLength(1))
        send('try again with bun')

        server.runEnds({ type: 'AgentError', error: 'the model failed' })
        await waitFor(() => expect(server.prompts).toHaveLength(2))
        expect(server.prompts[1].prompt).toBe('try again with bun')
    })

    test('queue: after a stop the message stays queued, and the user sends or removes it', async () => {
        renderSession()
        send('build the page')
        await waitFor(() => expect(server.prompts).toHaveLength(1))
        send('then add a test')
        send('and update the docs')

        server.agent({ type: 'AgentInterrupt' })
        server.runEnds({ type: 'AgentEnd', stopped: true, reason: 'user' })
        await waitFor(() => expect(useAppStore.getState().isGenerating).toBe(false))

        expect(server.prompts).toHaveLength(1)
        expect(queuedTexts()).toEqual(['then add a test', 'and update the docs'])

        // "Send" shows now that nothing runs
        fireEvent.click(screen.getAllByRole('button', { name: 'Send' })[1]!)
        await waitFor(() => expect(server.prompts).toHaveLength(2))
        expect(server.prompts[1].prompt).toBe('and update the docs')
        expect(queuedTexts()).toEqual(['then add a test'])
    })

    test('queue: a prompt the server gives back waits in the queue until the run ends', async () => {
        renderSession()
        // a run works in this session, started in another tab: this tab does not know
        send('build the page')
        await waitFor(() => expect(server.prompts).toHaveLength(1))
        const { clientMessageId } = server.prompts[0]
        expect(typeof clientMessageId).toBe('string')

        server.promptQueued({ sessionId: SESSION, prompt: 'build the page', clientMessageId })
        expect(queuedTexts()).toEqual(['build the page'])
        expect(userMessages()).toEqual([])

        server.runEnds()
        await waitFor(() => expect(server.prompts).toHaveLength(2))
        expect(server.prompts[1].prompt).toBe('build the page')
        expect(useAppStore.getState().messages.map((message) => message.role)).toEqual([
            'assistant',
            'user',
            'assistant',
        ])
    })

    test('send now: the message goes out at once and shows as a user message', async () => {
        usePreferences.setState({ messageWhileWorking: 'send' })
        renderSession()
        send('build the page')
        await waitFor(() => expect(server.prompts).toHaveLength(1))

        send('use bun, not npm')

        await waitFor(() => expect(server.prompts).toHaveLength(2))
        expect(server.prompts[1].prompt).toBe('use bun, not npm')
        expect(server.prompts[1].sessionId).toBe(SESSION)
        expect(queuedTexts()).toEqual([])
        expect(userMessages()).toEqual(['build the page', 'use bun, not npm'])
        // the run goes on
        expect(useAppStore.getState().isGenerating).toBe(true)
    })

    test('send now: what the agent does after it read the message shows below the message', async () => {
        usePreferences.setState({ messageWhileWorking: 'send' })
        renderSession()
        send('build the page')
        await waitFor(() => expect(server.prompts).toHaveLength(1))
        send('use bun, not npm')
        await waitFor(() => expect(server.prompts).toHaveLength(2))

        server.agent({
            type: 'SteeringDelivered',
            messages: [
                { prompt: 'use bun, not npm', clientMessageId: server.prompts[1].clientMessageId },
            ],
        })

        const roles = useAppStore.getState().messages.map((message) => message.role)
        expect(roles).toEqual(['user', 'assistant', 'user', 'assistant'])

        // the run ends: the message was read, so no other run is followed or started
        server.runEnds()
        await waitFor(() => expect(useAppStore.getState().isGenerating).toBe(false))
        expect(server.prompts).toHaveLength(2)
        expect(useAppStore.getState().messages).toHaveLength(4)
    })

    test('send now: a message the run did not read gets its own run, and the session follows it', async () => {
        usePreferences.setState({ messageWhileWorking: 'send' })
        renderSession()
        send('build the page')
        await waitFor(() => expect(server.prompts).toHaveLength(1))
        send('use bun, not npm')
        await waitFor(() => expect(server.prompts).toHaveLength(2))

        // the run ended before the agent read the message
        server.agent({ type: 'AgentEnd' })

        // the server starts the run: the web sends nothing again, and shows the answer
        await waitFor(() => expect(useAppStore.getState().isGenerating).toBe(true))
        server.agent({ type: 'RunClosed', sessionId: SESSION, runFollows: true })
        expect(server.prompts).toHaveLength(2)
        expect(useAppStore.getState().messages.map((message) => message.role)).toEqual([
            'user',
            'assistant',
            'user',
            'assistant',
        ])
    })
})

// #638: "Continue" on the spend limit question starts the run again on the server
describe('a run continued at a spend limit', () => {
    let server: ReturnType<typeof fakeServer>

    beforeEach(() => {
        cleanup()
        window.localStorage.clear()
        window.sessionStorage.clear()
        useMessageQueue.setState({ queued: [] })
        useAppStore.setState({
            isAuthenticated: true,
            activeProjectId: SESSION,
            messages: [{ id: 'm1', role: 'user', content: 'build the page' }],
            isGenerating: false,
        } as any)
        server = fakeServer()
        spyOn(sessionAPI, 'getPendingQuestion').mockImplementation(async () => ({
            source: 'spend-limit',
            questionId: 'limit-1',
            questions: [
                {
                    question: 'Reached $5. Continue?',
                    options: ['Continue', 'Stop here'],
                },
            ],
        }))
        spyOn(sessionAPI, 'submitQuestionAnswer').mockImplementation(async () => ({}) as never)
    })

    afterEach(() => {
        cleanup()
        mock.restore()
        getSharedSocket().off('agent_event')
    })

    test('the chat shows what the continued run does, as it does it', async () => {
        renderSession()
        fireEvent.click(await screen.findByText('Continue'))

        await waitFor(() => expect(useAppStore.getState().isGenerating).toBe(true))
        // the server started the run: no prompt goes out from this tab
        expect(server.prompts).toHaveLength(0)
        // the run has its own answer in the chat, under the messages that were there
        await waitFor(() =>
            expect(useAppStore.getState().messages.map((message) => message.role)).toEqual([
                'user',
                'assistant',
            ])
        )

        server.agent({ type: 'StreamChunk', data: { content: 'Working on the header.' } })
        await waitFor(() =>
            expect(useAppStore.getState().messages.at(-1)?.content).toContain(
                'Working on the header.'
            )
        )
        expect(useAppStore.getState().isGenerating).toBe(true)

        server.runEnds()
        await waitFor(() => expect(useAppStore.getState().isGenerating).toBe(false))
        expect(useAppStore.getState().messages.at(-1)?.status).toBe('done')
    })

    test('"Stop here" starts nothing', async () => {
        renderSession()
        fireEvent.click(await screen.findByText('Stop here'))

        await waitFor(() => expect(sessionAPI.submitQuestionAnswer).toHaveBeenCalledTimes(1))
        expect(useAppStore.getState().isGenerating).toBe(false)
        expect(useAppStore.getState().messages).toHaveLength(1)
    })
})

describe('settings: new messages while December works', () => {
    const realUpdatePreferences = profileAPI.updatePreferences
    const saved: Array<Record<string, unknown>> = []

    beforeEach(() => {
        cleanup()
        window.localStorage.clear()
        usePreferences.setState({ messageWhileWorking: 'queue' })
        // the preview flag is off
        setConnectionsDemo(null)
        saved.length = 0
        profileAPI.updatePreferences = async (values) => {
            saved.push(values)
            return { preferences: values }
        }
    })

    afterEach(() => {
        cleanup()
        profileAPI.updatePreferences = realUpdatePreferences
    })

    test('the row shows for every user, starts on Queue and saves Send now', () => {
        render(
            <QueryClientProvider client={new QueryClient()}>
                <AccountPreferencesSection />
            </QueryClientProvider>
        )

        expect(
            screen.getByRole('radiogroup', { name: 'New messages while December works' })
        ).toBeDefined()
        expect(screen.getByRole('radio', { name: 'Queue' }).getAttribute('aria-checked')).toBe(
            'true'
        )

        fireEvent.click(screen.getByRole('radio', { name: 'Send now' }))
        expect(usePreferences.getState().messageWhileWorking).toBe('send')
        expect(saved).toEqual([{ messageWhileWorking: 'send' }])
    })
})
