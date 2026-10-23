import Redis from 'ioredis'

import { E2BSandboxService } from './e2b-sandbox.service'

import type {
    DestroyPtySessionInput,
    EnsurePtySessionInput,
    HandleTerminalAttachInput,
    HandleTerminalDetachInput,
    HandleTerminalInputInput,
    HandleTerminalResizeInput,
    OnSandboxReadyInput,
    TerminalPtySession,
} from './terminal-bridge.types'

const MAX_BUFFER_LENGTH = 100_000 // 100KB per-session scrollback ring buffer

const ptySessions = new Map<string, TerminalPtySession>()

let redisPub: Redis | null = null
let redisSub: Redis | null = null
let mockRedisPubOverride: any = null
let mockRedisSubOverride: any = null

const setMockRedisPublisher = (mock: any) => {
    mockRedisPubOverride = mock
}

const setMockRedisSubscriber = (mock: any) => {
    mockRedisSubOverride = mock
}

const getRedisPub = (): Redis => {
    if (mockRedisPubOverride) {
        return mockRedisPubOverride
    }
    if (!redisPub) {
        const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379'
        redisPub = new Redis(redisUrl, {
            lazyConnect: true,
            maxRetriesPerRequest: 1,
            enableOfflineQueue: false,
        })
        redisPub.on('error', () => {
            // Intentionally swallowed: Suppress unhandled redis pub connection noise in test environment
        })
    }
    return redisPub
}

const getRedisSub = (): Redis => {
    if (mockRedisSubOverride) {
        return mockRedisSubOverride
    }
    if (!redisSub) {
        const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379'
        redisSub = new Redis(redisUrl, {
            lazyConnect: true,
            maxRetriesPerRequest: 1,
            enableOfflineQueue: false,
        })
        redisSub.on('error', () => {
            // Intentionally swallowed: Suppress unhandled redis sub connection noise in test environment
        })
    }
    return redisSub
}

const broadcastTerminalData = async (sessionId: string, data: string): Promise<void> => {
    try {
        const pub = getRedisPub()
        if (pub && (mockRedisPubOverride || pub.status === 'ready')) {
            await pub.publish(`session_terminal_data:${sessionId}`, data)
        }
    } catch {
        // Intentionally swallowed: Redis broadcast fallback in test environment
    }
}

const handleOutputChunk = async (sessionId: string, chunk: Uint8Array | string): Promise<void> => {
    const text = typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf-8')
    const session = ptySessions.get(sessionId)
    if (session) {
        session.buffer += text
        if (session.buffer.length > MAX_BUFFER_LENGTH) {
            session.buffer = session.buffer.slice(session.buffer.length - MAX_BUFFER_LENGTH)
        }
    }
    await broadcastTerminalData(sessionId, text)
}

const sendInputToPty = async (
    sandbox: any,
    pid: number,
    handle: any,
    input: string
): Promise<void> => {
    const payload = Buffer.from(input)
    if (sandbox?.pty && typeof sandbox.pty.sendInput === 'function') {
        await sandbox.pty.sendInput(pid, payload).catch(() => {
            // Intentionally swallowed: PTY sendInput fallback
        })
    } else if (handle && typeof handle.sendStdin === 'function') {
        await handle.sendStdin(input).catch(() => {
            // Intentionally swallowed: Handle sendStdin fallback
        })
    }
}

const ensurePtySession = async (
    data: EnsurePtySessionInput
): Promise<TerminalPtySession | null> => {
    const { sessionId, cols, rows, sandbox: explicitSandbox } = data

    const existing = ptySessions.get(sessionId)
    if (existing && existing.pid > 0) {
        return existing
    }
    if (existing?.isSpawning) {
        return existing
    }

    const sandbox = explicitSandbox || E2BSandboxService.getActiveSandbox(sessionId)
    if (!sandbox) {
        if (!existing) {
            const pendingSession: TerminalPtySession = {
                sessionId,
                pid: 0,
                cols: cols || 80,
                rows: rows || 24,
                attachedCount: 0,
                buffer: '',
                isSpawning: false,
                inputQueue: [],
            }
            ptySessions.set(sessionId, pendingSession)
            return pendingSession
        }
        return existing
    }

    const session: TerminalPtySession = existing || {
        sessionId,
        pid: 0,
        cols: cols || 80,
        rows: rows || 24,
        attachedCount: 0,
        buffer: '',
        isSpawning: false,
        inputQueue: [],
    }

    session.isSpawning = true
    ptySessions.set(sessionId, session)

    const effectiveCols = cols || session.cols || 80
    const effectiveRows = rows || session.rows || 24

    try {
        let handle: any = null
        let pid = 0

        if (sandbox.pty && typeof sandbox.pty.create === 'function') {
            handle = await sandbox.pty.create({
                cols: effectiveCols,
                rows: effectiveRows,
                cwd: '/workspace',
                envs: {
                    TERM: 'xterm-256color',
                    COLORTERM: 'truecolor',
                },
                onData: (chunk: Uint8Array | string) => {
                    void handleOutputChunk(sessionId, chunk)
                },
            })
            pid = handle?.pid || 1
        }

        session.pid = pid
        session.handle = handle
        session.isSpawning = false
        session.cols = effectiveCols
        session.rows = effectiveRows

        // Flush any queued input that arrived while PTY was booting
        if (session.inputQueue.length > 0) {
            const queueToFlush = [...session.inputQueue]
            session.inputQueue = []
            for (const item of queueToFlush) {
                await sendInputToPty(sandbox, pid, handle, item)
            }
        }

        return session
    } catch (err) {
        session.isSpawning = false
        console.error(`[TerminalBridgeService] Failed to create PTY for session ${sessionId}:`, err)
        return session
    }
}

const handleTerminalInput = async (data: HandleTerminalInputInput): Promise<void> => {
    const { sessionId, data: inputData } = data
    if (!inputData) return

    let session = ptySessions.get(sessionId)
    if (!session || !session.pid || session.isSpawning) {
        if (!session) {
            session = {
                sessionId,
                pid: 0,
                cols: 80,
                rows: 24,
                attachedCount: 1,
                buffer: '',
                isSpawning: false,
                inputQueue: [],
            }
            ptySessions.set(sessionId, session)
        }
        session.inputQueue.push(inputData)
        void ensurePtySession({ sessionId })
        return
    }

    const sandbox = E2BSandboxService.getActiveSandbox(sessionId)
    if (sandbox) {
        await sendInputToPty(sandbox, session.pid, session.handle, inputData)
    } else {
        session.inputQueue.push(inputData)
    }
}

const handleTerminalResize = async (data: HandleTerminalResizeInput): Promise<void> => {
    const { sessionId, cols, rows } = data
    const session = ptySessions.get(sessionId)
    if (session) {
        session.cols = cols
        session.rows = rows
        if (session.pid > 0) {
            const sandbox = E2BSandboxService.getActiveSandbox(sessionId)
            if (sandbox?.pty && typeof sandbox.pty.resize === 'function') {
                await sandbox.pty.resize(session.pid, { cols, rows }).catch(() => {
                    // Intentionally swallowed: PTY resize failure fallback
                })
            } else if (session.handle && typeof session.handle.resize === 'function') {
                await session.handle.resize({ cols, rows }).catch(() => {
                    // Intentionally swallowed: Handle resize failure fallback
                })
            }
        }
    }
}

const handleTerminalAttach = async (data: HandleTerminalAttachInput): Promise<void> => {
    const { sessionId } = data
    let session = ptySessions.get(sessionId)
    if (!session || !session.pid) {
        session = (await ensurePtySession({ sessionId })) || session
    }

    if (session) {
        session.attachedCount += 1
        if (session.buffer && session.buffer.length > 0) {
            await broadcastTerminalData(sessionId, session.buffer)
        }
    }
}

const handleTerminalDetach = async (data: HandleTerminalDetachInput): Promise<void> => {
    const { sessionId } = data
    const session = ptySessions.get(sessionId)
    if (session) {
        session.attachedCount = Math.max(0, session.attachedCount - 1)
    }
}

const onSandboxReady = async (data: OnSandboxReadyInput): Promise<void> => {
    const { sessionId, sandbox } = data
    const existing = ptySessions.get(sessionId)
    if (
        existing &&
        (!existing.pid || existing.inputQueue.length > 0 || existing.attachedCount > 0)
    ) {
        await ensurePtySession({ sessionId, cols: existing.cols, rows: existing.rows, sandbox })
    }
}

const destroyPtySession = async (data: DestroyPtySessionInput): Promise<void> => {
    const { sessionId } = data
    const session = ptySessions.get(sessionId)
    if (session) {
        if (session.pid > 0) {
            const sandbox = E2BSandboxService.getActiveSandbox(sessionId)
            if (sandbox?.pty && typeof sandbox.pty.kill === 'function') {
                await sandbox.pty.kill(session.pid).catch(() => {
                    // Intentionally swallowed: PTY kill error fallback
                })
            } else if (session.handle && typeof session.handle.kill === 'function') {
                await session.handle.kill().catch(() => {
                    // Intentionally swallowed: Handle kill error fallback
                })
            }
        }
        ptySessions.delete(sessionId)
    }
}

const start = async (): Promise<void> => {
    const sub = getRedisSub()
    await sub
        .psubscribe(
            'session_terminal_input:*',
            'session_terminal_resize:*',
            'session_terminal_attach:*',
            'session_terminal_detach:*'
        )
        .catch(() => {
            // Intentionally swallowed: Offline Redis fallback during test runs
        })

    sub.on('pmessage', async (pattern, channel, message) => {
        try {
            if (pattern === 'session_terminal_input:*') {
                const sessionId = channel.replace('session_terminal_input:', '')
                await handleTerminalInput({ sessionId, data: message })
            } else if (pattern === 'session_terminal_resize:*') {
                const sessionId = channel.replace('session_terminal_resize:', '')
                const parsed = JSON.parse(message)
                await handleTerminalResize({
                    sessionId,
                    cols: parsed.cols,
                    rows: parsed.rows,
                })
            } else if (pattern === 'session_terminal_attach:*') {
                const sessionId = channel.replace('session_terminal_attach:', '')
                const parsed = JSON.parse(message || '{}')
                await handleTerminalAttach({ sessionId, userId: parsed.userId })
            } else if (pattern === 'session_terminal_detach:*') {
                const sessionId = channel.replace('session_terminal_detach:', '')
                const parsed = JSON.parse(message || '{}')
                await handleTerminalDetach({ sessionId, userId: parsed.userId })
            }
        } catch (err) {
            console.error(`[TerminalBridgeService] Error processing message on ${channel}:`, err)
        }
    })
}

const stop = async (): Promise<void> => {
    if (redisSub) {
        try {
            await redisSub.punsubscribe(
                'session_terminal_input:*',
                'session_terminal_resize:*',
                'session_terminal_attach:*',
                'session_terminal_detach:*'
            )
            await redisSub.quit()
        } catch {
            // Intentionally swallowed: Redis sub disconnect fallback
        }
        redisSub = null
    }

    if (redisPub) {
        try {
            await redisPub.quit()
        } catch {
            // Intentionally swallowed: Redis pub disconnect fallback
        }
        redisPub = null
    }

    for (const sessionId of Array.from(ptySessions.keys())) {
        await destroyPtySession({ sessionId })
    }
    ptySessions.clear()
}

const getPtySession = (sessionId: string): TerminalPtySession | undefined => {
    return ptySessions.get(sessionId)
}

const resetForTesting = (): void => {
    ptySessions.clear()
    mockRedisPubOverride = null
    mockRedisSubOverride = null
}

export const TerminalBridgeService = {
    start,
    stop,
    ensurePtySession,
    handleTerminalInput,
    handleTerminalResize,
    handleTerminalAttach,
    handleTerminalDetach,
    onSandboxReady,
    destroyPtySession,
    getPtySession,
    setMockRedisPublisher,
    setMockRedisSubscriber,
    resetForTesting,
}
