import {
    claimRunMark,
    newRunId,
    pushSteeringItem,
    QUEUED_RUN_MARK_SECONDS,
    releaseRunMark,
    requestRunStopKey,
} from '@december/shared'

import { redisClient } from '../config/redis'

import type { RunStopReason } from '@december/shared'

/**
 * A new message while December works (#637).
 *
 * `session_run:<sessionId>` marks a session whose run is queued or active. Its value is the
 * id of that run: the server sets it when it queues a run, the worker keeps it alive while
 * the run works and clears it when the run ends. `session_steering:<sessionId>` is the list
 * of messages that wait for the running agent. The key names, the times and the redis steps
 * are in packages/shared (run-contract.ts), the same for the worker.
 *
 * Redis keeps the mark across server nodes; with no Redis (tests, local) a map in this
 * process does.
 */

const localMarks = new Map<string, { runId: string; expiresAt: number }>()

const redisReady = () => redisClient !== undefined && redisClient.status === 'ready'

const localOwner = (sessionId: string): string | null => {
    const mark = localMarks.get(sessionId)
    if (!mark) return null
    if (mark.expiresAt > Date.now()) return mark.runId
    localMarks.delete(sessionId)
    return null
}

/**
 * Every path that queues a run calls this first. The id of the new run when the session had
 * no run: the session is now marked, and the caller queues the job with this `runId`. Null
 * when a run is queued or active.
 */
export const claimRun = async (sessionId: string): Promise<string | null> => {
    const runId = newRunId()
    if (redisReady()) {
        try {
            return (await claimRunMark(redisClient!, { sessionId, runId })) ? runId : null
        } catch (error) {
            // Intentionally swallowed: fall back to this process so the prompt still runs
            console.warn('[run mark] redis failed, using local state', error)
        }
    }
    if (localOwner(sessionId) !== null) return null
    localMarks.set(sessionId, { runId, expiresAt: Date.now() + QUEUED_RUN_MARK_SECONDS * 1000 })
    return runId
}

/** removes the mark of a run that was never queued. the mark of another run stays */
export const releaseRun = async (sessionId: string, runId: string): Promise<void> => {
    if (localOwner(sessionId) === runId) localMarks.delete(sessionId)
    if (!redisReady()) return
    try {
        await releaseRunMark(redisClient!, { sessionId, runId })
    } catch (error) {
        // the mark ends by itself
        console.warn('[run mark] could not release the run', error)
    }
}

/**
 * Gives a message to the run of the session. False when no run is active any more: the
 * message was not added, and the caller starts a normal run.
 */
export const pushSteering = async (sessionId: string, item: unknown): Promise<boolean> => {
    if (!redisReady()) return false
    try {
        return await pushSteeringItem(redisClient!, { sessionId, item: JSON.stringify(item) })
    } catch (error) {
        // no worker reads a list in this process: the caller starts a normal run, or the
        // message stays with the web
        console.warn('[run mark] could not give the message to the run', error)
        return false
    }
}

/**
 * Leaves the stop request for the run that is queued or active, so a job that has not
 * started yet reads it when it starts. The id of that run, or null when the session has no
 * run (or no redis: the publish is then the only signal).
 */
export const leaveStopRequest = async (
    sessionId: string,
    reason: RunStopReason
): Promise<string | null> => {
    if (!redisReady()) return localOwner(sessionId)
    try {
        return await requestRunStopKey(redisClient!, { sessionId, reason })
    } catch (error) {
        console.warn('[run mark] could not leave the stop request', error)
        return null
    }
}

/** for tests: a clean state in this process */
export const resetLocalRunMarks = () => {
    localMarks.clear()
}
