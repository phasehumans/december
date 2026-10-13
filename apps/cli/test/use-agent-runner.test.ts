import { describe, expect, it } from 'bun:test'

import { processAgentStream, getNextMsgId } from '../src/hooks/use-agent-runner'

async function* createAsyncStream(events: any[], delayMs = 5) {
    for (const event of events) {
        if (delayMs > 0) {
            await new Promise((r) => setTimeout(r, delayMs))
        }
        yield event
    }
}

describe('processAgentStream Frame-Budget Throttler', () => {
    it('generates unique message ids', () => {
        const id1 = getNextMsgId()
        const id2 = getNextMsgId()
        expect(id1).not.toBe(id2)
        expect(id1).toContain('msg-')
    })

    it('batches rapid streaming chunks within frame budget window instead of flushing per-token', async () => {
        let updateCount = 0
        let activeMessages: any[] = [{ id: 'assistant-1', role: 'assistant', blocks: [] }]

        const setActiveMessages = (updater: any) => {
            updateCount++
            activeMessages = typeof updater === 'function' ? updater(activeMessages) : updater
        }

        // Emit 20 rapid stream chunks with 2ms gap between them (total 40ms stream time)
        const chunks = Array.from({ length: 20 }, (_, i) => ({
            type: 'StreamChunk',
            content: ` token${i}`,
        }))

        const stream = createAsyncStream(chunks, 2)
        await processAgentStream({
            stream,
            setActiveMessages,
            assistantMsgId: 'assistant-1',
        })

        // Because of 33ms frame budget, 20 rapid chunks over 40ms should produce significantly fewer state update flushes than 20
        expect(updateCount).toBeLessThan(10)

        // All 20 tokens must still be completely accumulated into final text
        const assistantMsg = activeMessages.find((m) => m.id === 'assistant-1')
        expect(assistantMsg).toBeDefined()
        expect(assistantMsg.blocks[0].content).toContain('token0 token1')
        expect(assistantMsg.blocks[0].content).toContain('token19')
    })

    it('flushes critical state events like AgentError immediately', async () => {
        let updateCount = 0
        let activeMessages: any[] = [{ id: 'assistant-1', role: 'assistant', blocks: [] }]

        const setActiveMessages = (updater: any) => {
            updateCount++
            activeMessages = typeof updater === 'function' ? updater(activeMessages) : updater
        }

        const events = [{ type: 'TurnStart' }, { type: 'AgentError', error: 'Network failure' }]

        const stream = createAsyncStream(events, 0)
        await processAgentStream({
            stream,
            setActiveMessages,
            assistantMsgId: 'assistant-1',
        })

        expect(updateCount).toBeGreaterThanOrEqual(1)
        const assistantMsg = activeMessages.find((m) => m.id === 'assistant-1')
        expect(assistantMsg.blocks.some((b: any) => b.type === 'error')).toBe(true)
    })

    it('clears retry status color when transitioning to StreamChunk', async () => {
        let activeMessages: any[] = [{ id: 'assistant-1', role: 'assistant', blocks: [] }]

        const setActiveMessages = (updater: any) => {
            activeMessages = typeof updater === 'function' ? updater(activeMessages) : updater
        }

        const events = [
            { type: 'TurnStart' },
            { type: 'AgentStatus', message: 'Rate limit reached, retrying in 2s...' },
            { type: 'StreamChunk', content: 'Here is the response' },
        ]

        const stream = createAsyncStream(events, 0)
        await processAgentStream({
            stream,
            setActiveMessages,
            assistantMsgId: 'assistant-1',
        })

        const assistantMsg = activeMessages.find((m) => m.id === 'assistant-1')
        expect(assistantMsg).toBeDefined()
        expect(assistantMsg.blocks[0].content).toBe('Here is the response')
        expect(assistantMsg.blocks[0].color).toBeUndefined()
    })

    it('initializes block with Thinking... when TurnStart provides initialStatus Thinking...', async () => {
        let activeMessages: any[] = [{ id: 'assistant-1', role: 'assistant', blocks: [] }]
        const snapshots: any[] = []

        const setActiveMessages = (updater: any) => {
            activeMessages = typeof updater === 'function' ? updater(activeMessages) : updater
            snapshots.push(JSON.parse(JSON.stringify(activeMessages)))
        }

        async function* stream() {
            yield { type: 'TurnStart', initialStatus: 'Thinking...' }
            await new Promise((r) => setTimeout(r, 10))
            yield { type: 'StreamChunk', content: 'Finished' }
        }

        await processAgentStream({
            stream: stream(),
            setActiveMessages,
            assistantMsgId: 'assistant-1',
        })

        expect(snapshots.length).toBeGreaterThanOrEqual(1)
        const turnStartSnapshot = snapshots[0]
        const assistantMsg = turnStartSnapshot.find((m: any) => m.id === 'assistant-1')
        expect(assistantMsg).toBeDefined()
        expect(assistantMsg.blocks[0].type).toBe('text')
        expect(assistantMsg.blocks[0].content).toBe('Thinking...')
    })

    it('replaces Thinking... status block with streaming thinking block upon ThinkingChunk', async () => {
        let activeMessages: any[] = [{ id: 'assistant-1', role: 'assistant', blocks: [] }]

        const setActiveMessages = (updater: any) => {
            activeMessages = typeof updater === 'function' ? updater(activeMessages) : updater
        }

        const events = [
            { type: 'TurnStart', initialStatus: 'Thinking...' },
            { type: 'ThinkingChunk', content: 'Analyzing problem space...' },
        ]

        const stream = createAsyncStream(events, 0)
        await processAgentStream({
            stream,
            setActiveMessages,
            assistantMsgId: 'assistant-1',
        })

        const assistantMsg = activeMessages.find((m) => m.id === 'assistant-1')
        expect(assistantMsg).toBeDefined()
        const thinkingBlock = assistantMsg.blocks.find((b: any) => b.type === 'thinking')
        expect(thinkingBlock).toBeDefined()
        expect(thinkingBlock.content).toContain('Analyzing problem space...')
    })
})
