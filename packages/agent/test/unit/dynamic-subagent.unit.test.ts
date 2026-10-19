import { describe, it, expect } from 'bun:test'

import { Agent } from '../../src/agent'
import { executeDynamicSubagent, resolveScopedTools } from '../../src/subagent/dynamic-subagent'

import type { LLMProvider } from '@december/providers'
import type { Tool } from '@december/shared'

describe('DynamicSubagent (Unit)', () => {
    const readFileTool: Tool = {
        name: 'read_file',
        description: 'Read file',
        inputSchema: {},
        execute: async () => 'file content sample',
    }

    const bashTool: Tool = {
        name: 'bash',
        description: 'Run bash',
        inputSchema: {},
        execute: async () => 'command output',
    }

    const writeFileTool: Tool = {
        name: 'write_file',
        description: 'Write file',
        inputSchema: {},
        execute: async () => 'file written',
    }

    const grepTool: Tool = {
        name: 'grep',
        description: 'Grep search',
        inputSchema: {},
        execute: async () => 'grep match',
    }

    describe('resolveScopedTools', () => {
        const allTools = [readFileTool, bashTool, writeFileTool, grepTool]

        it('should filter tools by explicit whitelist', () => {
            const scoped = resolveScopedTools(allTools, 'custom-role', ['read_file', 'grep'])
            expect(scoped.map((t) => t.name)).toEqual(['read_file', 'grep'])
        })

        it('should default researcher role to read-only tools', () => {
            const scoped = resolveScopedTools(allTools, 'researcher')
            const names = scoped.map((t) => t.name)
            expect(names).toContain('read_file')
            expect(names).toContain('grep')
            expect(names).not.toContain('write_file')
            expect(names).not.toContain('bash')
        })

        it('should exclude recursive subagent tools at maxDepth', () => {
            const recursiveTool: Tool = {
                name: 'invoke_subagent',
                description: 'Spawn subagent',
                inputSchema: {},
                execute: async () => '',
            }
            const scoped = resolveScopedTools(
                [...allTools, recursiveTool],
                'general',
                undefined,
                5,
                5
            )
            expect(scoped.map((t) => t.name)).not.toContain('invoke_subagent')
        })
    })

    describe('executeDynamicSubagent', () => {
        it('should execute subagent and return structured rollup summary without polluting parent agent', async () => {
            let turn = 0
            const mockLlm: LLMProvider = {
                id: 'mock',
                stream: async function* () {
                    turn++
                    if (turn === 1) {
                        yield {
                            type: 'tool_call',
                            toolCall: {
                                id: 'call_1',
                                name: 'read_file',
                                input: JSON.stringify({ path: 'README.md' }),
                            },
                        }
                    } else {
                        yield {
                            type: 'text',
                            text: 'Found core architecture documentation: December uses modular micro-kernel design.',
                        }
                    }
                },
            }

            const parentAgent = new Agent({
                tools: [readFileTool, bashTool, writeFileTool],
                llm: mockLlm,
                operations: {} as any,
                workspaceDir: '/test/workspace',
            })

            const result = await executeDynamicSubagent({
                role: 'researcher',
                task: 'Analyze the system architecture from documentation',
                parentAgent,
            })

            expect(result.status).toBe('completed')
            expect(result.role).toBe('researcher')
            expect(result.task).toBe('Analyze the system architecture from documentation')
            expect(result.totalTurns).toBe(2)
            expect(result.toolCallsCount).toBe(1)
            expect(result.summary).toContain('Found core architecture documentation')
            expect(result.formattedReport).toContain('SubAgent: researcher')
            expect(result.formattedReport).toContain('Found core architecture documentation')

            // Crucial: Parent agent context must remain clean (isolated context)
            expect(parentAgent.messages.length).toBe(1)
        })

        it('should handle subagent execution error gracefully', async () => {
            const failingLlm: LLMProvider = {
                id: 'mock-fail',
                stream: async function* () {
                    yield { type: 'thinking_delta', text: 'starting...' }
                    throw new Error('Invalid authentication token')
                },
            }

            const parentAgent = new Agent({
                tools: [readFileTool],
                llm: failingLlm,
                operations: {} as any,
            })

            const result = await executeDynamicSubagent({
                role: 'debugger',
                task: 'Diagnose issue',
                parentAgent,
            })

            expect(result.status).toBe('failed')
            expect(result.error).toContain('Invalid authentication token')
            expect(result.formattedReport).toContain('FAILED')
        })

        it('should support abortion via AbortSignal', async () => {
            const abortController = new AbortController()

            const slowLlm: LLMProvider = {
                id: 'mock-slow',
                stream: async function* () {
                    yield { type: 'thinking_delta', text: 'starting...' }
                    abortController.abort()
                    const err = new Error('The operation was aborted')
                    err.name = 'AbortError'
                    throw err
                },
            }

            const parentAgent = new Agent({
                tools: [readFileTool],
                llm: slowLlm,
                operations: {} as any,
            })

            const result = await executeDynamicSubagent({
                role: 'tester',
                task: 'Run test suite',
                parentAgent,
                signal: abortController.signal,
            })

            expect(result.status).toBe('killed')
            expect(result.formattedReport).toContain('CANCELLED')
        })
    })
})
