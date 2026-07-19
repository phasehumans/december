import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'

import { expect, test, describe, beforeEach, afterEach, spyOn, mock } from 'bun:test'

import { FileSessionRepository } from '../src/file-session-repository'
import { AgentMessage } from '@december/shared'

describe('FileSessionRepository', () => {
    let mockReadFile: any
    let mockWriteFile: any
    let mockAppendFile: any
    let mockMkdir: any
    let mockReaddir: any
    let mockStat: any
    let mockUnlink: any
    let mockRename: any

    const sessionDir = path.join(os.homedir(), '.config', 'december', 'sessions')

    beforeEach(() => {
        mockReadFile = spyOn(fs, 'readFile')
        mockWriteFile = spyOn(fs, 'writeFile').mockResolvedValue(undefined as any)
        mockAppendFile = spyOn(fs, 'appendFile').mockResolvedValue(undefined as any)
        mockMkdir = spyOn(fs, 'mkdir').mockResolvedValue(undefined as any)
        mockReaddir = spyOn(fs, 'readdir')
        mockStat = spyOn(fs, 'stat')
        mockUnlink = spyOn(fs, 'unlink').mockResolvedValue(undefined as any)
        mockRename = spyOn(fs, 'rename').mockResolvedValue(undefined as any)
    })

    afterEach(() => {
        mock.restore()
    })

    describe('saveContext', () => {
        test('saves context and appends only new messages', async () => {
            const repo = new FileSessionRepository()

            // Mock empty file on first read
            mockReadFile.mockRejectedValueOnce(new Error('ENOENT'))

            const msgs: AgentMessage[] = [
                { id: '1', role: 'user', content: 'hello' } as any,
                { id: '2', role: 'assistant', content: 'hi' } as any,
            ]

            await repo.saveContext('session-1', msgs)

            expect(mockMkdir).toHaveBeenCalled()
            expect(mockAppendFile).toHaveBeenCalled()

            const appendCall = mockAppendFile.mock.calls[0]
            expect(appendCall[0]).toContain(path.join(sessionDir, 'session-1.jsonl'))
            expect(appendCall[1]).toContain('hello')
            expect(appendCall[1]).toContain('hi')

            // Now append again with same messages plus one new
            mockAppendFile.mockClear()

            const msgs2: AgentMessage[] = [
                ...msgs,
                { id: '3', role: 'user', content: 'how are you?' } as any,
            ]

            await repo.saveContext('session-1', msgs2)

            const appendCall2 = mockAppendFile.mock.calls[0]
            expect(appendCall2[1]).not.toContain('hello')
            expect(appendCall2[1]).toContain('how are you?')
        })
    })

    describe('loadContext', () => {
        test('loads and reconstructs branches correctly', async () => {
            const repo = new FileSessionRepository()

            // Setup a branching scenario
            // 1 -> 2 -> 3a
            //        -> 3b
            const fileContent = [
                JSON.stringify({ id: '1', role: 'user', timestamp: 100 }),
                JSON.stringify({ id: '2', role: 'assistant', parentId: '1', timestamp: 110 }),
                JSON.stringify({ id: '3a', role: 'user', parentId: '2', timestamp: 120 }),
                JSON.stringify({ id: '3b', role: 'user', parentId: '2', timestamp: 130 }), // Later timestamp
            ].join('\n')

            mockReadFile.mockResolvedValueOnce(fileContent)

            const msgs = await repo.loadContext('session-1')

            // Should pick 3b as latest, then walk back to 2, then 1.
            expect(msgs.length).toBe(3)
            expect(msgs[0].id).toBe('1')
            expect(msgs[1].id).toBe('2')
            expect(msgs[2].id).toBe('3b')
        })

        test('returns empty array on error', async () => {
            const repo = new FileSessionRepository()
            mockReadFile.mockRejectedValueOnce(new Error('ENOENT'))
            const msgs = await repo.loadContext('session-no')
            expect(msgs).toEqual([])
        })

        test('compacts file if there are duplicate ids (like token deltas)', async () => {
            const repo = new FileSessionRepository()
            const fileContent = [
                JSON.stringify({ id: '1', role: 'assistant', content: 'h' }),
                JSON.stringify({ id: '1', role: 'assistant', content: 'he' }),
                JSON.stringify({ id: '1', role: 'assistant', content: 'hel' }),
            ].join('\n')

            mockReadFile.mockResolvedValueOnce(fileContent)

            const msgs = await repo.loadContext('session-comp')

            expect(msgs.length).toBe(1)
            expect(msgs[0].content).toBe('hel')
            expect(mockWriteFile).toHaveBeenCalled()
        })
    })

    describe('listSessions', () => {
        test('lists sessions and gets preview and counts', async () => {
            const repo = new FileSessionRepository()

            mockReaddir.mockResolvedValueOnce(['sess-1.jsonl', 'sess-2.jsonl', 'not-json.txt'])
            mockStat.mockImplementation(async (p: string) => {
                if (p.includes('sess-1')) return { mtime: new Date(1000) }
                if (p.includes('sess-2')) return { mtime: new Date(2000) }
                throw new Error('NO')
            })
            mockReadFile.mockImplementation(async (p: string) => {
                if (p.includes('sess-1')) {
                    return (
                        JSON.stringify({ role: 'system', content: 'sys' }) +
                        '\n' +
                        JSON.stringify({ role: 'user', content: 'hello user 1' })
                    )
                }
                if (p.includes('sess-2')) {
                    return JSON.stringify({ role: 'user', content: 'hello user 2' })
                }
                return ''
            })

            const sessions = await repo.listSessions()

            expect(sessions.length).toBe(2)
            // sorted by mtime descending, so sess-2 should be first
            expect(sessions[0].id).toBe('sess-2')
            expect(sessions[0].preview).toBe('hello user 2')
            expect(sessions[0].messageCount).toBe(1)

            expect(sessions[1].id).toBe('sess-1')
            expect(sessions[1].preview).toBe('hello user 1')
            expect(sessions[1].messageCount).toBe(2)
        })

        test('returns empty array on error', async () => {
            const repo = new FileSessionRepository()
            mockReaddir.mockRejectedValueOnce(new Error('ENOENT'))
            const sessions = await repo.listSessions()
            expect(sessions).toEqual([])
        })
    })

    describe('deleteSession', () => {
        test('deletes correct file', async () => {
            const repo = new FileSessionRepository()
            await repo.deleteSession('sess-1')
            expect(mockUnlink).toHaveBeenCalled()
            const call = mockUnlink.mock.calls[0]
            expect(call[0]).toContain('sess-1.jsonl')
        })

        test('ignores error if file does not exist', async () => {
            const repo = new FileSessionRepository()
            mockUnlink.mockRejectedValueOnce(new Error('ENOENT'))
            // Should not throw
            await repo.deleteSession('sess-1')
        })
    })

    describe('renameSession', () => {
        test('renames file correctly', async () => {
            const repo = new FileSessionRepository()
            await repo.renameSession('old-1', 'new-1')
            expect(mockRename).toHaveBeenCalled()
            const call = mockRename.mock.calls[0]
            expect(call[0]).toContain('old-1.jsonl')
            expect(call[1]).toContain('new-1.jsonl')
        })
    })
})
