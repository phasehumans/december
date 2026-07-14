import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, afterEach, mock } from 'bun:test'
import React from 'react'

import { ProjectGridCard } from '@/features/projects/components/ProjectGridCard'

describe('ProjectGridCard Component', () => {
    const mockProject = {
        id: 'proj-1',
        title: 'Test Project',
        description: 'This is a test',
        createdByUsername: 'testuser',
        createdAt: '2023-01-01',
        isStarred: false,
        isSharedAsTemplate: false,
        versionCount: 1,
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
        render(<ProjectGridCard {...defaultProps} />)
        expect(screen.getByText('Test Project')).toBeTruthy()
        expect(screen.getByText('This is a test')).toBeTruthy()
        expect(screen.getByText('@testuser')).toBeTruthy()
        expect(screen.getByText('2023-01-01')).toBeTruthy()
    })

    it('calls onOpenProject when card is clicked', async () => {
        const onOpenProject = mock()
        const user = userEvent.setup()
        const { container } = render(
            <ProjectGridCard {...defaultProps} onOpenProject={onOpenProject} />
        )

        const imageContainer = container.querySelector('.aspect-\\[16\\/10\\]')
        if (imageContainer) {
            await user.click(imageContainer)
        }
        expect(onOpenProject).toHaveBeenCalledWith('proj-1')
    })

    it('calls onToggleStar when star button is clicked', async () => {
        const onToggleStar = mock()
        const user = userEvent.setup()
        const { container } = render(
            <ProjectGridCard {...defaultProps} onToggleStar={onToggleStar} />
        )

        // Find star button
        const starBtn = container.querySelector('button[title="Star"]')
        if (starBtn) {
            await user.click(starBtn)
        }
        expect(onToggleStar).toHaveBeenCalled()
    })

    it('renders menu when isMenuOpen is true', () => {
        render(<ProjectGridCard {...defaultProps} isMenuOpen={true} />)
        expect(screen.getByText('Open in new tab')).toBeTruthy()
        expect(screen.getByText('Rename')).toBeTruthy()
        expect(screen.getByText('Delete')).toBeTruthy()
    })

    it('calls correct callbacks from menu', async () => {
        const onOpenRename = mock()
        const user = userEvent.setup()
        render(<ProjectGridCard {...defaultProps} isMenuOpen={true} onOpenRename={onOpenRename} />)

        await user.click(screen.getByText('Rename'))
        expect(onOpenRename).toHaveBeenCalled()
    })
})
