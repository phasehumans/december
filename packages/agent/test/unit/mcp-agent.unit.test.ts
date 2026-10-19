import { McpClientManager, SearchToolsTool } from '@december/tools'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import { describe, it, expect, beforeEach, afterEach } from 'bun:test'

import { Agent } from '../../src/agent'
import { runAgentLoop } from '../../src/agent-loop'

import type { LLMProvider } from '@december/providers'

describe('MCP Tools in Agent Loop (Unit)', () => {
    let mockServer: Server
    let clientTransport: any
    let serverTransport: any
    let mcpManager: McpClientManager

    beforeEach(async () => {
        mockServer = new Server(
            { name: 'linear-mock', version: '1.0.0' },
            { capabilities: { tools: {} } }
        )

        mockServer.setRequestHandler(ListToolsRequestSchema, async () => {
            return {
                tools: [
                    {
                        name: 'create_issue',
                        description: 'Create a new ticket in Linear issue tracker',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                title: { type: 'string' },
                            },
                            required: ['title'],
                        },
                    },
                ],
            }
        })

        mockServer.setRequestHandler(CallToolRequestSchema, async (request) => {
            if (request.params.name === 'create_issue') {
                const title = (request.params.arguments as any)?.title
                return {
                    content: [{ type: 'text', text: `Issue created: LIN-123 (${title})` }],
                }
            }
            throw new Error(`Unknown tool: ${request.params.name}`)
        })

        const [cTrans, sTrans] = InMemoryTransport.createLinkedPair()
        clientTransport = cTrans
        serverTransport = sTrans
        await mockServer.connect(serverTransport)

        mcpManager = new McpClientManager()
    })

    afterEach(async () => {
        await mcpManager.disconnectAll()
        try {
            await mockServer.close()
        } catch {
            // Intentionally swallowed: server close error
        }
    })

    it('should discover MCP tools via search_tools and invoke them in agent loop', async () => {
        const agent = new Agent({
            tools: [SearchToolsTool],
            deferredTools: [],
            mcpClientManager: mcpManager,
            llm: { id: 'mock', stream: async function* () {} } as any,
            operations: {} as any,
        })

        // Connect the MCP server to manager (which registers tool to agent.deferredRegistry)
        await mcpManager.connectWithTransport('linear', { command: 'mock' }, clientTransport)

        // Verify tool is registered in agent.deferredRegistry
        expect(agent.deferredRegistry.has('mcp_linear_create_issue')).toBe(true)

        // Mock LLM steps:
        // Turn 1: Call search_tools to find Linear tools
        // Turn 2: Call the activated mcp_linear_create_issue tool
        // Turn 3: Final assistant response
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
                            input: JSON.stringify({ query: 'linear ticket' }),
                        },
                    }
                } else if (turn === 2) {
                    yield {
                        type: 'tool_call',
                        toolCall: {
                            id: 'call_2',
                            name: 'mcp_linear_create_issue',
                            input: JSON.stringify({ title: 'Fix login bug' }),
                        },
                    }
                } else {
                    yield {
                        type: 'text',
                        text: 'Created ticket LIN-123 in Linear.',
                    }
                }
            },
        }

        agent.setLLM(mockLlm)

        const events = []
        for await (const event of runAgentLoop(agent, 'Please file a bug on Linear')) {
            events.push(event)
        }

        expect(agent.tools.has('mcp_linear_create_issue')).toBe(true)

        const toolMessages = agent.messages.filter((m) => m.role === 'tool')
        expect(toolMessages).toHaveLength(2)
        expect(toolMessages[0]?.content).toContain('mcp_linear_create_issue')
        expect(toolMessages[1]?.content).toBe('Issue created: LIN-123 (Fix login bug)')

        const lastMsg = agent.messages[agent.messages.length - 1]
        expect(lastMsg?.content).toBe('Created ticket LIN-123 in Linear.')
    })
})
