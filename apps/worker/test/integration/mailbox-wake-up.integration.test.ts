import { prisma } from '@december/database'
import { afterAll, beforeAll, describe, expect, it } from 'bun:test'

import { MailboxService } from '../../src/mailbox.service'
import { WakeUpSweeper } from '../../src/wake-up-sweeper'

describe('Mailbox Queue, Wake-Up Sweeper & Session Parking (Integration)', () => {
    let testUserId: string
    let testSessionId: string
    let dbAvailable = false

    beforeAll(async () => {
        try {
            await prisma.$queryRaw`SELECT 1`
            dbAvailable = true

            // Create test user and session
            const user = await prisma.user.create({
                data: {
                    name: 'Mailbox Test User',
                    email: `mailbox-user-${Date.now()}@example.com`,
                    username: `mailboxuser_${Date.now()}`,
                },
            })
            testUserId = user.id

            const session = await prisma.session.create({
                data: {
                    title: 'Always-On Mailbox Session',
                    userId: testUserId,
                    type: 'WEB',
                    epoch: 1,
                    status: 'IDLE',
                },
            })
            testSessionId = session.id
        } catch (err) {
            console.warn('Postgres test database unavailable for mailbox integration test:', err)
            dbAvailable = false
        }
    })

    afterAll(async () => {
        if (dbAvailable && testUserId) {
            try {
                await prisma.user.delete({ where: { id: testUserId } })
            } catch {
                // Intentionally swallowed: cleanup error
            }
            await prisma.$disconnect()
        }
    })

    it('manages atomic mailbox message transitions: QUEUED -> PLACED -> COMPLETED', async () => {
        if (!dbAvailable) return

        // 1. Enqueue messages
        const msg1 = await MailboxService.enqueueMailboxMessage({
            sessionId: testSessionId,
            sender: 'USER',
            content: 'Task 1: Run security scan',
        })
        const msg2 = await MailboxService.enqueueMailboxMessage({
            sessionId: testSessionId,
            sender: 'WEBHOOK',
            content: 'Task 2: Inbound GitHub webhook ping',
        })

        expect(msg1.status).toBe('QUEUED')
        expect(msg2.status).toBe('QUEUED')

        // 2. Transition atomically to PLACED
        const placed = await MailboxService.placeMailboxMessages({ sessionId: testSessionId })
        expect(placed.length).toBe(2)

        const placedDbMessages = await prisma.mailboxMessage.findMany({
            where: { id: { in: [msg1.id, msg2.id] } },
        })
        for (const msg of placedDbMessages) {
            expect(msg.status).toBe('PLACED')
        }

        // 3. Complete messages
        await MailboxService.completeMailboxMessages({
            messageIds: [msg1.id, msg2.id],
        })

        const completedDbMessages = await prisma.mailboxMessage.findMany({
            where: { id: { in: [msg1.id, msg2.id] } },
        })
        for (const msg of completedDbMessages) {
            expect(msg.status).toBe('COMPLETED')
            expect(msg.processedAt).toBeDefined()
        }
    })

    it('schedules a wake-up 2 seconds in the future, asserts transition to PARKED, verifies autonomous wake-up execution, and confirms return to PARKED', async () => {
        if (!dbAvailable) return

        const dispatchedJobs: Array<{
            sessionId: string
            userId: string
            prompt: string
            triggerId: string
        }> = []

        // Configure sweeper with test job dispatcher
        const sweeper = new WakeUpSweeper({
            intervalMs: 500,
            jobDispatcher: async (jobData) => {
                dispatchedJobs.push(jobData)
            },
        })

        // 1. Enqueue inbound prompt message
        const inboundMsg = await MailboxService.enqueueMailboxMessage({
            sessionId: testSessionId,
            sender: 'USER',
            content: 'Autonomous task: verify pull request and run tests',
        })
        expect(inboundMsg.status).toBe('QUEUED')

        // 2. Schedule wake-up trigger 2 seconds in the future
        const triggerAt = new Date(Date.now() + 2000)
        const trigger = await MailboxService.scheduleWakeUp({
            sessionId: testSessionId,
            triggerAt,
            reason: 'scheduled_autonomous_review',
        })
        expect(trigger.status).toBe('PENDING')

        // 3. Park the session and assert PARKED status
        await MailboxService.parkSession({
            sessionId: testSessionId,
            reason: 'waiting_for_wake_up',
        })
        const parkedSession = await prisma.session.findUnique({
            where: { id: testSessionId },
        })
        expect(parkedSession!.status).toBe('PARKED')
        expect(parkedSession!.leaseOwner).toBeNull()

        // 4. Run sweeper immediately before trigger is due: must NOT trigger early
        const earlyCount = await sweeper.sweep()
        expect(earlyCount).toBe(0)
        expect(dispatchedJobs.length).toBe(0)

        const stillParked = await prisma.session.findUnique({
            where: { id: testSessionId },
        })
        expect(stillParked!.status).toBe('PARKED')

        // 5. Wait 2.2 seconds for trigger to become due
        await new Promise((r) => setTimeout(r, 2200))

        // 6. Sweeper sweeps due triggers
        const sweepCount = await sweeper.sweep()
        expect(sweepCount).toBe(1)

        // 7. Assert autonomous wake-up execution
        expect(dispatchedJobs.length).toBe(1)
        expect(dispatchedJobs[0]!.sessionId).toBe(testSessionId)
        expect(dispatchedJobs[0]!.prompt).toContain(
            'Autonomous task: verify pull request and run tests'
        )

        // 8. Assert wake-up trigger transitioned to COMPLETED
        const completedTrigger = await prisma.wakeUpTrigger.findUnique({
            where: { id: trigger.id },
        })
        expect(completedTrigger!.status).toBe('COMPLETED')
        expect(completedTrigger!.processedAt).toBeDefined()

        // 9. Assert mailbox message transitioned to COMPLETED
        const completedMsg = await prisma.mailboxMessage.findUnique({
            where: { id: inboundMsg.id },
        })
        expect(completedMsg!.status).toBe('COMPLETED')
        expect(completedMsg!.processedAt).toBeDefined()

        // 10. Assert session returned to PARKED after autonomous turn
        const finalSession = await prisma.session.findUnique({
            where: { id: testSessionId },
        })
        expect(finalSession!.status).toBe('PARKED')
    })
})
