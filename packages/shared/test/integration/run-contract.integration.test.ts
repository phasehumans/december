import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import Redis from 'ioredis'

import {
    adoptRunMark,
    claimRunMark,
    closeRunMark,
    IDLE_STOP_MINUTES,
    interruptChannel,
    pushSteeringItem,
    QUEUED_RUN_MARK_SECONDS,
    readStopRequest,
    releaseRunMark,
    requestRunStopKey,
    runMarkKey,
    steeringListKey,
    stopRequestKey,
} from '../../src/run-contract'

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379'
const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
let count = 0
const newSession = () => `run-contract-${stamp}-${(count += 1)}`

// the contract between the server and the worker for the life of a run (#637)
describe('run contract', () => {
    let redis: Redis
    const used: string[] = []
    const session = () => {
        const sessionId = newSession()
        used.push(sessionId)
        return sessionId
    }

    beforeAll(() => {
        redis = new Redis(REDIS_URL)
    })

    afterAll(async () => {
        for (const sessionId of used) {
            await redis.del(
                runMarkKey(sessionId),
                steeringListKey(sessionId),
                stopRequestKey(sessionId)
            )
        }
        await redis.quit()
    })

    it('names the keys the same way on both sides', () => {
        expect(runMarkKey('s1')).toBe('session_run:s1')
        expect(steeringListKey('s1')).toBe('session_steering:s1')
        expect(interruptChannel('s1')).toBe('session_interrupts:s1')
        expect(stopRequestKey('s1')).toBe('session_stop:s1')
        expect(QUEUED_RUN_MARK_SECONDS).toBe(600)
        expect([...IDLE_STOP_MINUTES]).toEqual([10, 30, 60])
    })

    describe('the run mark has an owner', () => {
        it('one run claims a session; a second claim is refused', async () => {
            const sessionId = session()

            expect(await claimRunMark(redis, { sessionId, runId: 'run-a' })).toBe(true)
            expect(await claimRunMark(redis, { sessionId, runId: 'run-b' })).toBe(false)
            expect(await redis.get(runMarkKey(sessionId))).toBe('run-a')
        })

        it('only the owner releases the mark', async () => {
            const sessionId = session()
            await claimRunMark(redis, { sessionId, runId: 'run-a' })

            expect(await releaseRunMark(redis, { sessionId, runId: 'run-b' })).toBe(false)
            expect(await redis.get(runMarkKey(sessionId))).toBe('run-a')

            expect(await releaseRunMark(redis, { sessionId, runId: 'run-a' })).toBe(true)
            expect(await redis.get(runMarkKey(sessionId))).toBe(null)
        })

        it('the job of the owner adopts the mark; the job of another run does not', async () => {
            const sessionId = session()
            await claimRunMark(redis, { sessionId, runId: 'run-a' })

            expect(await adoptRunMark(redis, { sessionId, runId: 'run-b' })).toBe(false)
            expect(await adoptRunMark(redis, { sessionId, runId: 'run-a' })).toBe(true)
            expect(await redis.get(runMarkKey(sessionId))).toBe('run-a')
            // a working run holds the mark for a short time, renewed by its heartbeat
            expect(await redis.ttl(runMarkKey(sessionId))).toBeLessThanOrEqual(90)
        })

        it('a job takes a free mark (the queued mark ran out)', async () => {
            const sessionId = session()
            expect(await adoptRunMark(redis, { sessionId, runId: 'run-a' })).toBe(true)
            expect(await redis.get(runMarkKey(sessionId))).toBe('run-a')
        })

        it('the end of a run does not clear the mark of another run', async () => {
            const sessionId = session()
            await claimRunMark(redis, { sessionId, runId: 'run-b' })
            await redis.rpush(steeringListKey(sessionId), JSON.stringify({ prompt: 'for b' }))

            const left = await closeRunMark(redis, {
                sessionId,
                runId: 'run-a',
                keepMark: true,
                nextRunId: 'run-c',
            })

            expect(left).toEqual([])
            expect(await redis.get(runMarkKey(sessionId))).toBe('run-b')
            // the messages stay for the run that works
            expect(await redis.llen(steeringListKey(sessionId))).toBe(1)
        })

        it('the end of a run frees the session', async () => {
            const sessionId = session()
            await claimRunMark(redis, { sessionId, runId: 'run-a' })

            const left = await closeRunMark(redis, {
                sessionId,
                runId: 'run-a',
                keepMark: true,
                nextRunId: 'run-c',
            })

            expect(left).toEqual([])
            expect(await redis.get(runMarkKey(sessionId))).toBe(null)
        })

        it('messages that nobody took pass the mark to the run that follows', async () => {
            const sessionId = session()
            await claimRunMark(redis, { sessionId, runId: 'run-a' })
            const item = JSON.stringify({ prompt: 'one more thing' })
            expect(await pushSteeringItem(redis, { sessionId, item })).toBe(true)

            const left = await closeRunMark(redis, {
                sessionId,
                runId: 'run-a',
                keepMark: true,
                nextRunId: 'run-c',
            })

            expect(left).toEqual([item])
            expect(await redis.get(runMarkKey(sessionId))).toBe('run-c')
            expect(await redis.llen(steeringListKey(sessionId))).toBe(0)
        })

        it('entries with a blank prompt keep no mark', async () => {
            const sessionId = session()
            await claimRunMark(redis, { sessionId, runId: 'run-a' })
            await pushSteeringItem(redis, { sessionId, item: JSON.stringify({ prompt: '   ' }) })
            await pushSteeringItem(redis, { sessionId, item: JSON.stringify({ prompt: '' }) })
            await pushSteeringItem(redis, { sessionId, item: 'not json' })
            await pushSteeringItem(redis, { sessionId, item: JSON.stringify({ text: 'x' }) })

            await closeRunMark(redis, {
                sessionId,
                runId: 'run-a',
                keepMark: true,
                nextRunId: 'run-c',
            })

            expect(await redis.get(runMarkKey(sessionId))).toBe(null)
        })

        it('a message for a session with no run is not added', async () => {
            const sessionId = session()
            expect(await pushSteeringItem(redis, { sessionId, item: '{"prompt":"hi"}' })).toBe(
                false
            )
            expect(await redis.llen(steeringListKey(sessionId))).toBe(0)
        })
    })

    describe('a stop request stays for the run it stops', () => {
        it('names the run that holds the mark, and that run reads the reason', async () => {
            const sessionId = session()
            await claimRunMark(redis, { sessionId, runId: 'run-a' })

            expect(await requestRunStopKey(redis, { sessionId, reason: 'user' })).toBe('run-a')
            expect(await readStopRequest(redis, { sessionId, runId: 'run-a' })).toBe('user')
        })

        it('keeps the reason of a spend limit', async () => {
            const sessionId = session()
            await claimRunMark(redis, { sessionId, runId: 'run-a' })
            await requestRunStopKey(redis, { sessionId, reason: 'limit' })

            expect(await readStopRequest(redis, { sessionId, runId: 'run-a' })).toBe('limit')
        })

        it('does not stop the next run of the session', async () => {
            const sessionId = session()
            await claimRunMark(redis, { sessionId, runId: 'run-a' })
            await requestRunStopKey(redis, { sessionId, reason: 'user' })
            await releaseRunMark(redis, { sessionId, runId: 'run-a' })
            await claimRunMark(redis, { sessionId, runId: 'run-b' })

            expect(await readStopRequest(redis, { sessionId, runId: 'run-b' })).toBe(null)
        })

        it('leaves nothing when no run is queued or active', async () => {
            const sessionId = session()

            expect(await requestRunStopKey(redis, { sessionId, reason: 'user' })).toBe(null)
            expect(await redis.exists(stopRequestKey(sessionId))).toBe(0)
        })

        it('ends by itself', async () => {
            const sessionId = session()
            await claimRunMark(redis, { sessionId, runId: 'run-a' })
            await requestRunStopKey(redis, { sessionId, reason: 'user' })

            const ttl = await redis.ttl(stopRequestKey(sessionId))
            expect(ttl).toBeGreaterThan(0)
            expect(ttl).toBeLessThanOrEqual(600)
        })
    })
})
