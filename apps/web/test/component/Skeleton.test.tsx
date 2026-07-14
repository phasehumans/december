import { render, cleanup } from '@testing-library/react'
import { describe, it, expect, afterEach } from 'bun:test'
import React from 'react'

import { Skeleton } from '@/shared/components/ui/Skeleton'

describe('Skeleton Component', () => {
    afterEach(() => {
        cleanup()
    })

    it('renders with base classes', () => {
        const { container } = render(<Skeleton />)
        expect(container.firstChild?.className).toContain('animate-pulse')
    })

    it('accepts custom classes', () => {
        const { container } = render(<Skeleton className="w-10 h-10" />)
        expect(container.firstChild?.className).toContain('w-10 h-10')
    })
})
