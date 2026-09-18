import { describe, expect, it, beforeEach } from 'bun:test'
import { Text } from 'ink'
import { render } from 'ink-testing-library'
import React from 'react'

import { resetTipSession } from '../../src/constants/tips'
import { useDelayedTip } from '../../src/hooks/use-delayed-tip'

function TipTestComponent({
    active,
    minColumns = 75,
    delayMs = 20,
}: {
    active: boolean
    minColumns?: number
    delayMs?: number
}) {
    const tip = useDelayedTip(active, { minColumns, delayMs })
    return <Text>{tip ? `tip:${tip}` : 'no-tip'}</Text>
}

describe('useDelayedTip Hook (Unit)', () => {
    beforeEach(() => {
        resetTipSession()
    })

    it('returns null immediately when active is false', () => {
        const { lastFrame } = render(<TipTestComponent active={false} />)
        expect(lastFrame()).toContain('no-tip')
    })

    it('returns null before delayMs expires', () => {
        const { lastFrame } = render(<TipTestComponent active={true} delayMs={500} />)
        expect(lastFrame()).toContain('no-tip')
    })

    it('reveals tip after delayMs has elapsed', async () => {
        const { lastFrame } = render(<TipTestComponent active={true} delayMs={30} />)
        expect(lastFrame()).toContain('no-tip')

        // Wait for timer to expire
        await new Promise((resolve) => setTimeout(resolve, 60))

        expect(lastFrame()).toContain('tip:')
        expect(lastFrame()).not.toContain('no-tip')
    })

    it('clears tip when active flips to false', async () => {
        const { lastFrame, rerender } = render(<TipTestComponent active={true} delayMs={30} />)

        await new Promise((resolve) => setTimeout(resolve, 60))
        expect(lastFrame()).toContain('tip:')

        // Flip active to false
        rerender(<TipTestComponent active={false} delayMs={30} />)
        expect(lastFrame()).toContain('no-tip')
    })

    it('suppresses tip when terminal width is below minColumns threshold', async () => {
        // Demand impossible 500 columns so it's guaranteed below threshold
        const { lastFrame } = render(
            <TipTestComponent active={true} minColumns={500} delayMs={30} />
        )

        await new Promise((resolve) => setTimeout(resolve, 60))
        expect(lastFrame()).toContain('no-tip')
    })
})
