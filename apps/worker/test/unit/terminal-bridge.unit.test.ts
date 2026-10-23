import { describe, it, expect, beforeEach, mock } from 'bun:test'

import { E2BSandboxService } from '../../src/e2b-sandbox.service'
import { TerminalBridgeService } from '../../src/terminal-bridge.service'

describe('TerminalBridgeService (Worker Listener Bridge & PTY Management)', () => {
    let mockPtyHandle: any
    let mockSandbox: any
    let publishedEvents: Array<{ channel: string; message: string }>

    beforeEach(() => {
        publishedEvents = []
        E2BSandboxService.resetMockClient()
        TerminalBridgeService.resetForTesting()

        mockPtyHandle = {
            pid: 4321,
            kill: mock(async () => true),
        }

        mockSandbox = {
            sandboxId: 'sb-term-test',
            pty: {
                create: mock(async (opts: any) => {
                    if (opts?.onData) {
                        mockSandbox.pty._onData = opts.onData
                    }
                    return mockPtyHandle
                }),
                sendInput: mock(async (_pid: number, _data: Uint8Array) => {}),
                resize: mock(async (_pid: number, _size: { cols: number; rows: number }) => {}),
                kill: mock(async (_pid: number) => true),
                _onData: null as ((chunk: Uint8Array | string) => void) | null,
            },
        }

        // Mock redis pub client inside TerminalBridgeService
        TerminalBridgeService.setMockRedisPublisher({
            publish: async (channel: string, message: string) => {
                publishedEvents.push({ channel, message })
                return 1
            },
        })
    })

    it('should spawn interactive pty in sandbox when terminal attaches', async () => {
        E2BSandboxService.setMockClient({
            create: async () => mockSandbox,
        })
        await E2BSandboxService.provisionSandbox({ sessionId: 'term-sess-1' })

        await TerminalBridgeService.handleTerminalAttach({ sessionId: 'term-sess-1' })

        const ptySession = TerminalBridgeService.getPtySession('term-sess-1')
        expect(ptySession).toBeDefined()
        expect(ptySession?.pid).toBe(4321)
        expect(ptySession?.attachedCount).toBe(1)
        expect(mockSandbox.pty.create).toHaveBeenCalled()
    })

    it('should forward terminal input keystrokes to active sandbox pty process', async () => {
        E2BSandboxService.setMockClient({
            create: async () => mockSandbox,
        })
        await E2BSandboxService.provisionSandbox({ sessionId: 'term-sess-input' })
        await TerminalBridgeService.handleTerminalAttach({ sessionId: 'term-sess-input' })

        await TerminalBridgeService.handleTerminalInput({
            sessionId: 'term-sess-input',
            data: 'ls -la\r',
        })

        expect(mockSandbox.pty.sendInput).toHaveBeenCalled()
        const callArgs = (mockSandbox.pty.sendInput as any).mock.calls[0]
        expect(callArgs[0]).toBe(4321)
        expect(Buffer.from(callArgs[1]).toString('utf-8')).toBe('ls -la\r')
    })

    it('should buffer input if pty is not yet ready, and flush without losing keystrokes on boot', async () => {
        // Send input BEFORE sandbox is ready
        await TerminalBridgeService.handleTerminalInput({
            sessionId: 'term-sess-deferred',
            data: 'git status\n',
        })

        let ptySession = TerminalBridgeService.getPtySession('term-sess-deferred')
        expect(ptySession?.inputQueue).toEqual(['git status\n'])

        // Now sandbox becomes ready
        await TerminalBridgeService.onSandboxReady({
            sessionId: 'term-sess-deferred',
            sandbox: mockSandbox,
        })

        ptySession = TerminalBridgeService.getPtySession('term-sess-deferred')
        expect(ptySession?.pid).toBe(4321)
        expect(ptySession?.inputQueue.length).toBe(0)
        expect(mockSandbox.pty.sendInput).toHaveBeenCalled()
        const callArgs = (mockSandbox.pty.sendInput as any).mock.calls[0]
        expect(Buffer.from(callArgs[1]).toString('utf-8')).toBe('git status\n')
    })

    it('should forward terminal resize events to active sandbox pty', async () => {
        E2BSandboxService.setMockClient({
            create: async () => mockSandbox,
        })
        await E2BSandboxService.provisionSandbox({ sessionId: 'term-sess-resize' })
        await TerminalBridgeService.handleTerminalAttach({ sessionId: 'term-sess-resize' })

        await TerminalBridgeService.handleTerminalResize({
            sessionId: 'term-sess-resize',
            cols: 120,
            rows: 40,
        })

        expect(mockSandbox.pty.resize).toHaveBeenCalledWith(4321, { cols: 120, rows: 40 })
        const session = TerminalBridgeService.getPtySession('term-sess-resize')
        expect(session?.cols).toBe(120)
        expect(session?.rows).toBe(40)
    })

    it('should capture stdout/stderr in scrollback buffer and replay to client across reconnects', async () => {
        E2BSandboxService.setMockClient({
            create: async () => mockSandbox,
        })
        await E2BSandboxService.provisionSandbox({ sessionId: 'term-sess-reconnect' })
        await TerminalBridgeService.handleTerminalAttach({ sessionId: 'term-sess-reconnect' })

        // Simulate PTY output data chunk
        if (mockSandbox.pty._onData) {
            mockSandbox.pty._onData(Buffer.from('Welcome to December terminal\r\n$ '))
        }

        // Data was broadcast to redis
        expect(
            publishedEvents.some(
                (e) =>
                    e.channel === 'session_terminal_data:term-sess-reconnect' &&
                    e.message.includes('Welcome to December terminal')
            )
        ).toBe(true)

        // Detach client (tab reload or navigation)
        await TerminalBridgeService.handleTerminalDetach({ sessionId: 'term-sess-reconnect' })
        const detachedSession = TerminalBridgeService.getPtySession('term-sess-reconnect')
        expect(detachedSession?.attachedCount).toBe(0)
        expect(detachedSession?.buffer).toContain('Welcome to December terminal')

        // Reconnect client
        publishedEvents = []
        await TerminalBridgeService.handleTerminalAttach({ sessionId: 'term-sess-reconnect' })
        expect(
            publishedEvents.some(
                (e) =>
                    e.channel === 'session_terminal_data:term-sess-reconnect' &&
                    e.message.includes('Welcome to December terminal')
            )
        ).toBe(true)
    })

    it('should kill pty process and clear state when destroyPtySession is called', async () => {
        E2BSandboxService.setMockClient({
            create: async () => mockSandbox,
        })
        await E2BSandboxService.provisionSandbox({ sessionId: 'term-sess-destroy' })
        await TerminalBridgeService.handleTerminalAttach({ sessionId: 'term-sess-destroy' })

        await TerminalBridgeService.destroyPtySession({ sessionId: 'term-sess-destroy' })

        expect(mockSandbox.pty.kill).toHaveBeenCalledWith(4321)
        expect(TerminalBridgeService.getPtySession('term-sess-destroy')).toBeUndefined()
    })

    it('should consume redis subscriber messages and dispatch to bridge handlers', async () => {
        E2BSandboxService.setMockClient({
            create: async () => mockSandbox,
        })
        await E2BSandboxService.provisionSandbox({ sessionId: 'term-sess-redis' })

        let pmessageHandler: any = null
        const mockSub = {
            psubscribe: mock(async () => {}),
            punsubscribe: mock(async () => {}),
            quit: mock(async () => {}),
            on: (event: string, handler: any) => {
                if (event === 'pmessage') {
                    pmessageHandler = handler
                }
            },
        }

        TerminalBridgeService.setMockRedisSubscriber(mockSub)
        await TerminalBridgeService.start()

        expect(mockSub.psubscribe).toHaveBeenCalled()
        expect(pmessageHandler).not.toBeNull()

        // 1. Attach via redis
        await pmessageHandler(
            'session_terminal_attach:*',
            'session_terminal_attach:term-sess-redis',
            '{}'
        )
        const attachedSession = TerminalBridgeService.getPtySession('term-sess-redis')
        expect(attachedSession).toBeDefined()
        expect(attachedSession?.pid).toBe(4321)

        // 2. Input via redis
        await pmessageHandler(
            'session_terminal_input:*',
            'session_terminal_input:term-sess-redis',
            'pwd\r'
        )
        expect(mockSandbox.pty.sendInput).toHaveBeenCalled()

        // 3. Resize via redis
        await pmessageHandler(
            'session_terminal_resize:*',
            'session_terminal_resize:term-sess-redis',
            JSON.stringify({ cols: 100, rows: 35 })
        )
        expect(mockSandbox.pty.resize).toHaveBeenCalledWith(4321, { cols: 100, rows: 35 })

        // 4. Detach via redis
        await pmessageHandler(
            'session_terminal_detach:*',
            'session_terminal_detach:term-sess-redis',
            '{}'
        )
        expect(attachedSession?.attachedCount).toBe(0)

        await TerminalBridgeService.stop()
    })
})
