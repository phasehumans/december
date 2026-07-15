import React from 'react'
import { describe, expect, it } from 'bun:test'
import { render } from 'ink-testing-library'
import { Spinner } from '../src/components/spinner'

describe('Spinner Component', () => {
    it('renders with default props', () => {
        const { lastFrame } = render(<Spinner />)
        expect(lastFrame()).toContain('⠋')
    })

    it('renders with label', () => {
        const { lastFrame } = render(<Spinner label="Loading..." />)
        const frame = lastFrame()
        expect(frame).toContain('Loading...')
    })
})
