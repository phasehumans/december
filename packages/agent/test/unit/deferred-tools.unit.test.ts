import { SearchToolsTool } from '@december/tools'
import { describe, it, expect } from 'bun:test'

import { Agent } from '../../src/agent'
import { runAgentLoop } from '../../src/agent-loop'

import type { LLMProvider } from '@december/providers'
import type { Tool } from '@december/shared'

describe('Deferred Tools & SearchTools in Agent (Unit)', () => {
    const coreTool: Tool = {
        name: 'read_file',
        description: 'Read a file',
        inputSchema: {},
        execute: async () => 'file content',
    }

    const deferredBrowserTool: Tool = {
        name: 'browser',
        description: 'Browse external web pages and render html',
        inputSchema: {},
        execute: async () => 'browser rendered content',
    }

    it('should initialize with deferred tools and registry', () => {
        const agent = new Agent({
            tools: [coreTool, SearchToolsTool],
            deferredTools: [deferredBrowserTool],
            llm: { id: 'mock', stream: async function* () {} } as any,
            operations: {} as any,
        })

        expect(agent.tools.has('read_file')).toBe(true)
        expect(agent.tools.has('search_tools')).toBe(true)
        expect(agent.tools.has('browser')).toBe(false)
        expect(agent.deferredRegistry.has('browser')).toBe(true)
    })

    it('should dynamically activate deferred tool via search_tools in agent loop', async () => {
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
                            name: 'search_tools',
                            input: JSON.stringify({ query: 'browse web' }),
                        },
                    }
                } else if (turn === 2) {
                    yield {
                        type: 'tool_call',
                        toolCall: {
                            id: 'call_2',
                            name: 'browser',
                            input: JSON.stringify({}),
                        },
                    }
                } else {
                    yield {
                        type: 'text',
                        text: 'Browser rendered the page successfully.',
                    }
                }
            },
        }

        const agent = new Agent({
            tools: [coreTool, SearchToolsTool],
            deferredTools: [deferredBrowserTool],
            llm: mockLlm,
            operations: {} as any,
        })

        const events = []
        for await (const event of runAgentLoop(agent, 'Browse example.com')) {
            events.push(event)
        }

        // Verify that browser tool was dynamically activated
        expect(agent.tools.has('browser')).toBe(true)

        // Verify tool results in conversation messages
        const toolMessages = agent.messages.filter((m) => m.role === 'tool')
        expect(toolMessages.length).toBe(2)
        expect(toolMessages[0]?.content).toContain('Found and activated 1 tool(s)')
        expect(toolMessages[0]?.content).toContain('browser')
        expect(toolMessages[1]?.content).toBe('browser rendered content')

        const lastMsg = agent.messages[agent.messages.length - 1]
        expect(lastMsg?.content).toBe('Browser rendered the page successfully.')
    })
})
