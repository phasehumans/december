import React from 'react'
import { describe, expect, it } from 'bun:test'
import { render } from 'ink-testing-library'
import { Header } from '../src/components/header'

describe('Header Component', () => {
    it('renders with default version', () => {
        const { lastFrame } = render(<Header />)
        const frame = lastFrame()
        expect(frame).toContain('✱ December CLI 0.1.0')
    })

    it('renders with custom version and email', () => {
        const { lastFrame } = render(<Header cliVersion="1.0.0" userEmail="test@example.com" />)
        const frame = lastFrame()
        expect(frame).toContain('✱ December CLI 1.0.0')
        expect(frame).toContain('test@example.com')
    })
})
