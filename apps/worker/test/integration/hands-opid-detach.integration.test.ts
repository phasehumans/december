import fs from 'node:fs'
import path from 'node:path'

import { afterAll, beforeAll, describe, expect, it, spyOn } from 'bun:test'

import { handleDetach, handleRead, handleStart, handleStatus } from '../../src/hands-daemon'
import { RemotePlatformAdapter } from '../../src/remote-operations'
import * as runtime from '../../src/runtime'

describe('Hands opId Journal & Detach Integration', () => {
    const testOpsDir = path.join('/tmp', `december-detach-integration-${Date.now()}`)

    beforeAll(() => {
        if (!fs.existsSync(testOpsDir)) {
            fs.mkdirSync(testOpsDir, { recursive: true })
        }
    })

    afterAll(() => {
        try {
            fs.rmSync(testOpsDir, { recursive: true, force: true })
        } catch {
            // Intentionally swallowed: test cleanup
        }
    })

    it('should generate opId and track active operations during RemotePlatformAdapter execution', async () => {
        const adapter = new RemotePlatformAdapter('mock-vm-opid-test')

        let ranOpId: string | undefined
        const spy = spyOn(runtime, 'executeCommand').mockImplementation(
            async (_vmId: string, cmd: string, onData?: (chunk: string) => void) => {
                ranOpId = adapter.getActiveOpIds()[0]
                if (onData) onData(`Output for ${cmd}\n`)
                return 0
            }
        )

        try {
            const result = await adapter.bash.exec('ls -la', undefined, { opId: 'custom-op-101' })
            expect(result.exitCode).toBe(0)
            expect(result.opId).toBe('custom-op-101')
            expect(result.taskId).toBe('custom-op-101')
            expect(ranOpId).toBe('custom-op-101')
            // After completion, active opId is cleared
            expect(adapter.getActiveOpIds()).toEqual([])
        } finally {
            spy.mockRestore()
        }
    })

    it('should support worker detachAll during deployment shutdown without killing underlying processes', async () => {
        const adapter = new RemotePlatformAdapter('mock-vm-drain-test')

        // Start a real background process using hands-daemon
        const opId = 'op-drain-sim'
        const startRes = await handleStart(
            opId,
            '/tmp',
            'echo "build started" && sleep 0.3 && echo "build finished"',
            testOpsDir
        )
        expect(startRes.status).toBe('started')

        // Worker tracks opId
        await adapter.bash.exec('echo mock', undefined, { opId })

        // Simulate SIGTERM / worker deploy drain
        const detached = await adapter.detachAll()
        expect(adapter.getActiveOpIds()).toEqual([])

        // Check that the process in testOpsDir is STILL ALIVE and running
        const midStatus = handleStatus(opId, testOpsDir)
        expect(midStatus.status).toBe('running')

        // Worker detaches gracefully
        const detachRes = handleDetach(opId, testOpsDir)
        expect(detachRes.isAlive).toBe(true)

        // Wait for process to complete naturally in the sandbox
        await new Promise((r) => setTimeout(r, 400))

        // Replacement worker boots up and checks status
        const finalStatus = handleStatus(opId, testOpsDir)
        expect(finalStatus.status).toBe('done')
        expect(finalStatus.exitCode).toBe(0)

        // Output was preserved across the detach
        const readRes = handleRead(opId, 0, testOpsDir)
        expect(readRes.data).toContain('build started')
        expect(readRes.data).toContain('build finished')
        expect(readRes.isDone).toBe(true)
    })
})
