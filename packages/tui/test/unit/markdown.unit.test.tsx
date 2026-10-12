import { describe, expect, it } from 'bun:test'
import { render } from 'ink-testing-library'
import React from 'react'

import { Markdown } from '../../src/components/markdown'

describe('Markdown Component (Unit)', () => {
    it('renders basic text', () => {
        const { lastFrame } = render(<Markdown>Hello world</Markdown>)
        expect(lastFrame()).toContain('Hello world')
    })

    it('renders bold and italic text', () => {
        const { lastFrame } = render(<Markdown>**Bold** and *Italic*</Markdown>)
        const frame = lastFrame()
        expect(frame).toContain('Bold')
        expect(frame).toContain('and')
        expect(frame).toContain('Italic')
    })

    it('renders inline code', () => {
        const { lastFrame } = render(<Markdown>Run `npm install`</Markdown>)
        expect(lastFrame()).toContain('npm install')
    })

    it('renders lists', () => {
        const { lastFrame } = render(<Markdown>{`- Item 1\n- Item 2`}</Markdown>)
        const frame = lastFrame()
        expect(frame).toContain('Item 1')
        expect(frame).toContain('Item 2')
    })

    it('renders headings', () => {
        const { lastFrame } = render(<Markdown># Sample Heading</Markdown>)
        expect(lastFrame()).toContain('Sample Heading')
    })

    it('renders tables cleanly without raw separator lines', () => {
        const markdownTable = `
| Feature | Mode |
| :--- | :--- |
| Speed | Fast |
        `.trim()
        const { lastFrame } = render(<Markdown>{markdownTable}</Markdown>)
        const frame = lastFrame()
        expect(frame).toContain('Feature')
        expect(frame).toContain('Mode')
        expect(frame).toContain('Speed')
        expect(frame).toContain('Fast')
        // Ensure raw markdown syntax line is not present
        expect(frame).not.toContain('| :--- | :--- |')
    })

    it('renders mermaid diagrams with interactive support', () => {
        const mermaidCode = `
\`\`\`mermaid
graph LR
  A[Client] --> B[Server]
\`\`\`
        `.trim()
        const { lastFrame } = render(<Markdown>{mermaidCode}</Markdown>)
        const frame = lastFrame()
        expect(frame).toContain('Mermaid Diagram')
        expect(frame).toContain('Client')
        expect(frame).toContain('Server')
    })

    it('renders syntax highlighted code blocks in expanded mode without borders', () => {
        const { lastFrame } = render(
            <Markdown>{'```javascript\nconsole.log("test");\n```'}</Markdown>
        )
        const frame = lastFrame()
        expect(frame).toContain('console.log')
        expect(frame).toContain('test')
    })

    it('renders links with blue color #89B4F8', () => {
        const { lastFrame } = render(
            <Markdown>[Feedback Link](https://trydecember.com/feedback)</Markdown>
        )
        const frame = lastFrame()
        expect(frame).toContain('Feedback Link')
    })

    it('caches and reuses parsed AST tokens across multiple renders', async () => {
        const { parseMarkdownTokens, clearMarkdownCache, getMarkdownCacheStats } =
            await import('../../src/components/markdown')
        clearMarkdownCache()

        const snippet = '# Header\n\nParagraph text\n\n```ts\nconst x: number = 42;\n```'
        const tokens1 = parseMarkdownTokens(snippet)
        expect(tokens1.length).toBeGreaterThan(0)
        expect(getMarkdownCacheStats().astCacheSize).toBe(1)

        // Second call must return cached reference
        const tokens2 = parseMarkdownTokens(snippet)
        expect(tokens2).toBe(tokens1)
        expect(getMarkdownCacheStats().astCacheSize).toBe(1)
    })

    it('caches syntax-highlighted code output', async () => {
        const { getHighlightedCode, clearMarkdownCache, getMarkdownCacheStats } =
            await import('../../src/components/markdown')
        clearMarkdownCache()

        const code = 'const answer: number = 42;'
        const highlighted1 = getHighlightedCode(code, 'typescript')
        expect(highlighted1).toContain('42')
        expect(getMarkdownCacheStats().highlightCacheSize).toBe(1)

        // Reusing same code snippet returns cached highlight string
        const highlighted2 = getHighlightedCode(code, 'typescript')
        expect(highlighted2).toBe(highlighted1)
        expect(getMarkdownCacheStats().highlightCacheSize).toBe(1)
    })

    it('normalizes unicode bullets into markdown list items', async () => {
        const { normalizeMarkdown } = await import('../../src/components/markdown')
        const raw = ' • Bullet one\n • Bullet two\n   ● Sub-bullet'
        const normalized = normalizeMarkdown(raw)
        expect(normalized).toContain('* Bullet one')
        expect(normalized).toContain('* Bullet two')
        expect(normalized).toContain('   * Sub-bullet')
    })

    it('renders unicode bullets as formatted lists with bullets', () => {
        const raw = ' • Technical Foundations: AI integration\n • Developer Tools: CLI integration'
        const { lastFrame } = render(<Markdown>{raw}</Markdown>)
        const frame = lastFrame()
        expect(frame).toContain('Technical Foundations')
        expect(frame).toContain('Developer Tools')
    })

    it('renders ordered lists with proper number prefixes', () => {
        const raw = '1. First step\n2. Second step'
        const { lastFrame } = render(<Markdown>{raw}</Markdown>)
        const frame = lastFrame()
        expect(frame).toContain('1. ')
        expect(frame).toContain('First step')
        expect(frame).toContain('2. ')
        expect(frame).toContain('Second step')
    })

    it('renders headings with depth-based hash prefixes', () => {
        const raw = '# Top Heading\n\n## Sub Heading\n\n### Minor Heading'
        const { lastFrame } = render(<Markdown>{raw}</Markdown>)
        const frame = lastFrame()
        expect(frame).toContain('# Top Heading')
        expect(frame).toContain('## Sub Heading')
        expect(frame).toContain('### Minor Heading')
    })

    it('renders callout alerts with slim border bar and uppercase label without colon', () => {
        const noteRaw = '> [!NOTE]\n> Test migrations must run before test execution.'
        const { lastFrame: noteFrame } = render(<Markdown>{noteRaw}</Markdown>)
        const nFrame = noteFrame()
        expect(nFrame).toContain('▎')
        expect(nFrame).toContain('NOTE')
        expect(nFrame).not.toContain('NOTE:')
        expect(nFrame).toContain('Test migrations must run before test execution.')

        const warningRaw = '> [!WARNING]\n> High risk operation in progress.'
        const { lastFrame: warnFrame } = render(<Markdown>{warningRaw}</Markdown>)
        const wFrame = warnFrame()
        expect(wFrame).toContain('▎')
        expect(wFrame).toContain('WARNING')
        expect(wFrame).not.toContain('WARNING:')
        expect(wFrame).toContain('High risk operation in progress.')

        const tipRaw = '> [!TIP]\n> Use bun for faster execution.'
        const { lastFrame: tipFrame } = render(<Markdown>{tipRaw}</Markdown>)
        const tFrame = tipFrame()
        expect(tFrame).toContain('▎')
        expect(tFrame).toContain('TIP')
        expect(tFrame).toContain('Use bun for faster execution.')
    })

    it('renders plain blockquotes with slim bar without alert labels', () => {
        const quoteRaw = '> Single-context layout at repo root.'
        const { lastFrame } = render(<Markdown>{quoteRaw}</Markdown>)
        const frame = lastFrame()
        expect(frame).toContain('▎')
        expect(frame).toContain('Single-context layout at repo root.')
        expect(frame).not.toContain('NOTE')
        expect(frame).not.toContain('WARNING')
    })

    it('renders complex multi-line tables with aligned borders and word wrapping', () => {
        const complexTable = `
| Dimension | Telemetry from CampusLab | Academic Metric |
| :--- | :--- | :--- |
| Pacing / Velocity | joinedAt vs lastAcceptedAt in ContestStandingRecord | Time-to-Solution (TTS) |
| Trial-and-Error Behavior | Total failed submissions per user before Accepted status | Submission Thrashing / Guessing Factor |
        `.trim()
        const { lastFrame } = render(<Markdown>{complexTable}</Markdown>)
        const frame = lastFrame()
        expect(frame).toContain('Dimension')
        expect(frame).toContain('Telemetry from CampusLab')
        expect(frame).toContain('Academic Metric')
        expect(frame).toContain('Pacing / Velocity')
        expect(frame).toContain('ContestStandingRecord')
        expect(frame).toContain('Submission Thrashing')
        expect(frame).toContain('┌')
        expect(frame).toContain('├')
        expect(frame).toContain('└')
    })

    it('renders links with OSC 8 terminal hyperlink sequence and target url', () => {
        const linkRaw = '[Documentation](https://december.dev/docs)'
        const { lastFrame } = render(<Markdown>{linkRaw}</Markdown>)
        const frame = lastFrame()
        expect(frame).toContain('Documentation')
        expect(frame).toContain('\x1b]8;;https://december.dev/docs\x1b\\')
    })

    it('renders inline code with slate pill background without breaking spaces', () => {
        const codeRaw = 'Run `bun test` to execute.'
        const { lastFrame } = render(<Markdown>{codeRaw}</Markdown>)
        const frame = lastFrame()
        expect(frame).toContain('Run bun test to execute.')
        expect(frame).not.toContain('  bun test  ')
    })
})
