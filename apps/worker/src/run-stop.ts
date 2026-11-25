/**
 * Stop for a running agent (#637).
 *
 * The server publishes an interrupt on redis `session_interrupts:<sessionId>`
 * (sessionService.requestRunStop). The worker that runs the session aborts the agent and
 * ends the run with `AgentEnd { stopped: true, reason }`. The sandbox and its files stay.
 *
 * A publish reaches only a worker that listens. A stop that arrives while the job waits in
 * the queue also leaves a stop request in redis (`session_stop:<sessionId>`): the watch of
 * the run reads it when it starts, and the run never starts.
 *
 * Nothing here talks to redis, the sandbox or the model: the subscription, the read of the
 * stop request and the abort are passed in. The channel name is in packages/shared
 * (run-contract.ts), the same for the server.
 */
import { INTERRUPT_CHANNEL_PREFIX } from '@december/shared'

import { subscribeWhenReady } from './redis-subscriber'

import type { RunStopReason } from '@december/shared'

export type { RunStopReason } from '@december/shared'

export interface RunInterrupt {
    sessionId: string
    reason: RunStopReason
}

export type InterruptListener = (interrupt: RunInterrupt) => void

/** adds a listener for the interrupts this worker gets. returns a function that removes it */
export type SubscribeToInterrupts = (listener: InterruptListener) => () => void

const INTERRUPT_PATTERN = `${INTERRUPT_CHANNEL_PREFIX}*`

/** the interrupt in a redis message, or null when the message is not one */
const parseInterrupt = (channel: string, message: string): RunInterrupt | null => {
    if (!channel.startsWith(INTERRUPT_CHANNEL_PREFIX)) return null
    const sessionId = channel.slice(INTERRUPT_CHANNEL_PREFIX.length)
    if (!sessionId) return null
    try {
        const parsed = JSON.parse(message)
        if (parsed?.type !== 'INTERRUPT') return null
        // a message with no reason is the stop button
        return { sessionId, reason: parsed.reason === 'limit' ? 'limit' : 'user' }
    } catch {
        // Intentionally swallowed: a message that is not json is not an interrupt
        return null
    }
}

/** the part of the redis subscriber connection that the hub uses */
export interface InterruptSubscriber {
    status?: string
    on: (event: any, handler: (...args: any[]) => void) => unknown
    connect?: () => Promise<unknown>
    psubscribe: (pattern: string) => Promise<unknown>
}

/**
 * One redis subscription for every run of this worker. Every worker gets every interrupt;
 * only the worker that runs the session has a listener for it.
 */
export const createInterruptHub = (redis: InterruptSubscriber) => {
    const listeners = new Set<InterruptListener>()

    // on each (re)connect: the connection has no offline queue, so a subscribe sent before
    // it is ready is lost
    subscribeWhenReady({
        client: redis,
        subscribe: () => redis.psubscribe(INTERRUPT_PATTERN),
        label: 'RUN STOP',
    })
    redis.on('pmessage', (_pattern: string, channel: string, message: string) => {
        const interrupt = parseInterrupt(channel, message)
        if (!interrupt) return
        for (const listener of [...listeners]) listener(interrupt)
    })

    const subscribe: SubscribeToInterrupts = (listener) => {
        listeners.add(listener)
        return () => {
            listeners.delete(listener)
        }
    }

    return { subscribe, listenerCount: () => listeners.size }
}

export interface WatchRunStop {
    sessionId: string
    subscribe: SubscribeToInterrupts
    /**
     * Reads the stop request that was left for this run (redis `session_stop:`): the reason,
     * or null. It covers a stop that came before this worker listened for the session.
     */
    readStopRequest?: () => Promise<RunStopReason | null>
}

/** the stop state of one run, from the moment the job starts until the run ends */
export interface RunStop {
    /** settles when the stop request of this run was read: `stoppedBy` then knows it */
    readonly ready: Promise<void>
    /** aborted when the stop arrives: for work that must end with the run (a sandbox command) */
    readonly signal: AbortSignal
    /** the reason when the run was stopped, null while it was not */
    stoppedBy: () => RunStopReason | null
    /**
     * The agent is about to start: `abort` runs when the stop arrives. False when the stop
     * arrived before this call: the agent must not start.
     */
    attach: (abort: () => void) => boolean
    /** the run ended: the listener is removed */
    end: () => void
}

/** Listens for the interrupt of one session while its run is active. */
export const watchRunStop = (data: WatchRunStop): RunStop => {
    const { sessionId, subscribe, readStopRequest } = data
    const controller = new AbortController()
    let reason: RunStopReason | null = null
    let abortAgent: (() => void) | null = null
    let ended = false

    const stopRun = (stoppedBy: RunStopReason) => {
        // the first stop ends the run. one more changes nothing, and a run that ended is done
        if (reason !== null || ended) return
        reason = stoppedBy
        controller.abort()
        abortAgent?.()
    }

    // listen first, then read: a stop between the two steps reaches the listener
    const unsubscribe = subscribe((interrupt) => {
        if (interrupt.sessionId === sessionId) stopRun(interrupt.reason)
    })
    const ready = readStopRequest
        ? Promise.resolve()
              .then(readStopRequest)
              .then(
                  (stoppedBy) => {
                      if (stoppedBy) stopRun(stoppedBy)
                  },
                  (error: unknown) => {
                      // the publish still reaches a run that works
                      console.warn(
                          `[RUN STOP] could not read the stop request of ${sessionId}`,
                          error
                      )
                  }
              )
        : Promise.resolve()

    return {
        ready,
        signal: controller.signal,
        stoppedBy: () => reason,
        attach: (abort) => {
            if (reason !== null) return false
            abortAgent = abort
            return true
        },
        end: () => {
            if (ended) return
            ended = true
            abortAgent = null
            unsubscribe()
        },
    }
}

/** an event of the agent run, as the worker sends it to the server */
export interface RunEvent {
    type?: string
    [key: string]: any
}

export interface StoppableRun<E extends RunEvent> {
    /** the agent loop. the first read starts it, so a stop before that never starts the agent */
    events: AsyncIterable<E>
    stop: RunStop
    /** aborts the agent's model call and tool (agent.abort) */
    abort: () => void
}

/** what a tool that was running at the stop gets as its result */
export const STOPPED_TOOL_OUTPUT = 'Stopped'

/** the result of a tool call (or a setup command) that the stop cut short */
export const stoppedToolResult = (toolCallId: string): RunEvent => ({
    type: 'ToolCallResult',
    result: { toolCallId, result: '', error: STOPPED_TOOL_OUTPUT, stopped: true },
})

/**
 * The end of a stopped run. Alone, it ends a run that never started: one that a spend limit
 * held before its start, so the open session stops waiting for it.
 */
export const stoppedRunEnd = (reason: RunStopReason): RunEvent => ({
    type: 'AgentEnd',
    stopped: true,
    reason,
})

export interface StoppedRunEvents {
    /** tool calls that started and did not finish */
    runningToolCallIds: string[]
    reason: RunStopReason
}

/**
 * The last events of a stopped run: a result for each tool that was running (so nothing
 * stays marked as working), the interrupt, and the end with the reason.
 */
export const stoppedRunEvents = (data: StoppedRunEvents): RunEvent[] => {
    const { runningToolCallIds, reason } = data
    return [
        ...runningToolCallIds.map(stoppedToolResult),
        { type: 'AgentInterrupt' },
        stoppedRunEnd(reason),
    ]
}

const STOP_CAME_FIRST = Symbol('stop came first')

interface NextOrStop<E> {
    iterator: AsyncIterator<E>
    signal: AbortSignal
    /** the stop came first, and the read that was in flight has now settled */
    onLateStep: () => void
}

/** the next event of the loop, or STOP_CAME_FIRST when the stop arrives before it */
const nextOrStop = <E>(data: NextOrStop<E>) => {
    const { iterator, signal, onLateStep } = data
    return new Promise<IteratorResult<E> | typeof STOP_CAME_FIRST>((resolve, reject) => {
        let stopCameFirst = false
        const onStop = () => {
            stopCameFirst = true
            resolve(STOP_CAME_FIRST)
        }
        signal.addEventListener('abort', onStop, { once: true })
        iterator.next().then(
            (result) => {
                signal.removeEventListener('abort', onStop)
                if (stopCameFirst) onLateStep()
                else resolve(result)
            },
            (error) => {
                signal.removeEventListener('abort', onStop)
                if (stopCameFirst) onLateStep()
                else reject(error)
            }
        )
    })
}

/**
 * The events of the agent loop, until the loop ends or the run is stopped.
 *
 * A stop ends the run at once. It does not wait for the model call or the tool in flight:
 * `abort` ends those, and their late events are dropped. The run then closes with
 * `stoppedRunEvents`. A stop that arrived before the first read never starts the loop.
 */
export async function* stoppableRun<E extends RunEvent>(
    data: StoppableRun<E>
): AsyncGenerator<E | RunEvent, void, undefined> {
    const { events, stop, abort } = data
    const running = new Set<string>()

    if (stop.attach(abort)) {
        const iterator = events[Symbol.asyncIterator]()
        // ends the loop's generator. a read in flight settles first, so this never blocks
        const closeLoop = () => {
            void Promise.resolve(iterator.return?.()).catch(() => {
                // Intentionally swallowed: the loop is abandoned, its close error has no reader
            })
        }
        let readInFlight = false
        let loopEnded = false
        try {
            while (!stop.signal.aborted) {
                readInFlight = true
                const result = await nextOrStop({
                    iterator,
                    signal: stop.signal,
                    onLateStep: () => {
                        // the read in flight may have started the agent's work: abort again
                        abort()
                        closeLoop()
                    },
                })
                if (result === STOP_CAME_FIRST) break
                readInFlight = false
                if (result.done) {
                    loopEnded = true
                    break
                }
                const event = result.value
                if (event.type === 'ToolCallStart' && event.toolCall?.id) {
                    running.add(event.toolCall.id)
                } else if (event.type === 'ToolCallResult') {
                    running.delete(event.result?.toolCallId ?? event.toolCallId)
                }
                yield event
            }
        } finally {
            // the reader left or the run was stopped between two reads
            if (!loopEnded && !readInFlight) closeLoop()
        }
        if (loopEnded) return
    }

    yield* stoppedRunEvents({
        runningToolCallIds: [...running],
        reason: stop.stoppedBy() ?? 'user',
    })
}

/** the assistant message of a turn, as the listener saves it */
export interface StoppedTurn {
    content: string
    blocks: any[]
}

// the saved content of a stopped turn that has no text and no tool call. the web shows the
// blocks; this text only keeps the message from being empty in the next model call
const STOPPED_TURN_CONTENT = 'Stopped.'

/**
 * The saved message of the turn that a stop cut short: a tool that still runs is closed
 * (its output so far stays), and the interrupt is the last block, as the web shows it live.
 */
export const closeStoppedTurn = (turn: StoppedTurn): StoppedTurn => {
    const blocks = turn.blocks.map((block) =>
        block?.type === 'command' && block.status === 'running'
            ? { ...block, status: 'error', output: block.output || STOPPED_TOOL_OUTPUT }
            : block
    )
    const hasToolCall = blocks.some((block) => block?.type === 'command')
    return {
        content: turn.content || (hasToolCall ? '' : STOPPED_TURN_CONTENT),
        blocks: [...blocks, { type: 'interrupt' }],
    }
}

/**
 * The events of a run that fails before the agent starts (no key, no credits, no sandbox):
 * the error, then the end of the run. Without the end, the server keeps the run marked as
 * failed, and the end of the next run sends no "finished" notification.
 */
export const failedRunEvents = (error: RunEvent): RunEvent[] => [
    error,
    { type: 'AgentEnd', failed: true },
]

export interface KillableCommand {
    /**
     * Starts the command in the sandbox. A real sandbox gives a handle (`wait`, `kill`); a
     * sandbox with no handles (mock, dev mode) gives the result itself.
     */
    start: () => Promise<any>
    /** the stop signal of the run (RunStop.signal) */
    signal: AbortSignal
    /** the time limit of the command: the command is killed when it runs longer */
    timeoutMs?: number
}

/** true for the error of a command that ran into a time limit */
export const isTimeoutError = (error: any): boolean =>
    error?.name === 'TimeoutError' || /timed? ?out/i.test(error?.message || '')

const timeoutError = () =>
    Object.assign(new Error('the command timed out'), { name: 'TimeoutError' })

/**
 * Runs a sandbox command that the stop of the run kills, and that its time limit kills.
 * Gives the result of the command. A command that ran into the time limit (ours, or one of
 * the sandbox) is killed and fails with a TimeoutError: it does not keep running.
 */
export const runKillableCommand = async (data: KillableCommand): Promise<any> => {
    const { start, signal, timeoutMs } = data
    const handle = await start()
    if (typeof handle?.wait !== 'function' || typeof handle?.kill !== 'function') return handle

    const kill = () => {
        Promise.resolve(handle.kill()).catch((error: unknown) => {
            console.warn('[RUN STOP] could not kill the sandbox command', error)
        })
    }
    if (signal.aborted) kill()
    else signal.addEventListener('abort', kill, { once: true })

    let timer: ReturnType<typeof setTimeout> | null = null
    const limit = new Promise<never>((_resolve, reject) => {
        if (!timeoutMs || timeoutMs <= 0) return
        timer = setTimeout(() => {
            // first the result of the race, then the kill (a kill can end the wait)
            reject(timeoutError())
            kill()
        }, timeoutMs)
    })
    try {
        return await Promise.race([handle.wait(), limit])
    } catch (error) {
        // a time limit of the sandbox ends the wait, not the process
        if (isTimeoutError(error) && (error as Error).message !== timeoutError().message) kill()
        throw error
    } finally {
        if (timer) clearTimeout(timer)
        signal.removeEventListener('abort', kill)
    }
}
