import fs from 'node:fs'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'bun:test'

import {
    handleDetach,
    handleRead,
    handleStart,
    handleStatus,
    handleTerminate,
} from '../../src/hands-daemon'

describe('Hands Daemon (In-Sandbox Operation Journal)', () => {
    const testOpsDir = path.join('/tmp', `december-test-ops-${Date.now()}`)

    beforeEach(() => {
        if (!fs.existsSync(testOpsDir)) {
            fs.mkdirSync(testOpsDir, { recursive: true })
        }
    })

    afterEach(() => {
        try {
            fs.rmSync(testOpsDir, { recursive: true, force: true })
        } catch {
            // Intentionally swallowed: test cleanup
        }
    })

    it('should spawn command, track PID and stream output to log file', async () => {
        const opId = 'op-test-basic'
        const res = await handleStart(opId, '/tmp', 'echo "step 1" && echo "step 2"', testOpsDir)

        expect(res.status).toBe('started')
        expect(res.pid).toBeDefined()

        // Wait briefly for execution
        await new Promise((r) => setTimeout(r, 100))

        const status = handleStatus(opId, testOpsDir)
        expect(status.status).toBe('done')
        expect(status.exitCode).toBe(0)

        const readRes = handleRead(opId, 0, testOpsDir)
        expect(readRes.data).toContain('step 1')
        expect(readRes.data).toContain('step 2')
        expect(readRes.isDone).toBe(true)
    })

    it('should guarantee replay safety by returning cached result for completed opId', async () => {
        const opId = 'op-replay-safety'
        await handleStart(opId, '/tmp', 'echo "unique-first-run"', testOpsDir)
        await new Promise((r) => setTimeout(r, 100))

        // Second call with identical opId but different command should NOT execute
        const replayRes = await handleStart(opId, '/tmp', 'echo "should-not-run"', testOpsDir)
        expect(replayRes.status).toBe('done')
        expect(replayRes.exitCode).toBe(0)

        const readRes = handleRead(opId, 0, testOpsDir)
        expect(readRes.data).toContain('unique-first-run')
        expect(readRes.data).not.toContain('should-not-run')
    })

    it('should support detaching from long-running process without killing it', async () => {
        const opId = 'op-detach-test'
        // Run a command that takes 400ms
        const startRes = await handleStart(
            opId,
            '/tmp',
            'echo "part-1" && sleep 0.4 && echo "part-2"',
            testOpsDir
        )
        expect(startRes.status).toBe('started')

        // Wait 50ms so part-1 is printed
        await new Promise((r) => setTimeout(r, 50))

        // Read initial chunk
        const initialRead = handleRead(opId, 0, testOpsDir)
        expect(initialRead.data).toContain('part-1')

        // Worker detaches (simulating server deploy / restart)
        const detachRes = handleDetach(opId, testOpsDir)
        expect(detachRes.status).toBe('detached')
        expect(detachRes.isAlive).toBe(true)

        // Process should still be alive right after detach
        const midStatus = handleStatus(opId, testOpsDir)
        expect(midStatus.status).toBe('running')

        // Wait for sleep to finish
        await new Promise((r) => setTimeout(r, 450))

        // Resuming worker attaches and reads from previous offset
        const finalRead = handleRead(opId, initialRead.offset, testOpsDir)
        expect(finalRead.data).toContain('part-2')
        expect(finalRead.isDone).toBe(true)

        const finalStatus = handleStatus(opId, testOpsDir)
        expect(finalStatus.status).toBe('done')
        expect(finalStatus.exitCode).toBe(0)
    })

    it('should terminate process when user explicitly cancels', async () => {
        const opId = 'op-terminate-test'
        // Run a 5-second sleep
        await handleStart(opId, '/tmp', 'sleep 5', testOpsDir)

        const runningStatus = handleStatus(opId, testOpsDir)
        expect(runningStatus.status).toBe('running')

        // User abort triggers terminate
        const termRes = handleTerminate(opId, testOpsDir)
        expect(termRes.status).toBe('terminated')
        expect(termRes.exitCode).toBe(137)

        await new Promise((r) => setTimeout(r, 50))
        const finalStatus = handleStatus(opId, testOpsDir)
        expect(finalStatus.status).toBe('done')
        expect(finalStatus.exitCode).toBe(137)
    })
})
