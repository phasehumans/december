import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, afterEach, mock } from 'bun:test'
import React from 'react'

import { Modal } from '@/shared/components/ui/Modal'

describe('Modal Component', () => {
    afterEach(() => {
        cleanup()
    })

    it('does not render when isOpen is false', () => {
        const { container } = render(
            <Modal isOpen={false} onClose={() => {}} title="Test Modal">
                <div>Content</div>
            </Modal>
        )
        expect(container.firstChild).toBeNull()
        // Modal is portaled to document.body, so we should query body
        expect(document.body.querySelector('h2')).toBeNull()
    })

    it('renders correctly when isOpen is true', () => {
        render(
            <Modal
                isOpen={true}
                onClose={() => {}}
                title="Test Modal"
                description="Test Description"
            >
                <div>Modal Content</div>
            </Modal>
        )
        expect(screen.getByText('Test Modal')).toBeTruthy()
        expect(screen.getByText('Test Description')).toBeTruthy()
        expect(screen.getByText('Modal Content')).toBeTruthy()
    })

    it('calls onClose when close button is clicked', async () => {
        const onClose = mock()
        const user = userEvent.setup()
        render(
            <Modal isOpen={true} onClose={onClose} title="Test Modal">
                <div>Content</div>
            </Modal>
        )

        // Find close button by checking SVG inside button or just querying button
        const closeButton = document.querySelector('button')
        if (closeButton) {
            await user.click(closeButton)
        }

        expect(onClose).toHaveBeenCalled()
    })

    it('calls onClose when backdrop is clicked', async () => {
        const onClose = mock()
        const user = userEvent.setup()
        render(
            <Modal isOpen={true} onClose={onClose} title="Test Modal">
                <div>Content</div>
            </Modal>
        )

        // Backdrop is the absolute div that's first child of fixed container
        const backdrop = document.querySelector('.bg-black\\/60')
        if (backdrop) {
            await user.click(backdrop)
        }

        expect(onClose).toHaveBeenCalled()
    })

    it('renders premium variant correctly', () => {
        render(
            <Modal isOpen={true} onClose={() => {}} title="Premium Modal" variant="premium">
                <div>Content</div>
            </Modal>
        )
        expect(screen.getByText('Premium Modal')).toBeTruthy()
        // Check for premium styling class
        const modalContainer = screen.getByText('Premium Modal').closest('.relative')
        expect(modalContainer?.className).toContain('bg-[#121211]')
    })
})
