import { render } from 'ink-testing-library'
import React from 'react'
import { describe, expect, it } from 'vitest'

import {
    SmoothMarkdown,
    splitStreamingMarkdown,
    autoCloseFences,
} from '../../src/components/messages/smooth-markdown'

describe('splitStreamingMarkdown', () => {
    it('splits text by double newlines into committed and tail parts', () => {
        const text = 'First paragraph\n\nSecond paragraph in prog'
        const { committed, tail } = splitStreamingMarkdown(text)
        expect(committed).toBe('First paragraph')
        expect(tail).toBe('Second paragraph in prog')
    })

    it('returns empty committed when no double newlines exist', () => {
        const text = 'Single line in progress'
        const { committed, tail } = splitStreamingMarkdown(text)
        expect(committed).toBe('')
        expect(tail).toBe('Single line in progress')
    })

    it('does not split double newlines that are inside an unclosed code fence', () => {
        const text = '```typescript\nconst a = 1;\n\nconst b = 2;'
        const { committed, tail } = splitStreamingMarkdown(text)
        expect(committed).toBe('')
        expect(tail).toBe(text)
    })
})

describe('autoCloseFences', () => {
    it('auto-closes an unclosed code block fence', () => {
        const unclosed = '```typescript\nfunction hello() {'
        expect(autoCloseFences(unclosed)).toBe('```typescript\nfunction hello() {\n```')
    })

    it('leaves already closed code block fence unchanged', () => {
        const closed = '```typescript\nfunction hello() {}\n```'
        expect(autoCloseFences(closed)).toBe(closed)
    })
})

describe('SmoothMarkdown Component', () => {
    it('renders streaming text with auto-closed code fence without crashing', () => {
        const text = 'Here is the code:\n\n```javascript\nconsole.log("stream");'
        const { lastFrame } = render(<SmoothMarkdown text={text} isRunning={true} />)
        const frame = lastFrame() || ''
        expect(frame).toContain('Here is the code:')
        expect(frame).toContain('console.log')
    })

    it('renders static completed markdown when not running', () => {
        const text = 'Finished paragraph'
        const { lastFrame } = render(<SmoothMarkdown text={text} isRunning={false} />)
        expect(lastFrame()).toContain('Finished paragraph')
    })
})
