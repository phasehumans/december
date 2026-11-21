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

    it('rewinds to the current session snapshot when turn numbers repeat across sessions', async () => {
        const file = path.join(tempDir, 'a.txt')
        const session1 = new SnapshotManager(tempDir)
        await fs.writeFile(file, 'v1', 'utf8')
        await session1.createSnapshot({ turnIndex: 1, sessionId: 's1', messageId: 'm1' })
        await fs.writeFile(file, 'v2', 'utf8')
        await session1.createSnapshot({ turnIndex: 2, sessionId: 's1', messageId: 'm2' })
        await fs.writeFile(file, 'v3', 'utf8')

        const session2 = new SnapshotManager(tempDir)
        const current = await session2.createSnapshot({
            turnIndex: 1,
            sessionId: 's2',
            messageId: 'm3',
        })
        await fs.writeFile(file, 'v4', 'utf8')

        const byId = await session2.rollbackToSnapshot(current.id)
        expect(byId.success).toBe(true)
        expect(await fs.readFile(file, 'utf8')).toBe('v3')

        // Other sessions keep their snapshots; the rewound one is dropped
        expect(session2.getSnapshots().map((r) => r.messageId)).toEqual(['m1', 'm2'])
    })

    it('rollbackToTurn picks the most recent snapshot for a repeated turn number', async () => {
        const file = path.join(tempDir, 'a.txt')
        const manager = new SnapshotManager(tempDir)
        await fs.writeFile(file, 'old', 'utf8')
        await manager.createSnapshot({ turnIndex: 1, sessionId: 's1' })
        await fs.writeFile(file, 'new', 'utf8')
        await manager.createSnapshot({ turnIndex: 1, sessionId: 's2' })
        await fs.writeFile(file, 'changed', 'utf8')

        await manager.rollbackToTurn(1)
        expect(await fs.readFile(file, 'utf8')).toBe('new')
    })

    it('drops the target and later snapshots of the same session after a rewind', async () => {
        const file = path.join(tempDir, 'a.txt')
        const manager = new SnapshotManager(tempDir)
        await fs.writeFile(file, 'v1', 'utf8')
        await manager.createSnapshot({ turnIndex: 1, sessionId: 's1', messageId: 'm1' })
        await fs.writeFile(file, 'v2', 'utf8')
        const turn2 = await manager.createSnapshot({
            turnIndex: 2,
            sessionId: 's1',
            messageId: 'm2',
        })
        await fs.writeFile(file, 'v3', 'utf8')
        await manager.createSnapshot({ turnIndex: 3, sessionId: 's1', messageId: 'm3' })

        await manager.rollbackToSnapshot(turn2.id)
        expect(await fs.readFile(file, 'utf8')).toBe('v2')
        expect(manager.getSnapshots().map((r) => r.messageId)).toEqual(['m1'])
    })

    it('undoes a rename without leaving the new file behind', async () => {
        const manager = new SnapshotManager(tempDir)
        const oldPath = path.join(tempDir, 'old.ts')
        const newPath = path.join(tempDir, 'new.ts')
        await fs.writeFile(oldPath, 'export const x = 1\n'.repeat(20), 'utf8')
        await manager.createSnapshot({ turnIndex: 1 })

        await fs.rename(oldPath, newPath)

        const result = await manager.rollbackToTurn(1)
        expect(result.success).toBe(true)
        expect(result.restoredFiles).toContain('old.ts')
        expect(result.deletedFiles).toContain('new.ts')
        const files = (await fs.readdir(tempDir)).filter((f) => !f.startsWith('.'))
        expect(files).toEqual(['old.ts'])
    })

    it('restores paths with spaces and non-ASCII characters', async () => {
        const manager = new SnapshotManager(tempDir)
        const file = path.join(tempDir, 'café notes [1].md')
        await fs.writeFile(file, 'original', 'utf8')
        await manager.createSnapshot({ turnIndex: 1 })

        await fs.writeFile(file, 'edited', 'utf8')
        const added = path.join(tempDir, 'naïve *.txt')
        await fs.writeFile(added, 'new', 'utf8')

        const result = await manager.rollbackToTurn(1)
        expect(result.success).toBe(true)
        expect(result.failedFiles).toEqual([])
        expect(await fs.readFile(file, 'utf8')).toBe('original')
        await expect(fs.access(added)).rejects.toThrow()
    })

    it('finds the first snapshot of a session', async () => {
        const manager = new SnapshotManager(tempDir)
        await manager.createSnapshot({ turnIndex: 1, sessionId: 'other' })
        const first = await manager.createSnapshot({ turnIndex: 1, sessionId: 'mine' })
        await manager.createSnapshot({ turnIndex: 2, sessionId: 'mine' })

        expect(manager.getFirstSnapshotForSession('mine')?.id).toBe(first.id)
        expect(manager.getFirstSnapshotForSession('missing')).toBeUndefined()
    })

    it('diffs the workspace against a snapshot, with counts and one diff per file', async () => {
        const manager = new SnapshotManager(tempDir)
        await fs.writeFile(path.join(tempDir, 'kept.txt'), 'same\n', 'utf8')
        await fs.writeFile(path.join(tempDir, 'edited.ts'), 'a\nb\nc\n', 'utf8')
        await fs.writeFile(path.join(tempDir, 'removed.md'), 'bye\n', 'utf8')
        const base = await manager.createSnapshot({ turnIndex: 1, sessionId: 's1' })

        await fs.writeFile(path.join(tempDir, 'edited.ts'), 'a\nB\nc\nd\n', 'utf8')
        await fs.rm(path.join(tempDir, 'removed.md'))
        await fs.writeFile(path.join(tempDir, 'new file.txt'), 'one\ntwo\n', 'utf8')

        const changes = await manager.diffSinceSnapshot(base.commitHash)
        const byPath = Object.fromEntries(changes.map((c) => [c.path, c]))

        expect(Object.keys(byPath).sort()).toEqual(['edited.ts', 'new file.txt', 'removed.md'])
        expect(byPath['edited.ts']).toMatchObject({
            status: 'modified',
            additions: 2,
            deletions: 1,
        })
        expect(byPath['edited.ts']!.diff).toStartWith('diff --git a/edited.ts b/edited.ts')
        expect(byPath['edited.ts']!.diff).toContain('+B')
        expect(byPath['new file.txt']).toMatchObject({
            status: 'added',
            additions: 2,
            deletions: 0,
        })
        expect(byPath['new file.txt']!.diff).toContain('+two')
        expect(byPath['removed.md']).toMatchObject({
            status: 'deleted',
            additions: 0,
            deletions: 1,
        })
        expect(byPath['removed.md']!.diff).toContain('-bye')
    })

    it('leaves the shadow index alone and no temp index behind when diffing', async () => {
        const manager = new SnapshotManager(tempDir)
        await fs.writeFile(path.join(tempDir, 'a.txt'), '1\n', 'utf8')
        const base = await manager.createSnapshot({ turnIndex: 1 })
        const snapshotsDir = path.join(tempDir, '.december', 'snapshots')
        const indexBefore = await fs.readFile(path.join(snapshotsDir, 'index'))

        await fs.writeFile(path.join(tempDir, 'a.txt'), '2\n', 'utf8')
        const changes = await manager.diffSinceSnapshot(base.commitHash)

        expect(changes.map((c) => c.path)).toEqual(['a.txt'])
        expect(await fs.readFile(path.join(snapshotsDir, 'index'))).toEqual(indexBefore)
        const leftovers = (await fs.readdir(snapshotsDir)).filter((f) => f.startsWith('index.'))
        expect(leftovers).toEqual([])
    })

    it('returns no changes when the workspace matches the snapshot', async () => {
        const manager = new SnapshotManager(tempDir)
        await fs.writeFile(path.join(tempDir, 'a.txt'), '1\n', 'utf8')
        const base = await manager.createSnapshot({ turnIndex: 1 })
        expect(await manager.diffSinceSnapshot(base.commitHash)).toEqual([])
    })
})
