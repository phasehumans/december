import { describe, expect, it, beforeEach } from 'bun:test'
import { render } from 'ink-testing-library'
import React from 'react'

import { InlineTip } from '../../src/components/inline-tip'
import { resetTipSession } from '../../src/constants/tips'

describe('InlineTip Component (Unit)', () => {
    beforeEach(() => {
        resetTipSession()
    })

    it('renders nothing when active is false', () => {
        const { lastFrame } = render(<InlineTip active={false} />)
        expect(lastFrame()).toBe('')
    })

    it('renders nothing before delay expires', () => {
        const { lastFrame } = render(<InlineTip active={true} options={{ delayMs: 500 }} />)
        expect(lastFrame()).toBe('')
    })

    it('renders subtle dot separator and tip label when delay expires', async () => {
        const { lastFrame } = render(<InlineTip active={true} options={{ delayMs: 20 }} />)
        expect(lastFrame()).toBe('')

        await new Promise((resolve) => setTimeout(resolve, 50))

        const frame = lastFrame()
        expect(frame).toContain('·')
        expect(frame).toContain('tip:')
    })

    it('disappears when active becomes false', async () => {
        const { lastFrame, rerender } = render(
            <InlineTip active={true} options={{ delayMs: 20 }} />
        )

        await new Promise((resolve) => setTimeout(resolve, 50))
        expect(lastFrame()).toContain('tip:')

        rerender(<InlineTip active={false} options={{ delayMs: 20 }} />)
        expect(lastFrame()).toBe('')
    })
})
