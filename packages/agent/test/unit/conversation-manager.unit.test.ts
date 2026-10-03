import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { describe, test, expect, beforeEach, afterEach } from 'bun:test'

import { ConversationManager } from '../../src/conversation-manager'
import { MockLLM } from '../mock-provider'

describe('ConversationManager (Unit)', () => {
    test('initializes with empty messages by default', () => {
        const manager = new ConversationManager()
        expect(manager.messages).toEqual([])
    })

    test('initializes with provided messages', () => {
        const manager = new ConversationManager([{ role: 'user', content: 'hello', id: '1' }])
        expect(manager.messages.length).toBe(1)
        expect(manager.messages[0]!.content).toBe('hello')
    })

    test('supports setting messages array directly via setter', () => {
        const manager = new ConversationManager()
        const newMsgs = [{ role: 'system', content: 'system' }] as any
        manager.messages = newMsgs
        expect(manager.messages).toEqual(newMsgs)
    })

    test('addMessage assigns ID and parentId automatically', () => {
        const manager = new ConversationManager()
        manager.addMessage({ role: 'user', content: 'first' })
        const firstMsg = manager.messages[0]!
        expect(firstMsg.id).toBeDefined()
        expect(firstMsg.parentId).toBeUndefined()
        expect(firstMsg.timestamp).toBeDefined()

        manager.addMessage({ role: 'assistant', content: 'second' })
        const secondMsg = manager.messages[1]!
        expect(secondMsg.id).toBeDefined()
        expect(secondMsg.parentId).toBe(firstMsg.id)
    })

    test('addMessage uses provided ID and parentId if given', () => {
        const manager = new ConversationManager()
        manager.addMessage({ role: 'user', content: 'first', id: 'custom-1', parentId: 'parent-0' })
        const firstMsg = manager.messages[0]!
        expect(firstMsg.id).toBe('custom-1')
        expect(firstMsg.parentId).toBe('parent-0')
    })

    test('compactIfNeeded delegates to compaction utility and returns summary', async () => {
        const manager = new ConversationManager()
        manager.addMessage({ role: 'system', content: 'system' })
        for (let i = 0; i < 25; i++) {
            manager.addMessage({ role: 'user', content: 'a'.repeat(100) })
        }

        const llm = new MockLLM()
        llm.pushResponse('Compacted Summary Text')
        const result = await manager.compactIfNeeded(llm, 10)

        expect(result.compacted).toBe(true)
        expect(result.summary).toBe('[COMPACTED HISTORY SUMMARY]\nCompacted Summary Text')
        expect(manager.messages.length).toBe(22)
    })

    test('compactIfNeeded does nothing if below limit', async () => {
        const manager = new ConversationManager()
        manager.addMessage({ role: 'system', content: 'system' })
        manager.addMessage({ role: 'user', content: 'short' })

        const llm = new MockLLM()
        const result = await manager.compactIfNeeded(llm, 1000)

        expect(result.compacted).toBe(false)
        expect(manager.messages.length).toBe(2)
    })

    test('compactIfNeeded prunes tool results in Tier 1', async () => {
        const manager = new ConversationManager()
        manager.addMessage({ role: 'system', content: 'system' })
        // Add user 1 and a massive tool result
        manager.addMessage({ role: 'user', content: 'user 1' })
        manager.addMessage({
            role: 'assistant',
            content: '',
            toolCalls: [{ id: 'tc-old', name: 'read_file', input: '{"path":"big.ts"}' }],
        })
        manager.addMessage({
            role: 'tool',
            toolCallId: 'tc-old',
            content: 'z'.repeat(250_000), // ~62,500 tokens
        })
        // Turn 2
        manager.addMessage({ role: 'user', content: 'user 2' })
        manager.addMessage({ role: 'assistant', content: 'ack 2' })
        // Turn 3
        manager.addMessage({ role: 'user', content: 'user 3' })
        manager.addMessage({ role: 'assistant', content: 'ack 3' })

        const llm = new MockLLM()
        // Large maxTokens so Tier 2 does not trigger, but Tier 1 prunes
        const result = await manager.compactIfNeeded(llm, 1_000_000)

        expect(result.compacted).toBe(true)
        expect(result.pruned).toBe(true)
        expect(result.tokensSaved).toBeGreaterThan(15000)
        expect(manager.messages[3]!.content).toBe('[Old tool result content cleared]')
        expect(llm.calls.length).toBe(0)
    })

    describe('Passive Workspace Memory Ingestion', () => {
        let tmpDir: string

        beforeEach(() => {
            tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'conv-mem-test-'))
        })

        afterEach(() => {
            fs.rmSync(tmpDir, { recursive: true, force: true })
        })

        test('checks for .december/memory.md in workspace root and injects under <project_memory>', () => {
            const decDir = path.join(tmpDir, '.december')
            fs.mkdirSync(decDir, { recursive: true })
            fs.writeFileSync(
                path.join(decDir, 'memory.md'),
                '## quirks\n- bun test requires DB migrations first'
            )

            const manager = new ConversationManager()
            const prompt = manager.initSession({
                workspaceRoot: tmpDir,
                systemPrompt: 'You are December.',
            })

            expect(prompt).toContain('<project_memory>')
            expect(prompt).toContain('## quirks')
            expect(prompt).toContain('- bun test requires DB migrations first')
            expect(prompt).toContain('</project_memory>')
            expect(manager.messages.length).toBe(1)
            expect(manager.messages[0]!.content).toBe(prompt)
        })

        test('falls back to .december/rules.md when memory.md is missing', () => {
            const decDir = path.join(tmpDir, '.december')
            fs.mkdirSync(decDir, { recursive: true })
            fs.writeFileSync(
                path.join(decDir, 'rules.md'),
                '## conventions\n- lowercase commit messages only'
            )

            const manager = new ConversationManager()
            const prompt = manager.initSession({
                workspaceRoot: tmpDir,
                systemPrompt: 'You are December.',
            })

            expect(prompt).toContain('<project_memory>')
            expect(prompt).toContain('## conventions')
            expect(prompt).toContain('- lowercase commit messages only')
            expect(prompt).toContain('</project_memory>')
        })

        test('supports MEMORY.md and RULES.md in workspace root, combining both when present', () => {
            fs.writeFileSync(
                path.join(tmpDir, 'MEMORY.md'),
                '## build_and_test\n- test with bun test packages/tools'
            )
            fs.writeFileSync(path.join(tmpDir, 'RULES.md'), '## rules\n- do not use em dashes')

            const manager = new ConversationManager()
            const prompt = manager.initSession({
                workspaceRoot: tmpDir,
                systemPrompt: 'Base system prompt.',
            })

            expect(prompt).toContain('<project_memory>')
            expect(prompt).toContain('test with bun test packages/tools')
            expect(prompt).toContain('do not use em dashes')
            expect(prompt).toContain('</project_memory>')
        })

        test('handles missing memory and rules files gracefully without errors or warnings', () => {
            const manager = new ConversationManager()
            const originalPrompt = 'You are a helpful coding agent.'
            const prompt = manager.initSession({
                workspaceRoot: tmpDir,
                systemPrompt: originalPrompt,
            })

            expect(prompt).toBe(originalPrompt)
            expect(prompt).not.toContain('<project_memory>')
            expect(manager.messages.length).toBe(1)
            expect(manager.messages[0]!.content).toBe(originalPrompt)
        })

        test('preserves dynamic environment section at the end of system prompt', () => {
            const decDir = path.join(tmpDir, '.december')
            fs.mkdirSync(decDir, { recursive: true })
            fs.writeFileSync(path.join(decDir, 'memory.md'), '## architecture\n- monorepo packages')

            const manager = new ConversationManager()
            const baseWithEnv = `You are December.\n\nCurrent date: 2026-10-03\nCurrent working directory: ${tmpDir}`
            const prompt = manager.initSession({
                workspaceRoot: tmpDir,
                systemPrompt: baseWithEnv,
            })

            expect(prompt).toContain('<project_memory>')
            expect(prompt).toContain('## architecture')
            // project_memory should come before Current date:
            const memoryIndex = prompt.indexOf('<project_memory>')
            const envIndex = prompt.indexOf('Current date:')
            expect(memoryIndex).toBeLessThan(envIndex)
            expect(prompt.endsWith(`Current working directory: ${tmpDir}`)).toBe(true)
        })

        test('supports constructor options with workspaceRoot', () => {
            const decDir = path.join(tmpDir, '.december')
            fs.mkdirSync(decDir, { recursive: true })
            fs.writeFileSync(path.join(decDir, 'memory.md'), '## conventions\n- always use bun')

            const manager = new ConversationManager([], {
                workspaceRoot: tmpDir,
                systemPrompt: 'Init via constructor',
            })

            expect(manager.messages.length).toBe(1)
            expect(manager.messages[0]!.content).toContain('<project_memory>')
            expect(manager.messages[0]!.content).toContain('always use bun')
        })
    })
})
