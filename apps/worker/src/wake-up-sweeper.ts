import { prisma } from '@december/database'
import { enqueueJob } from '@december/shared/queue'

import { MailboxService } from './mailbox.service'

import type { WakeUpSweeperOptions } from './mailbox.types'

export class WakeUpSweeper {
    private timer: NodeJS.Timeout | null = null
    private isSweeping = false
    private intervalMs: number
    private jobDispatcher?: (data: {
        sessionId: string
        userId: string
        prompt: string
        triggerId: string
    }) => Promise<void>

    constructor(options?: WakeUpSweeperOptions) {
        this.intervalMs = options?.intervalMs ?? 30000
        this.jobDispatcher = options?.jobDispatcher
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
                    await this.processTrigger(trigger)
                    processedCount++
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

    private async processTrigger(trigger: any): Promise<void> {
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
            return
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
            await this.jobDispatcher({
                sessionId,
                userId: session.userId,
                prompt,
                triggerId,
            })
        } else {
            try {
                await enqueueJob('run_agent', {
                    sessionId,
                    userId: session.userId,
                    prompt,
                    triggerId,
                })
            } catch (queueErr: any) {
                console.warn(
                    `[WAKE-UP SWEEPER] Redis enqueue fallback for session '${sessionId}':`,
                    queueErr?.message || queueErr
                )
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
    }
}
