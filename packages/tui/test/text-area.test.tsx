import { describe, expect, it } from 'bun:test'
import { render } from 'ink-testing-library'
import React from 'react'

import { TextArea } from '../src/components/text-area'

describe('TextArea Component', () => {
    it('renders with placeholder', () => {
        const { lastFrame } = render(
            <TextArea
                value=""
                onChange={() => {}}
                onSubmit={() => {}}
                placeholder="Type something..."
            />
        )
        expect(lastFrame()).toContain('Type something...')
    })

    it('renders text with cursor block', () => {
        const { lastFrame } = render(
            <TextArea value="Hello" onChange={() => {}} onSubmit={() => {}} />
        )
        const frame = lastFrame()
        expect(frame).toContain('Hello')
    })
})
