import { mkdtemp, rm, writeFile as fsWriteFile, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, test, beforeEach, afterEach } from 'bun:test'

import { ManageMemoryTool } from '../../src/manage_memory'
import { createMockContext } from '../mock-context'

describe('ManageMemoryTool (Unit)', () => {
    let testDir: string
    let context: any

    beforeEach(async () => {
        testDir = await mkdtemp(join(tmpdir(), 'december-tools-mem-test-'))
        context = createMockContext()
        context.operations.env.cwd = () => testDir
        context.operations.fs.readFile = async (p: string) => {
            const fullPath = p.startsWith('/') ? p : join(testDir, p)
            return await Bun.file(fullPath).text()
        }
        context.operations.fs.writeFile = async (p: string, content: string) => {
            const fullPath = p.startsWith('/') ? p : join(testDir, p)
            const dir = fullPath.substring(0, fullPath.lastIndexOf('/'))
            await mkdir(dir, { recursive: true })
            await fsWriteFile(fullPath, content, 'utf-8')
        }
        context.operations.fs.readdir = async (p: string) => {
            const fullPath = p.startsWith('/') ? p : join(testDir, p)
            const { readdir } = await import('node:fs/promises')
            return await readdir(fullPath)
        }
    })

    afterEach(async () => {
        await rm(testDir, { recursive: true, force: true })
    })

    test('has valid metadata and schema', () => {
        expect(ManageMemoryTool.name).toBe('manage_memory')
        expect(ManageMemoryTool.description).toBeDefined()
        expect(ManageMemoryTool.inputSchema).toBeDefined()
    })

    test('record appends structured entries under relevant category headers in .december/memory.md', async () => {
        const result = await ManageMemoryTool.execute(
            {
                action: 'record',
                category: 'build_and_test',
                entry: 'bun test requires DB migrations first',
            },
            context
        )

        expect(result).toContain('Recorded entry under "build_and_test"')

        const memFile = join(testDir, '.december', 'memory.md')
        const content = await Bun.file(memFile).text()
        expect(content).toContain('## build_and_test')
        expect(content).toContain('- bun test requires DB migrations first')
    })

    test('record appends multiple entries under existing category headers without overwriting', async () => {
        await ManageMemoryTool.execute(
            {
                action: 'record',
                category: 'conventions',
                entry: 'always use pino logger',
            },
            context
        )

        await ManageMemoryTool.execute(
            {
                action: 'record',
                category: 'conventions',
                entry: 'never leave empty catch blocks',
            },
            context
        )

        await ManageMemoryTool.execute(
            {
                action: 'record',
                category: 'quirks',
                entry: 'headless browser needs xvfb',
            },
            context
        )

        const memFile = join(testDir, '.december', 'memory.md')
        const content = await Bun.file(memFile).text()
        expect(content).toContain('## conventions')
        expect(content).toContain('- always use pino logger')
        expect(content).toContain('- never leave empty catch blocks')
        expect(content).toContain('## quirks')
        expect(content).toContain('- headless browser needs xvfb')
    })

    test('duplicate entries are detected and ignored', async () => {
        await ManageMemoryTool.execute(
            {
                action: 'record',
                category: 'architecture',
                entry: 'modular monorepo structure',
            },
            context
        )

        const duplicateResult = await ManageMemoryTool.execute(
            {
                action: 'record',
                category: 'architecture',
                entry: 'modular monorepo structure',
            },
            context
        )

        expect(duplicateResult).toContain('Skipped duplicate')

        const memFile = join(testDir, '.december', 'memory.md')
        const content = await Bun.file(memFile).text()
        const occurrences = content.split('modular monorepo structure').length - 1
        expect(occurrences).toBe(1)
    })

    test('records rules into RULES.md when target is rules or category is rules', async () => {
        const result = await ManageMemoryTool.execute(
            {
                action: 'record',
                target: 'rules',
                entry: 'strictly lowercase commit messages only',
            },
            context
        )

        expect(result).toContain('Recorded entry')

        const rulesFile = join(testDir, 'RULES.md')
        const content = await Bun.file(rulesFile).text()
        expect(content).toContain('- strictly lowercase commit messages only')
    })

    test('records memories into MEMORY.md when target is MEMORY.md', async () => {
        const result = await ManageMemoryTool.execute(
            {
                action: 'record',
                target: 'MEMORY.md',
                category: 'conventions',
                entry: 'user prefers dark mode themes',
            },
            context
        )

        expect(result).toContain('Recorded entry')

        const memoryFile = join(testDir, 'MEMORY.md')
        const content = await Bun.file(memoryFile).text()
        expect(content).toContain('## conventions')
        expect(content).toContain('- user prefers dark mode themes')
    })

    test('read action returns all entries, filters by category, or filters by query', async () => {
        await ManageMemoryTool.execute(
            {
                action: 'record',
                category: 'conventions',
                entry: 'use camelCase for variables',
            },
            context
        )
        await ManageMemoryTool.execute(
            {
                action: 'record',
                category: 'build_and_test',
                entry: 'run bun test before push',
            },
            context
        )

        // Read all
        const allResult = await ManageMemoryTool.execute({ action: 'read' }, context)
        expect(allResult).toContain('use camelCase for variables')
        expect(allResult).toContain('run bun test before push')

        // Read by category
        const catResult = await ManageMemoryTool.execute(
            { action: 'read', category: 'conventions' },
            context
        )
        expect(catResult).toContain('use camelCase for variables')
        expect(catResult).not.toContain('run bun test before push')

        // Read by query
        const queryResult = await ManageMemoryTool.execute(
            { action: 'read', query: 'camelcase' },
            context
        )
        expect(queryResult).toContain('use camelCase for variables')
        expect(queryResult).not.toContain('run bun test before push')
    })

    test('forget action removes matching entry from memory', async () => {
        await ManageMemoryTool.execute(
            {
                action: 'record',
                category: 'quirks',
                entry: 'temporary port conflict on 3000',
            },
            context
        )

        const forgetResult = await ManageMemoryTool.execute(
            {
                action: 'forget',
                entry: 'temporary port conflict on 3000',
            },
            context
        )

        expect(forgetResult).toContain('Removed entry from memory')

        const readResult = await ManageMemoryTool.execute({ action: 'read' }, context)
        expect(readResult).not.toContain('temporary port conflict on 3000')
    })

    test('handles missing memory files gracefully when reading', async () => {
        const result = await ManageMemoryTool.execute({ action: 'read' }, context)
        expect(result).toContain('No memory')
    })

    test('returns clear error when required entry is missing for record or forget', async () => {
        const recordResult = await ManageMemoryTool.execute({ action: 'record' }, context)
        expect(recordResult).toContain('Error')

        const forgetResult = await ManageMemoryTool.execute({ action: 'forget' }, context)
        expect(forgetResult).toContain('Error')
    })
})
