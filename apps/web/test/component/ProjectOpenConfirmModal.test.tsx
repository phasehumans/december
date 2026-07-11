import { describe, it, expect, afterEach, mock } from 'bun:test'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import { ProjectOpenConfirmModal } from '@/features/projects/components/ProjectOpenConfirmModal'

describe('ProjectOpenConfirmModal Component', () => {
    afterEach(() => {
        cleanup()
        mock.restore()
    })

    it('renders correctly', () => {
        render(
            <ProjectOpenConfirmModal
                isOpen={true}
                projectTitle="Test Project"
                onClose={() => {}}
                onConfirm={() => {}}
            />
        )
        expect(screen.getByText('Open Project')).toBeTruthy()
        expect(screen.getByText(/"Test Project"/)).toBeTruthy()
    })

    it('calls onConfirm when confirm is clicked', async () => {
        const onConfirm = mock()
        const user = userEvent.setup()
        render(
            <ProjectOpenConfirmModal
                isOpen={true}
                projectTitle="Test"
                onClose={() => {}}
                onConfirm={onConfirm}
            />
        )

        await user.click(screen.getByText('Confirm'))
        expect(onConfirm).toHaveBeenCalled()
    })
})
