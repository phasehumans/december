import { prisma } from '@december/database'
import {
    claimRunMark,
    readStopRequest,
    requestRunStopKey,
    runMarkKey,
    steeringListKey,
    stopRequestKey,
} from '@december/shared'
import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import Redis from 'ioredis'

import { createRedisSteeringStore, joinRun, watchRunSteering } from '../../src/run-steering'
import { watchRunStop } from '../../src/run-stop'
import { clearStaleHeldRun } from '../../src/spend-limits'

import type { SteeringItem } from '../../src/run-steering'

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379'
const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

// the life of a run in the worker, on the test redis and the test database
describe('the life of a run: the worker', () => {
    let redis: Redis
    const sessions: string[] = []
    let count = 0
    const session = () => {
        const sessionId = `worker-run-life-${stamp}-${(count += 1)}`
        sessions.push(sessionId)
        return sessionId
    }
    const store = createRedisSteeringStore(() => redis as any)

    beforeAll(() => {
        redis = new Redis(REDIS_URL)
    })

    afterAll(async () => {
        for (const sessionId of sessions) {
            await redis.del(
                runMarkKey(sessionId),
                steeringListKey(sessionId),
                stopRequestKey(sessionId)
            )
        }
        await redis.quit()
    })

    it('two jobs for one session: the second one gives its prompt to the run that works', async () => {
        const sessionId = session()
        // the server claimed the session for run-a, and by a fault a second job was queued
        await claimRunMark(redis, { sessionId, runId: 'run-a' })
        const first = await joinRun({ store, sessionId, runId: 'run-a', item: { prompt: 'a' } })
        const second = await joinRun({
            store,
            sessionId,
            runId: 'job:77',
            item: { prompt: 'wake up', userMessageSequence: 9 },
        })

        expect(first).toBe('owner')
        expect(second).toBe('handed-off')
        expect(await redis.get(runMarkKey(sessionId))).toBe('run-a')

        // the run that works reads the prompt at its next turn
        const steering = watchRunSteering({
            sessionId,
            runId: 'run-a',
            store,
            startRun: async () => {},
            heartbeatMs: 0,
        })
        await steering.ready
        expect(await steering.take()).toEqual([{ prompt: 'wake up', userMessageSequence: 9 }])
        await steering.end({ discard: true })
        expect(await redis.exists(runMarkKey(sessionId))).toBe(0)
    })

    it('the run for messages nobody took owns the session when its job starts', async () => {
        const sessionId = session()
        await claimRunMark(redis, { sessionId, runId: 'run-a' })
        const queued: Array<{ items: SteeringItem[]; runId: string }> = []
        const steering = watchRunSteering({
            sessionId,
            runId: 'run-a',
            store,
            startRun: async (items, runId) => {
                queued.push({ items, runId })
            },
            heartbeatMs: 0,
        })
        await steering.ready
        await store.push({ sessionId, item: { prompt: 'one more thing' } })

        await steering.end({ discard: false })

        expect(queued).toHaveLength(1)
        expect(await redis.get(runMarkKey(sessionId))).toBe(queued[0]!.runId)
        expect(
            await joinRun({
                store,
                sessionId,
                runId: queued[0]!.runId,
                item: { prompt: 'one more thing' },
            })
        ).toBe('owner')
    })

    it('a stop while the job waits in the queue: the job reads it and never starts', async () => {
        const sessionId = session()
        await claimRunMark(redis, { sessionId, runId: 'run-a' })
        // the server: the stop button. no worker listens for this session yet
        await requestRunStopKey(redis, { sessionId, reason: 'user' })

        const stop = watchRunStop({
            sessionId,
            subscribe: () => () => {},
            readStopRequest: () => readStopRequest(redis, { sessionId, runId: 'run-a' }),
        })
        await stop.ready

        expect(stop.stoppedBy()).toBe('user')
        expect(stop.attach(() => {})).toBe(false)
    })

    it('the next run of the session is not stopped by the old request', async () => {
        const sessionId = session()
        await claimRunMark(redis, { sessionId, runId: 'run-a' })
        await requestRunStopKey(redis, { sessionId, reason: 'user' })

        const stop = watchRunStop({
            sessionId,
            subscribe: () => () => {},
            readStopRequest: () => readStopRequest(redis, { sessionId, runId: 'run-b' }),
        })
        await stop.ready

        expect(stop.stoppedBy()).toBe(null)
    })

    describe('a held run that is left over', () => {
        let userId: string

        beforeAll(async () => {
            const user = await prisma.user.create({
                data: { name: 'run life', email: `worker-run-life-${stamp}@example.com` },
            })
            userId = user.id
        })

        afterAll(async () => {
            await prisma.session.deleteMany({ where: { userId } })
            await prisma.user.delete({ where: { id: userId } })
        })

        const heldRun = { prompt: 'an old prompt', billingSource: 'CREDITS' }

        it('is cleared when a run starts and no question asks about it', async () => {
            const row = await prisma.session.create({
                data: { userId, title: 'stale', limitHeldRun: heldRun },
            })

            await clearStaleHeldRun({ db: prisma, sessionId: row.id })

            expect(
                (await prisma.session.findUniqueOrThrow({ where: { id: row.id } })).limitHeldRun
            ).toBe(null)
        })

        it('stays while its question is open', async () => {
            const row = await prisma.session.create({
                data: {
                    userId,
                    title: 'asked',
                    limitHeldRun: heldRun,
                    limitQuestionKind: 'session',
                    limitQuestionCents: 500,
                },
            })

            await clearStaleHeldRun({ db: prisma, sessionId: row.id })

            expect(
                (await prisma.session.findUniqueOrThrow({ where: { id: row.id } })).limitHeldRun
            ).toEqual(heldRun)
        })
    })
})
