import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, afterEach, mock } from 'bun:test'
import React from 'react'

import { ProjectDeleteModal } from '@/features/projects/components/ProjectDeleteModal'

describe('ProjectDeleteModal Component', () => {
    afterEach(() => {
        cleanup()
        mock.restore()
    })

    it('renders correctly when open', () => {
        render(
            <ProjectDeleteModal
                isOpen={true}
                projectTitle="My Test Project"
                isPending={false}
                onClose={() => {}}
                onConfirm={() => {}}
            />
        )
        expect(screen.getByText('Delete project')).toBeTruthy()
        expect(screen.getByText(/"My Test Project"/)).toBeTruthy()
    })

    it('does not render when closed', () => {
        const { container } = render(
            <ProjectDeleteModal
                isOpen={false}
                projectTitle="My Test Project"
                isPending={false}
                onClose={() => {}}
                onConfirm={() => {}}
            />
        )
        expect(container.firstChild).toBeNull()
    })

    it('calls onClose when cancel is clicked', async () => {
        const onClose = mock()
        const user = userEvent.setup()
        render(
            <ProjectDeleteModal
                isOpen={true}
                projectTitle="Test"
                isPending={false}
                onClose={onClose}
                onConfirm={() => {}}
            />
        )

        await user.click(screen.getByText('Cancel'))
        expect(onClose).toHaveBeenCalled()
    })

    it('disables buttons when isPending is true', () => {
        render(
            <ProjectDeleteModal
                isOpen={true}
                projectTitle="Test"
                isPending={true}
                onClose={() => {}}
                onConfirm={() => {}}
            />
        )

        expect((screen.getByText('Cancel') as HTMLButtonElement).disabled).toBe(true)
        expect((screen.getByText('Delete') as HTMLButtonElement).disabled).toBe(true)
    })
})
