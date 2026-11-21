import { describe, test, expect } from 'bun:test'

import { ConversationManager } from '../../src/conversation-manager'
import { compactContextIfNeeded, FORCED_PROTECTED_TAIL } from '../../src/utils/compaction'
import { MockLLM } from '../mock-provider'

import type { Message } from '@december/shared'

function conversation(turns: number): Message[] {
    const messages: Message[] = [{ role: 'system', content: 'You are an agent' }]
    for (let i = 0; i < turns; i++) {
        messages.push({ role: 'user', content: `question ${i}` })
        messages.push({ role: 'assistant', content: `answer ${i}` })
    }
    return messages
}

describe('/compact (forced compaction)', () => {
    test('compacts below the threshold when forced and keeps only the last few messages', async () => {
        const messages = conversation(5)
        const llm = new MockLLM()
        llm.pushResponse('## Goal\nship /compact')

        const notForced = await compactContextIfNeeded(messages, llm, 1_000_000)
        expect(notForced).toEqual(messages)

        const result = await compactContextIfNeeded(
            messages,
            llm,
            1_000_000,
            undefined,
            undefined,
            {
                force: true,
            }
        )
        expect(result[0]!.role).toBe('system')
        expect(result[1]!.content).toContain('[COMPACTED HISTORY SUMMARY]')
        expect(result.length).toBe(2 + FORCED_PROTECTED_TAIL)
        expect(result[result.length - 1]!.content).toBe('answer 4')
    })

    test('adds the focus text to the summary prompt', async () => {
        const llm = new MockLLM()
        llm.pushResponse('summary')
        await compactContextIfNeeded(conversation(5), llm, 1_000_000, undefined, undefined, {
            force: true,
            focus: 'keep the auth refactor details',
        })
        const prompt = llm.calls[0]!.messages.map((m) => m.content).join('\n')
        expect(prompt).toContain('focus on: keep the auth refactor details')
    })

    test('ConversationManager reports tokens before and after', async () => {
        const manager = new ConversationManager(conversation(6) as any)
        const llm = new MockLLM()
        llm.pushResponse('short')
        const result = await manager.compactIfNeeded(llm, undefined, undefined, undefined, {
            force: true,
        })
        expect(result.compacted).toBe(true)
        expect(result.tokensBefore).toBeGreaterThan(0)
        expect(result.tokensAfter).toBeLessThan(result.tokensBefore!)
    })

    test('a conversation that is too short is not compacted', async () => {
        const manager = new ConversationManager(conversation(1) as any)
        const result = await manager.compactIfNeeded(
            new MockLLM(),
            undefined,
            undefined,
            undefined,
            {
                force: true,
            }
        )
        expect(result.compacted).toBe(false)
    })
})
