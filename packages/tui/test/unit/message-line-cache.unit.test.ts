import { describe, expect, it } from 'bun:test'

import { MessageLineCache } from '../../src/renderer/views/message-line-cache'

import type { MessageItem } from '../../src/renderer/views/message-list-view'

describe('MessageLineCache', () => {
    it('formats assistant markdown and caches the result', () => {
        const cache = new MessageLineCache()
        const messages: MessageItem[] = [
            {
                id: 'm1',
                role: 'assistant',
                content: 'Hello **world** from assistant',
            },
        ]

        const lines1 = cache.getLines(messages, 80)
        expect(lines1.length).toBeGreaterThan(0)
        expect(lines1[0]!.map((s) => s.text).join('')).toContain('Hello world from assistant')

        // Second call with same reference should return cached lines
        const lines2 = cache.getLines(messages, 80)
        expect(lines2).toBe(lines1)
    })

    it('recomputes when width changes', () => {
        const cache = new MessageLineCache()
        const messages: MessageItem[] = [
            {
                id: 'm1',
                role: 'assistant',
                content:
                    'This is a long line that wraps differently across different terminal dimensions.',
            },
        ]

        const lines80 = cache.getLines(messages, 80)
        const lines40 = cache.getLines(messages, 40)

        expect(lines40).not.toBe(lines80)
        expect(lines40.length).toBeGreaterThan(lines80.length)
    })

    it('recomputes when message content changes but keeps unchanged messages cached', () => {
        const cache = new MessageLineCache()
        const messages: MessageItem[] = [
            {
                id: 'm1',
                role: 'user',
                content: 'First question',
            },
            {
                id: 'm2',
                role: 'assistant',
                content: 'Chunk 1',
                isStreaming: true,
            },
        ]

        const firstResult = cache.getLines(messages, 80)
        const m1LinesFirst = cache.getMessageLines(messages[0]!, 80)

        // Simulate streaming next token into m2
        messages[1]!.content = 'Chunk 1 Chunk 2'
        const secondResult = cache.getLines(messages, 80)
        const m1LinesSecond = cache.getMessageLines(messages[0]!, 80)

        // m1 was not modified, so its cached lines are strictly preserved
        expect(m1LinesSecond).toBe(m1LinesFirst)
        expect(secondResult[0]).toBe(firstResult[0])
        expect(secondResult.map((l) => l.map((s) => s.text).join('')).join('\n')).toContain(
            'Chunk 1 Chunk 2'
        )
    })

    it('formats tool calls cleanly and caches successful executions', () => {
        const cache = new MessageLineCache()
        const messages: MessageItem[] = [
            {
                id: 't1',
                role: 'tool',
                toolCall: {
                    id: 'c1',
                    name: 'readFile',
                    command: 'readFile(src/index.ts)',
                    status: 'success',
                },
            },
        ]

        const lines = cache.getLines(messages, 80)
        expect(lines.length).toBeGreaterThan(0)
        expect(lines[0]!.map((s) => s.text).join('')).toContain('readFile(src/index.ts)')
    })
})
