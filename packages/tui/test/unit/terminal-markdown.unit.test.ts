import { describe, expect, it } from 'bun:test'

import { formatMarkdownToLines } from '../../src/renderer/views/markdown'

describe('Terminal Markdown Formatter (Renderer)', () => {
    it('formats plain text lines with word wrapping', () => {
        const text = 'This is a simple paragraph that should wrap across lines.'
        const lines = formatMarkdownToLines(text, 25)

        expect(lines.length).toBeGreaterThan(1)
        const combined = lines
            .map((l) =>
                l
                    .map((s) => s.text)
                    .join('')
                    .trim()
            )
            .join(' ')
        expect(combined).toContain('This is a simple paragraph')
    })

    it('formats markdown headings with bold and brand styling', () => {
        const text = '# Main Header\n## Subheader'
        const lines = formatMarkdownToLines(text, 40)

        expect(lines.length).toBe(2)
        expect(lines[0][0].text).toContain('# Main Header')
        expect(lines[0][0].style?.bold).toBe(true)
        expect(lines[1][0].text).toContain('## Subheader')
    })

    it('formats fenced code blocks with distinct background styling', () => {
        const text = '```typescript\nconst x = 42\n```'
        const lines = formatMarkdownToLines(text, 30)

        expect(lines.length).toBe(1)
        expect(lines[0][0].text).toBe('const x = 42')
        expect(lines[0][0].style?.bg).toBeDefined()
    })

    it('formats bullet lists with bullet glyph', () => {
        const text = '- Item 1\n- Item 2'
        const lines = formatMarkdownToLines(text, 30)

        expect(lines.length).toBe(2)
        expect(lines[0].map((s) => s.text).join('')).toContain('• Item 1')
        expect(lines[1].map((s) => s.text).join('')).toContain('• Item 2')
    })

    it('formats bold and inline code segments correctly', () => {
        const text = 'Here is **important** and `inline_code`.'
        const lines = formatMarkdownToLines(text, 50)

        const plainLine = lines[0].map((s) => s.text).join('')
        expect(plainLine).toBe('Here is important and inline_code.')

        const boldSeg = lines[0].find((s) => s.text === 'important')
        expect(boldSeg?.style?.bold).toBe(true)

        const codeSeg = lines[0].find((s) => s.text === 'inline_code')
        expect(codeSeg?.style?.bg).toBeDefined()
    })
})
