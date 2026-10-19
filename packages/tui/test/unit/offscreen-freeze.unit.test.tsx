import { Text } from 'ink'
import { render } from 'ink-testing-library'
import React from 'react'
import { describe, expect, it } from 'vitest'

import { OffscreenFreeze } from '../../src/components/offscreen-freeze'

describe('OffscreenFreeze Component (Unit)', () => {
    it('renders initial live children when visible', () => {
        const { lastFrame } = render(
            <OffscreenFreeze>
                <Text>Active Live Content</Text>
            </OffscreenFreeze>
        )
        const frame = lastFrame() || ''
        expect(frame).toContain('Active Live Content')
    })

    it('updates live content when disabled is true', () => {
        const { rerender, lastFrame } = render(
            <OffscreenFreeze disabled={true}>
                <Text>Initial Content</Text>
            </OffscreenFreeze>
        )
        expect(lastFrame() || '').toContain('Initial Content')

        rerender(
            <OffscreenFreeze disabled={true}>
                <Text>Updated Content</Text>
            </OffscreenFreeze>
        )
        expect(lastFrame() || '').toContain('Updated Content')
    })
})
