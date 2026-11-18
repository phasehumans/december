import { describe, expect, it } from 'bun:test'

import { ScreenBuffer } from '../../src/renderer/buffer'
import { MessageLineCache } from '../../src/renderer/views/message-line-cache'
import { MessageListView, type MessageItem } from '../../src/renderer/views/message-list-view'

function buildHistory(turns: number): MessageItem[] {
    const messages: MessageItem[] = []
    for (let i = 0; i < turns; i++) {
        messages.push({ role: 'user', content: `question ${i}` })
        messages.push({
            role: 'tool',
            toolCall: {
                id: `read-${i}`,
                name: 'read_file',
                command: `Read(src/file${i}.ts)`,
                status: 'success',
                output: 'line\n'.repeat(50),
                durationMs: 12,
            },
        })
        messages.push({
            role: 'assistant',
            content:
                `Answer ${i}.\n\n- point about **thing**\n- point with \`code\`\n\n` +
                'A paragraph that wraps across the terminal width. '.repeat(4),
        })
    }
    return messages
}

/** Median ms per frame while two tools run in parallel at the end of the session. */
function medianFrameMs(turns: number): number {
    const messages = buildHistory(turns)
    messages.push({ role: 'user', content: 'now' })
    messages.push({
        role: 'tool',
        toolCall: { id: 'a', name: 'read_file', command: 'Read(a.ts)', status: 'running' },
    })
    messages.push({
        role: 'tool',
        toolCall: { id: 'b', name: 'grep_search', command: 'Search(foo)', status: 'running' },
    })

    const lineCache = new MessageLineCache()
    const buffer = new ScreenBuffer(120, 40)
    const frame = (i: number) => {
        buffer.clear()
        MessageListView.render(buffer, {
            width: 120,
            height: 40,
            messages,
            lineCache,
            isStreaming: true,
            spinnerFrame: i % 10,
        })
    }

    for (let i = 0; i < 10; i++) frame(i)

    const samples: number[] = []
    for (let s = 0; s < 7; s++) {
        const start = performance.now()
        for (let i = 0; i < 20; i++) frame(i)
        samples.push((performance.now() - start) / 20)
    }
    samples.sort((a, b) => a - b)
    return samples[Math.floor(samples.length / 2)]!
}

describe('MessageListView frame cost', () => {
    it('does not grow with session length while several tools run', () => {
        const short = medianFrameMs(50)
        const long = medianFrameMs(2000)
        // Before the fix the 2000-turn frame was over 10x the 50-turn frame
        expect(long / short).toBeLessThan(3)
    })

    it('shows the same lines for a long session as a full re-layout would', () => {
        const messages = buildHistory(30)
        messages.push({ role: 'user', content: 'now' })
        messages.push({
            role: 'tool',
            toolCall: { id: 'a', name: 'read_file', command: 'Read(a.ts)', status: 'running' },
        })
        messages.push({
            role: 'tool',
            toolCall: { id: 'b', name: 'grep_search', command: 'Search(foo)', status: 'running' },
        })

        const warmCache = new MessageLineCache()
        warmCache.getLines(messages, 100)
        // Second call may reuse cached earlier turns
        const fromWarm = warmCache.getLines(messages, 100)
        const fromCold = new MessageLineCache().getLines(messages, 100)

        expect(fromWarm).toEqual(fromCold)
    })

    it('re-lays out earlier turns when the terminal width changes', () => {
        const messages = buildHistory(5)
        messages.push({ role: 'user', content: 'now' })
        messages.push({
            role: 'tool',
            toolCall: { id: 'a', name: 'read_file', command: 'Read(a.ts)', status: 'running' },
        })
        messages.push({
            role: 'tool',
            toolCall: { id: 'b', name: 'grep_search', command: 'Search(foo)', status: 'running' },
        })

        const cache = new MessageLineCache()
        cache.getLines(messages, 120)
        expect(cache.getLines(messages, 40)).toEqual(new MessageLineCache().getLines(messages, 40))
    })

    it('shows an in-place edit to an earlier turn while tools are running', () => {
        const messages = buildHistory(5)
        messages.push({ role: 'user', content: 'now' })
        messages.push({
            role: 'tool',
            toolCall: { id: 'a', name: 'read_file', command: 'Read(a.ts)', status: 'running' },
        })
        messages.push({
            role: 'tool',
            toolCall: { id: 'b', name: 'grep_search', command: 'Search(foo)', status: 'running' },
        })

        const cache = new MessageLineCache()
        cache.getLines(messages, 100)

        // Same array, same boundary message: only an earlier message changes in place
        messages[2]!.content = 'Edited earlier answer'
        const text = (lines: ReturnType<MessageLineCache['getLines']>) =>
            lines.map((line) => line.map((seg) => seg.text).join('')).join('\n')

        expect(text(cache.getLines(messages, 100))).toContain('Edited earlier answer')
    })

    it('shows a replaced earlier message while the last message streams', () => {
        const messages = buildHistory(5)
        messages.push({ role: 'assistant', content: 'streaming', isStreaming: true })

        const cache = new MessageLineCache()
        cache.getLines(messages, 100)

        messages[2] = { role: 'assistant', content: 'Replaced answer' }
        const lines = cache.getLines(messages, 100)
        const text = lines.map((line) => line.map((seg) => seg.text).join('')).join('\n')
        expect(text).toContain('Replaced answer')
    })
})
