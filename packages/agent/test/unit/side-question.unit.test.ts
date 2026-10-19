import { describe, test, expect } from 'bun:test'

import { Agent } from '../../src/agent'
import { runSideQuestion } from '../../src/side-question'
import { MockLLM } from '../mock-provider'

const mockOperations = {} as any

describe('Side Question / BTW (Unit)', () => {
    test('executes ephemeral query without polluting agent conversation history', async () => {
        const mockLlm = new MockLLM()
        mockLlm.pushResponse([
            { type: 'text', text: 'Postgres is mapped to ' },
            { type: 'text', text: 'port 5432.' },
        ])

        const toolA = { name: 'bash', description: 'Run bash command', inputSchema: {} } as any

        const agent = new Agent({
            llm: mockLlm,
            tools: [toolA],
            operations: mockOperations,
            systemPrompt: 'You are December.',
        })

        // Add some existing conversation turns
        agent.conversation.addMessage({ role: 'user', content: 'Set up docker compose' })
        agent.conversation.addMessage({
            role: 'assistant',
            content: 'I have set up docker compose.',
        })

        const initialMessagesCount = agent.messages.length

        const chunks: string[] = []
        const result = await runSideQuestion(agent, 'what port is postgres?', {
            onChunk: (chunk) => chunks.push(chunk),
        })

        expect(result).toBe('Postgres is mapped to port 5432.')
        expect(chunks).toEqual(['Postgres is mapped to ', 'port 5432.'])

        // Crucial requirement: Zero pollution of agent working memory or conversation history
        expect(agent.messages.length).toBe(initialMessagesCount)
        expect(agent.conversation.messages.length).toBe(initialMessagesCount)

        // Verify the LLM call preserved prefix and prompt cache settings
        expect(mockLlm.calls.length).toBe(1)
        const call = mockLlm.calls[0]!
        expect(call.systemPrompt).toBe('You are December.')
        expect(call.tools?.length).toBe(1)
        expect(call.tools?.[0]?.name).toBe('bash')
        expect((call.tools?.[0] as any)?.cache_control).toEqual({ type: 'ephemeral' })

        // Check messages passed to provider
        const lastMsg = call.messages[call.messages.length - 1]
        expect(lastMsg?.role).toBe('user')
        expect(lastMsg?.content).toContain(
            '[Side Question (ephemeral / by the way)]: what port is postgres?'
        )

        // Check thinkingLevel was turned off for instant response
        expect(call.modelOptions?.thinkingLevel).toBe('off')
    })

    test('aborts cleanly when signal is aborted', async () => {
        const mockLlm = new MockLLM()
        mockLlm.pushResponse([{ type: 'text', text: 'Some long answer...' }])

        const agent = new Agent({
            llm: mockLlm,
            tools: [],
            operations: mockOperations,
        })

        const controller = new AbortController()
        controller.abort()

        await expect(
            runSideQuestion(agent, 'quick question', { signal: controller.signal })
        ).rejects.toThrow('Aborted')

        expect(agent.messages.length).toBe(1) // only system prompt
    })

    test('returns empty string if question is blank', async () => {
        const mockLlm = new MockLLM()
        const agent = new Agent({
            llm: mockLlm,
            tools: [],
            operations: mockOperations,
        })

        const result = await runSideQuestion(agent, '   ')
        expect(result).toBe('')
        expect(mockLlm.calls.length).toBe(0)
    })
})
