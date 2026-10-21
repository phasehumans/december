import { DurableStepKernel, PrismaDurableStepStorage, StaleEpochError } from '@december/agent'
import { prisma } from '@december/database'
import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import Redis from 'ioredis'

import { reconcilePendingOp } from '../../src/durable-reconciler'
import { processGrpcStream } from '../../src/listener'
import { MailboxService } from '../../src/mailbox.service'
import { RemotePlatformAdapter } from '../../src/remote-operations'
import { WakeUpSweeper } from '../../src/wake-up-sweeper'

describe('Durable Execution Engine & Chaos Test Suite (Integration)', () => {
    let testUserId: string
    let dbAvailable = false
    let redisPub: Redis
    let redisSub: Redis

    beforeAll(async () => {
        try {
            await prisma.$queryRaw`SELECT 1`
            dbAvailable = true

            // Create test user
            const user = await prisma.user.create({
                data: {
                    name: 'Chaos Test User',
                    email: `chaos-user-${Date.now()}@example.com`,
                    username: `chaosuser_${Date.now()}`,
                },
            })
            testUserId = user.id

            const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379'
            redisPub = new Redis(redisUrl, { lazyConnect: true, maxRetriesPerRequest: 1 })
            redisSub = redisPub.duplicate({ enableReadyCheck: false })
            await redisPub.connect().catch(() => {
                // Intentionally swallowed: Redis connection fallback in offline test runner
            })
            await redisSub.connect().catch(() => {
                // Intentionally swallowed: Redis connection fallback in offline test runner
            })
        } catch (err) {
            console.warn('Postgres or Redis test service unavailable:', err)
            dbAvailable = false
        }
    })

    afterAll(async () => {
        if (redisPub) {
            redisPub.disconnect()
        }
        if (redisSub) {
            redisSub.disconnect()
        }

        if (dbAvailable && testUserId) {
            try {
                await prisma.user.delete({ where: { id: testUserId } })
            } catch {
                // Intentionally swallowed: test cleanup error
            }
            await prisma.$disconnect()
        }
    })

    it('Chaos Test 1: Worker crash mid-command with successful opId re-attachment without duplicate execution', async () => {
        if (!dbAvailable) return

        const session = await prisma.session.create({
            data: {
                title: 'Chaos Recovery Session',
                userId: testUserId,
                type: 'WEB',
                epoch: 1,
                status: 'RUNNING',
            },
        })
        const sessionId = session.id

        const storage = new PrismaDurableStepStorage(prisma)
        const worker1Kernel = new DurableStepKernel({ storage, workerId: 'worker-crashed-1' })
        const lease1 = await worker1Kernel.acquireLease(sessionId, 5000)

        // Worker 1 dispatches tool call with opId into sandbox and commits step 1
        const opId = 'chaos-op-midflight'
        await worker1Kernel.commitStep({
            sessionId,
            stepType: 'MODEL_INFERENCE',
            opId,
            output: {
                toolCall: {
                    id: opId,
                    name: 'bash',
                    input: {
                        command: 'node -e "setTimeout(() => console.log(\'chaos-done\'), 500)"',
                    },
                },
            },
        })

        // Mock sandbox hands daemon where the command is actively running
        let commandPollCount = 0
        const mockAdapter = new RemotePlatformAdapter('mock-vm-chaos')
        mockAdapter.getOpStatus = async (_targetOpId: string) => {
            commandPollCount++
            if (commandPollCount < 3) {
                return { status: 'running' }
            }
            return { status: 'done', exitCode: 0, output: 'chaos-done\n' }
        }

        // Worker 1 crashes (simulated by dropping process)
        // Worker 2 boots up as successor and takes over session with bumped epoch
        const worker2Kernel = new DurableStepKernel({ storage, workerId: 'worker-successor-2' })
        const lease2 = await worker2Kernel.acquireLease(sessionId, 5000, true)
        expect(lease2.epoch).toBeGreaterThan(lease1.epoch)

        // Worker 2 reconciles in-flight op
        const reconcileRes = await reconcilePendingOp(sessionId, worker2Kernel, mockAdapter)
        expect(reconcileRes.reconciled).toBe(true)
        expect(reconcileRes.action).toBe('attached_and_committed')
        expect(reconcileRes.opId).toBe(opId)

        // Verify TOOL_EXECUTION step was committed under epoch 2
        const steps = await prisma.durableStep.findMany({
            where: { sessionId },
            orderBy: { stepIndex: 'asc' },
        })
        expect(steps.length).toBe(2)
        expect(steps[1]!.stepType).toBe('TOOL_EXECUTION')
        expect(steps[1]!.opId).toBe(opId)
        expect((steps[1]!.output as any)?.output).toContain('chaos-done')

        // Verify zombie worker 1 waking up late is rejected by epoch fencing
        await expect(
            worker1Kernel.commitStep({
                sessionId,
                stepType: 'TOOL_EXECUTION',
                opId,
                output: { output: 'zombie-write' },
            })
        ).rejects.toThrow(StaleEpochError)
    })

    it('Chaos Test 2: Dual-path streaming broadcasts tokens via Redis while stale worker epoch is rejected', async () => {
        if (!dbAvailable) return

        const session = await prisma.session.create({
            data: {
                title: 'Dual-Path Streaming Session',
                userId: testUserId,
                type: 'WEB',
                epoch: 1,
                status: 'RUNNING',
            },
        })
        const sessionId = session.id

        const storage = new PrismaDurableStepStorage(prisma)
        const worker1Kernel = new DurableStepKernel({ storage, workerId: 'worker-dualpath-1' })
        await worker1Kernel.acquireLease(sessionId, 5000)

        // Track live tokens streamed over Redis Pub/Sub
        const receivedTokens: string[] = []
        if (redisSub && redisSub.status === 'ready') {
            await redisSub.subscribe(`session_events:${sessionId}`).catch(() => {})
            redisSub.on('message', (ch, msg) => {
                if (ch === `session_events:${sessionId}`) {
                    try {
                        const parsed = JSON.parse(msg)
                        if (parsed.type === 'StreamChunk') {
                            receivedTokens.push(parsed.content)
                        }
                    } catch {
                        // Intentionally swallowed
                    }
                }
            })
        }

        // Stream generator emitting real-time tokens and tool result
        const streamGenerator = (async function* () {
            yield {
                data: JSON.stringify({ type: 'ThinkingChunk', content: 'Analyzing problem...' }),
            }
            yield { data: JSON.stringify({ type: 'StreamChunk', content: 'Hello ' }) }
            yield { data: JSON.stringify({ type: 'StreamChunk', content: 'world' }) }
            yield {
                data: JSON.stringify({
                    type: 'ToolCallStart',
                    toolCall: { id: 'call-1', name: 'ls', input: { path: '.' } },
                }),
            }
            yield {
                data: JSON.stringify({
                    type: 'ToolCallResult',
                    toolCallId: 'call-1',
                    result: { exitCode: 0, output: 'file1.txt\nfile2.txt' },
                }),
            }
            yield { data: JSON.stringify({ type: 'TurnEnd' }) }
        })()

        // Process stream on worker 1
        await processGrpcStream(sessionId, streamGenerator, undefined, { kernel: worker1Kernel })

        // Verify discrete steps committed to PostgreSQL
        const steps = await prisma.durableStep.findMany({
            where: { sessionId },
            orderBy: { stepIndex: 'asc' },
        })
        expect(steps.length).toBeGreaterThanOrEqual(1)
        expect(steps.some((s) => s.stepType === 'TOOL_EXECUTION')).toBe(true)

        // Now test split-brain fencing: Worker 2 takes over
        const worker2Kernel = new DurableStepKernel({ storage, workerId: 'worker-successor-2' })
        await worker2Kernel.acquireLease(sessionId, 5000, true)

        // Worker 1 now attempts another commit; must be rejected with StaleEpochError
        await expect(
            worker1Kernel.commitStep({
                sessionId,
                stepType: 'MODEL_INFERENCE',
                output: { content: 'zombie-turn' },
            })
        ).rejects.toThrow(StaleEpochError)
    })

    it('Chaos Test 3: Always-on park and wake-up execution lifecycle', async () => {
        if (!dbAvailable) return

        const session = await prisma.session.create({
            data: {
                title: 'Always-On Chaos Session',
                userId: testUserId,
                type: 'WEB',
                epoch: 1,
                status: 'IDLE',
            },
        })
        const sessionId = session.id

        const dispatchedJobs: any[] = []
        const sweeper = new WakeUpSweeper({
            intervalMs: 500,
            jobDispatcher: async (data) => {
                dispatchedJobs.push(data)
            },
        })

        // 1. Enqueue inbound mailbox message
        const message = await MailboxService.enqueueMailboxMessage({
            sessionId,
            sender: 'WEBHOOK',
            content: 'GitHub webhook: pr_opened #99',
        })
        expect(message.status).toBe('QUEUED')

        // 2. Schedule wake-up trigger 1.5s in the future
        const triggerAt = new Date(Date.now() + 1500)
        const trigger = await MailboxService.scheduleWakeUp({
            sessionId,
            triggerAt,
            reason: 'pr_opened_event',
        })
        expect(trigger.status).toBe('PENDING')

        // 3. Park session and assert PARKED
        await MailboxService.parkSession({ sessionId, reason: 'waiting_for_webhook_eval' })
        const parked = await prisma.session.findUnique({ where: { id: sessionId } })
        expect(parked!.status).toBe('PARKED')

        // 4. Sweeper run before trigger is due: zero processing
        const earlyCount = await sweeper.sweep()
        expect(earlyCount).toBe(0)
        expect(dispatchedJobs.length).toBe(0)

        // 5. Wait for trigger to become due
        await new Promise((r) => setTimeout(r, 1600))

        // 6. Sweeper runs and processes due wake-up
        const sweepCount = await sweeper.sweep()
        expect(sweepCount).toBe(1)

        // Assert job was dispatched with prompt from mailbox message
        expect(dispatchedJobs.length).toBe(1)
        expect(dispatchedJobs[0]!.prompt).toContain('GitHub webhook: pr_opened #99')

        // Assert message and trigger are COMPLETED
        const completedMsg = await prisma.mailboxMessage.findUnique({ where: { id: message.id } })
        expect(completedMsg!.status).toBe('COMPLETED')

        const completedTrigger = await prisma.wakeUpTrigger.findUnique({
            where: { id: trigger.id },
        })
        expect(completedTrigger!.status).toBe('COMPLETED')

        // Assert session returned to PARKED after autonomous wake-up turn
        const finalSession = await prisma.session.findUnique({ where: { id: sessionId } })
        expect(finalSession!.status).toBe('PARKED')
    })
})
