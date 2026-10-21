import fs from 'node:fs'
import path from 'node:path'

import { DurableStepKernel, PrismaDurableStepStorage, StaleEpochError } from '@december/agent'
import { prisma } from '@december/database'
import { afterAll, beforeAll, describe, expect, it } from 'bun:test'

import { reconcilePendingOp } from '../../src/durable-reconciler'
import { handleStart } from '../../src/hands-daemon'
import { RemotePlatformAdapter } from '../../src/remote-operations'

describe('Worker Crash Recovery & Mid-Flight Re-attachment (Integration)', () => {
    let testUserId: string
    let testSessionId: string
    let dbAvailable = false
    const testOpsDir = path.join('/tmp', `december-recovery-ops-${Date.now()}`)

    beforeAll(async () => {
        try {
            await prisma.$queryRaw`SELECT 1`
            dbAvailable = true

            if (!fs.existsSync(testOpsDir)) {
                fs.mkdirSync(testOpsDir, { recursive: true })
            }

            const user = await prisma.user.create({
                data: {
                    name: 'Crash Recovery User',
                    email: `recovery-user-${Date.now()}@example.com`,
                    username: `recoveryuser_${Date.now()}`,
                },
            })
            testUserId = user.id

            const session = await prisma.session.create({
                data: {
                    title: 'Crash Recovery Test Session',
                    userId: testUserId,
                    type: 'WEB',
                    epoch: 1,
                    status: 'IDLE',
                },
            })
            testSessionId = session.id
        } catch (err) {
            console.warn('Postgres test database unavailable for crash recovery test:', err)
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
        try {
            fs.rmSync(testOpsDir, { recursive: true, force: true })
        } catch {
            // Intentionally swallowed: cleanup error
        }
    })

    it('should re-attach to in-flight sandbox command upon failover without duplicate execution', async () => {
        if (!dbAvailable) return

        const storage = new PrismaDurableStepStorage(prisma)

        // 1. Worker 1 starts session
        const worker1 = new DurableStepKernel({ storage, workerId: 'worker-1' })
        const lease1 = await worker1.acquireLease(testSessionId, 5000)
        expect(lease1.epoch).toBe(2)

        // Worker 1 commits Step 1 (User Prompt)
        await worker1.commitStep({
            sessionId: testSessionId,
            stepType: 'APPEND_USER',
            input: { prompt: 'Compile production release' },
        })

        // Worker 1 commits Step 2 (Model Decision with opId)
        const opId = 'op-midflight-recovery'
        await worker1.commitStep({
            sessionId: testSessionId,
            stepType: 'MODEL_INFERENCE',
            opId,
            output: {
                toolCall: {
                    name: 'bash',
                    opId,
                    command: 'echo "compiling-phase-1" && sleep 0.3 && echo "compiling-phase-2"',
                },
            },
        })

        // Launch command in sandbox via hands-daemon
        await handleStart(
            opId,
            '/tmp',
            'echo "compiling-phase-1" && sleep 0.3 && echo "compiling-phase-2"',
            testOpsDir
        )

        // 2. SIMULATE WORKER 1 CRASH (SIGKILL)
        // Worker 1 abruptly dies. Its in-memory state is lost.

        // 3. Worker 2 boots up and claims session
        const worker2 = new DurableStepKernel({ storage, workerId: 'worker-2' })
        const lease2 = await worker2.acquireLease(testSessionId, 5000, true)
        expect(lease2.epoch).toBe(3)
        expect(lease2.leaseOwner).toBe('worker-2')

        // Worker 2 creates adapter with testOpsDir
        const adapter2 = new RemotePlatformAdapter('mock-vm-recovery')
        // Mock getOpStatus to use testOpsDir for integration testing
        adapter2.getOpStatus = async (targetOpId: string) => {
            const { handleStatus, handleRead } = await import('../../src/hands-daemon')
            const status = handleStatus(targetOpId, testOpsDir)
            if (status.status === 'done') {
                const read = handleRead(targetOpId, 0, testOpsDir)
                return { status: 'done', exitCode: status.exitCode, output: read.data }
            }
            return status
        }

        // 4. Worker 2 runs durable reconciliation
        const reconcileRes = await reconcilePendingOp(testSessionId, worker2, adapter2)
        expect(reconcileRes.reconciled).toBe(true)
        expect(reconcileRes.opId).toBe(opId)

        // 5. Verify that Step 3 was committed durably to PostgreSQL by Worker 2
        const stepsInDb = await prisma.durableStep.findMany({
            where: { sessionId: testSessionId },
            orderBy: { stepIndex: 'asc' },
        })

        expect(stepsInDb.length).toBe(3)
        expect(stepsInDb[0]?.stepType).toBe('APPEND_USER')
        expect(stepsInDb[1]?.stepType).toBe('MODEL_INFERENCE')
        expect(stepsInDb[2]?.stepType).toBe('TOOL_EXECUTION')
        expect(stepsInDb[2]?.opId).toBe(opId)

        const toolOutput = stepsInDb[2]?.output as any
        expect(toolOutput.exitCode).toBe(0)
        expect(toolOutput.output).toContain('compiling-phase-1')
        expect(toolOutput.output).toContain('compiling-phase-2')

        // 6. Assert zombie Worker 1 write rejection: if Worker 1 wakes up, its late write is rejected
        let zombieError: any = null
        try {
            await worker1.commitStep({
                sessionId: testSessionId,
                stepType: 'TOOL_EXECUTION',
                opId,
                output: 'stale duplicate write',
            })
        } catch (err) {
            zombieError = err
        }

        expect(zombieError).toBeInstanceOf(StaleEpochError)
        expect(zombieError.expectedEpoch).toBe(2)
        expect(zombieError.actualEpoch).toBe(3)
    })
})
