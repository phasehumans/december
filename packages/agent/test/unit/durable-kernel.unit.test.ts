import { describe, expect, it } from 'bun:test'

import { DurableStepKernel, InMemoryDurableStepStorage, StaleEpochError } from '../../src'

describe('DurableStepKernel (Unit)', () => {
    it('should acquire lease and commit sequential steps', async () => {
        const storage = new InMemoryDurableStepStorage()
        const kernel = new DurableStepKernel({ storage, workerId: 'worker-1' })

        const lease = await kernel.acquireLease('session-test-1')
        expect(lease.epoch).toBe(2) // Initial epoch was 1, acquire increments
        expect(kernel.getCurrentEpoch('session-test-1')).toBe(2)

        const step1 = await kernel.commitStep({
            sessionId: 'session-test-1',
            stepType: 'APPEND_USER',
            input: { prompt: 'Fix the failing tests' },
        })

        expect(step1.stepIndex).toBe(1)
        expect(step1.stepType).toBe('APPEND_USER')

        const step2 = await kernel.commitStep({
            sessionId: 'session-test-1',
            stepType: 'MODEL_INFERENCE',
            opId: 'op-123',
            output: { tool: 'bash', command: 'bun test' },
        })

        expect(step2.stepIndex).toBe(2)
        expect(step2.opId).toBe('op-123')

        const history = await kernel.getHistory('session-test-1')
        expect(history.length).toBe(2)
        expect(history[0]!.stepIndex).toBe(1)
        expect(history[1]!.stepIndex).toBe(2)
    })

    it('should reject commits with StaleEpochError when a second worker takes over', async () => {
        const storage = new InMemoryDurableStepStorage()
        const worker1 = new DurableStepKernel({ storage, workerId: 'worker-1' })
        const worker2 = new DurableStepKernel({ storage, workerId: 'worker-2' })

        // Worker 1 acquires lease
        const lease1 = await worker1.acquireLease('session-split-brain')
        expect(lease1.epoch).toBe(2)

        // Worker 1 commits step 1
        await worker1.commitStep({
            sessionId: 'session-split-brain',
            stepType: 'APPEND_USER',
            input: { message: 'hello' },
        })

        // Worker 2 forcefully takes over (e.g. lease expired or failover)
        const lease2 = await worker2.acquireLease('session-split-brain', 5000, true)
        expect(lease2.epoch).toBe(3) // Epoch incremented by worker 2

        // Worker 1 unfreezes and attempts to commit step 2 with stale epoch 2
        let caughtError: any = null
        try {
            await worker1.commitStep({
                sessionId: 'session-split-brain',
                stepType: 'TOOL_EXECUTION',
                output: 'stale result',
            })
        } catch (err) {
            caughtError = err
        }

        expect(caughtError).toBeInstanceOf(StaleEpochError)
        expect(caughtError.expectedEpoch).toBe(2)
        expect(caughtError.actualEpoch).toBe(3)

        // Worker 1 active epoch should be cleared to prevent further zombie attempts
        expect(worker1.getCurrentEpoch('session-split-brain')).toBeUndefined()
    })

    it('should offload payloads larger than threshold and preserve reference', async () => {
        const storage = new InMemoryDurableStepStorage()
        const kernel = new DurableStepKernel({
            storage,
            workerId: 'worker-payload',
            payloadOffloadThresholdBytes: 100, // Small threshold for testing
        })

        await kernel.acquireLease('session-large-payload')

        const largeLog = 'A'.repeat(500)
        const step = await kernel.commitStep({
            sessionId: 'session-large-payload',
            stepType: 'TOOL_EXECUTION',
            opId: 'op-compile-large',
            output: largeLog,
        })

        expect(step.outputRef).toBeDefined()
        expect(step.outputRef).toContain('op-compile-large')
        expect(step.output.__offloaded).toBe(true)
        expect(step.output.sizeBytes).toBe(500)
        expect(step.output.preview.length).toBeLessThanOrEqual(1024)
    })

    it('should execute step with duration tracking and error handling', async () => {
        const storage = new InMemoryDurableStepStorage()
        const kernel = new DurableStepKernel({ storage, workerId: 'worker-exec' })

        await kernel.acquireLease('session-exec')

        const { result, step } = await kernel.executeStep(
            'session-exec',
            'TOOL_EXECUTION',
            async () => {
                await new Promise((resolve) => setTimeout(resolve, 20))
                return { exitCode: 0, stdout: 'success' }
            },
            { opId: 'op-exec-1', input: { cmd: 'echo hi' } }
        )

        expect(result.exitCode).toBe(0)
        expect(step.stepIndex).toBe(1)
        expect(step.durationMs).toBeGreaterThanOrEqual(15)
        expect(step.opId).toBe('op-exec-1')
    })

    it('should support renewing and releasing leases cleanly', async () => {
        const storage = new InMemoryDurableStepStorage()
        const kernel = new DurableStepKernel({ storage, workerId: 'worker-lease' })

        await kernel.acquireLease('session-release')
        const renewed = await kernel.renewLease('session-release', 10000)
        expect(renewed).toBe(true)

        const released = await kernel.releaseLease('session-release', 'PARKED')
        expect(released).toBe(true)
        expect(kernel.getCurrentEpoch('session-release')).toBeUndefined()
    })
})
