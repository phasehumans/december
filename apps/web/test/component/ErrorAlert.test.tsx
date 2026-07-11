import { describe, it, expect, afterEach, mock } from 'bun:test'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import { ErrorAlert } from '@/shared/components/ui/ErrorAlert'

describe('ErrorAlert Component', () => {
    afterEach(() => {
        cleanup()
    })

    it('does not render without a message', () => {
        const { container } = render(<ErrorAlert message={null} />)
        expect(container.firstChild).toBeNull()
    })

    it('renders message correctly', () => {
        render(<ErrorAlert message="Something went wrong!" />)
        expect(screen.getByText('Something went wrong!')).toBeTruthy()
    })

    it('calls onClear and dismisses when close button is clicked', async () => {
        const onClear = mock()
        const user = userEvent.setup()
        const { container } = render(<ErrorAlert message="Error!" onClear={onClear} />)

        const closeButton = container.querySelector('button')
        expect(closeButton).toBeTruthy()

        if (closeButton) {
            await user.click(closeButton)
        }

        expect(onClear).toHaveBeenCalled()
        // It should not render after dismiss
        expect(container.firstChild).toBeNull()
    })
})
