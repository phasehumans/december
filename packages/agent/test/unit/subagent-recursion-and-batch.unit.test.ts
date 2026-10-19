import { describe, it, expect, beforeEach } from 'bun:test'

import { Agent } from '../../src/agent'
import { executeDynamicSubagent, resolveScopedTools } from '../../src/subagent/dynamic-subagent'
import { SubagentManager } from '../../src/subagent/subagent-manager'
import { createInvokeSubagentTool } from '../../src/subagent/subagent-tool'

import type { LLMProvider } from '@december/providers'
import type { Tool } from '@december/shared'

describe('Subagent Recursion, Model Override & Batch (Unit)', () => {
    let manager: SubagentManager

    const dummyTool: Tool = {
        name: 'read_file',
        description: 'Read file',
        inputSchema: {},
        execute: async () => 'content',
    }

    beforeEach(() => {
        manager = new SubagentManager()
    })

    describe('Recursion Depth Tracking & Max Depth 5', () => {
        it('tracks depth hierarchically from parent to child', async () => {
            const mockLlm: LLMProvider = {
                id: 'mock',
                stream: async function* () {
                    yield { type: 'text', text: 'Depth task completed.' }
                },
            }

            const rootAgent = new Agent({
                tools: [dummyTool],
                llm: mockLlm,
                operations: {} as any,
                depth: 0,
                maxDepth: 5,
            })

            const result1 = await executeDynamicSubagent({
                role: 'lead-researcher',
                task: 'Explore architecture',
                parentAgent: rootAgent,
            })

            expect(result1.depth).toBe(1)
            expect(result1.status).toBe('completed')
        })

        it('rejects spawning when depth >= maxDepth', async () => {
            const mockLlm: LLMProvider = {
                id: 'mock',
                stream: async function* () {
                    yield { type: 'text', text: 'Done' }
                },
            }

            const deepAgent = new Agent({
                tools: [dummyTool],
                llm: mockLlm,
                operations: {} as any,
                depth: 5,
                maxDepth: 5,
            })

            const result = await executeDynamicSubagent({
                role: 'nested-agent',
                task: 'Exceed max depth',
                parentAgent: deepAgent,
            })

            expect(result.status).toBe('failed')
            expect(result.error).toContain('Maximum delegation depth (5) reached')
        })

        it('permits invoke_subagent tool only when depth < maxDepth', () => {
            const invokeTool = createInvokeSubagentTool(manager)
            const allTools = [dummyTool, invokeTool]

            // Depth 1: still allowed to delegate (depth < 5)
            const toolsAtDepth1 = resolveScopedTools(allTools, 'architect', undefined, 1, 5)
            expect(toolsAtDepth1.map((t) => t.name)).toContain('invoke_subagent')

            // Depth 4: still allowed to delegate (depth < 5)
            const toolsAtDepth4 = resolveScopedTools(allTools, 'sub-architect', undefined, 4, 5)
            expect(toolsAtDepth4.map((t) => t.name)).toContain('invoke_subagent')

            // Depth 5: leaf agent, must NOT have invoke_subagent
            const toolsAtDepth5 = resolveScopedTools(allTools, 'leaf-worker', undefined, 5, 5)
            expect(toolsAtDepth5.map((t) => t.name)).not.toContain('invoke_subagent')
        })
    })

    describe('Model Override Routing', () => {
        it('applies overridden model to child agent modelOptions', async () => {
            const mockLlm: LLMProvider = {
                id: 'mock',
                stream: async function* () {
                    yield { type: 'text', text: 'Ran with overridden model' }
                },
            }

            const parentAgent = new Agent({
                tools: [dummyTool],
                llm: mockLlm,
                operations: {} as any,
                modelOptions: { model: 'claude-3-7-sonnet' },
            })

            const result = await executeDynamicSubagent({
                role: 'fast-indexer',
                task: 'Scan symbols',
                model: 'gemini-3.6-flash',
                parentAgent,
            })

            expect(result.model).toBe('gemini-3.6-flash')
            expect(result.formattedReport).toContain('gemini-3.6-flash')
        })
    })

    describe('Turn Budget & Timeout Protection', () => {
        it('enforces maxTurns budget on subagent loop', async () => {
            let turnCount = 0
            const infiniteLlm: LLMProvider = {
                id: 'mock-infinite',
                stream: async function* () {
                    turnCount++
                    yield {
                        type: 'tool_call',
                        toolCall: {
                            id: `call_${turnCount}`,
                            name: 'read_file',
                            input: JSON.stringify({}),
                        },
                    }
                },
            }

            const parentAgent = new Agent({
                tools: [dummyTool],
                llm: infiniteLlm,
                operations: {} as any,
            })

            const result = await executeDynamicSubagent({
                role: 'tester',
                task: 'Run infinite turns',
                maxTurns: 3,
                parentAgent,
            })

            expect(result.totalTurns).toBeLessThanOrEqual(3)
            expect(result.status).toBe('completed')
        })

        it('enforces timeoutMs limit on slow subagent execution', async () => {
            let resolveBlocker: () => void = () => {}
            const blocker = new Promise<void>((r) => {
                resolveBlocker = r
            })

            const hangingLlm: LLMProvider = {
                id: 'mock-hang',
                stream: async function* () {
                    await blocker
                    yield { type: 'text', text: 'Finished' }
                },
            }

            const parentAgent = new Agent({
                tools: [dummyTool],
                llm: hangingLlm,
                operations: {} as any,
            })

            const result = await executeDynamicSubagent({
                role: 'slow-worker',
                task: 'Hanging task',
                timeoutMs: 50,
                parentAgent,
            })

            expect(result.status).toBe('killed')
            expect(result.error).toContain('timed out')

            resolveBlocker()
        })
    })

    describe('Batch Multi-Agent Parallel Delegation', () => {
        it('executes batch subagents concurrently and returns combined rollup report', async () => {
            const mockLlm: LLMProvider = {
                id: 'mock',
                stream: async function* () {
                    yield { type: 'text', text: 'Subagent completed.' }
                },
            }

            const parentAgent = new Agent({
                tools: [dummyTool],
                llm: mockLlm,
                operations: {} as any,
            })

            const invokeTool = createInvokeSubagentTool(manager)
            const context = {
                operations: {} as any,
                env: new Map(),
                onStream: () => {},
                agent: parentAgent,
            }

            const result = await invokeTool.execute(
                {
                    subagents: [
                        { role: 'researcher', task: 'Investigate API' },
                        { role: 'tester', task: 'Check test coverage' },
                    ],
                },
                context
            )

            expect(result).toContain('Batch Subagents Execution (2 tasks)')
            expect(result).toContain('SubAgent: researcher')
            expect(result).toContain('SubAgent: tester')
        })
    })

    describe('Cascading Cancellation', () => {
        it('cascades parent abort signal to child subagents', async () => {
            const parentAbort = new AbortController()

            let resolveHang: () => void = () => {}
            const hang = new Promise<void>((r) => {
                resolveHang = r
            })

            const hangingLlm: LLMProvider = {
                id: 'mock',
                stream: async function* () {
                    await hang
                    yield { type: 'text', text: 'Done' }
                },
            }

            const parentAgent = new Agent({
                tools: [dummyTool],
                llm: hangingLlm,
                operations: {} as any,
            })

            const handle = manager.spawnBackground({
                role: 'child-worker',
                task: 'Long background task',
                parentAgent,
                signal: parentAbort.signal,
            })

            expect(handle.status).toBe('running')

            // Abort parent
            parentAbort.abort()

            const summary = await handle.promise
            expect(summary.status).toBe('killed')

            resolveHang()
        })
    })
})
