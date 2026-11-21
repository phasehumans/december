import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { getSnapshotManager, setSnapshotManager } from '@december/tools'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

import { Agent } from '../../src/agent'
import { MockLLM } from '../mock-provider'

describe('Agent rewind (Unit)', () => {
    let tempDir: string

    beforeEach(async () => {
        tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'december-rewind-test-'))
        setSnapshotManager(null)
    })

    afterEach(async () => {
        setSnapshotManager(null)
        await fs.rm(tempDir, { recursive: true, force: true })
    })

    const createAgent = () =>
        new Agent({
            llm: new MockLLM(),
            tools: [],
            operations: {} as any,
            workspaceDir: tempDir,
            sessionId: 'current',
        })

    test('lists only turns still in the conversation and restores files and messages by id', async () => {
        const file = path.join(tempDir, 'a.txt')
        const snapshots = getSnapshotManager(tempDir)

        // Snapshots from an earlier session in the same workspace
        await fs.writeFile(file, 'old-1', 'utf8')
        await snapshots.createSnapshot({ turnIndex: 1, sessionId: 'old', messageId: 'old-u1' })
        await fs.writeFile(file, 'old-2', 'utf8')
        await snapshots.createSnapshot({ turnIndex: 2, sessionId: 'old', messageId: 'old-u2' })

        // Current conversation: two turns
        const agent = createAgent()
        await fs.writeFile(file, 'before-turn-1', 'utf8')
        agent.messages.push({ role: 'user', content: 'first', id: 'u1' })
        await snapshots.createSnapshot({ turnIndex: 1, sessionId: 'current', messageId: 'u1' })
        agent.messages.push({ role: 'assistant', content: 'answer 1', id: 'a1' })
        await fs.writeFile(file, 'before-turn-2', 'utf8')
        agent.messages.push({ role: 'user', content: 'second', id: 'u2' })
        await snapshots.createSnapshot({ turnIndex: 2, sessionId: 'current', messageId: 'u2' })
        agent.messages.push({ role: 'assistant', content: 'answer 2', id: 'a2' })
        await fs.writeFile(file, 'after-turn-2', 'utf8')

        const rewindable = await agent.getRewindableSnapshots()
        expect(rewindable.map((r) => [r.turnIndex, r.messageId])).toEqual([
            [2, 'u2'],
            [1, 'u1'],
        ])

        await agent.rollbackToSnapshot(rewindable[0]!.id)

        expect(await fs.readFile(file, 'utf8')).toBe('before-turn-2')
        expect(agent.messages.map((m) => m.id)).toEqual([agent.messages[0]!.id, 'u1', 'a1'])
        expect((await agent.getRewindableSnapshots()).map((r) => r.messageId)).toEqual(['u1'])
    })

    test('refuses to rewind a turn that is no longer in the conversation', async () => {
        const file = path.join(tempDir, 'a.txt')
        const snapshots = getSnapshotManager(tempDir)
        await fs.writeFile(file, 'old', 'utf8')
        const stale = await snapshots.createSnapshot({
            turnIndex: 1,
            sessionId: 'old',
            messageId: 'old-u1',
        })
        await fs.writeFile(file, 'current', 'utf8')

        const agent = createAgent()
        await expect(agent.rollbackToSnapshot(stale.id)).rejects.toThrow(
            'no longer in the conversation'
        )
        expect(await fs.readFile(file, 'utf8')).toBe('current')
        expect(snapshots.getSnapshots().length).toBe(1)
    })
})
