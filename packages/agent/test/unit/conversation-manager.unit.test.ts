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

    test('truncateToTurn removes conversation messages from target turn onwards', () => {
        const manager = new ConversationManager()
        manager.addMessage({ role: 'system', content: 'system prompt' })
        manager.addMessage({ role: 'user', content: 'turn 1 prompt' })
        manager.addMessage({ role: 'assistant', content: 'turn 1 answer' })
        manager.addMessage({ role: 'user', content: 'turn 2 prompt' })
        manager.addMessage({ role: 'assistant', content: 'turn 2 answer' })
        manager.addMessage({ role: 'user', content: 'turn 3 prompt' })
        manager.addMessage({ role: 'assistant', content: 'turn 3 answer' })

        expect(manager.messages.length).toBe(7)

        // Truncate to turn 2 (removes turn 2 and turn 3)
        manager.truncateToTurn(2)

        expect(manager.messages.length).toBe(3)
        expect(manager.messages[0]!.role).toBe('system')
        expect(manager.messages[1]!.content).toBe('turn 1 prompt')
        expect(manager.messages[2]!.content).toBe('turn 1 answer')
    })

    test('truncateToTurn to turn 1 leaves only system prompt', () => {
        const manager = new ConversationManager()
        manager.addMessage({ role: 'system', content: 'system prompt' })
        manager.addMessage({ role: 'user', content: 'turn 1 prompt' })
        manager.addMessage({ role: 'assistant', content: 'turn 1 answer' })

        manager.truncateToTurn(1)
        expect(manager.messages.length).toBe(1)
        expect(manager.messages[0]!.role).toBe('system')
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

        test('enforces strict 2KB ceiling on injected workspace memory exceeding 2048 bytes', () => {
            const decDir = path.join(tmpDir, '.december')
            fs.mkdirSync(decDir, { recursive: true })
            const oversizedMemory = 'x'.repeat(5000)
            fs.writeFileSync(path.join(decDir, 'memory.md'), oversizedMemory)

            const manager = new ConversationManager([], {
                workspaceRoot: tmpDir,
                systemPrompt: 'Base prompt',
            })

            const prompt = manager.messages[0]!.content
            expect(prompt).toContain('<project_memory>')
            expect(prompt).toContain('[truncated to 2KB budget]')

            const memoryMatch = prompt.match(/<project_memory>([\s\S]*?)<\/project_memory>/)
            expect(memoryMatch).toBeDefined()
            const injectedMemory = memoryMatch![1]!.trim()
            expect(Buffer.byteLength(injectedMemory, 'utf8')).toBeLessThanOrEqual(2048)
        })

        test('safely truncates multi-byte UTF-8 characters without split or replacement characters', () => {
            const decDir = path.join(tmpDir, '.december')
            fs.mkdirSync(decDir, { recursive: true })
            const repeatedEmojis = '🚀'.repeat(1000)
            fs.writeFileSync(path.join(decDir, 'memory.md'), repeatedEmojis)

            const manager = new ConversationManager([], {
                workspaceRoot: tmpDir,
                systemPrompt: 'Base prompt',
            })

            const prompt = manager.messages[0]!.content
            expect(prompt).toContain('<project_memory>')
            expect(prompt).toContain('[truncated to 2KB budget]')
            expect(prompt).not.toContain('\uFFFD')

            const memoryMatch = prompt.match(/<project_memory>([\s\S]*?)<\/project_memory>/)
            expect(memoryMatch).toBeDefined()
            const injectedMemory = memoryMatch![1]!.trim()
            expect(Buffer.byteLength(injectedMemory, 'utf8')).toBeLessThanOrEqual(2048)
        })

        test('inherits pinnedRules from Project and injects into memory block', () => {
            const manager = new ConversationManager([], {
                systemPrompt: 'Base prompt',
                pinnedRules:
                    'pinned: strictly lowercase commit messages and adhere to project standards',
            })

            expect(manager.messages.length).toBe(1)
            const prompt = manager.messages[0]!.content
            expect(prompt).toContain('<project_memory>')
            expect(prompt).toContain('strictly lowercase commit messages')
        })

        test('compactIfNeeded triggers when multi-turn session exceeds 15 user turns without exceeding token budget', async () => {
            const manager = new ConversationManager()
            manager.addMessage({ role: 'system', content: 'You are an agent' })
            // Add 16 user-assistant turns with short messages (far below token limit)
            for (let i = 1; i <= 16; i++) {
                manager.addMessage({ role: 'user', content: `Turn ${i} question` })
                manager.addMessage({ role: 'assistant', content: `Turn ${i} answer` })
            }

            expect(manager.messages.length).toBe(33) // 1 system + 32 messages (16 turns)

            const llm = new MockLLM()
            llm.pushResponse('Structured Checkpoint: Completed turns 1 to 8')

            const result = await manager.compactIfNeeded(llm)

            expect(result.compacted).toBe(true)
            expect(result.summary).toContain('Structured Checkpoint')
            expect(manager.messages[1]!.content).toContain('[COMPACTED HISTORY SUMMARY]')
            expect(manager.messages[1]!.content).toContain('Completed turns 1 to 8')
            expect(manager.messages.length).toBeLessThan(33)
        })
    })
})
