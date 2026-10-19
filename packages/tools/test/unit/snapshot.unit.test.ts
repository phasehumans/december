import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { describe, expect, it, beforeEach, afterEach } from 'bun:test'

import { SnapshotManager, setSnapshotManager } from '../../src/snapshot'

describe('SnapshotManager (Unit)', () => {
    let tempDir: string

    beforeEach(async () => {
        tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'december-snap-test-'))
        setSnapshotManager(null)
    })

    afterEach(async () => {
        try {
            await fs.rm(tempDir, { recursive: true, force: true })
        } catch {
            // Intentionally swallowed: test cleanup error
        }
        setSnapshotManager(null)
    })

    it('should initialize shadow git repository and exclude configuration', async () => {
        const manager = new SnapshotManager(tempDir)
        await manager.init()

        const snapshotsDir = path.join(tempDir, '.december', 'snapshots')
        const stat = await fs.stat(snapshotsDir)
        expect(stat.isDirectory()).toBe(true)

        const excludeFile = path.join(snapshotsDir, 'info', 'exclude')
        const excludeContent = await fs.readFile(excludeFile, 'utf8')
        expect(excludeContent).toContain('.december')
        expect(excludeContent).toContain('node_modules')
    })

    it('should create snapshots with commit hashes and turn metadata', async () => {
        const manager = new SnapshotManager(tempDir)
        await manager.init()

        // Create initial test file
        const filePath = path.join(tempDir, 'sample.txt')
        await fs.writeFile(filePath, 'version 1', 'utf8')

        const record = await manager.createSnapshot({
            turnIndex: 1,
            messageId: 'msg-1',
            prompt: 'create sample file',
        })

        expect(record.turnIndex).toBe(1)
        expect(record.commitHash).toBeDefined()
        expect(record.commitHash.length).toBeGreaterThan(0)
        expect(record.prompt).toBe('create sample file')

        const snapshots = manager.getSnapshots()
        expect(snapshots.length).toBe(1)
        expect(snapshots[0]?.commitHash).toBe(record.commitHash)
    })

    it('should rollback modified files to previous snapshot state', async () => {
        const manager = new SnapshotManager(tempDir)
        await manager.init()

        const filePath = path.join(tempDir, 'config.json')
        await fs.writeFile(filePath, '{"version": 1}', 'utf8')

        // Turn 1 snapshot
        await manager.createSnapshot({
            turnIndex: 1,
            prompt: 'initial config',
        })

        // Agent modifies file in Turn 2
        await fs.writeFile(filePath, '{"version": 2, "broken": true}', 'utf8')

        // Rollback to Turn 1
        const rollbackResult = await manager.rollbackToTurn(1)
        expect(rollbackResult.success).toBe(true)
        expect(rollbackResult.targetTurn).toBe(1)

        const restoredContent = await fs.readFile(filePath, 'utf8')
        expect(restoredContent).toBe('{"version": 1}')
    })

    it('should delete newly created files when rolling back to a previous snapshot', async () => {
        const manager = new SnapshotManager(tempDir)
        await manager.init()

        const existingFile = path.join(tempDir, 'keep.txt')
        await fs.writeFile(existingFile, 'keep me', 'utf8')

        // Snapshot at turn 1
        await manager.createSnapshot({
            turnIndex: 1,
            prompt: 'turn 1',
        })

        // Turn 2 adds a new file
        const newFile = path.join(tempDir, 'new-file.txt')
        await fs.writeFile(newFile, 'temporary hallucinated file', 'utf8')

        // Rollback to turn 1
        const rollbackResult = await manager.rollbackToTurn(1)
        expect(rollbackResult.success).toBe(true)

        // Existing file is intact
        const existingContent = await fs.readFile(existingFile, 'utf8')
        expect(existingContent).toBe('keep me')

        // New file must be deleted
        let newFileExists = true
        try {
            await fs.access(newFile)
        } catch {
            // Intentionally swallowed: file should not exist after rollback
            newFileExists = false
        }
        expect(newFileExists).toBe(false)
        expect(rollbackResult.deletedFiles).toContain('new-file.txt')
    })

    it('should support rollbackLastTurn() convenience helper', async () => {
        const manager = new SnapshotManager(tempDir)
        await manager.init()

        const file = path.join(tempDir, 'state.txt')
        await fs.writeFile(file, 'initial', 'utf8')

        await manager.createSnapshot({ turnIndex: 1, prompt: 'turn 1' })

        await fs.writeFile(file, 'turn 2 changes', 'utf8')
        await manager.createSnapshot({ turnIndex: 2, prompt: 'turn 2' })

        await fs.writeFile(file, 'turn 3 buggy changes', 'utf8')

        // Rollback last turn (rolls back to turn 2 state)
        const rollbackResult = await manager.rollbackLastTurn()
        expect(rollbackResult.success).toBe(true)
        expect(rollbackResult.targetTurn).toBe(2)

        const content = await fs.readFile(file, 'utf8')
        expect(content).toBe('turn 2 changes')
    })

    it('should persist and reload records across instances', async () => {
        const manager1 = new SnapshotManager(tempDir)
        await manager1.init()

        const file = path.join(tempDir, 'app.ts')
        await fs.writeFile(file, 'console.log("hello")', 'utf8')

        await manager1.createSnapshot({ turnIndex: 1, prompt: 'initial app' })

        // New manager pointing to same workspace
        const manager2 = new SnapshotManager(tempDir)
        await manager2.init()

        const loadedSnapshots = manager2.getSnapshots()
        expect(loadedSnapshots.length).toBe(1)
        expect(loadedSnapshots[0]?.turnIndex).toBe(1)
        expect(loadedSnapshots[0]?.prompt).toBe('initial app')
    })
})
