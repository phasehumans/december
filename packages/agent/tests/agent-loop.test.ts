import { describe, test, expect, mock } from 'bun:test'
import { Agent } from '../src/agent'
import { runAgentLoop } from '../src/agent-loop'
import type { LLMProvider, ProviderStreamChunk, ProviderTool } from '@december/providers'
import type { Message, Tool } from '@december/shared'

class MockLLM implements LLMProvider {
    public id = 'mock'
    public mockResponses: any[][] = []

    async *stream(
        messages: Message[],
        tools?: ProviderTool[],
        systemPrompt?: string,
        modelOptions?: any,
        signal?: AbortSignal
    ): AsyncGenerator<ProviderStreamChunk, void, unknown> {
        const chunks = this.mockResponses.shift() || [{ type: 'text', text: 'default' }]
        for (const chunk of chunks) {
            yield chunk
        }
    }
}

const mockOperations = {} as any

describe('runAgentLoop', () => {
    test('yields stream chunks and stops on pure text response', async () => {
        const mockLLM = new MockLLM()
        mockLLM.mockResponses.push([
            { type: 'text', text: 'hello ' },
            { type: 'text', text: 'world' },
        ])

        const agent = new Agent({
            llm: mockLLM,
            tools: [],
            operations: mockOperations,
        })

        const loop = runAgentLoop(agent, 'say hello')
        const events: any[] = []
        for await (const event of loop) {
            events.push(event)
        }

        // Assert event types
        const types = events.map((e) => e.type)
        expect(types).toContain('AgentStart')
        expect(types).toContain('TurnStart')
        expect(types).toContain('StreamChunk')
        expect(types).toContain('TurnEnd')
        expect(types).toContain('AgentEnd')

        // Ensure the input message was added
        expect(agent.messages.length).toBe(3) // System + User + Assistant
        expect(agent.messages[1].role).toBe('user')
        expect(agent.messages[1].content).toBe('say hello')
        expect(agent.messages[2].role).toBe('assistant')
        expect(agent.messages[2].content).toBe('hello world')
    })

    test('executes tool call and continues loop', async () => {
        const mockLLM = new MockLLM()

        // Turn 1: Assistant calls tool
        mockLLM.mockResponses.push([
            {
                type: 'tool_call',
                toolCall: { id: 'call_1', name: 'my_tool', input: '{"arg":"val"}' },
            },
        ])
        // Turn 2: Assistant responds with text
        mockLLM.mockResponses.push([{ type: 'text', text: 'tool executed successfully' }])

        const mockTool: Tool = {
            name: 'my_tool',
            description: 'Does something',
            inputSchema: { type: 'object', properties: {} },
            execute: async () => 'success output',
        }

        const agent = new Agent({
            llm: mockLLM,
            tools: [mockTool],
            operations: mockOperations,
        })

        const loop = runAgentLoop(agent)
        const events: any[] = []
        for await (const event of loop) {
            events.push(event)
        }

        // Verify tool was added to messages
        expect(
            agent.messages.some((m) => m.role === 'tool' && m.content === 'success output')
        ).toBeTrue()

        // Verify final assistant message
        const lastMsg = agent.messages[agent.messages.length - 1]
        expect(lastMsg.role).toBe('assistant')
        expect(lastMsg.content).toBe('tool executed successfully')
    })

    test('integrates steering messages from queue', async () => {
        const mockLLM = new MockLLM()
        mockLLM.mockResponses.push([{ type: 'text', text: 'response' }])

        const agent = new Agent({
            llm: mockLLM,
            tools: [],
            operations: mockOperations,
        })

        // Inject a steering message before running the loop
        agent.steer({ role: 'user', content: 'steer me' })

        const loop = runAgentLoop(agent)
        for await (const _ of loop) {
        }

        // System + Steer + Assistant
        expect(agent.messages.length).toBe(3)
        expect(agent.messages[1].content).toBe('steer me')
    })

    test('handles standard API errors gracefully without crashing the loop', async () => {
        const mockLLM = new MockLLM()
        mockLLM.stream = async function* () {
            throw new Error('Some API error')
        }

        const agent = new Agent({
            llm: mockLLM,
            tools: [],
            operations: mockOperations,
        })

        const loop = runAgentLoop(agent, 'do something')
        const events: any[] = []
        for await (const event of loop) {
            events.push(event)
        }

        expect(events.map((e) => e.type)).toContain('StreamChunk')
        // StreamChunk should contain the error
        expect(events.find((e) => e.type === 'StreamChunk').content).toContain('Some API error')

        const lastMsg = agent.messages[agent.messages.length - 1]
        expect(lastMsg.role).toBe('assistant')
        expect(lastMsg.content).toContain('Failed due to API error: Error: Some API error')
    })

    test('tool execution blocked by ui.requestPermission', async () => {
        const mockLLM = new MockLLM()
        mockLLM.mockResponses.push([
            {
                type: 'tool_call',
                toolCall: { id: 'call_blocked', name: 'destructive_tool', input: '{}' },
            },
        ])
        // Turn 2: Assistant gets error
        mockLLM.mockResponses.push([{ type: 'text', text: 'I see it was blocked.' }])

        const mockTool: Tool = {
            name: 'destructive_tool',
            description: 'Does something bad',
            inputSchema: { type: 'object', properties: {} },
            execute: async () => 'Should not be called',
        }

        const operationsWithUI = {
            ui: {
                requestPermission: async () => ({ block: true, reason: 'User denied' }),
            },
        } as any

        const agent = new Agent({
            llm: mockLLM,
            tools: [mockTool],
            operations: operationsWithUI,
        })

        const loop = runAgentLoop(agent)
        const events: any[] = []
        for await (const event of loop) {
            events.push(event)
        }

        // Tool result message should contain the block reason
        const toolMsg = agent.messages.find((m) => m.role === 'tool')
        expect(toolMsg).toBeDefined()
        expect(toolMsg!.content).toContain('Tool execution blocked: User denied')
    })
})
