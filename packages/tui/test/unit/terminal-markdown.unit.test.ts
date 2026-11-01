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
        expect(lines[0].map((s) => s.text).join('')).toBe('const x = 42')
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

    it('formats markdown links and raw URLs with underline and brand styling', () => {
        const text =
            'Open URL: [https://github.com/login/device](https://github.com/login/device) or visit https://example.com directly.'
        const lines = formatMarkdownToLines(text, 120)

        const urlSeg = lines[0].find((s) => s.text.includes('https://github.com/login/device'))
        expect(urlSeg).toBeDefined()
        expect(urlSeg?.style?.underline).toBe(true)

        const rawUrlSeg = lines[0].find((s) => s.text.includes('https://example.com'))
        expect(rawUrlSeg).toBeDefined()
        expect(rawUrlSeg?.style?.underline).toBe(true)
    })

    it('chunks very long continuous URLs cleanly so no line exceeds maxWidth', () => {
        const longUrl =
            'https://accounts.google.com/o/oauth2/v2/auth?client_id=1071006060591-tmhssin2h21lcre235vtolojh4g403ep.apps.googleusercontent.com&redirect_uri=http%3A%2F%2F127.0.0.1%3A44447%2Fcallback&response_type=code&scope=https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fuserinfo.email%20https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fuserinfo.profile&code_challenge=n6EHMrPTBJkuMjy2S6p5oYVBK10NJBa-gzBnqw8HOW0&code_challenge_method=S256&state=6789ffaac26be99efc7204e54bbfcfb8'
        const maxWidth = 80
        const lines = formatMarkdownToLines(longUrl, maxWidth)

        expect(lines.length).toBeGreaterThan(3)
        for (const line of lines) {
            const lineLen = line.reduce((acc, seg) => acc + seg.text.length, 0)
            expect(lineLen).toBeLessThanOrEqual(maxWidth)
        }
    })

    it('syntax highlights keywords and strings inside fenced code blocks', () => {
        const text = '```typescript\nconst message = "hello"\nreturn 42\n```'
        const lines = formatMarkdownToLines(text, 60)

        expect(lines.length).toBe(2)
        const constSeg = lines[0].find((s) => s.text === 'const')
        expect(constSeg?.style?.bold).toBe(true)

        const strSeg = lines[0].find((s) => s.text.includes('hello'))
        expect(strSeg).toBeDefined()

        const numSeg = lines[1].find((s) => s.text === '42')
        expect(numSeg).toBeDefined()
    })

    it('formats markdown tables into aligned border box rows', () => {
        const text = '| Col 1 | Col 2 |\n|---|---|\n| Val 1 | Val 2 |'
        const lines = formatMarkdownToLines(text, 60)

        expect(lines.length).toBeGreaterThanOrEqual(4)
        const top = lines[0].map((s) => s.text).join('')
        expect(top).toContain('┌')
        expect(top).toContain('┬')
        expect(top).toContain('┐')

        const header = lines[1].map((s) => s.text).join('')
        expect(header).toContain('Col 1')
        expect(header).toContain('Col 2')

        const bot = lines[lines.length - 1].map((s) => s.text).join('')
        expect(bot).toContain('└')
        expect(bot).toContain('┴')
        expect(bot).toContain('┘')
    })

    it('renders mermaid flowchart diagrams into ASCII node connections', () => {
        const text = '```mermaid\nflowchart TD\nA[Client] --> B[Server]\n```'
        const lines = formatMarkdownToLines(text, 60)

        const combined = lines.map((l) => l.map((s) => s.text).join('')).join('\n')
        expect(combined).toContain('Flowchart')
        expect(combined).toContain('[Client]')
        expect(combined).toContain('──►')
        expect(combined).toContain('[Server]')
    })

    it('renders mermaid sequence diagrams into participant messages', () => {
        const text = '```mermaid\nsequenceDiagram\nClient->>Server: ping\n```'
        const lines = formatMarkdownToLines(text, 60)

        const combined = lines.map((l) => l.map((s) => s.text).join('')).join('\n')
        expect(combined).toContain('Sequence Diagram')
        expect(combined).toContain('[Client]')
        expect(combined).toContain('[Server]')
        expect(combined).toContain(': ping')
    })
})
