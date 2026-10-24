import { describe, expect, it, mock } from 'bun:test'
import React from 'react'

import { SkillsMenu } from '../../src/components/menus/skills-menu'
import { renderWithProviders } from '../test-providers'

describe('SkillsMenu Component (Unit)', () => {
    it('renders skills list view with header and creation guide', () => {
        const handleClose = mock()
        const { lastFrame } = renderWithProviders(
            <SkillsMenu onClose={handleClose} workspaceDir="/home/chaitanya/code/december" />
        )
        const frame = lastFrame()

        expect(frame).toContain('Skills')
        expect(frame).toContain('skills')
        expect(frame).toContain('Create new skills')
        expect(frame).toContain('.agents/skills/{skill_name}/SKILL.md')
        expect(frame).toContain('~/.gemini/antigravity-cli/skills/{skill_name}/SKILL.md')
        expect(frame).toContain('~/.gemini/skills/{skill_name}/SKILL.md')
        expect(frame).toContain('navigate')
        expect(frame).toContain('view')
        expect(frame).toContain('search')
        expect(frame).toContain('close')
        expect(frame).not.toContain('run')
    })

    it('navigates list with arrow keys', async () => {
        const handleClose = mock()
        const { lastFrame, stdin } = renderWithProviders(
            <SkillsMenu onClose={handleClose} workspaceDir="/home/chaitanya/code/december" />
        )

        const initialFrame = lastFrame()
        expect(initialFrame).toContain('Skills')

        // Press down arrow to move cursor
        stdin.write('\u001B[B')
        await new Promise((resolve) => setTimeout(resolve, 30))

        // Press up arrow to move back
        stdin.write('\u001B[A')
        await new Promise((resolve) => setTimeout(resolve, 30))

        expect(lastFrame()).toContain('Skills')
    })

    it('enters search mode on / and filters skills', async () => {
        const handleClose = mock()
        const { lastFrame, stdin } = renderWithProviders(
            <SkillsMenu onClose={handleClose} workspaceDir="/home/chaitanya/code/december" />
        )

        // Press / to enter search
        stdin.write('/')
        await new Promise((resolve) => setTimeout(resolve, 30))
        expect(lastFrame()).toContain('Search:')

        // Type query
        stdin.write('review')
        await new Promise((resolve) => setTimeout(resolve, 30))
        expect(lastFrame()).toContain('review')

        // Exit search on Esc
        stdin.write('\u001B')
        await new Promise((resolve) => setTimeout(resolve, 30))
        expect(lastFrame()).not.toContain('Search:')
    })

    it('opens detail view on Enter and renders file viewer with coordinates and gutter', async () => {
        const handleClose = mock()
        const { lastFrame, stdin } = renderWithProviders(
            <SkillsMenu onClose={handleClose} workspaceDir="/home/chaitanya/code/december" />
        )

        // Press Enter to open detail view for the first skill
        stdin.write('\r')
        await new Promise((resolve) => setTimeout(resolve, 50))

        const frame = lastFrame()
        expect(frame).toContain('line 1:')
        expect(frame).toContain('scroll')
        expect(frame).toContain('back')
        expect(frame).not.toContain('run skill')

        // Press Esc to return to list view
        stdin.write('\u001B')
        await new Promise((resolve) => setTimeout(resolve, 30))

        const backFrame = lastFrame()
        expect(backFrame).toContain('Skills')
        expect(backFrame).toContain('Create new skills')
        expect(handleClose).not.toHaveBeenCalled()
    })

    it('closes on Esc in list view', async () => {
        const handleClose = mock()
        const { stdin } = renderWithProviders(
            <SkillsMenu onClose={handleClose} workspaceDir="/home/chaitanya/code/december" />
        )

        stdin.write('\u001B')
        await new Promise((resolve) => setTimeout(resolve, 30))
        expect(handleClose).toHaveBeenCalledTimes(1)
    })

    it('ignores r key and does not close or run in list view', async () => {
        const handleClose = mock()
        const { stdin } = renderWithProviders(
            <SkillsMenu onClose={handleClose} workspaceDir="/home/chaitanya/code/december" />
        )

        stdin.write('r')
        await new Promise((resolve) => setTimeout(resolve, 30))
        expect(handleClose).not.toHaveBeenCalled()
    })
})
