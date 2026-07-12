import { describe, it, expect, afterEach, mock } from 'bun:test'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import { ProjectListRow } from '@/features/projects/components/ProjectListRow'

describe('ProjectListRow Component', () => {
    const mockProject = {
        id: 'proj-1',
        title: 'Row Project',
        description: 'Row desc',
        createdByUsername: 'rowuser',
        createdAt: '2023-01-02',
        isStarred: true,
        isSharedAsTemplate: false,
        versionCount: 2,
    }

    const defaultProps = {
        project: mockProject as any,
        isMenuOpen: false,
        isTogglePending: false,
        onOpenProject: mock(),
        onToggleStar: mock(),
        onToggleMenu: mock(),
        onOpenProjectFromMenu: mock(),
        onToggleStarFromMenu: mock(),
        onOpenRename: mock(),
        onOpenDuplicate: mock(),
        onOpenShare: mock(),
        onOpenDelete: mock(),
        onOpenSettings: mock(),
    }

    afterEach(() => {
        cleanup()
        mock.restore()
    })

    it('renders project info correctly', () => {
        render(<ProjectListRow {...defaultProps} />)
        expect(screen.getByText('Row Project')).toBeTruthy()
        expect(screen.getByText('Row desc')).toBeTruthy()
        expect(screen.getByText('@rowuser')).toBeTruthy()
        expect(screen.getByText('2 sessions')).toBeTruthy()
    })

    it('calls onOpenProject when row is clicked', async () => {
        const onOpenProject = mock()
        const user = userEvent.setup()
        const { container } = render(
            <ProjectListRow {...defaultProps} onOpenProject={onOpenProject} />
        )

        // First child is the row container
        if (container.firstChild) {
            await user.click(container.firstChild as Element)
        }
        expect(onOpenProject).toHaveBeenCalledWith('proj-1')
    })

    it('calls onToggleMenu when more button is clicked', async () => {
        const onToggleMenu = mock()
        const user = userEvent.setup()
        const { container } = render(
            <ProjectListRow {...defaultProps} onToggleMenu={onToggleMenu} />
        )

        // Find more button (the one with MoreHorizontal icon)
        const buttons = container.querySelectorAll('button')
        const moreBtn = Array.from(buttons).find((b) => b.innerHTML.includes('circle')) // Icons.MoreHorizontal uses circles usually
        // Let's just find the last button or button not having title 'Unstar'
        const menuBtn = Array.from(buttons).find((b) => !b.title)
        if (menuBtn) {
            await user.click(menuBtn)
        }
        expect(onToggleMenu).toHaveBeenCalled()
    })

    it('renders menu when isMenuOpen is true', () => {
        render(<ProjectListRow {...defaultProps} isMenuOpen={true} />)
        expect(screen.getByText('Rename')).toBeTruthy()
        expect(screen.getByText('Delete')).toBeTruthy()
    })
})
