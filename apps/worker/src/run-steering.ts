/**
 * A new message while December works (#637): steering.
 *
 * The server puts a message for a running session on the redis list
 * `session_steering:<sessionId>` (sessionService.deliverSteering). The run reads the list at
 * the start of each agent turn (the `getSteeringMessages` hook), so the agent sees the
 * message at its next model call. A list, not a publish: a message that nobody took before
 * the run ended is still there, and starts a normal run.
 *
 * `session_run:<sessionId>` marks a session whose run is active. Its value is the id of the
 * run. Whoever queues a run sets it, the worker keeps it alive while the run works and
 * clears it at the end. Only the run that owns the mark works on the session: the job of
 * another run gives its prompt to the owner as a steering message (`joinRun`).
 *
 * The mark is cleared when the run is closed, after its last work (the pull request step).
 * The worker then sends `RunClosed`, and the web sends the message it kept in its queue.
 *
 * Only `createRedisSteeringStore` talks to redis. The rest takes the store as a parameter.
 * The key names, the times and the redis steps are in packages/shared (run-contract.ts),
 * the same for the server.
 */
import {
    adoptRunMark,
    closeRunMark,
    newRunId,
    pushSteeringItem,
    steeringListKey,
} from '@december/shared'

import type { RunContractRedis } from '@december/shared'

const HEARTBEAT_MS = 30_000

/** a message sent to a running session */
export interface SteeringItem {
    prompt: string
    /** the sequence of the saved user message */
    userMessageSequence?: number
    /** the files sent with the message (#634), as the server names them in a job */
    attachments?: unknown
    /** skills picked with /name for this message */
    skills?: string[]
    /** the id the web gave the message, so it can tell when the agent read it */
    clientMessageId?: string
}

/** the steering message in a redis list entry, or null when the entry is not one */
export const parseSteeringItem = (raw: string): SteeringItem | null => {
    try {
        const parsed = JSON.parse(raw)
        if (typeof parsed?.prompt !== 'string' || !parsed.prompt.trim()) return null
        return {
            prompt: parsed.prompt,
            ...(Number.isInteger(parsed.userMessageSequence)
                ? { userMessageSequence: parsed.userMessageSequence }
                : {}),
            ...(Array.isArray(parsed.attachments) && parsed.attachments.length > 0
                ? { attachments: parsed.attachments }
                : {}),
            ...(Array.isArray(parsed.skills) && parsed.skills.length > 0
                ? { skills: parsed.skills.filter((name: unknown) => typeof name === 'string') }
                : {}),
            ...(typeof parsed.clientMessageId === 'string'
                ? { clientMessageId: parsed.clientMessageId }
                : {}),
        }
    } catch {
        // Intentionally swallowed: an entry that is not json is not a steering message
        return null
    }
}

/** a run of a session: the id of the run is the owner of the run mark */
export interface RunOfSession {
    sessionId: string
    runId: string
}

export interface CloseRun extends RunOfSession {
    /** messages that still wait start a run: the mark passes to it */
    keepMark: boolean
    /** the id of the run that follows, when messages were left */
    nextRunId: string
}

/** the redis side of steering */
export interface SteeringStore {
    /** reads and clears the waiting messages of a session, in one step */
    take: (sessionId: string) => Promise<string[]>
    /**
     * The run ended: reads and clears the waiting messages. The run mark is cleared, or it
     * passes to `nextRunId` when `keepMark` is set and messages were left (a run for them
     * follows). A run that does not own the mark gets nothing and changes nothing.
     */
    close: (data: CloseRun) => Promise<string[]>
    /**
     * Marks the session as working for this run, or renews the mark. False when another
     * run owns the mark: this run must not work on the session.
     */
    touch: (data: RunOfSession) => Promise<boolean>
    /** gives a message to the run that owns the mark. false when the session has no run */
    push: (data: { sessionId: string; item: SteeringItem }) => Promise<boolean>
}

/** the part of an ioredis client that the store uses */
export interface SteeringRedis extends RunContractRedis {
    multi: () => any
}

export const createRedisSteeringStore = (getRedis: () => SteeringRedis): SteeringStore => ({
    take: async (sessionId) => {
        const key = steeringListKey(sessionId)
        const results = await getRedis().multi().lrange(key, 0, -1).del(key).exec()
        const items = results?.[0]?.[1]
        return Array.isArray(items) ? items : []
    },
    close: (data) => closeRunMark(getRedis(), data),
    touch: (data) => adoptRunMark(getRedis(), data),
    push: ({ sessionId, item }) =>
        pushSteeringItem(getRedis(), { sessionId, item: JSON.stringify(item) }),
})

export interface JoinRun extends RunOfSession {
    store: SteeringStore
    /** the prompt of this job, as a message for the run that owns the session */
    item: SteeringItem
}

/**
 * The job of a run starts. `owner`: the session is marked for this run, and the job works.
 * `handed-off`: another run owns the session, so this job must not work; its prompt was
 * given to that run as a steering message, so it is not lost. Two jobs never work on one
 * session.
 */
export const joinRun = async (data: JoinRun): Promise<'owner' | 'handed-off'> => {
    const { store, sessionId, runId, item } = data
    // the other run can end between the two steps: try again a few times
    for (let attempt = 0; attempt < 3; attempt += 1) {
        if (await store.touch({ sessionId, runId })) return 'owner'
        if (await store.push({ sessionId, item })) return 'handed-off'
    }
    throw new Error(`could not join the run of session ${sessionId}`)
}

/** an event of the agent run, as the worker sends it to the server */
interface RunEventLike {
    type?: string
}

/** the event that tells the server and the web that the agent now reads these messages */
export const steeringEvents = (items: SteeringItem[]) =>
    items.length === 0
        ? []
        : [
              {
                  type: 'SteeringDelivered',
                  messages: items.map((item) => ({
                      prompt: item.prompt,
                      ...(item.userMessageSequence ? { sequence: item.userMessageSequence } : {}),
                      ...(item.clientMessageId ? { clientMessageId: item.clientMessageId } : {}),
                  })),
              },
          ]

export interface WatchRunSteering {
    sessionId: string
    /** the id of this run: the owner of the run mark */
    runId: string
    store: SteeringStore
    /**
     * Queues a normal run for the messages that nobody took. The last one is its prompt.
     * `runId` is the id of that run: the session is already marked for it.
     */
    startRun: (items: SteeringItem[], runId: string) => Promise<void>
    /**
     * The run is closed: its last work is done (the saved messages, the pull request step),
     * and the session is free for the next run, or the run of a message nobody took is
     * queued. The web sends its queued message now.
     */
    onClosed?: (data: RunClosed) => Promise<void>
    /** how often the run mark is renewed. 0 turns the heartbeat off (tests) */
    heartbeatMs?: number
}

export interface RunClosed {
    /** a run for the messages that nobody took follows */
    runFollows: boolean
}

export interface EndRunSteering {
    /** the run was stopped or never started: messages that still wait start no run */
    discard: boolean
}

/** the steering of one run, from the moment the job starts until the run ends */
export interface RunSteering {
    /** settles when the session is marked as working */
    readonly ready: Promise<void>
    /**
     * The agent starts a turn: the messages that wait, in the order they were sent. Called
     * once for each turn (the `getSteeringMessages` hook).
     */
    take: () => Promise<SteeringItem[]>
    /**
     * The reader of the run events reached the start of a turn: the messages the agent read
     * at that turn. The reader can be behind the agent, so they are kept by turn.
     */
    beforeTurnStart: () => SteeringItem[]
    /** the events to send before this run event (SteeringDelivered before its TurnStart) */
    eventsBefore: (event: RunEventLike) => ReturnType<typeof steeringEvents>
    /** the run ended: no more messages are read, and what still waits starts a run */
    end: (data: EndRunSteering) => Promise<void>
}

/** Reads the steering messages of one session while its run is active. */
export const watchRunSteering = (data: WatchRunSteering): RunSteering => {
    const { sessionId, runId, store, startRun, onClosed } = data
    const heartbeatMs = data.heartbeatMs ?? HEARTBEAT_MS
    let ended = false
    // the turn the agent is at, and the turn the reader of the events is at
    let agentTurn = 0
    let readerTurn = 0
    const takenAtTurn = new Map<number, SteeringItem[]>()

    const touch = () =>
        store.touch({ sessionId, runId }).then(
            (owned) => {
                if (!owned) {
                    console.warn(`[RUN STEERING] run ${runId} no longer owns session ${sessionId}`)
                }
            },
            (error: unknown) => {
                console.warn(`[RUN STEERING] could not mark session ${sessionId} as working`, error)
            }
        )
    const ready = touch()
    const heartbeat = heartbeatMs > 0 ? setInterval(touch, heartbeatMs) : null
    // the heartbeat never keeps the process alive
    ;(heartbeat as { unref?: () => void } | null)?.unref?.()

    const parse = (entries: string[]) =>
        entries.map(parseSteeringItem).filter((item): item is SteeringItem => item !== null)

    const beforeTurnStart = () => {
        readerTurn += 1
        const items: SteeringItem[] = []
        for (const turn of [...takenAtTurn.keys()].sort((a, b) => a - b)) {
            if (turn > readerTurn) break
            items.push(...(takenAtTurn.get(turn) ?? []))
            takenAtTurn.delete(turn)
        }
        return items
    }

    return {
        ready,
        take: async () => {
            agentTurn += 1
            if (ended) return []
            const turn = agentTurn
            let items: SteeringItem[] = []
            try {
                items = parse(await store.take(sessionId))
            } catch (error) {
                // the messages stay on the list: the next turn, or the end of the run, has them
                console.warn(`[RUN STEERING] could not read the messages of ${sessionId}`, error)
            }
            if (items.length > 0) takenAtTurn.set(turn, items)
            return items
        },
        beforeTurnStart,
        eventsBefore: (event) =>
            event.type === 'TurnStart' ? steeringEvents(beforeTurnStart()) : [],
        end: async ({ discard }) => {
            if (ended) return
            ended = true
            if (heartbeat) clearInterval(heartbeat)
            await ready
            let left: SteeringItem[] = []
            const nextRunId = newRunId()
            try {
                left = parse(await store.close({ sessionId, runId, keepMark: !discard, nextRunId }))
            } catch (error) {
                console.warn(`[RUN STEERING] could not close the run of ${sessionId}`, error)
            }
            const runFollows = !discard && left.length > 0
            if (runFollows) {
                try {
                    await startRun(left, nextRunId)
                } catch (error) {
                    console.error(`[RUN STEERING] could not start the run of ${sessionId}`, error)
                }
            }
            try {
                await onClosed?.({ runFollows })
            } catch (error) {
                console.warn(`[RUN STEERING] could not tell that ${sessionId} is closed`, error)
            }
        },
    }
}

/** the part of the prisma client that moveMessagesToEnd uses */
export interface SteeringMessageDb {
    message: {
        findFirst: (args: any) => Promise<{ sequence: number } | null>
        updateMany: (args: any) => Promise<unknown>
    }
}

export interface MoveMessagesToEnd {
    db: SteeringMessageDb
    sessionId: string
    /** the sequences of the saved steering messages, in the order they were sent */
    sequences: number[]
}

/**
 * The agent reads a steering message at the start of a turn. The message was saved when it
 * arrived, so the answer of the turn that ran meanwhile has a later sequence. This moves the
 * message to the end of the conversation: the saved order is the order the agent saw.
 */
export const moveMessagesToEnd = async (data: MoveMessagesToEnd): Promise<void> => {
    const { db, sessionId, sequences } = data
    for (const sequence of sequences) {
        const last = await db.message.findFirst({
            where: { sessionId },
            orderBy: { sequence: 'desc' },
            select: { sequence: true },
        })
        if (!last || last.sequence <= sequence) continue
        await db.message.updateMany({
            where: { sessionId, sequence, role: 'USER' },
            data: { sequence: last.sequence + 1 },
        })
    }
}
