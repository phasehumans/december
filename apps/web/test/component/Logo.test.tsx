import { describe, it, expect, afterEach } from 'bun:test'
import { render, screen, cleanup } from '@testing-library/react'
import React from 'react'
import { Logo } from '@/shared/components/Logo'

describe('Logo Component', () => {
    afterEach(() => {
        cleanup()
    })

    it('renders the text by default', () => {
        render(<Logo />)
        expect(screen.getByText('phase')).toBeInTheDocument()
        expect(screen.getByText('humans')).toBeInTheDocument()
    })

    it('does not render text when showText is false', () => {
        render(<Logo showText={false} />)
        expect(screen.queryByText('phase')).not.toBeInTheDocument()
        expect(screen.queryByText('humans')).not.toBeInTheDocument()
    })

    it('applies additional className correctly', () => {
        const { container } = render(<Logo className="custom-test-class" />)
        // The outermost div should have the custom class
        expect(container.firstChild).toHaveClass('custom-test-class')
    })
})
