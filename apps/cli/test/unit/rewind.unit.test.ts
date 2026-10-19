import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { describe, expect, it, beforeEach, afterEach } from 'bun:test'

import { parseCliArgs } from '../../src/args'
import { handleRewindCommand } from '../../src/commands'

describe('CLI Rewind & Undo System (Unit)', () => {
    it('parses rewind and undo subcommands and options', () => {
        const rewindParsed = parseCliArgs(['rewind', '--turn', '3'])
        expect(rewindParsed.command).toBe('rewind')
        expect(rewindParsed.turn).toBe(3)

        const listParsed = parseCliArgs(['rewind', '--list'])
        expect(listParsed.command).toBe('rewind')
        expect(listParsed.list).toBe(true)

        const undoParsed = parseCliArgs(['undo'])
        expect(undoParsed.command).toBe('undo')
    })

    describe('handleRewindCommand', () => {
        let tempDir: string
        let originalCwd: string

        beforeEach(async () => {
            originalCwd = process.cwd()
            tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'december-cli-rewind-'))
            process.chdir(tempDir)
        })

        afterEach(async () => {
            process.chdir(originalCwd)
            try {
                await fs.rm(tempDir, { recursive: true, force: true })
            } catch {
                // Intentionally swallowed: test cleanup
            }
        })

        it('handles empty snapshot list gracefully', async () => {
            // Should not throw when no snapshots exist
            await handleRewindCommand({ list: true })
            await handleRewindCommand()
        })

        it('lists and rewinds to specific turn in workspace', async () => {
            const { getSnapshotManager } = await import('@december/tools')
            const manager = getSnapshotManager(tempDir)
            await manager.init()

            const testFile = path.join(tempDir, 'test.txt')
            await fs.writeFile(testFile, 'version 1', 'utf8')
            await manager.createSnapshot({ turnIndex: 1, prompt: 'initial turn' })

            await fs.writeFile(testFile, 'version 2', 'utf8')
            await manager.createSnapshot({ turnIndex: 2, prompt: 'second turn' })

            // Break file in turn 3
            await fs.writeFile(testFile, 'broken turn 3', 'utf8')

            // Rewind to turn 1
            await handleRewindCommand({ turn: 1 })

            const content = await fs.readFile(testFile, 'utf8')
            expect(content).toBe('version 1')
        })
    })
})
