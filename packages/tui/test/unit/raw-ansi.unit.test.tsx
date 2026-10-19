import { render } from 'ink-testing-library'
import React from 'react'
import { describe, expect, it } from 'vitest'

import { RawAnsi } from '../../src/components/raw-ansi'

describe('RawAnsi Component (Unit)', () => {
    it('returns null when lines array is empty', () => {
        const { lastFrame } = render(<RawAnsi lines={[]} />)
        expect(lastFrame()).toBe('')
    })

    it('renders pre-formatted ANSI lines joined into single output', () => {
        const lines = [
            '\x1b[32m+ line 1\x1b[39m',
            '\x1b[31m- line 2\x1b[39m',
            '\x1b[90m  line 3\x1b[39m',
        ]
        const { lastFrame } = render(<RawAnsi lines={lines} width={40} />)
        const frame = lastFrame() || ''
        expect(frame).toContain('+ line 1')
        expect(frame).toContain('- line 2')
        expect(frame).toContain('line 3')
    })
})
