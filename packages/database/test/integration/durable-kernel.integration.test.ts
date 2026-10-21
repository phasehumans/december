import { afterAll, beforeAll, describe, expect, it } from 'bun:test'

import { DurableStepKernel, PrismaDurableStepStorage, StaleEpochError } from '../../../agent/src'
import { prisma } from '../../src/index'

describe('DurableStepKernel & PostgreSQL Epoch Fencing (Integration)', () => {
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
                    name: 'Durable Test User',
                    email: `durable-user-${Date.now()}@example.com`,
                    username: `durableuser_${Date.now()}`,
                },
            })
            testUserId = user.id

            const session = await prisma.session.create({
                data: {
                    title: 'Durable Execution Test Session',
                    userId: testUserId,
                    type: 'WEB',
                    epoch: 1,
                    status: 'IDLE',
                },
            })
            testSessionId = session.id
        } catch (err) {
            console.warn('Postgres test database unavailable for integration test:', err)
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

    it('should acquire lease and commit sequential steps to PostgreSQL', async () => {
        if (!dbAvailable) return

        const storage = new PrismaDurableStepStorage(prisma)
        const worker1 = new DurableStepKernel({ storage, workerId: 'worker-integration-1' })

        // 1. Acquire lease
        const lease = await worker1.acquireLease(testSessionId, 5000)
        expect(lease.epoch).toBe(2)
        expect(lease.leaseOwner).toBe('worker-integration-1')

        // Verify database session state
        const dbSession = await prisma.session.findUnique({ where: { id: testSessionId } })
        expect(dbSession?.epoch).toBe(2)
        expect(dbSession?.leaseOwner).toBe('worker-integration-1')
        expect(dbSession?.status).toBe('RUNNING')

        // 2. Commit Step 1
        const step1 = await worker1.commitStep({
            sessionId: testSessionId,
            stepType: 'APPEND_USER',
            input: { prompt: 'Deploy database migrations' },
        })

        expect(step1.stepIndex).toBe(1)
        expect(step1.stepType).toBe('APPEND_USER')

        // 3. Commit Step 2
        const step2 = await worker1.commitStep({
            sessionId: testSessionId,
            stepType: 'TOOL_EXECUTION',
            opId: 'op-integration-step2',
            output: { exitCode: 0, stdout: 'Migrations applied' },
        })

        expect(step2.stepIndex).toBe(2)
        expect(step2.opId).toBe('op-integration-step2')

        // 4. Verify durable steps persisted in PostgreSQL
        const stepsInDb = await prisma.durableStep.findMany({
            where: { sessionId: testSessionId },
            orderBy: { stepIndex: 'asc' },
        })

        expect(stepsInDb.length).toBe(2)
        expect(stepsInDb[0]?.stepIndex).toBe(1)
        expect(stepsInDb[0]?.stepType).toBe('APPEND_USER')
        expect(stepsInDb[1]?.stepIndex).toBe(2)
        expect(stepsInDb[1]?.opId).toBe('op-integration-step2')
    })

    it('should reject commits from stale worker when successor increments epoch', async () => {
        if (!dbAvailable) return

        const storage = new PrismaDurableStepStorage(prisma)
        const worker1 = new DurableStepKernel({ storage, workerId: 'worker-integration-1' })
        const worker2 = new DurableStepKernel({ storage, workerId: 'worker-integration-2' })

        // Worker 1 acquires lease (epoch becomes 3 if session already at 2, or bumped)
        const lease1 = await worker1.acquireLease(testSessionId, 5000, true)
        const worker1Epoch = lease1.epoch

        // Worker 2 forcefully takes over (failover scenario, epoch bumped)
        const lease2 = await worker2.acquireLease(testSessionId, 5000, true)
        expect(lease2.epoch).toBe(worker1Epoch + 1)
        expect(lease2.leaseOwner).toBe('worker-integration-2')

        // Worker 1 unfreezes and attempts to commit step with stale worker1Epoch
        let staleError: any = null
        try {
            await worker1.commitStep({
                sessionId: testSessionId,
                stepType: 'TOOL_EXECUTION',
                opId: 'op-zombie-attempt',
                output: 'Zombie worker trying to write',
            })
        } catch (err) {
            staleError = err
        }

        expect(staleError).toBeInstanceOf(StaleEpochError)
        expect(staleError.expectedEpoch).toBe(worker1Epoch)
        expect(staleError.actualEpoch).toBe(lease2.epoch)

        // Verify that the zombie step was NOT written to PostgreSQL
        const zombieStep = await prisma.durableStep.findFirst({
            where: {
                sessionId: testSessionId,
                opId: 'op-zombie-attempt',
            },
        })
        expect(zombieStep).toBeNull()

        // Worker 2 can commit successfully with valid epoch
        const validStep = await worker2.commitStep({
            sessionId: testSessionId,
            stepType: 'TOOL_EXECUTION',
            opId: 'op-valid-successor',
            output: 'Successor worker write',
        })
        expect(validStep.opId).toBe('op-valid-successor')
    })
})
