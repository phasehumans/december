import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test'
import React from 'react'

if (!globalThis.document) {
    GlobalRegistrator.register()
}

// load react-dom and the app only after the dom exists, or react skips its input events
const { render, screen, fireEvent, cleanup, waitFor } = await import('@testing-library/react')
const { MemoryRouter } = await import('react-router-dom')
const { ChatMessage } = await import('../src/features/chat/components/ChatMessage')
const { ChatPromptInput } = await import('../src/features/chat/components/ChatPromptInput')
const { mapBackendMessageToUIMessage } = await import('../src/features/chat/utils')
const { generationAPI, getSharedSocket } = await import('../src/features/generation/api/generation')
const { PromptInput } = await import('../src/features/home/components/PromptInput')
const { useModelSelection } = await import('../src/features/home/model-selection')
const { sessionAPI } = await import('../src/features/sessions/api/session')

const wrap = (ui: React.ReactNode) => {
    // the cache answers the saved-keys and connections requests, so nothing goes to the network
    const client = new QueryClient({
        defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    })
    client.setQueryData(['byok'], { providers: [], credentials: [] })
    client.setQueryData(['connections', 'prompt-box'], { skills: [], plugins: [], mcps: [] })
    return render(
        <QueryClientProvider client={client}>
            <MemoryRouter>{ui}</MemoryRouter>
        </QueryClientProvider>
    )
}

/** a Home box that starts a session with its prompt, the way the app does */
const HomeSender: React.FC = () => {
    const [value, setValue] = React.useState('')
    return (
        <PromptInput
            value={value}
            onChange={setValue}
            isLoading={false}
            isAuthenticated
            mode="agent"
            onSubmit={(prompt, options) =>
                void generationAPI
                    .generateProjectStream({ prompt, ...options, onEvent: () => {} })
                    .catch(() => {
                        // the stream never ends in these tests: they read what was sent
                    })
            }
        />
    )
}

/** a session box that sends its prompt to the open session, the way the app does */
const SessionSender: React.FC<{ sessionId: string }> = ({ sessionId }) => {
    const [value, setValue] = React.useState('')
    return (
        <ChatPromptInput
            value={value}
            onChange={setValue}
            isAuthenticated
            sessionId={sessionId}
            onSubmit={(options?: any) => {
                void generationAPI
                    .applyProjectEdit({
                        sessionId,
                        prompt: value,
                        billingSource: options?.billingSource,
                        runConfig: options?.runConfig,
                        attachments: options?.attachments,
                        onEvent: () => {},
                    })
                    .catch(() => {
                        // the stream never ends in these tests: they read what was sent
                    })
                setValue('')
            }}
        />
    )
}

const box = () => document.querySelector('textarea') as HTMLTextAreaElement
const picker = () => document.querySelector('input[type="file"]') as HTMLInputElement

const type = (value: string) => {
    const el = box()
    fireEvent.focusIn(el)
    fireEvent.change(el, { target: { value } })
    el.setSelectionRange(value.length, value.length)
    fireEvent.keyUp(el)
}

const textFile = (name: string, size = 5) => new File(['a'.repeat(size)], name)
const pick = (...files: File[]) => fireEvent.change(picker(), { target: { files } })

/**
 * what the page sent: the order of the calls, the uploads, the removed files and each
 * send_prompt. `refuse` names the files the server refuses, with its answer
 */
const captureRequests = (refuse: Record<string, { status: number; message: string }> = {}) => {
    const order: string[] = []
    const removed: string[] = []
    const uploads: Array<{ url: string; method?: string; type?: string; body: unknown }> = []
    const prompts: any[] = []

    const socket = getSharedSocket()
    Object.defineProperty(socket, 'connected', { get: () => true, configurable: true })
    socket.emit = mock((event: string, data: any) => {
        if (event !== 'send_prompt') return
        order.push('prompt')
        prompts.push(data)
    }) as any

    spyOn(globalThis, 'fetch').mockImplementation((async (input: any, init?: RequestInit) => {
        const url = String(input)
        if (!url.includes('/attachments')) throw new Error(`unexpected request: ${url}`)
        if (init?.method === 'DELETE') {
            order.push('remove')
            removed.push(new URL(url, 'http://localhost').pathname)
            return new Response(JSON.stringify({ success: true, data: null }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            })
        }
        const refusal = refuse[new URL(url, 'http://localhost').searchParams.get('name') ?? '']
        if (refusal) {
            order.push('refused')
            return new Response(JSON.stringify({ success: false, message: refusal.message }), {
                status: refusal.status,
                headers: { 'Content-Type': 'application/json' },
            })
        }
        order.push('upload')
        uploads.push({
            url,
            method: init?.method,
            type: (init?.headers as Record<string, string>)?.['Content-Type'],
            body: init?.body,
        })
        const name = new URL(url, 'http://localhost').searchParams.get('name')
        return new Response(
            JSON.stringify({
                success: true,
                data: {
                    attachment: {
                        id: `att-${uploads.length}`,
                        name,
                        contentType: 'text/plain',
                        sizeBytes: 5,
                    },
                },
            }),
            { status: 201, headers: { 'Content-Type': 'application/json' } }
        )
    }) as any)

    return { order, uploads, prompts, removed, refuse }
}

beforeEach(() => {
    cleanup()
    useModelSelection.getState().reset()
})

afterEach(() => {
    cleanup()
    mock.restore()
})

// #634: files sent with a prompt
describe('prompt box attachments', () => {
    test('a picked file shows as a chip, and its button removes it', () => {
        wrap(<HomeSender />)

        pick(textFile('notes.txt'), textFile('main.ts'))
        expect(screen.getByText('notes.txt')).toBeTruthy()
        expect(screen.getByText('main.ts')).toBeTruthy()

        fireEvent.click(screen.getByRole('button', { name: 'Remove notes.txt' }))
        expect(screen.queryByText('notes.txt')).toBeNull()
        expect(screen.getByText('main.ts')).toBeTruthy()
    })

    test('the picker offers images and text files', () => {
        wrap(<HomeSender />)
        const accept = picker().accept.split(',')
        expect(accept).toContain('.png')
        expect(accept).toContain('.md')
        expect(accept).not.toContain('.pdf')
    })

    test('a file over 5 MB shows an error and no chip', () => {
        wrap(<HomeSender />)

        pick(textFile('big.log', 5 * 1024 * 1024 + 1))

        expect(screen.getByRole('status').textContent).toBe('big.log is over 5 MB.')
        expect(screen.queryByRole('button', { name: 'Remove big.log' })).toBeNull()
    })

    test('a type that is not allowed shows an error and no chip', () => {
        wrap(<SessionSender sessionId="s1" />)

        pick(textFile('report.pdf'))

        expect(screen.getByRole('status').textContent).toBe(
            'report.pdf cannot be attached. Use images or text files.'
        )
        expect(screen.queryByRole('button', { name: 'Remove report.pdf' })).toBeNull()
    })

    test('the sixth file is refused', () => {
        wrap(<HomeSender />)

        pick(...['a', 'b', 'c', 'd', 'e', 'f'].map((name) => textFile(`${name}.txt`)))

        expect(screen.getByRole('status').textContent).toBe('Up to 5 files for each prompt.')
        expect(screen.getByText('e.txt')).toBeTruthy()
        expect(screen.queryByText('f.txt')).toBeNull()
    })

    for (const [name, Sender] of [
        ['home box', () => <HomeSender />],
        ['session box', () => <SessionSender sessionId="s1" />],
    ] as const) {
        test(`${name}: a pasted file becomes a chip, with the checks of the picker`, () => {
            wrap(<Sender />)

            fireEvent.paste(box(), { clipboardData: { files: [textFile('notes.txt')] } })
            expect(screen.getByRole('button', { name: 'Remove notes.txt' })).toBeTruthy()

            fireEvent.paste(box(), { clipboardData: { files: [textFile('report.pdf')] } })
            expect(screen.getByRole('status').textContent).toBe(
                'report.pdf cannot be attached. Use images or text files.'
            )
            expect(screen.queryByRole('button', { name: 'Remove report.pdf' })).toBeNull()
        })

        test(`${name}: a dropped file becomes a chip, with the checks of the picker`, () => {
            wrap(<Sender />)
            const zone = document.querySelector('[data-prompt-box]') as HTMLElement

            fireEvent.drop(zone, {
                dataTransfer: { files: [textFile('notes.txt'), textFile('main.ts')] },
            })
            expect(screen.getByRole('button', { name: 'Remove notes.txt' })).toBeTruthy()
            expect(screen.getByRole('button', { name: 'Remove main.ts' })).toBeTruthy()

            fireEvent.drop(zone, {
                dataTransfer: { files: [textFile('big.log', 5 * 1024 * 1024 + 1)] },
            })
            expect(screen.getByRole('status').textContent).toBe('big.log is over 5 MB.')
        })
    }

    test('pasted text with no file is left to the text box', () => {
        wrap(<HomeSender />)
        const event = new Event('paste', { bubbles: true, cancelable: true })
        Object.defineProperty(event, 'clipboardData', { value: { files: [] } })

        box().dispatchEvent(event)

        expect(event.defaultPrevented).toBe(false)
        expect(document.querySelectorAll('[aria-label^="Remove "]')).toHaveLength(0)
    })

    test('a session prompt uploads the files, then sends the prompt with their ids', async () => {
        const { order, uploads, prompts } = captureRequests()
        wrap(<SessionSender sessionId="s1" />)
        const notes = textFile('notes.txt')
        const code = textFile('main.ts')

        pick(notes, code)
        type('read these')
        fireEvent.keyDown(box(), { key: 'Enter' })

        await waitFor(() => expect(prompts).toHaveLength(1))
        expect(order).toEqual(['upload', 'upload', 'prompt'])
        expect(uploads[0].url).toContain('/session/s1/attachments?name=notes.txt')
        expect(uploads[0].method).toBe('POST')
        expect(uploads[0].type).toBe('application/octet-stream')
        expect(uploads[0].body).toBe(notes)
        expect(uploads[1].body).toBe(code)
        expect(prompts[0].sessionId).toBe('s1')
        expect(prompts[0].prompt).toBe('read these')
        expect(prompts[0].attachments).toEqual(['att-1', 'att-2'])
        // the chips go with the prompt
        expect(screen.queryByText('notes.txt')).toBeNull()
    })

    test('a new session is made first, then the upload, then the prompt', async () => {
        const { order, uploads, prompts } = captureRequests()
        spyOn(sessionAPI, 'createSession').mockImplementation(async () => {
            order.push('session')
            return { id: 'new-1', title: 'New Session' } as never
        })
        wrap(<HomeSender />)

        pick(textFile('notes.txt'))
        type('start here')
        fireEvent.keyDown(box(), { key: 'Enter' })

        await waitFor(() => expect(prompts).toHaveLength(1))
        expect(order).toEqual(['session', 'upload', 'prompt'])
        expect(uploads[0].url).toContain('/session/new-1/attachments?name=notes.txt')
        expect(prompts[0].sessionId).toBe('new-1')
        expect(prompts[0].attachments).toEqual(['att-1'])
    })

    test('a prompt with no files sends no attachments field', async () => {
        const { uploads, prompts } = captureRequests()
        wrap(<SessionSender sessionId="s1" />)

        type('plain')
        fireEvent.keyDown(box(), { key: 'Enter' })

        await waitFor(() => expect(prompts).toHaveLength(1))
        expect(uploads).toHaveLength(0)
        expect('attachments' in prompts[0]).toBe(false)
    })
})

// review A3: the server reads the bytes and can refuse a file the browser let through
describe('a file the server refuses', () => {
    const NOT_ALLOWED = {
        status: 415,
        message: 'this file type is not allowed. send an image or a text file',
    }

    test('a session prompt keeps its text and chips, shows the reason, and sends nothing', async () => {
        const { order, prompts, removed } = captureRequests({ 'fake.png': NOT_ALLOWED })
        wrap(<SessionSender sessionId="s1" />)

        pick(textFile('notes.txt'), textFile('fake.png'), textFile('main.ts'))
        type('read these')
        fireEvent.keyDown(box(), { key: 'Enter' })

        await waitFor(() =>
            expect(screen.getByRole('status').textContent).toBe(
                'fake.png: this file type is not allowed. send an image or a text file'
            )
        )
        // the file stored before the refusal gives its room back
        await waitFor(() => expect(removed).toHaveLength(1))
        expect(removed[0].endsWith('/api/v1/session/s1/attachments/att-1')).toBe(true)
        expect(order).toEqual(['upload', 'refused', 'remove'])
        expect(prompts).toHaveLength(0)
        expect(box().value).toBe('read these')
        expect(screen.getByText('notes.txt')).toBeTruthy()
        expect(screen.getByText('main.ts')).toBeTruthy()
        expect(
            screen.getByText('fake.png').closest('[data-refused]')?.getAttribute('data-refused')
        ).toBe('true')
        expect(screen.getByText('notes.txt').closest('[data-refused]')).toBeNull()
    })

    test('with the refused file removed, the next send goes out with the other files', async () => {
        const { prompts, uploads } = captureRequests({ 'fake.png': NOT_ALLOWED })
        wrap(<SessionSender sessionId="s1" />)

        pick(textFile('notes.txt'), textFile('fake.png'))
        type('read these')
        fireEvent.keyDown(box(), { key: 'Enter' })
        await waitFor(() => expect(screen.getByRole('status')).toBeTruthy())

        fireEvent.click(screen.getByRole('button', { name: 'Remove fake.png' }))
        expect(screen.queryByRole('status')).toBeNull()
        fireEvent.keyDown(box(), { key: 'Enter' })

        await waitFor(() => expect(prompts).toHaveLength(1))
        expect(prompts[0].prompt).toBe('read these')
        // notes.txt went up again: the first copy was removed with the refused batch
        expect(uploads).toHaveLength(2)
        expect(prompts[0].attachments).toEqual(['att-2'])
        expect(box().value).toBe('')
        expect(screen.queryByText('notes.txt')).toBeNull()
    })

    test('a new session stays on the page with the box as it was, and the retry uses the same session', async () => {
        const { order, prompts, uploads, refuse } = captureRequests({
            'big.txt': { status: 413, message: 'the file is larger than 5 MB' },
        })
        const createSession = spyOn(sessionAPI, 'createSession').mockImplementation(async () => {
            order.push('session')
            return { id: 'new-1', title: 'New Session' } as never
        })
        const onSubmit = mock(() => {})
        const Home: React.FC = () => {
            const [value, setValue] = React.useState('')
            return (
                <PromptInput
                    value={value}
                    onChange={setValue}
                    isLoading={false}
                    isAuthenticated
                    mode="agent"
                    onSubmit={(prompt, options) => {
                        onSubmit()
                        void generationAPI
                            .generateProjectStream({ prompt, ...options, onEvent: () => {} })
                            .catch(() => {
                                // the stream never ends in this test: it reads what was sent
                            })
                    }}
                />
            )
        }
        wrap(<Home />)

        pick(textFile('big.txt'))
        type('start here')
        fireEvent.keyDown(box(), { key: 'Enter' })

        await waitFor(() =>
            expect(screen.getByRole('status').textContent).toBe(
                'big.txt: the file is larger than 5 MB'
            )
        )
        expect(order).toEqual(['session', 'refused'])
        // the page was not told to start: no navigation, no prompt
        expect(onSubmit).toHaveBeenCalledTimes(0)
        expect(prompts).toHaveLength(0)
        expect(box().value).toBe('start here')
        expect(screen.getByText('big.txt')).toBeTruthy()

        // the server takes the file this time
        delete refuse['big.txt']
        fireEvent.keyDown(box(), { key: 'Enter' })

        await waitFor(() => expect(prompts).toHaveLength(1))
        expect(createSession).toHaveBeenCalledTimes(1)
        expect(uploads[0].url).toContain('/session/new-1/attachments?name=big.txt')
        expect(prompts[0].sessionId).toBe('new-1')
        expect(prompts[0].prompt).toBe('start here')
        expect(prompts[0].attachments).toEqual(['att-1'])
        expect(box().value).toBe('')
    })

    test('a session that is not ready keeps the box and sends nothing', async () => {
        const { prompts, uploads } = captureRequests()
        const Sender: React.FC = () => {
            const [value, setValue] = React.useState('')
            return <ChatPromptInput value={value} onChange={setValue} isAuthenticated />
        }
        wrap(<Sender />)

        pick(textFile('notes.txt'))
        type('read this')
        fireEvent.keyDown(box(), { key: 'Enter' })

        await waitFor(() =>
            expect(screen.getByRole('status').textContent).toBe(
                'The session is not ready. Send again in a moment.'
            )
        )
        expect(uploads).toHaveLength(0)
        expect(prompts).toHaveLength(0)
        expect(box().value).toBe('read this')
        expect(screen.getByText('notes.txt')).toBeTruthy()
    })
})

describe('attachments on a chat message', () => {
    test('the user message shows the names of its files', () => {
        render(
            <ChatMessage
                role="user"
                content="read these"
                attachments={[{ name: 'notes.txt' }, { name: 'shot.png' }]}
                isGenerating={false}
                executionTime={0}
                index={0}
            />
        )
        expect(screen.getByText('read these')).toBeTruthy()
        expect(screen.getByText('notes.txt')).toBeTruthy()
        expect(screen.getByText('shot.png')).toBeTruthy()
    })

    test('a message read from the server keeps its files', () => {
        const message = mapBackendMessageToUIMessage({
            id: 'm1',
            role: 'USER',
            content: 'read these',
            sequence: 1,
            createdAt: '2026-11-25T00:00:00.000Z',
            updatedAt: '2026-11-25T00:00:00.000Z',
            attachments: [{ id: 'a1', name: 'notes.txt', contentType: 'text/plain', sizeBytes: 5 }],
        })
        expect(message.attachments).toEqual([{ id: 'a1', name: 'notes.txt' }])
    })
})
