import { describe, expect, it } from 'bun:test'

import { Agent } from '../../src/agent'
import { runAgentLoop } from '../../src/agent-loop'

import type { LLMProvider } from '@december/providers'

describe('Agent Resilience, Rate Limiting & Error Recovery (Integration)', () => {
    it('aborts immediately when abort signal is triggered during retry backoff', async () => {
        let attempts = 0
        const mockLlm: LLMProvider = {
            id: 'mock-llm-retry-abort',
            stream: async function* () {
                attempts++
                yield { type: 'text', text: '' }
                const err: any = new Error('Rate limit 429')
                err.status = 429
                throw err
            },
        }

        const agent = new Agent({
            llm: mockLlm,
            tools: [],
            operations: {} as any,
        })

        const events: any[] = []
        const loopPromise = (async () => {
            for await (const event of runAgentLoop(agent, 'prompt')) {
                events.push(event)
                if (
                    event.type === 'AgentStatus' &&
                    event.message.includes('LLM Provider rate limit')
                ) {
                    agent.abort()
                }
            }
        })()

        await loopPromise
        expect(events.some((e) => e.type === 'AgentInterrupt')).toBe(true)
        expect(events[events.length - 1].type).toBe('AgentEnd')
    })

    it('fails immediately without retrying on permanent quota errors', async () => {
        let attempts = 0
        const mockLlm: LLMProvider = {
            id: 'gemini',
            stream: async function* () {
                attempts++
                yield* []
                const err: any = new Error('429 Resource has been exhausted (e.g. check quota).')
                err.status = 429
                throw err
            },
        }

        const agent = new Agent({
            llm: mockLlm,
            tools: [],
            operations: {} as any,
        })

        const events: any[] = []
        for await (const event of runAgentLoop(agent, 'prompt')) {
            events.push(event)
        }

        // Must fail on attempt 1 without fruitlessly retrying 5 times
        expect(attempts).toBe(1)
        const errEvent = events.find((e) => e.type === 'AgentError')
        expect(errEvent).toBeDefined()
        expect(errEvent.error).toContain('Resource has been exhausted')
    })

    it('emits connecting attempt status during retry rather than silently overwriting with Thinking', async () => {
        let attempts = 0
        const mockLlm: LLMProvider = {
            id: 'mock-transient',
            stream: async function* () {
                attempts++
                if (attempts === 1) {
                    const err: any = new Error('503 Service Unavailable: overloaded')
                    err.status = 503
                    throw err
                }
                yield { type: 'text', text: 'Recovered successfully' }
            },
        }

        const agent = new Agent({
            llm: mockLlm,
            tools: [],
            operations: {} as any,
        })

        const statuses: string[] = []
        for await (const event of runAgentLoop(agent, 'prompt')) {
            if (event.type === 'AgentStatus') {
                statuses.push(event.message)
            }
        }

        expect(attempts).toBe(2)
        // Verify retry notice was emitted and attempt 2 notified connecting
        expect(statuses.some((s) => s.includes('Retrying in'))).toBe(true)
        expect(statuses.some((s) => s.includes('Connecting to') && s.includes('attempt 2'))).toBe(
            true
        )
    })
})
