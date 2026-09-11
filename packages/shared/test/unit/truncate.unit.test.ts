import { describe, expect, test } from 'bun:test'

import { truncateOutput } from '../../src/truncate'

describe('truncateOutput (Unit)', () => {
    test('returns original untruncated text if below maxBytes and maxLines', () => {
        const text = 'Line 1\nLine 2\nLine 3'
        const result = truncateOutput(text, 1000, 10)
        expect(result.truncated).toBe(false)
        expect(result.text).toBe(text)
        expect(result.originalLength).toBe(3)
    })

    test('truncates text exceeding maxLines and inserts truncation marker', () => {
        const lines = Array.from({ length: 300 }, (_, i) => `Line ${i + 1}`).join('\n')
        const result = truncateOutput(lines, 100000, 100)
        expect(result.truncated).toBe(true)
        expect(result.text).toContain('truncated')
        expect(result.text.startsWith('Line 1')).toBe(true)
        expect(result.text.endsWith('Line 300')).toBe(true)
    })

    test('spills unabridged content to temporary file when output is truncated', async () => {
        const fs = await import('node:fs')
        const lines = Array.from({ length: 250 }, (_, i) => `Log line ${i}`).join('\n')
        const result = truncateOutput(lines, 100000, 50)
        expect(result.truncated).toBe(true)
        expect(result.spillPath).toBeDefined()
        expect(result.text).toContain(`Full output spilled to ${result.spillPath}`)
        const spilledContent = fs.readFileSync(result.spillPath!, 'utf8')
        expect(spilledContent).toBe(lines)
        fs.unlinkSync(result.spillPath!)
    })
})
