import { describe, expect, it } from 'bun:test'

import { getAdaptiveThinkingLevel, isSimpleConversationalTurn } from '../../src/agent-loop'

import type { AgentMessage } from '@december/shared'

describe('Adaptive Thinking Level Classifier (Unit)', () => {
    it('returns off when messages are empty or contain no user message', () => {
        expect(getAdaptiveThinkingLevel([])).toBe('off')
        expect(
            getAdaptiveThinkingLevel([
                { role: 'system', content: 'You are an agent.' },
                { role: 'assistant', content: 'Ready.' },
            ])
        ).toBe('off')
    })

    it('ignores isUI user messages and processes actual user content', () => {
        const messages: AgentMessage[] = [
            { role: 'user', content: 'please refactor the entire authentication service' },
            { role: 'user', content: 'UI message', isUI: true },
        ]
        expect(getAdaptiveThinkingLevel(messages)).toBe('fast')
    })

    it('returns off for slash commands', () => {
        expect(getAdaptiveThinkingLevel([{ role: 'user', content: '/help' }])).toBe('off')
        expect(getAdaptiveThinkingLevel([{ role: 'user', content: '/commit' }])).toBe('off')
        expect(getAdaptiveThinkingLevel([{ role: 'user', content: '/settings' }])).toBe('off')
        expect(getAdaptiveThinkingLevel([{ role: 'user', content: '/model gpt-4' }])).toBe('off')
    })

    it('defaults to fast for prompts without auto-escalating on refactor, debug, or length keywords', () => {
        const heavyQueries = [
            'please refactor the auth middleware to support oauth2 and jwt',
            'debug the memory leak in the websocket connection handler',
            'architect a new distributed caching layer with redis cluster',
            'rewrite the sql query generator with full type safety',
            'migrate from prisma to drizzle orm across all services',
            'fix tests in packages/providers that are failing on macos',
            'fix error ECONNRESET when streaming responses',
        ]

        for (const query of heavyQueries) {
            expect(getAdaptiveThinkingLevel([{ role: 'user', content: query }])).toBe('fast')
        }

        const longPrompt = 'a'.repeat(500)
        expect(getAdaptiveThinkingLevel([{ role: 'user', content: longPrompt }])).toBe('fast')
    })

    it('honors explicitly configured reasoning levels', () => {
        const prompt = 'fix tests in packages/agent'
        expect(getAdaptiveThinkingLevel([{ role: 'user', content: prompt }], 'deep')).toBe('deep')
        expect(getAdaptiveThinkingLevel([{ role: 'user', content: prompt }], 'high')).toBe('deep')
        expect(getAdaptiveThinkingLevel([{ role: 'user', content: prompt }], 'fast')).toBe('fast')
        expect(getAdaptiveThinkingLevel([{ role: 'user', content: prompt }], 'off')).toBe('off')
        expect(getAdaptiveThinkingLevel([{ role: 'user', content: prompt }], 'auto')).toBe('fast')
        expect(getAdaptiveThinkingLevel([{ role: 'user', content: prompt }], 'medium')).toBe('deep')
    })

    it('identifies simple conversational greetings for dynamic tool masking', () => {
        const greetings = [
            'hi',
            'hello',
            'hey',
            'thanks',
            'thank you',
            'yes',
            'no',
            'ok',
            'okay',
            'bye',
            'ping',
            'help',
        ]
        for (const greeting of greetings) {
            expect(isSimpleConversationalTurn([{ role: 'user', content: greeting }])).toBe(true)
        }

        expect(isSimpleConversationalTurn([{ role: 'user', content: 'what can you do' }])).toBe(
            true
        )
        expect(isSimpleConversationalTurn([{ role: 'user', content: 'who are you' }])).toBe(true)
        expect(isSimpleConversationalTurn([{ role: 'user', content: 'read package.json' }])).toBe(
            false
        )
        expect(
            isSimpleConversationalTurn([
                { role: 'user', content: 'fix tests in packages/providers' },
            ])
        ).toBe(false)
    })

    it('handles non-string user message content safely', () => {
        expect(getAdaptiveThinkingLevel([{ role: 'user', content: null as any }])).toBe('off')
        expect(getAdaptiveThinkingLevel([{ role: 'user', content: undefined as any }])).toBe('off')
        expect(getAdaptiveThinkingLevel([{ role: 'user', content: '   ' }])).toBe('off')
    })
})
