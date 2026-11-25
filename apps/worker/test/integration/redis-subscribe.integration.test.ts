import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import Redis from 'ioredis'

import { subscribeWhenReady } from '../../src/redis-subscriber'
import { RemotePlatformAdapter } from '../../src/remote-operations'

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379'
const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

// the worker's redis clients are lazy and have no offline queue (see getRedisPub in
// e2b-sandbox.service.ts): a command sent before "ready" is refused
const workerStyleClient = () => {
    const client = new Redis(REDIS_URL, {
        lazyConnect: true,
        maxRetriesPerRequest: 1,
        enableOfflineQueue: false,
    })
    client.on('error', () => {
        // Intentionally swallowed: the test fails on its own assertions
    })
    return client
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

describe('worker redis subscriptions on the test redis', () => {
    let publisher: Redis
    let server: Redis

    beforeAll(async () => {
        publisher = workerStyleClient()
        await publisher.connect()
        // the server side: a plain client that sees the prompt and sends the answer
        server = new Redis(REDIS_URL)
    })

    afterAll(async () => {
        await publisher.quit()
        await server.quit()
    })

    it('the answer to an agent question reaches the agent', async () => {
        const sessionId = `ask-${stamp}`
        const adapter = new RemotePlatformAdapter('mock-vm', {
            sessionId,
            redisClient: publisher,
            // the fallback is the first option: a lost answer shows as 'Tailwind CSS'
            timeoutMs: 3000,
        })

        const answer = adapter.ui.askQuestion([
            { question: 'Which styling?', options: ['Tailwind CSS', 'CSS Modules'] },
        ])
        // a person answers later than this
        await wait(500)
        const pending = JSON.parse((await server.get(`session_pending_question:${sessionId}`))!)
        await server.publish(
            `session_question_answer:${sessionId}`,
            JSON.stringify({ questionId: pending.questionId, answer: 'CSS Modules' })
        )

        expect(await answer).toBe('CSS Modules')
    })

    it('subscribeWhenReady subscribes a client that was not connected yet', async () => {
        const channel = `subscribe-when-ready-${stamp}`
        const subscriber = workerStyleClient()
        const received: string[] = []
        subscriber.on('message', (_channel, message) => received.push(message))

        subscribeWhenReady({
            client: subscriber,
            subscribe: () => subscriber.subscribe(channel),
            label: 'test',
        })
        await wait(300)
        await server.publish(channel, 'hello')
        await wait(100)
        await subscriber.quit()

        expect(received).toEqual(['hello'])
    })
})
