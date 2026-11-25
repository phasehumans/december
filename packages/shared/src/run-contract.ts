/**
 * The life of a run: what the server and the worker must agree on (#637).
 *
 * `session_run:<sessionId>` is the run mark: the session has a run that is queued or works.
 * Its value is the id of that run (the owner). Whoever queues a run claims the mark first
 * (`claimRunMark`), the job of that run adopts it when it starts and renews it while it
 * works, and only the owner clears it. So two jobs never work on one session.
 *
 * `session_steering:<sessionId>` is the list of messages that wait for the running agent.
 *
 * `session_interrupts:<sessionId>` is the publish channel of a stop. A publish reaches only
 * a worker that listens, so a stop also leaves `session_stop:<sessionId>` for a short time:
 * the job reads it when it starts, and a run that waits in the queue never starts.
 *
 * Nothing here opens a connection: every function takes the redis client.
 */

export const RUN_MARK_PREFIX = 'session_run:'
export const STEERING_LIST_PREFIX = 'session_steering:'
export const INTERRUPT_CHANNEL_PREFIX = 'session_interrupts:'
export const STOP_REQUEST_PREFIX = 'session_stop:'

/** the mark of a run that works: renewed by the heartbeat, so a dead worker frees it */
export const RUN_MARK_SECONDS = 90
/** the mark of a run that waits in the queue for a free worker */
export const QUEUED_RUN_MARK_SECONDS = 600
/** a message that no run ever takes is not kept for ever */
export const STEERING_LIST_SECONDS = 3600
/** a stop request lives as long as a run can wait in the queue */
export const STOP_REQUEST_SECONDS = QUEUED_RUN_MARK_SECONDS

/** the choices of "pause an idle sandbox after" in the sandbox settings, in minutes */
export const IDLE_STOP_MINUTES = [10, 30, 60] as const
export type IdleStopMinutes = (typeof IDLE_STOP_MINUTES)[number]
export const DEFAULT_IDLE_STOP_MINUTES: IdleStopMinutes = 10

export const runMarkKey = (sessionId: string) => `${RUN_MARK_PREFIX}${sessionId}`
export const steeringListKey = (sessionId: string) => `${STEERING_LIST_PREFIX}${sessionId}`
export const interruptChannel = (sessionId: string) => `${INTERRUPT_CHANNEL_PREFIX}${sessionId}`
export const stopRequestKey = (sessionId: string) => `${STOP_REQUEST_PREFIX}${sessionId}`

/** who asked for the stop: the user (stop button) or a spend limit */
export type RunStopReason = 'user' | 'limit'

/** the part of an ioredis client that the run contract uses */
export interface RunContractRedis {
    set: (...args: any[]) => Promise<unknown>
    get: (key: string) => Promise<string | null>
    eval: (...args: any[]) => Promise<unknown>
}

/** a new id for a run: the owner value of its mark */
export const newRunId = (): string => globalThis.crypto.randomUUID()

export interface RunOfSession {
    sessionId: string
    /** the id of the run: the owner of the mark */
    runId: string
}

/**
 * The one way to start a run: true when the session had no run, and is now marked for this
 * one. The caller then queues the job with this `runId`. False: a run is queued or works.
 */
export const claimRunMark = async (
    redis: RunContractRedis,
    data: RunOfSession
): Promise<boolean> => {
    const { sessionId, runId } = data
    const set = await redis.set(runMarkKey(sessionId), runId, 'EX', QUEUED_RUN_MARK_SECONDS, 'NX')
    return set === 'OK'
}

const RELEASE_SCRIPT = `
if redis.call('GET', KEYS[1]) == ARGV[1] then
    redis.call('DEL', KEYS[1])
    return 1
end
return 0
`

/** removes the mark of a run that was never queued. true when this run held the mark */
export const releaseRunMark = async (
    redis: RunContractRedis,
    data: RunOfSession
): Promise<boolean> => {
    const { sessionId, runId } = data
    return (await redis.eval(RELEASE_SCRIPT, 1, runMarkKey(sessionId), runId)) === 1
}

// '1' is the mark of a server from before marks had an owner
const ADOPT_SCRIPT = `
local owner = redis.call('GET', KEYS[1])
if owner == false or owner == ARGV[1] or owner == '1' then
    redis.call('SET', KEYS[1], ARGV[1], 'EX', ARGV[2])
    return 1
end
return 0
`

/**
 * The job of a run starts, or its heartbeat: the mark is renewed when this run owns it, and
 * taken when it is free. False when another run owns it: this job must not work.
 */
export const adoptRunMark = async (
    redis: RunContractRedis,
    data: RunOfSession
): Promise<boolean> => {
    const { sessionId, runId } = data
    const adopted = await redis.eval(
        ADOPT_SCRIPT,
        1,
        runMarkKey(sessionId),
        runId,
        String(RUN_MARK_SECONDS)
    )
    return adopted === 1
}

// one step: the worker reads the list and clears the mark in one step too, so a message is
// either on the list before that read, or it finds no mark
const PUSH_SCRIPT = `
if redis.call('EXISTS', KEYS[1]) == 1 then
    redis.call('RPUSH', KEYS[2], ARGV[1])
    redis.call('EXPIRE', KEYS[2], ARGV[2])
    return 1
end
return 0
`

export interface PushSteeringItem {
    sessionId: string
    /** the message, as json */
    item: string
}

/**
 * Gives a message to the run of the session. False when no run is queued or active: the
 * message was not added, and the caller starts a normal run.
 */
export const pushSteeringItem = async (
    redis: RunContractRedis,
    data: PushSteeringItem
): Promise<boolean> => {
    const { sessionId, item } = data
    const added = await redis.eval(
        PUSH_SCRIPT,
        2,
        runMarkKey(sessionId),
        steeringListKey(sessionId),
        item,
        String(STEERING_LIST_SECONDS)
    )
    return added === 1
}

// one step, so a message the server adds lands before the read (a run follows) or finds no
// mark (the server starts a normal run). a run that does not own the mark changes nothing.
// only an entry with a prompt that is not blank is a message: the reader drops the others,
// so they must keep no mark (it would block the session until it runs out)
const CLOSE_SCRIPT = `
if redis.call('GET', KEYS[2]) ~= ARGV[1] then
    return {}
end
local items = redis.call('LRANGE', KEYS[1], 0, -1)
redis.call('DEL', KEYS[1])
local valid = 0
for _, raw in ipairs(items) do
    local ok, item = pcall(cjson.decode, raw)
    if ok and type(item) == 'table' and type(item.prompt) == 'string'
        and string.find(item.prompt, '%S') then
        valid = valid + 1
    end
end
if valid > 0 and ARGV[2] == '1' then
    redis.call('SET', KEYS[2], ARGV[3], 'EX', ARGV[4])
else
    redis.call('DEL', KEYS[2])
end
return items
`

export interface CloseRunMark extends RunOfSession {
    /** messages that still wait start a run: the mark passes to it */
    keepMark: boolean
    /** the id of the run that follows, when messages were left */
    nextRunId: string
}

/**
 * The run ended: reads and clears the waiting messages, and clears the mark. With `keepMark`
 * and messages left, the mark passes to `nextRunId` (the caller queues that run). A run that
 * does not own the mark gets nothing and changes nothing.
 */
export const closeRunMark = async (
    redis: RunContractRedis,
    data: CloseRunMark
): Promise<string[]> => {
    const { sessionId, runId, keepMark, nextRunId } = data
    const items = await redis.eval(
        CLOSE_SCRIPT,
        2,
        steeringListKey(sessionId),
        runMarkKey(sessionId),
        runId,
        keepMark ? '1' : '0',
        nextRunId,
        String(QUEUED_RUN_MARK_SECONDS)
    )
    return Array.isArray(items) ? items : []
}

const STOP_SCRIPT = `
local owner = redis.call('GET', KEYS[1])
if owner == false then
    return false
end
redis.call('SET', KEYS[2], ARGV[1] .. ':' .. owner, 'EX', ARGV[2])
return owner
`

export interface RequestRunStopKey {
    sessionId: string
    reason: RunStopReason
}

/**
 * Leaves the stop request for the run that holds the mark, and gives the id of that run.
 * Null when no run is queued or active: nothing is left, so the next run is not stopped.
 */
export const requestRunStopKey = async (
    redis: RunContractRedis,
    data: RequestRunStopKey
): Promise<string | null> => {
    const { sessionId, reason } = data
    const owner = await redis.eval(
        STOP_SCRIPT,
        2,
        runMarkKey(sessionId),
        stopRequestKey(sessionId),
        reason,
        String(STOP_REQUEST_SECONDS)
    )
    return typeof owner === 'string' ? owner : null
}

/** the reason when a stop was asked for this run, null when not */
export const readStopRequest = async (
    redis: RunContractRedis,
    data: RunOfSession
): Promise<RunStopReason | null> => {
    const { sessionId, runId } = data
    const value = await redis.get(stopRequestKey(sessionId))
    if (!value) return null
    const split = value.indexOf(':')
    if (split < 0 || value.slice(split + 1) !== runId) return null
    return value.slice(0, split) === 'limit' ? 'limit' : 'user'
}

/**
 * The pause of the sandbox that follows a stop (the stop route). It must not pause the
 * sandbox under an agent that is still going to run: when another run holds the mark by the
 * time the pause is done, the sandbox is left as it is.
 */
export const pausesAfterStop = (data: {
    /** the owner of the run mark now, null when the session has no run */
    markOwner: string | null
    /** the run the stop was for, null when the session had no run */
    stoppedRunId: string | null
}): boolean => {
    const { markOwner, stoppedRunId } = data
    return markOwner === null || markOwner === stoppedRunId
}
