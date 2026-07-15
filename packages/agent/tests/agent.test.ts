import { describe, test, expect, mock } from 'bun:test'
import { Agent } from '../src/agent'
import type { LLMProvider, ProviderStreamChunk, ProviderTool } from '@december/providers'
import type { Message } from '@december/shared'

class MockLLM implements LLMProvider {
    public id = 'mock'
    public mockResponses: string[] = []

    async *stream(
        messages: Message[],
        tools?: ProviderTool[],
        systemPrompt?: string,
        modelOptions?: any,
        signal?: AbortSignal
    ): AsyncGenerator<ProviderStreamChunk, void, unknown> {
        const response = this.mockResponses.shift() || 'default response'
        yield { type: 'text', text: response }
    }
}

const mockOperations = {} as any

describe('Agent core functionality', () => {
    test('initializes with default system prompt', () => {
        const agent = new Agent({
            llm: new MockLLM(),
            tools: [],
            operations: mockOperations,
        })
        expect(agent.messages.length).toBe(1)
        expect(agent.messages[0]!.role).toBe('system')
        expect(agent.messages[0]!.content).toBe('You are a helpful autonomous software engineer.')
    })

    test('initializes queues based on mode', () => {
        const agent = new Agent({
            llm: new MockLLM(),
            tools: [],
            operations: mockOperations,
            steeringMode: 'one-at-a-time',
            followUpMode: 'all',
        })
        expect(agent.steeringQueue.mode).toBe('one-at-a-time')
        expect(agent.followUpQueue.mode).toBe('all')
    })

    test('steer queue push and drain', () => {
        const agent = new Agent({
            llm: new MockLLM(),
            tools: [],
            operations: mockOperations,
            steeringMode: 'one-at-a-time',
        })
        agent.steer({ role: 'user', content: 'steer1' })
        agent.steer({ role: 'user', content: 'steer2' })
        expect(agent.steeringQueue.length).toBe(2)

        // one-at-a-time mode
        const drained1 = agent.steeringQueue.drain()
        expect(drained1.length).toBe(1)
        expect(drained1[0]!.content).toBe('steer1')
        expect(agent.steeringQueue.length).toBe(1)

        const drained2 = agent.steeringQueue.drain()
        expect(drained2.length).toBe(1)
        expect(drained2[0]!.content).toBe('steer2')
    })

    test('followUp queue drain all mode', () => {
        const agent = new Agent({
            llm: new MockLLM(),
            tools: [],
            operations: mockOperations,
            followUpMode: 'all',
        })
        agent.followUp({ role: 'user', content: 'follow1' })
        agent.followUp({ role: 'user', content: 'follow2' })

        // all mode
        const drained = agent.followUpQueue.drain()
        expect(drained.length).toBe(2)
        expect(drained[0]!.content).toBe('follow1')
        expect(drained[1]!.content).toBe('follow2')
        expect(agent.followUpQueue.length).toBe(0)
    })

    test('clearContext leaves only system prompt', async () => {
        const agent = new Agent({
            llm: new MockLLM(),
            tools: [],
            operations: mockOperations,
        })
        agent.addMessage({ role: 'user', content: 'hello' })
        expect(agent.messages.length).toBe(2)

        await agent.clearContext()
        expect(agent.messages.length).toBe(1)
        expect(agent.messages[0]!.role).toBe('system')
    })
})
