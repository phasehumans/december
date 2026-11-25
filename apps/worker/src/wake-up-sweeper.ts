import { prisma } from '@december/database'
import { claimRunMark, newRunId, releaseRunMark } from '@december/shared'
import { enqueueJob, getRedisClient } from '@december/shared/queue'

import { MailboxService } from './mailbox.service'
import { waitUntilReady } from './redis-subscriber'

import type { WakeUpSweeperOptions } from './mailbox.types'

// a wake-up for a session that is not free is tried again after this long
const BUSY_RETRY_MS = 60_000

/** the redis client of the queue, when it takes commands */
const readyRedis = async () => {
    const client = getRedisClient()
    if (!(await waitUntilReady(client))) throw new Error('redis is not ready')
    return client
}

// one run for a session (#637): a wake-up claims the run mark like every other run
const claimRunInRedis = async (sessionId: string): Promise<string | null> => {
    const runId = newRunId()
    return (await claimRunMark(await readyRedis(), { sessionId, runId })) ? runId : null
}

const releaseRunInRedis = async (sessionId: string, runId: string): Promise<void> => {
    await releaseRunMark(await readyRedis(), { sessionId, runId })
}

export class WakeUpSweeper {
    private timer: NodeJS.Timeout | null = null
    private isSweeping = false
    private intervalMs: number
    private jobDispatcher?: (data: {
        sessionId: string
        userId: string
        prompt: string
        triggerId: string
        runId: string
    }) => Promise<void>
    private claimRun: (sessionId: string) => Promise<string | null>
    private releaseRun: (sessionId: string, runId: string) => Promise<void>
    private retryMs: number

    constructor(options?: WakeUpSweeperOptions) {
        this.intervalMs = options?.intervalMs ?? 30000
        this.jobDispatcher = options?.jobDispatcher
        this.claimRun = options?.claimRun ?? claimRunInRedis
        this.releaseRun = options?.releaseRun ?? releaseRunInRedis
        this.retryMs = options?.retryMs ?? BUSY_RETRY_MS
    }

    /** frees the session of a run that was not queued. a failure only delays the next run */
    private async freeSession(sessionId: string, runId: string): Promise<void> {
        await this.releaseRun(sessionId, runId).catch((error: any) => {
            // the mark ends by itself
            console.warn(
                `[WAKE-UP SWEEPER] Could not free session '${sessionId}':`,
                error?.message || error
            )
        })
    }

    start(): void {
        if (this.timer) {
            return
        }

        console.log(
            `[WAKE-UP SWEEPER] Starting sweeper with ${this.intervalMs}ms polling interval.`
        )
        this.timer = setInterval(() => {
            this.sweep().catch((err) => {
                console.error(
                    '[WAKE-UP SWEEPER] Error during sweep execution:',
                    err?.message || err
                )
            })
        }, this.intervalMs)
    }

    stop(): void {
        if (this.timer) {
            clearInterval(this.timer)
            this.timer = null
            console.log('[WAKE-UP SWEEPER] Stopped polling sweeper.')
        }
    }

    async sweep(): Promise<number> {
        if (this.isSweeping) {
            return 0
        }

        this.isSweeping = true
        let processedCount = 0

        try {
            const now = new Date()
            const dueTriggers = await prisma.wakeUpTrigger.findMany({
                where: {
                    status: 'PENDING',
                    triggerAt: { lte: now },
                },
                include: {
                    session: true,
                },
                orderBy: { triggerAt: 'asc' },
                take: 50,
            })

            for (const trigger of dueTriggers) {
                // Atomic claim prevents duplicate concurrent sweeper execution
                const claimed = await prisma.wakeUpTrigger.updateMany({
                    where: {
                        id: trigger.id,
                        status: 'PENDING',
                    },
                    data: {
                        status: 'PROCESSING',
                    },
                })

                if (claimed.count === 0) {
                    continue // Claimed by another worker
                }

                try {
                    if (await this.processTrigger(trigger)) processedCount++
                } catch (triggerErr: any) {
                    console.error(
                        `[WAKE-UP SWEEPER] Failed processing trigger '${trigger.id}' for session '${trigger.sessionId}':`,
                        triggerErr?.message || triggerErr
                    )
                    await prisma.wakeUpTrigger
                        .update({
                            where: { id: trigger.id },
                            data: { status: 'FAILED' },
                        })
                        .catch(() => {
                            // Intentionally swallowed: database error fallback during failure marking
                        })
                }
            }
        } finally {
            this.isSweeping = false
        }

        return processedCount
    }

    /** true when the wake-up ran; false when it was cancelled or waits for a free session */
    private async processTrigger(trigger: any): Promise<boolean> {
        const { id: triggerId, sessionId, session, reason, payload } = trigger

        if (!session) {
            console.warn(
                `[WAKE-UP SWEEPER] Session '${sessionId}' for trigger '${triggerId}' not found. Cancelling trigger.`
            )
            await prisma.wakeUpTrigger
                .update({
                    where: { id: triggerId },
                    data: { status: 'CANCELLED' },
                })
                .catch(() => {
                    // Intentionally swallowed: trigger cancellation fallback
                })
            return false
        }

        // one run for a session: a wake-up never starts a second job on a session that has
        // a run. it waits, and is tried again later, with its mailbox messages still queued
        let runId: string | null
        try {
            runId = await this.claimRun(sessionId)
        } catch (claimErr: any) {
            console.warn(
                `[WAKE-UP SWEEPER] Could not claim session '${sessionId}':`,
                claimErr?.message || claimErr
            )
            // a test dispatcher runs the turn in this process, with no queue and no redis
            runId = this.jobDispatcher ? newRunId() : null
        }
        if (!runId) {
            console.log(
                `[WAKE-UP SWEEPER] Session '${sessionId}' has a run. Trigger '${triggerId}' waits.`
            )
            await prisma.wakeUpTrigger.update({
                where: { id: triggerId },
                data: { status: 'PENDING', triggerAt: new Date(Date.now() + this.retryMs) },
            })
            return false
        }

        console.log(
            `[WAKE-UP SWEEPER] Processing wake-up trigger '${triggerId}' for session '${sessionId}' (reason: ${reason})`
        )

        // 1. Unpark session if currently PARKED
        if (session.status === 'PARKED') {
            await MailboxService.unparkSession({ sessionId })
        }

        // 2. Atomically transition pending mailbox messages: QUEUED -> PLACED
        const placedMessages = await MailboxService.placeMailboxMessages({ sessionId })
        const messageIds = placedMessages.map((msg) => msg.id)

        // 3. Construct turn prompt from placed mailbox messages or trigger payload
        let prompt = ''
        if (placedMessages.length > 0) {
            prompt = placedMessages.map((msg) => `[${msg.sender}]: ${msg.content}`).join('\n\n')
        } else if (payload && typeof payload === 'object' && (payload as any).prompt) {
            prompt = String((payload as any).prompt)
        } else {
            prompt = `[SCHEDULED WAKE-UP]: ${reason || 'Periodic autonomous check'}`
        }

        // 4. Dispatch job to BullMQ or test runner
        if (this.jobDispatcher) {
            try {
                await this.jobDispatcher({
                    sessionId,
                    userId: session.userId,
                    prompt,
                    triggerId,
                    runId,
                })
            } finally {
                // the dispatcher ran the turn in this process: no job will end the run
                await this.freeSession(sessionId, runId)
            }
        } else {
            try {
                await enqueueJob('run_agent', {
                    sessionId,
                    userId: session.userId,
                    runId,
                    prompt,
                    triggerId,
                })
            } catch (queueErr: any) {
                console.warn(
                    `[WAKE-UP SWEEPER] Redis enqueue fallback for session '${sessionId}':`,
                    queueErr?.message || queueErr
                )
                // no run was queued: the session is free again
                await this.freeSession(sessionId, runId)
            }
        }

        // 5. Atomically transition mailbox messages: PLACED -> COMPLETED
        if (messageIds.length > 0) {
            await MailboxService.completeMailboxMessages({ messageIds })
        }

        // 6. Mark trigger as COMPLETED
        await prisma.wakeUpTrigger.update({
            where: { id: triggerId },
            data: {
                status: 'COMPLETED',
                processedAt: new Date(),
            },
        })

        // 7. Return session to PARKED when idle (only for synchronous dispatcher runs; otherwise listener handles parking upon stream completion)
        if (this.jobDispatcher) {
            await MailboxService.parkSession({
                sessionId,
                reason: 'wake_up_turn_completed',
            })
        }
        return true
    }
}
