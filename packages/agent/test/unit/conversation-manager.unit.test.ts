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

    test('truncateBeforeMessage removes the target message and everything after it', () => {
        const manager = new ConversationManager()
        manager.addMessage({ role: 'system', content: 'system prompt' })
        manager.addMessage({ role: 'user', content: 'turn 1 prompt', id: 'u1' })
        manager.addMessage({ role: 'assistant', content: 'turn 1 answer' })
        manager.addMessage({ role: 'user', content: 'turn 2 prompt', id: 'u2' })
        manager.addMessage({ role: 'assistant', content: 'turn 2 answer' })
        manager.addMessage({ role: 'user', content: 'turn 3 prompt', id: 'u3' })

        expect(manager.truncateBeforeMessage('u2')).toBe(true)

        expect(manager.messages.length).toBe(3)
        expect(manager.messages[0]!.role).toBe('system')
        expect(manager.messages[1]!.content).toBe('turn 1 prompt')
        expect(manager.messages[2]!.content).toBe('turn 1 answer')
    })

    test('truncateBeforeMessage leaves the conversation unchanged for an unknown id', () => {
        const manager = new ConversationManager()
        manager.addMessage({ role: 'system', content: 'system prompt' })
        manager.addMessage({ role: 'user', content: 'turn 1 prompt', id: 'u1' })

        expect(manager.truncateBeforeMessage('missing')).toBe(false)
        expect(manager.messages.length).toBe(2)
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

    describe('Pinned Rules Injection', () => {
        let tmpDir: string

        beforeEach(() => {
            tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'conv-mem-test-'))
        })

        afterEach(() => {
            fs.rmSync(tmpDir, { recursive: true, force: true })
        })

        test('ignores legacy memory and rules files in the workspace root', () => {
            const decDir = path.join(tmpDir, '.december')
            fs.mkdirSync(decDir, { recursive: true })
            fs.writeFileSync(path.join(decDir, 'memory.md'), '## quirks\n- legacy memory entry')
            fs.writeFileSync(path.join(decDir, 'rules.md'), '## conventions\n- legacy rules entry')
            fs.writeFileSync(path.join(tmpDir, 'MEMORY.md'), '- legacy root memory')
            fs.writeFileSync(path.join(tmpDir, 'RULES.md'), '- legacy root rules')

            const manager = new ConversationManager()
            const originalPrompt = 'You are December.'
            const prompt = manager.initSession({
                workspaceRoot: tmpDir,
                systemPrompt: originalPrompt,
            })

            expect(prompt).toBe(originalPrompt)
            expect(prompt).not.toContain('<project_memory>')
        })

        test('handles a workspace without pinned rules gracefully', () => {
            const manager = new ConversationManager()
            const originalPrompt = 'You are a helpful coding agent.'
            const prompt = manager.initSession({
                workspaceRoot: tmpDir,
                systemPrompt: originalPrompt,
            })

            expect(prompt).toBe(originalPrompt)
            expect(manager.messages.length).toBe(1)
            expect(manager.messages[0]!.content).toBe(originalPrompt)
        })

        test('places pinned rules before the dynamic environment section', () => {
            const manager = new ConversationManager()
            const baseWithEnv = `You are December.\n\nCurrent date: 2026-10-03\nCurrent working directory: ${tmpDir}`
            const prompt = manager.initSession({
                workspaceRoot: tmpDir,
                systemPrompt: baseWithEnv,
                pinnedRules: '## architecture\n- monorepo packages',
            })

            expect(prompt).toContain('<project_memory>')
            expect(prompt).toContain('## architecture')
            const memoryIndex = prompt.indexOf('<project_memory>')
            const envIndex = prompt.indexOf('Current date:')
            expect(memoryIndex).toBeLessThan(envIndex)
            expect(prompt.endsWith(`Current working directory: ${tmpDir}`)).toBe(true)
        })

        test('enforces strict 2KB ceiling on injected pinned rules exceeding 2048 bytes', () => {
            const manager = new ConversationManager([], {
                systemPrompt: 'Base prompt',
                pinnedRules: 'x'.repeat(5000),
            })

            const prompt = manager.messages[0]!.content
            expect(prompt).toContain('[truncated to 2KB budget]')

            const memoryMatch = prompt.match(/<project_memory>([\s\S]*?)<\/project_memory>/)
            expect(memoryMatch).toBeDefined()
            const injectedMemory = memoryMatch![1]!.trim()
            expect(Buffer.byteLength(injectedMemory, 'utf8')).toBeLessThanOrEqual(2048)
        })

        test('safely truncates multi-byte UTF-8 characters without split or replacement characters', () => {
            const manager = new ConversationManager([], {
                systemPrompt: 'Base prompt',
                pinnedRules: '🚀'.repeat(1000),
            })

            const prompt = manager.messages[0]!.content
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

        test('compactIfNeeded does not trigger on turn 16 by default when token capacity is below 80%', async () => {
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

            // Default compactIfNeeded does not compact based on turns alone
            const resultDefault = await manager.compactIfNeeded(llm)
            expect(resultDefault.compacted).toBe(false)

            // When explicit maxTurns is provided in options, it triggers compaction
            const resultExplicit = await manager.compactIfNeeded(
                llm,
                undefined,
                undefined,
                undefined,
                {
                    maxTurns: 15,
                }
            )
            expect(resultExplicit.compacted).toBe(true)
            expect(resultExplicit.summary).toContain('Structured Checkpoint')
            expect(manager.messages[1]!.content).toContain('[COMPACTED HISTORY SUMMARY]')
            expect(manager.messages[1]!.content).toContain('Completed turns 1 to 8')
            expect(manager.messages.length).toBeLessThan(33)
        })
    })
})
