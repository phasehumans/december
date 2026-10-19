import { describe, it, expect, beforeEach } from 'bun:test'

import { Agent } from '../../src/agent'
import { SubagentManager } from '../../src/subagent/subagent-manager'

import type { LLMProvider } from '@december/providers'
import type { Tool } from '@december/shared'

describe('SubagentManager (Unit)', () => {
    let manager: SubagentManager

    const dummyTool: Tool = {
        name: 'read_file',
        description: 'Read file',
        inputSchema: {},
        execute: async () => 'sample text',
    }

    beforeEach(() => {
        manager = new SubagentManager()
    })

    it('should spawn subagent in background and report status as running', async () => {
        let resolveStream: () => void = () => {}
        const blocker = new Promise<void>((r) => {
            resolveStream = r
        })

        const mockLlm: LLMProvider = {
            id: 'mock',
            stream: async function* () {
                await blocker
                yield { type: 'text', text: 'Task completed successfully.' }
            },
        }

        const parentAgent = new Agent({
            tools: [dummyTool],
            llm: mockLlm,
            operations: {} as any,
        })

        const handle = manager.spawnBackground({
            role: 'researcher',
            task: 'Explore source code',
            parentAgent,
        })

        expect(handle.id).toBeDefined()
        expect(handle.role).toBe('researcher')
        expect(handle.status).toBe('running')

        const listed = manager.list()
        expect(listed.length).toBe(1)
        expect(listed[0]!.id).toBe(handle.id)

        // Resolve subagent execution
        resolveStream()
        const summary = await handle.promise

        expect(summary.status).toBe('completed')
        expect(handle.status).toBe('completed')
        expect(summary.summary).toContain('Task completed successfully')
    })

    it('should support steering message passing to running subagent', async () => {
        const receivedMessages: string[] = []

        const mockLlm: LLMProvider = {
            id: 'mock',
            stream: async function* (_messages: any[]) {
                receivedMessages.push(_messages[_messages.length - 1]?.content || '')
                yield { type: 'text', text: 'Acknowledged instruction.' }
            },
        }

        const parentAgent = new Agent({
            tools: [dummyTool],
            llm: mockLlm,
            operations: {} as any,
        })

        const handle = manager.spawnBackground({
            role: 'assistant',
            task: 'Initial task',
            parentAgent,
        })

        // Pass message before completion
        const sent = manager.sendMessage(handle.id, 'Steer towards unit testing')
        expect(sent).toBe(true)

        await handle.promise
    })

    it('should support cancelling running subagent with kill()', async () => {
        let resolvePending: () => void = () => {}
        const pendingPromise = new Promise<void>((r) => {
            resolvePending = r
        })

        const mockLlm: LLMProvider = {
            id: 'mock',
            stream: async function* () {
                await pendingPromise
                yield { type: 'text', text: 'Should not reach here' }
            },
        }

        const parentAgent = new Agent({
            tools: [dummyTool],
            llm: mockLlm,
            operations: {} as any,
        })

        const handle = manager.spawnBackground({
            role: 'worker',
            task: 'Long running task',
            parentAgent,
        })

        expect(handle.status).toBe('running')

        const killed = manager.kill(handle.id)
        expect(killed).toBe(true)
        expect(handle.status).toBe('killed')

        resolvePending()
        const summary = await handle.promise
        expect(summary.status).toBe('killed')
    })

    it('should forward events to custom tracker if configured', async () => {
        const outputs: string[] = []
        let completedCode: number | null = null

        const mockTracker = {
            registerSubagentTask: () => ({ id: 'mock-task' }),
            appendOutput: (_id: string, chunk: string) => {
                outputs.push(chunk)
            },
            markCompleted: (_id: string, code: number) => {
                completedCode = code
            },
        }

        manager.setTracker(mockTracker)

        const mockLlm: LLMProvider = {
            id: 'mock',
            stream: async function* () {
                yield { type: 'text', text: 'Tracker test output' }
            },
        }

        const parentAgent = new Agent({
            tools: [dummyTool],
            llm: mockLlm,
            operations: {} as any,
        })

        const handle = manager.spawnBackground({
            role: 'tracker-role',
            task: 'Verify tracking',
            parentAgent,
        })

        await handle.promise
        expect(completedCode).toBe(0)
        expect(outputs.length).toBeGreaterThan(0)
    })
})
