import { describe, expect, it } from 'bun:test'

import {
    createRedisSteeringStore,
    joinRun,
    moveMessagesToEnd,
    parseSteeringItem,
    steeringEvents,
    watchRunSteering,
} from '../../src/run-steering'

import type { SteeringItem, SteeringStore } from '../../src/run-steering'

/** the redis lists and run marks of the worker, kept in this test */
const fakeStore = () => {
    const lists = new Map<string, string[]>()
    // the owner of the mark of each session
    const marks = new Map<string, string>()
    const store: SteeringStore = {
        take: async (sessionId) => {
            const items = lists.get(sessionId) ?? []
            lists.delete(sessionId)
            return items
        },
        close: async ({ sessionId, runId, keepMark, nextRunId }) => {
            if (marks.get(sessionId) !== runId) return []
            const items = lists.get(sessionId) ?? []
            lists.delete(sessionId)
            if (items.length > 0 && keepMark) marks.set(sessionId, nextRunId)
            else marks.delete(sessionId)
            return items
        },
        touch: async ({ sessionId, runId }) => {
            const owner = marks.get(sessionId)
            if (owner !== undefined && owner !== runId) return false
            marks.set(sessionId, runId)
            return true
        },
        push: async ({ sessionId, item }) => {
            if (!marks.has(sessionId)) return false
            lists.set(sessionId, [...(lists.get(sessionId) ?? []), JSON.stringify(item)])
            return true
        },
    }
    return {
        store,
        marks,
        lists,
        send: (sessionId: string, item: SteeringItem) => {
            lists.set(sessionId, [...(lists.get(sessionId) ?? []), JSON.stringify(item)])
        },
    }
}

const watch = (redis: ReturnType<typeof fakeStore>, sessionId = 'session-a', runId = 'run-1') => {
    const started: SteeringItem[][] = []
    // the ids of the runs that were queued for messages nobody took
    const startedRunIds: string[] = []
    // what happened at the end of the run, in order
    const log: string[] = []
    const steering = watchRunSteering({
        sessionId,
        runId,
        store: redis.store,
        startRun: async (items, nextRunId) => {
            started.push(items)
            startedRunIds.push(nextRunId)
            log.push('run queued')
        },
        onClosed: async ({ runFollows }) => {
            log.push(`closed, marked: ${redis.marks.has(sessionId)}, run follows: ${runFollows}`)
        },
        heartbeatMs: 0,
    })
    return { steering, started, startedRunIds, log }
}

describe('a new message while December works: the worker', () => {
    it('marks the session as working from the start of the run', async () => {
        const redis = fakeStore()
        const { steering } = watch(redis)
        await steering.ready

        expect([...redis.marks]).toEqual([['session-a', 'run-1']])
    })

    it('gives the agent the messages of its session in the order they were sent', async () => {
        const redis = fakeStore()
        const { steering } = watch(redis)
        redis.send('session-a', { prompt: 'use bun', userMessageSequence: 4 })
        redis.send('session-a', { prompt: 'and add a test', userMessageSequence: 6 })

        expect(await steering.take()).toEqual([
            { prompt: 'use bun', userMessageSequence: 4 },
            { prompt: 'and add a test', userMessageSequence: 6 },
        ])
        // a message is read once
        expect(await steering.take()).toEqual([])
    })

    it('ignores a message for another session', async () => {
        const redis = fakeStore()
        const { steering } = watch(redis)
        redis.send('session-b', { prompt: 'not for this run' })

        expect(await steering.take()).toEqual([])
    })

    it('drops a message that is not a steering message', async () => {
        expect(parseSteeringItem('not json')).toBeNull()
        expect(parseSteeringItem(JSON.stringify({ prompt: '   ' }))).toBeNull()
        expect(
            parseSteeringItem(JSON.stringify({ prompt: 'ok', userMessageSequence: 'x' }))
        ).toEqual({ prompt: 'ok' })
    })

    it('says which messages the agent reads at a turn, before that turn starts', async () => {
        const redis = fakeStore()
        const { steering } = watch(redis)

        // turn 1: nothing waits
        await steering.take()
        expect(steering.beforeTurnStart()).toEqual([])

        // turn 2: one message. the reader of the events is still at turn 2
        redis.send('session-a', { prompt: 'use bun', userMessageSequence: 4 })
        await steering.take()
        expect(steering.beforeTurnStart()).toEqual([{ prompt: 'use bun', userMessageSequence: 4 }])
        expect(steering.beforeTurnStart()).toEqual([])
    })

    it('keeps a message for its own turn when the reader of the events is a turn behind', async () => {
        const redis = fakeStore()
        const { steering } = watch(redis)

        await steering.take() // the agent starts turn 1
        redis.send('session-a', { prompt: 'late', userMessageSequence: 9 })
        await steering.take() // the agent starts turn 2 and reads the message

        // the reader only now gets to the start of turn 1
        expect(steering.beforeTurnStart()).toEqual([])
        expect(steering.beforeTurnStart()).toEqual([{ prompt: 'late', userMessageSequence: 9 }])
    })

    it('puts SteeringDelivered before the TurnStart of the turn that reads the message', async () => {
        const redis = fakeStore()
        const { steering } = watch(redis)
        redis.send('session-a', {
            prompt: 'use bun',
            userMessageSequence: 4,
            clientMessageId: 'c1',
        })
        await steering.take()

        expect(steering.eventsBefore({ type: 'ToolCallResult' })).toEqual([])
        expect(steering.eventsBefore({ type: 'TurnStart' })).toEqual([
            {
                type: 'SteeringDelivered',
                messages: [{ prompt: 'use bun', sequence: 4, clientMessageId: 'c1' }],
            },
        ])
        expect(steeringEvents([])).toEqual([])
    })

    it('removes the listener when the run ends: no more messages, the mark is cleared', async () => {
        const redis = fakeStore()
        const { steering, started } = watch(redis)
        await steering.ready

        await steering.end({ discard: false })
        redis.send('session-a', { prompt: 'after the end' })

        expect(await steering.take()).toEqual([])
        expect([...redis.marks]).toEqual([])
        expect(started).toEqual([])
        // a second end does nothing
        await steering.end({ discard: false })
        expect(started).toEqual([])
    })

    it('starts a normal run for a message that nobody took before the run ended', async () => {
        const redis = fakeStore()
        const { steering, started, startedRunIds } = watch(redis)
        await steering.ready
        redis.send('session-a', { prompt: 'first', userMessageSequence: 7 })
        redis.send('session-a', { prompt: 'second', userMessageSequence: 8 })

        await steering.end({ discard: false })

        expect(started).toEqual([
            [
                { prompt: 'first', userMessageSequence: 7 },
                { prompt: 'second', userMessageSequence: 8 },
            ],
        ])
        // the session stays marked as working, now for the run that follows
        expect(startedRunIds).toHaveLength(1)
        expect(startedRunIds[0]).not.toBe('run-1')
        expect([...redis.marks]).toEqual([['session-a', startedRunIds[0]!]])
    })

    it('the end of a run does not free the session of another run', async () => {
        const redis = fakeStore()
        // the mark of this run ran out, and another run claimed the session
        redis.marks.set('session-a', 'run-2')
        const { steering, started } = watch(redis, 'session-a', 'run-1')
        await steering.ready
        redis.send('session-a', { prompt: 'for run 2' })

        await steering.end({ discard: false })

        expect([...redis.marks]).toEqual([['session-a', 'run-2']])
        // the message stays for the run that works, and no third run starts
        expect(redis.lists.get('session-a')).toHaveLength(1)
        expect(started).toEqual([])
    })

    describe('the job of a run starts', () => {
        const item = { prompt: 'add a test', userMessageSequence: 5 }

        it('works when the session is marked for this run', async () => {
            const redis = fakeStore()
            redis.marks.set('session-a', 'run-1')

            expect(
                await joinRun({ store: redis.store, sessionId: 'session-a', runId: 'run-1', item })
            ).toBe('owner')
        })

        it('takes a session with no mark (the queued mark ran out)', async () => {
            const redis = fakeStore()

            expect(
                await joinRun({ store: redis.store, sessionId: 'session-a', runId: 'run-1', item })
            ).toBe('owner')
            expect([...redis.marks]).toEqual([['session-a', 'run-1']])
        })

        it('does not work when another run owns the session: its prompt goes to that run', async () => {
            const redis = fakeStore()
            redis.marks.set('session-a', 'run-2')

            expect(
                await joinRun({ store: redis.store, sessionId: 'session-a', runId: 'run-1', item })
            ).toBe('handed-off')
            expect([...redis.marks]).toEqual([['session-a', 'run-2']])
            expect(redis.lists.get('session-a')).toEqual([JSON.stringify(item)])
        })
    })

    it('starts no run after a stop: the message stays in the conversation only', async () => {
        const redis = fakeStore()
        const { steering, started } = watch(redis)
        await steering.ready
        redis.send('session-a', { prompt: 'too late' })

        await steering.end({ discard: true })

        expect(started).toEqual([])
        expect([...redis.marks]).toEqual([])
    })

    it('says that the run is closed after the session is free, once', async () => {
        const redis = fakeStore()
        const { steering, log } = watch(redis)
        await steering.ready

        await steering.end({ discard: false })
        await steering.end({ discard: false })

        expect(log).toEqual(['closed, marked: false, run follows: false'])
    })

    it('says that a run follows after that run is queued', async () => {
        const redis = fakeStore()
        const { steering, log } = watch(redis)
        await steering.ready
        redis.send('session-a', { prompt: 'not read' })

        await steering.end({ discard: false })

        expect(log).toEqual(['run queued', 'closed, marked: true, run follows: true'])
    })

    it('reads and clears the redis list in one step, and names its run in every mark step', async () => {
        const calls: any[] = []
        const redis = {
            multi: () => {
                const chain = {
                    lrange: (...args: any[]) => (calls.push(['lrange', ...args]), chain),
                    del: (...args: any[]) => (calls.push(['del', ...args]), chain),
                    exec: async () => [
                        [null, ['{"prompt":"a"}']],
                        [null, 1],
                    ],
                }
                return chain
            },
            // the scripts run on a real redis in packages/shared (run-contract)
            eval: async (...args: any[]) => {
                calls.push(['eval', ...args.slice(1)])
                return args.length === 5 ? 1 : ['{"prompt":"b"}']
            },
            set: async () => 'OK',
            get: async () => null,
        }
        const store = createRedisSteeringStore(() => redis)

        expect(await store.take('s1')).toEqual(['{"prompt":"a"}'])
        expect(
            await store.close({ sessionId: 's1', runId: 'r1', keepMark: true, nextRunId: 'r2' })
        ).toEqual(['{"prompt":"b"}'])
        expect(await store.touch({ sessionId: 's1', runId: 'r1' })).toBe(true)

        expect(calls).toEqual([
            ['lrange', 'session_steering:s1', 0, -1],
            ['del', 'session_steering:s1'],
            ['eval', 2, 'session_steering:s1', 'session_run:s1', 'r1', '1', 'r2', '600'],
            ['eval', 1, 'session_run:s1', 'r1', '90'],
        ])
    })
})

describe('the saved order of a steering message', () => {
    /** the messages of one session, as { sequence, content } rows */
    const fakeDb = (rows: Array<{ sequence: number; content: string }>) => ({
        rows,
        message: {
            findFirst: async () => [...rows].sort((a, b) => b.sequence - a.sequence)[0] ?? null,
            updateMany: async (args: any) => {
                const row = rows.find((r) => r.sequence === args.where.sequence)
                if (!row) return { count: 0 }
                row.sequence = args.data.sequence
                return { count: 1 }
            },
        },
    })
    const inOrder = (db: ReturnType<typeof fakeDb>) =>
        [...db.rows].sort((a, b) => a.sequence - b.sequence).map((row) => row.content)

    it('moves the message after the turn that ran while it waited', async () => {
        const db = fakeDb([
            { sequence: 1, content: 'prompt' },
            { sequence: 2, content: 'steer' },
            { sequence: 3, content: 'answer of turn 1' },
        ])

        await moveMessagesToEnd({ db, sessionId: 's1', sequences: [2] })

        expect(inOrder(db)).toEqual(['prompt', 'answer of turn 1', 'steer'])
    })

    it('keeps two messages in the order they were sent, and leaves a last message alone', async () => {
        const db = fakeDb([
            { sequence: 1, content: 'prompt' },
            { sequence: 2, content: 'steer one' },
            { sequence: 3, content: 'steer two' },
            { sequence: 4, content: 'answer of turn 1' },
        ])

        await moveMessagesToEnd({ db, sessionId: 's1', sequences: [2, 3] })
        expect(inOrder(db)).toEqual(['prompt', 'answer of turn 1', 'steer one', 'steer two'])

        await moveMessagesToEnd({ db, sessionId: 's1', sequences: [6] })
        expect(db.rows.map((row) => row.sequence).sort()).toEqual([1, 4, 5, 6])
    })
})
