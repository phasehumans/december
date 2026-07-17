import { describe, expect, it } from 'bun:test'
import { render } from 'ink-testing-library'
import React from 'react'

import { Pill } from '../src/components/pill'

describe('Pill Component', () => {
    it('renders with default props', () => {
        const { lastFrame } = render(<Pill label="TestPill" />)
        expect(lastFrame()).toContain('TestPill')
    })
})
