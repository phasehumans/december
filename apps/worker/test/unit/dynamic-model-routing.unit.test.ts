import { describe, expect, it } from 'bun:test'

import { E2BSandboxService } from '../../src/e2b-sandbox.service'

describe('Dynamic Model & Provider Routing (Ticket #592 - Seam 2)', () => {
    it('should initialize mock agent session with custom model and provider payload', async () => {
        const stream = await E2BSandboxService.runAgentSession({
            sessionId: 'mock-session-routing-1',
            prompt: 'Test dynamic model routing',
            model: 'claude-3-7-sonnet',
            provider: 'anthropic',
            workspaceDir: '/workspace',
        })

        const chunks: any[] = []
        for await (const chunk of stream) {
            chunks.push(JSON.parse(chunk.data))
        }

        expect(chunks.length).toBeGreaterThan(0)
        expect(chunks[0].type).toBe('AgentStart')
        expect(chunks[1].type).toBe('TurnStart')
        expect(chunks[chunks.length - 1].type).toBe('AgentEnd')
    })

    it('should support OpenAI and OpenRouter model routing payloads', async () => {
        const streamOpenAI = await E2BSandboxService.runAgentSession({
            sessionId: 'mock-session-routing-2',
            prompt: 'Test openai routing',
            model: 'gpt-4o',
            provider: 'openai',
        })

        const streamRouter = await E2BSandboxService.runAgentSession({
            sessionId: 'mock-session-routing-3',
            prompt: 'Test openrouter routing',
            model: 'deepseek/deepseek-r1',
            provider: 'openrouter',
        })

        expect(streamOpenAI).toBeDefined()
        expect(streamRouter).toBeDefined()
    })
})
