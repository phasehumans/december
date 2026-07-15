import { describe, test, expect } from 'bun:test'
import { compactContextIfNeeded } from '../src/utils/compaction'
import type { LLMProvider, ProviderStreamChunk } from '@december/providers'
import type { Message } from '@december/shared'

class MockLLM implements LLMProvider {
    public id = 'mock'

    async *stream(): AsyncGenerator<ProviderStreamChunk, void, unknown> {
        yield { type: 'text', text: 'This is a summary.' }
    }
}

describe('compactContextIfNeeded', () => {
    test('does not compact if below threshold', async () => {
        const messages: Message[] = [
            { role: 'system', content: 'You are an agent' },
            { role: 'user', content: 'hello' },
        ]
        const llm = new MockLLM()
        const result = await compactContextIfNeeded(messages, llm, 1000)
        expect(result.length).toBe(2)
        expect(result).toEqual(messages)
    })

    test('compacts if above threshold and length > 21', async () => {
        const messages: Message[] = [{ role: 'system', content: 'You are an agent' }]
        // Create enough messages to exceed 21
        for (let i = 0; i < 25; i++) {
            messages.push({ role: 'user', content: 'a'.repeat(100) })
        }

        const llm = new MockLLM()
        // Low threshold so it triggers
        const result = await compactContextIfNeeded(messages, llm, 10)

        // Output should be: System (1) + Summary (1) + Protected Tail (20) = 22
        expect(result.length).toBe(22)
        expect(result[0]!.role).toBe('system')
        expect(result[1]!.role).toBe('system')
        expect(result[1]!.content).toContain('[COMPACTED HISTORY SUMMARY]')
        expect(result[1]!.content).toContain('This is a summary.')
        expect(result[2]!.role).toBe('user')
    })

    test('does not compact if length <= 21 even if tokens exceed', async () => {
        const messages: Message[] = [{ role: 'system', content: 'You are an agent' }]
        // Create exactly 21 messages total
        for (let i = 0; i < 20; i++) {
            messages.push({ role: 'user', content: 'a'.repeat(100) })
        }

        const llm = new MockLLM()
        // Low threshold so it would trigger based on tokens
        const result = await compactContextIfNeeded(messages, llm, 10)

        // Output should remain unchanged since length <= 21
        expect(result.length).toBe(21)
    })
})
