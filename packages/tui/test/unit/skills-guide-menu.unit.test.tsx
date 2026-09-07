import { describe, it, expect, mock } from 'bun:test'
import { render } from 'ink-testing-library'
import React from 'react'

import { SkillsGuideMenu } from '../../src/components/menus/skills-guide-menu'

describe('SkillsGuideMenu Component (Unit)', () => {
    it('renders skills guide layout without boxes or borders', () => {
        const setAuthMode = mock()
        const { lastFrame } = render(<SkillsGuideMenu setAuthMode={setAuthMode} />)
        const frame = lastFrame() || ''

        expect(frame).not.toContain('COMMANDS')
        expect(frame).not.toContain('SOURCES')
        expect(frame).toContain('Chat')
        expect(frame).toContain('CLI')
        expect(frame).toContain('/skill:<name>')
        expect(frame).toContain('Invoke a skill in chat')
        expect(frame).toContain('december skill list')
        expect(frame).toContain('december skill add <source>')
        expect(frame).toContain('december skill info <name>')
        expect(frame).toContain('december skill create <name>')
        expect(frame).toContain('december skill remove <name>')
        expect(frame).toContain('Scopes:')
        expect(frame).toContain('Explore:')
        expect(frame).toContain('agentskills.org')
        expect(frame).toContain('vercel-labs/skills')
        expect(frame).toContain('anthropics/skills')
        expect(frame).toContain('Back to chat')

        // Ensure no box or border characters
        expect(frame).not.toMatch(/[┌┐└┘╭╮╯╰╔╗╚╝│─]/)
    })

    it('exits to chat on pressing escape', async () => {
        const setAuthMode = mock()
        const { stdin } = render(<SkillsGuideMenu setAuthMode={setAuthMode} />)

        stdin.write('\x1B')
        await new Promise((resolve) => setTimeout(resolve, 50))
        expect(setAuthMode).toHaveBeenCalledWith('none')
    })

    it('exits to chat on pressing return / enter', () => {
        const setAuthMode = mock()
        const { stdin } = render(<SkillsGuideMenu setAuthMode={setAuthMode} />)

        stdin.write('\r')
        expect(setAuthMode).toHaveBeenCalledWith('none')
    })

    it('exits to chat on pressing q', () => {
        const setAuthMode = mock()
        const { stdin } = render(<SkillsGuideMenu setAuthMode={setAuthMode} />)

        stdin.write('q')
        expect(setAuthMode).toHaveBeenCalledWith('none')
    })
})
