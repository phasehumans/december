import { afterEach, describe, expect, it } from 'bun:test'

import { publishWhenReady, subscribeWhenReady, waitUntilReady } from '../../src/redis-subscriber'
import { TerminalBridgeService } from '../../src/terminal-bridge.service'

/**
 * A subscriber that behaves like the worker's ioredis clients (lazy, no offline queue):
 * it starts in "wait", and it refuses a subscribe that is sent before "ready".
 */
const lazyClient = () => {
    const handlers = new Map<string, Array<(...args: any[]) => void>>()
    const subscribed: string[] = []
    const client = {
        status: 'wait',
        subscribed,
        on: (event: string, handler: (...args: any[]) => void) => {
            handlers.set(event, [...(handlers.get(event) ?? []), handler])
            return client
        },
        emit: (event: string, ...args: any[]) => {
            for (const handler of handlers.get(event) ?? []) handler(...args)
        },
        connect: async () => {
            client.status = 'connecting'
            await Promise.resolve()
            client.status = 'ready'
            client.emit('ready')
        },
        psubscribe: async (...patterns: string[]) => {
            if (client.status !== 'ready') {
                throw new Error("Stream isn't writeable and enableOfflineQueue options is false")
            }
            subscribed.push(...patterns)
        },
        punsubscribe: async () => {},
        quit: async () => {},
    }
    return client
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 5))

describe('subscribeWhenReady', () => {
    it('opens a client that is not connected and subscribes when it is ready', async () => {
        const client = lazyClient()

        subscribeWhenReady({
            client,
            subscribe: () => client.psubscribe('session_events:*'),
            label: 'test',
        })
        await settle()

        expect(client.subscribed).toEqual(['session_events:*'])
    })

    it('subscribes at once on a client that is ready', async () => {
        const client = lazyClient()
        client.status = 'ready'

        subscribeWhenReady({
            client,
            subscribe: () => client.psubscribe('session_events:*'),
            label: 'test',
        })
        await settle()

        expect(client.subscribed).toEqual(['session_events:*'])
    })

    it('waits for a client that is connecting, and does not connect it twice', async () => {
        const client = lazyClient()
        client.status = 'connecting'
        let connects = 0
        client.connect = async () => {
            connects++
        }

        subscribeWhenReady({
            client,
            subscribe: () => client.psubscribe('session_events:*'),
            label: 'test',
        })
        await settle()
        expect(client.subscribed).toEqual([])

        client.status = 'ready'
        client.emit('ready')
        await settle()

        expect(connects).toBe(0)
        expect(client.subscribed).toEqual(['session_events:*'])
    })

    it('subscribes again after a reconnect', async () => {
        const client = lazyClient()
        subscribeWhenReady({
            client,
            subscribe: () => client.psubscribe('session_events:*'),
            label: 'test',
        })
        await settle()

        client.emit('ready')
        await settle()

        expect(client.subscribed).toEqual(['session_events:*', 'session_events:*'])
    })

    it('logs a subscribe that fails', async () => {
        const client = lazyClient()
        client.status = 'ready'
        const logged: unknown[][] = []
        const savedError = console.error
        console.error = (...args: unknown[]) => {
            logged.push(args)
        }
        try {
            subscribeWhenReady({
                client,
                subscribe: async () => {
                    throw new Error('NOPERM')
                },
                label: 'WORKER LISTENER',
            })
            await settle()
        } finally {
            console.error = savedError
        }

        expect(logged).toEqual([['[WORKER LISTENER] redis subscribe failed:', 'NOPERM']])
    })
})

describe('TerminalBridgeService.start', () => {
    afterEach(() => {
        TerminalBridgeService.resetForTesting()
    })

    it('subscribes to the terminal channels on a subscriber that was not connected yet', async () => {
        const client = lazyClient()
        TerminalBridgeService.setMockRedisSubscriber(client)

        await TerminalBridgeService.start()
        await settle()

        expect(client.subscribed).toEqual([
            'session_terminal_input:*',
            'session_terminal_resize:*',
            'session_terminal_attach:*',
            'session_terminal_detach:*',
        ])
    })
})

// one way to wait for a worker redis client, for every publish of a run event
describe('a publish on a lazy redis client', () => {
    /** a publisher like the worker's: lazy, no offline queue, a publish before "ready" fails */
    const publisher = (status: string, options: { connects?: boolean } = {}) => {
        const handlers = new Map<string, Set<(...args: any[]) => void>>()
        const sent: Array<{ channel: string; message: string }> = []
        const client = {
            status,
            sent,
            once: (event: string, handler: (...args: any[]) => void) => {
                handlers.set(event, (handlers.get(event) ?? new Set()).add(handler))
                return client
            },
            off: (event: string, handler: (...args: any[]) => void) => {
                handlers.get(event)?.delete(handler)
                return client
            },
            emit: (event: string) => {
                for (const handler of [...(handlers.get(event) ?? [])]) handler()
            },
            listeners: () => [...handlers.values()].reduce((sum, set) => sum + set.size, 0),
            connect: async () => {
                client.status = 'connecting'
                if (options.connects === false) return
                await Promise.resolve()
                client.status = 'ready'
                client.emit('ready')
            },
            publish: async (channel: string, message: string) => {
                if (client.status !== 'ready') {
                    throw new Error(
                        "Stream isn't writeable and enableOfflineQueue options is false"
                    )
                }
                sent.push({ channel, message })
                return 1
            },
        }
        return client
    }

    it('a ready client publishes at once', async () => {
        const client = publisher('ready')

        expect(await waitUntilReady(client)).toBe(true)
        expect(
            await publishWhenReady({ client, channel: 'session_events:s1', message: '{"a":1}' })
        ).toBe(true)
        expect(client.sent).toEqual([{ channel: 'session_events:s1', message: '{"a":1}' }])
    })

    it('an event sent while the connection opens is not dropped', async () => {
        const client = publisher('connecting')
        const published = publishWhenReady({
            client,
            channel: 'session_events:s1',
            message: '{"type":"SpendLimitReached"}',
        })

        client.status = 'ready'
        client.emit('ready')

        expect(await published).toBe(true)
        expect(client.sent).toEqual([
            { channel: 'session_events:s1', message: '{"type":"SpendLimitReached"}' },
        ])
        expect(client.listeners()).toBe(0)
    })

    it('opens a connection that nothing opened yet', async () => {
        const client = publisher('wait')

        expect(
            await publishWhenReady({ client, channel: 'session_events:s1', message: '{}' })
        ).toBe(true)
        expect(client.sent).toHaveLength(1)
    })

    it('gives up after the time limit when redis is offline, and says so', async () => {
        const client = publisher('wait', { connects: false })

        expect(
            await publishWhenReady({
                client,
                channel: 'session_events:s1',
                message: '{}',
                timeoutMs: 20,
            })
        ).toBe(false)
        expect(client.sent).toEqual([])
        expect(client.listeners()).toBe(0)
    })

    it('does not wait for a connection that is closed', async () => {
        const client = publisher('end')
        const started = Date.now()

        expect(await waitUntilReady(client, 500)).toBe(false)
        expect(Date.now() - started).toBeLessThan(200)
    })
})
