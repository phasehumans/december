import { describe, it, expect, afterEach } from 'bun:test'
import { render, screen, cleanup } from '@testing-library/react'
import React from 'react'
import { Button } from '@/shared/components/ui/Button'

describe('Button Component', () => {
    afterEach(() => {
        cleanup()
    })

    it('renders children correctly', () => {
        render(<Button>Click Me</Button>)
        expect(screen.getByText('Click Me')).toBeTruthy()
    })

    it('applies variant classes', () => {
        const { container } = render(<Button variant="danger">Danger</Button>)
        expect(container.firstChild?.className).toContain('bg-red-500/10')
    })

    it('shows loading state', () => {
        const { container } = render(<Button isLoading>Loading</Button>)
        expect(container.querySelector('.animate-spin')).toBeTruthy()
    })

    it('disables button when loading or explicitly disabled', () => {
        const { rerender, getByRole } = render(<Button disabled>Disabled</Button>)
        expect((getByRole('button') as HTMLButtonElement).disabled).toBe(true)

        rerender(<Button isLoading>Loading</Button>)
        expect((getByRole('button') as HTMLButtonElement).disabled).toBe(true)
    })
})
