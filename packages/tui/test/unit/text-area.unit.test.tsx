import { describe, expect, it, mock } from 'bun:test'
import { render } from 'ink-testing-library'
import React from 'react'

import { TextArea } from '../../src/components/text-area'

describe('TextArea Component (Unit)', () => {
    it('renders with placeholder text', () => {
        const { lastFrame } = render(
            <TextArea
                value=""
                onChange={() => {}}
                onSubmit={() => {}}
                placeholder="Type your message..."
            />
        )
        expect(lastFrame()).toContain('Type your message...')
    })

    it('renders value when provided', () => {
        const { lastFrame } = render(
            <TextArea value="User typed content" onChange={() => {}} onSubmit={() => {}} />
        )
        expect(lastFrame()).toContain('User typed content')
    })

    it('highlights slash commands and arguments separately', () => {
        const { lastFrame } = render(
            <TextArea value="/model gemini-3.6-flash" onChange={() => {}} onSubmit={() => {}} />
        )
        const frame = lastFrame() || ''
        expect(frame).toContain('/model')
        expect(frame).toContain('gemini-3.6-flash')
    })

    it('highlights standalone @ and @filename mentions', () => {
        const { lastFrame } = render(
            <TextArea value="check @src/app.tsx please" onChange={() => {}} onSubmit={() => {}} />
        )
        const frame = lastFrame() || ''
        expect(frame).toContain('@src/app.tsx')
        expect(frame).toContain('please')
    })

    it('highlights ? shortcuts character in brand color', () => {
        const { lastFrame } = render(<TextArea value="?" onChange={() => {}} onSubmit={() => {}} />)
        const frame = lastFrame() || ''
        expect(frame).toContain('?')
    })

    it('highlights entire direct shell command and arguments in brand color for !', () => {
        const { lastFrame } = render(
            <TextArea value="!git status -s" onChange={() => {}} onSubmit={() => {}} />
        )
        const frame = lastFrame() || ''
        expect(frame).toContain('!git status -s')
    })

    it('positions cursor at the end when value is updated via autocomplete', () => {
        const { lastFrame, rerender } = render(
            <TextArea value="/mod" onChange={() => {}} onSubmit={() => {}} />
        )
        expect(lastFrame()).toContain('/mod')

        // Autocomplete to '/model '
        rerender(<TextArea value="/model " onChange={() => {}} onSubmit={() => {}} />)
        const frame = lastFrame() || ''
        expect(frame).toContain('/model')
    })

    it('respects disableHistoryNav prop and ignores up arrow when dropdown is open', () => {
        const onHistoryUp = mock()
        const { stdin } = render(
            <TextArea
                value="/"
                onChange={() => {}}
                onSubmit={() => {}}
                onHistoryUp={onHistoryUp}
                disableHistoryNav={true}
            />
        )

        stdin.write('\u001B[A') // Up arrow
        expect(onHistoryUp).not.toHaveBeenCalled()
    })

    it('renders long text cleanly with contiguous chunk grouping', () => {
        const longPrompt =
            'If your application requires frequent, low-latency, two-way interaction such as multiplayer gaming, live chat typing indicators, or collaborative whiteboards, WebSockets are the better fit.'
        const { lastFrame } = render(
            <TextArea value={longPrompt} onChange={() => {}} onSubmit={() => {}} focus={true} />
        )
        const frame = lastFrame() || ''
        expect(frame).toContain('WebSockets are the better fit.')
        expect(frame).toContain('multiplayer gaming')
    })

    it('renders multiline text values properly with newline handling', () => {
        const multilinePrompt = 'Line one prompt\nLine two prompt\nLine three prompt'
        const { lastFrame } = render(
            <TextArea
                value={multilinePrompt}
                onChange={() => {}}
                onSubmit={() => {}}
                focus={true}
            />
        )
        const frame = lastFrame() || ''
        expect(frame).toContain('Line one prompt')
        expect(frame).toContain('Line two prompt')
        expect(frame).toContain('Line three prompt')
    })

    it('handles value reset to empty string without cursor out-of-bounds error', () => {
        const { lastFrame, rerender } = render(
            <TextArea
                value="Initial long user prompt before submit"
                onChange={() => {}}
                onSubmit={() => {}}
                placeholder="Ask December to build..."
                focus={true}
            />
        )
        expect(lastFrame()).toContain('Initial long user prompt before submit')

        // Submit happens: parent resets value to ''
        rerender(
            <TextArea
                value=""
                onChange={() => {}}
                onSubmit={() => {}}
                placeholder="Ask December to build..."
                focus={true}
            />
        )
        const frame = lastFrame() || ''
        expect(frame).toContain('Ask December to build...')
    })
})
