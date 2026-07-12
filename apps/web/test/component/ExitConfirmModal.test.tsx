import { describe, it, expect, afterEach, mock } from 'bun:test'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import { ExitConfirmModal } from '@/features/preview/components/ExitConfirmModal'

describe('ExitConfirmModal Component', () => {
    afterEach(() => {
        cleanup()
        mock.restore()
    })

    it('renders correctly when open', () => {
        render(<ExitConfirmModal isOpen={true} onClose={() => {}} onConfirm={() => {}} />)
        expect(screen.getAllByText('Exit Project').length).toBeGreaterThan(0)
        expect(screen.getByText(/Are you sure you want to exit/)).toBeTruthy()
    })

    it('calls onConfirm when Exit Project is clicked', async () => {
        const onConfirm = mock()
        const user = userEvent.setup()
        render(<ExitConfirmModal isOpen={true} onClose={() => {}} onConfirm={onConfirm} />)

        await user.click(screen.getByRole('button', { name: 'Exit Project' }))
        expect(onConfirm).toHaveBeenCalled()
    })
})
