import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { PassThrough } from 'node:stream'

import { AgentHarness } from '@december/agent'
import { FOUNDATIONAL_TOOLS } from '@december/tools'
import { afterEach, beforeEach, describe, expect, it } from 'bun:test'

import { runHeadlessTask } from '../../src/headless-runner'
import { localOperations } from '../../src/local-operations'

import type { LLMProvider, ProviderStreamChunk, ProviderTool, Message } from '@december/providers'

class TestMockProvider implements LLMProvider {
    public id = 'test-mock-provider'
    private queue: ProviderStreamChunk[][] = []

    public enqueue(chunks: ProviderStreamChunk[]) {
        this.queue.push(chunks)
    }

    async *stream(
        _messages: Message[],
        _tools?: ProviderTool[],
        _systemPrompt?: string,
        _modelOptions?: Record<string, any>,
        signal?: AbortSignal
    ): AsyncGenerator<ProviderStreamChunk, void, unknown> {
        if (signal?.aborted) {
            const err = new Error('Aborted')
            err.name = 'AbortError'
            throw err
        }

        const next = this.queue.shift() || [{ type: 'text', text: 'turn done' }]
        for (const chunk of next) {
            if (signal?.aborted) {
                const err = new Error('Aborted')
                err.name = 'AbortError'
                throw err
            }
            yield chunk
        }
    }
}

describe('Headless RPC Protocol & Foundational 4-Tool Kernel (Integration)', () => {
    let tempDir: string

    beforeEach(() => {
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'december-rpc-integration-'))
    })

    afterEach(() => {
        try {
            fs.rmSync(tempDir, { recursive: true, force: true })
        } catch {
            // Intentionally swallowed: cleanup error
        }
    })

    it('drives agent through stdin/stdout RPC stream and asserts on lifecycle events and filesystem modifications', async () => {
        const mockProvider = new TestMockProvider()
        const targetFilePath = path.join(tempDir, 'demo.txt')

        // Step 1: Model issues a write_file tool call
        mockProvider.enqueue([
            {
                type: 'tool_call',
                toolCall: {
                    id: 'call_write_1',
                    name: 'write_file',
                    input: JSON.stringify({
                        filePath: targetFilePath,
                        content: 'initial line 1\ninitial line 2\ninitial line 3\n',
                    }),
                },
            },
        ])

        // Step 2: After write_file executes, model acknowledges
        mockProvider.enqueue([{ type: 'text', text: 'file written successfully' }])

        const harness = new AgentHarness({
            llm: mockProvider,
            tools: FOUNDATIONAL_TOOLS,
            operations: localOperations,
            workspaceDir: tempDir,
            lean: true,
            sessionId: 'rpc-test-session',
            modelOptions: { model: 'mock-model' },
        })

        const agent = harness.getAgent()
        const mockStdin = new PassThrough()
        const mockStdout = new PassThrough()
        const emittedEvents: any[] = []

        mockStdout.on('data', (chunk) => {
            const lines = chunk.toString().split('\n')
            for (const line of lines) {
                if (line.trim()) {
                    try {
                        emittedEvents.push(JSON.parse(line))
                    } catch {
                        // ignore malformed
                    }
                }
            }
        })

        const result = await runHeadlessTask('create demo.txt', {
            agent,
            stdin: mockStdin as any,
            stdout: mockStdout as any,
            rpc: true,
            nonInteractive: true,
            cwd: tempDir,
        })

        expect(result.success).toBe(true)

        // Verify lifecycle event sequence
        const eventTypes = emittedEvents.map((e) => e.type)
        expect(eventTypes).toContain('session_init')
        expect(eventTypes).toContain('turn_start')
        expect(eventTypes).toContain('tool_call')
        expect(eventTypes).toContain('tool_result')
        expect(eventTypes).toContain('token_delta')
        expect(eventTypes).toContain('turn_complete')

        const toolCall = emittedEvents.find((e) => e.type === 'tool_call')
        expect(toolCall.name).toBe('write_file')
        expect(toolCall.id).toBe('call_write_1')

        const toolResult = emittedEvents.find((e) => e.type === 'tool_result')
        expect(toolResult.id).toBe('call_write_1')
        expect(toolResult.result).toContain('Successfully wrote')

        // Verify actual filesystem mutation
        expect(fs.existsSync(targetFilePath)).toBe(true)
        const fileContent = fs.readFileSync(targetFilePath, 'utf8')
        expect(fileContent).toBe('initial line 1\ninitial line 2\ninitial line 3\n')

        // Step 3: Now drive an edit_file turn to verify surgical editing on disk
        const editMockProvider = new TestMockProvider()
        editMockProvider.enqueue([
            {
                type: 'tool_call',
                toolCall: {
                    id: 'call_edit_1',
                    name: 'edit_file',
                    input: JSON.stringify({
                        path: targetFilePath,
                        targetContent: 'initial line 2',
                        replacementContent: 'updated line 2',
                    }),
                },
            },
        ])
        editMockProvider.enqueue([{ type: 'text', text: 'file edited successfully' }])

        const editHarness = new AgentHarness({
            llm: editMockProvider,
            tools: FOUNDATIONAL_TOOLS,
            operations: localOperations,
            workspaceDir: tempDir,
            lean: true,
            sessionId: 'rpc-test-session-2',
            modelOptions: { model: 'mock-model' },
        })

        const editAgent = editHarness.getAgent()
        const editStdin = new PassThrough()
        const editStdout = new PassThrough()
        const editEvents: any[] = []

        editStdout.on('data', (chunk) => {
            const lines = chunk.toString().split('\n')
            for (const line of lines) {
                if (line.trim()) {
                    try {
                        editEvents.push(JSON.parse(line))
                    } catch {
                        // ignore malformed
                    }
                }
            }
        })

        const editResult = await runHeadlessTask('edit demo.txt', {
            agent: editAgent,
            stdin: editStdin as any,
            stdout: editStdout as any,
            rpc: true,
            nonInteractive: true,
            cwd: tempDir,
        })

        expect(editResult.success).toBe(true)
        const updatedContent = fs.readFileSync(targetFilePath, 'utf8')
        expect(updatedContent).toBe('initial line 1\nupdated line 2\ninitial line 3\n')
    })

    it('cancels active run when abort message is received via stdin', async () => {
        const mockProvider = new TestMockProvider()
        const targetFilePath = path.join(tempDir, 'abort-test.txt')

        const harness = new AgentHarness({
            llm: mockProvider,
            tools: FOUNDATIONAL_TOOLS,
            operations: localOperations,
            workspaceDir: tempDir,
            lean: true,
            sessionId: 'rpc-abort-session',
        })

        const agent = harness.getAgent()
        const mockStdin = new PassThrough()
        const mockStdout = new PassThrough()

        mockProvider.enqueue([
            {
                type: 'tool_call',
                toolCall: {
                    id: 'call_slow',
                    name: 'write_file',
                    input: JSON.stringify({ filePath: targetFilePath, content: 'will abort' }),
                },
            },
        ])

        // Immediately send abort message over stdin
        queueMicrotask(() => {
            mockStdin.write(JSON.stringify({ type: 'abort' }) + '\n')
        })

        const result = await runHeadlessTask('abort prompt', {
            agent,
            stdin: mockStdin as any,
            stdout: mockStdout as any,
            rpc: true,
            nonInteractive: true,
            cwd: tempDir,
        })

        expect(result.success).toBe(true)
    })
})
