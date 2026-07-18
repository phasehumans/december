import { describe, test, expect, mock } from 'bun:test'
import { EventStreamingProxy } from '../src/proxy'
import { Agent } from '../src/agent'
import type { LLMProvider, ProviderStreamChunk } from '@december/providers'

class MockLLM implements LLMProvider {
    public id = 'mock'
    async *stream(): AsyncGenerator<ProviderStreamChunk, void, unknown> {
        yield { type: 'text', text: 'Hello via proxy' }
    }
}

describe('EventStreamingProxy', () => {
    test('run method serializes events and sends to rpc', async () => {
        const mockAgent = new Agent({
            llm: new MockLLM(),
            tools: [],
            operations: {} as any,
        })

        const proxy = new EventStreamingProxy(mockAgent)

        const sentEvents: string[] = []
        const rpc = {
            onMessage: mock(),
            sendEvent: mock((eventStr: string) => {
                sentEvents.push(eventStr)
            }),
        }

        await proxy.run('Start', rpc)

        expect(rpc.sendEvent).toHaveBeenCalled()
        expect(sentEvents.length).toBeGreaterThan(0)

        // at least one event should contain the streamchunk
        const hasTextChunk = sentEvents.some((str) => str.includes('Hello via proxy'))
        expect(hasTextChunk).toBe(true)

        const hasTurnStart = sentEvents.some((str) => str.includes('TurnStart'))
        expect(hasTurnStart).toBe(true)

        const hasAgentEnd = sentEvents.some((str) => str.includes('AgentEnd'))
        expect(hasAgentEnd).toBe(true)
    })
})
