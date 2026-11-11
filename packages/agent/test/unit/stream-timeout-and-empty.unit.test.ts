import { describe, expect, it } from 'bun:test'

import { Agent } from '../../src/agent'
import { getModelStreamTimeouts, getModelStreamTimeoutMs, runAgentLoop } from '../../src/agent-loop'

import type { LLMProvider } from '@december/providers'

describe('Stream Timeouts and Empty Responses (Unit)', () => {
    it('getModelStreamTimeouts returns 30s firstTokenTimeout for reasoning models', () => {
        const reasoningTimeouts = getModelStreamTimeouts('gemini-2.5-pro')
        expect(reasoningTimeouts.firstTokenTimeoutMs).toBe(30000)
        expect(reasoningTimeouts.interTokenTimeoutMs).toBe(15000)

        const flashThinkingTimeouts = getModelStreamTimeouts('gemini-3.8-flash', 'high')
        expect(flashThinkingTimeouts.firstTokenTimeoutMs).toBe(30000)
        expect(flashThinkingTimeouts.interTokenTimeoutMs).toBe(15000)
    })

    it('getModelStreamTimeouts returns 20s firstTokenTimeout for non-reasoning models', () => {
        const standardTimeouts = getModelStreamTimeouts('gpt-4o', 'off')
        expect(standardTimeouts.firstTokenTimeoutMs).toBe(20000)
        expect(standardTimeouts.interTokenTimeoutMs).toBe(15000)
    })

    it('getModelStreamTimeoutMs returns firstTokenTimeoutMs for backward compatibility', () => {
        expect(getModelStreamTimeoutMs('gemini-2.5-pro')).toBe(30000)
        expect(getModelStreamTimeoutMs('gpt-4o', 'off')).toBe(20000)
    })

    it('throws descriptive error and emits AgentError when stream finishes without any tokens or tool calls', async () => {
        const mockEmptyLLM: LLMProvider = {
            id: 'mock',
            stream: async function* () {
                // Yield nothing: simulates dropped stream / empty completion
            },
        }

        const agent = new Agent({
            systemPrompt: 'You are an agent',
            llm: mockEmptyLLM,
            tools: [],
            operations: {} as any,
            disableLogging: true,
        })

        const events: any[] = []
        for await (const event of runAgentLoop(agent, 'hello')) {
            events.push(event)
        }

        const errorEvent = events.find((e) => e.type === 'AgentError')
        expect(errorEvent).toBeDefined()
        expect(errorEvent.error).toContain(
            'The model completed the request without returning any content or tool calls'
        )
    })
})
