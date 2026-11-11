import { describe, expect, it } from 'bun:test'

import { ButterflowQueue } from '../../src/renderer/butterflow'

describe('ButterflowQueue', () => {
    it('initializes with default enabled state and empty buffer', () => {
        const queue = new ButterflowQueue()
        expect(queue.enabled).toBe(true)
        expect(queue.hasPending()).toBe(false)
        expect(queue.getTargetText()).toBe('')
        expect(queue.getDrippedText()).toBe('')
        queue.destroy()
    })

    it('immediately drips full chunks when disabled', () => {
        const drippedDeltas: string[] = []
        let drainCount = 0

        const queue = new ButterflowQueue({
            enabled: false,
            onDrip: (delta) => drippedDeltas.push(delta),
            onDrain: () => drainCount++,
        })

        queue.enqueue('Hello ')
        queue.enqueue('World!')

        expect(drippedDeltas).toEqual(['Hello ', 'World!'])
        expect(queue.getDrippedText()).toBe('Hello World!')
        expect(queue.hasPending()).toBe(false)
        expect(drainCount).toBe(2)
        queue.destroy()
    })

    it('buffers incoming chunks and smooths dripping when enabled', async () => {
        const drippedDeltas: string[] = []
        let drained = false

        const queue = new ButterflowQueue({
            frameIntervalMs: 5,
            enabled: true,
            onDrip: (delta) => drippedDeltas.push(delta),
            onDrain: () => {
                drained = true
            },
        })

        queue.enqueue('Hello World!')
        expect(queue.hasPending()).toBe(true)
        expect(queue.getTargetText()).toBe('Hello World!')

        // Wait for dripping to complete
        await new Promise<void>((resolve) => {
            const check = setInterval(() => {
                if (drained) {
                    clearInterval(check)
                    resolve()
                }
            }, 5)
        })

        expect(queue.getDrippedText()).toBe('Hello World!')
        expect(queue.hasPending()).toBe(false)
        expect(drippedDeltas.join('')).toBe('Hello World!')
        // Should have been dripped across multiple steps
        expect(drippedDeltas.length).toBeGreaterThan(1)
        queue.destroy()
    })

    it('flush() immediately drips all pending buffer', () => {
        const drippedDeltas: string[] = []
        let drained = false

        const queue = new ButterflowQueue({
            frameIntervalMs: 20,
            enabled: true,
            onDrip: (delta) => drippedDeltas.push(delta),
            onDrain: () => {
                drained = true
            },
        })

        queue.enqueue('High speed burst of tokens that must be flushed immediately')
        expect(queue.hasPending()).toBe(true)

        const flushed = queue.flush()
        expect(flushed).toBe('High speed burst of tokens that must be flushed immediately')
        expect(queue.hasPending()).toBe(false)
        expect(queue.getDrippedText()).toBe(
            'High speed burst of tokens that must be flushed immediately'
        )
        expect(drippedDeltas.join('')).toBe(
            'High speed burst of tokens that must be flushed immediately'
        )
        expect(drained).toBe(true)
        queue.destroy()
    })

    it('adapts step size proportionally to large lag bursts', async () => {
        const drippedDeltas: string[] = []

        const queue = new ButterflowQueue({
            frameIntervalMs: 5,
            enabled: true,
            onDrip: (delta) => drippedDeltas.push(delta),
        })

        // Enqueue 500 characters at once (large burst)
        const largeText = 'A'.repeat(500)
        queue.enqueue(largeText)

        // Wait a few ticks
        await new Promise((r) => setTimeout(r, 20))

        // First step should have been scaled up (much larger than 1 char)
        expect(drippedDeltas.length).toBeGreaterThan(0)
        expect(drippedDeltas[0].length).toBeGreaterThan(10)

        queue.flush()
        expect(queue.getDrippedText()).toBe(largeText)
        queue.destroy()
    })

    it('does not split surrogate pairs (emojis)', async () => {
        const drippedDeltas: string[] = []

        const queue = new ButterflowQueue({
            frameIntervalMs: 5,
            enabled: true,
            onDrip: (delta) => drippedDeltas.push(delta),
        })

        // Text containing 4-byte UTF-16 surrogate pairs
        const emojiText = '🚀🔥🎉✨'
        queue.enqueue(emojiText)

        queue.flush()
        for (const delta of drippedDeltas) {
            // Verify no broken surrogate character exists alone in any delta
            for (let i = 0; i < delta.length; i++) {
                const code = delta.charCodeAt(i)
                if (code >= 0xd800 && code <= 0xdbff) {
                    // Next char must be low surrogate
                    const nextCode = delta.charCodeAt(i + 1)
                    expect(nextCode).toBeGreaterThanOrEqual(0xdc00)
                    expect(nextCode).toBeLessThanOrEqual(0xdfff)
                    i++
                }
            }
        }
        expect(queue.getDrippedText()).toBe(emojiText)
        queue.destroy()
    })

    it('reset() stops timer and resets state cleanly', () => {
        const queue = new ButterflowQueue({
            frameIntervalMs: 10,
            enabled: true,
        })

        queue.enqueue('Testing reset')
        expect(queue.hasPending()).toBe(true)

        queue.reset()
        expect(queue.hasPending()).toBe(false)
        expect(queue.getTargetText()).toBe('')
        expect(queue.getDrippedText()).toBe('')
        queue.destroy()
    })
})
