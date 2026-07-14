import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, afterEach, mock } from 'bun:test'
import React from 'react'

import { ProjectRenameModal } from '@/features/projects/components/ProjectRenameModal'

describe('ProjectRenameModal Component', () => {
    afterEach(() => {
        cleanup()
        mock.restore()
    })

    it('renders correctly when open', () => {
        render(
            <ProjectRenameModal
                isOpen={true}
                value="Old Name"
                isPending={false}
                onClose={() => {}}
                onChange={() => {}}
                onSubmit={() => {}}
            />
        )
        expect(screen.getByText('Rename project')).toBeTruthy()
        expect(
            (screen.getByPlaceholderText('Enter project name...') as HTMLInputElement).value
        ).toBe('Old Name')
    })

    it('calls onChange when typing', async () => {
        const onChange = mock()
        const user = userEvent.setup()
        render(
            <ProjectRenameModal
                isOpen={true}
                value=""
                isPending={false}
                onClose={() => {}}
                onChange={onChange}
                onSubmit={() => {}}
            />
        )

        await user.type(screen.getByPlaceholderText('Enter project name...'), 'N')
        expect(onChange).toHaveBeenCalledWith('N')
    })

    it('disables save button when value is empty', () => {
        render(
            <ProjectRenameModal
                isOpen={true}
                value="   "
                isPending={false}
                onClose={() => {}}
                onChange={() => {}}
                onSubmit={() => {}}
            />
        )

        expect((screen.getByText('Save') as HTMLButtonElement).disabled).toBe(true)
    })
})
