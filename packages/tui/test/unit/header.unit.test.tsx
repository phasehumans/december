import { describe, expect, it } from 'bun:test'
import { render } from 'ink-testing-library'
import React from 'react'

import { Header, getGitBranch, clearGitBranchCache } from '../../src/components/header'

describe('Header Component (Unit)', () => {
    it('renders with default version', () => {
        const { lastFrame } = render(<Header />)
        const frame = lastFrame()
        expect(frame).toContain('December v0.1.0')
        expect(frame).toContain('Use /handoff to continue in cloud')
        expect(frame).toContain('trydecember.com')
        expect(frame).toContain('https://trydecember.com')
    })

    it('renders with custom version and email', () => {
        const { lastFrame } = render(<Header cliVersion="1.0.0" userEmail="test@example.com" />)
        const frame = lastFrame()
        expect(frame).toContain('1.0.0')
        expect(frame).toContain('test@example.com')
    })

    it('renders 3rd tip line when latestVersion is available', () => {
        const { lastFrame } = render(<Header cliVersion="0.2.25" latestVersion="0.2.26" />)
        const frame = lastFrame()
        expect(frame).toContain('Run /update to install December CLI 0.2.26')
    })

    it('resolves git branch without throwing and caches result', () => {
        clearGitBranchCache()
        const branch = getGitBranch()
        expect(branch === null || typeof branch === 'string').toBe(true)
        const branch2 = getGitBranch()
        expect(branch2).toBe(branch)
    })

    it('renders announcement with 3 items and heading when provided', () => {
        const announcement = {
            version: '0.4.0',
            title: "What's New in v0.4.0",
            bullets: [
                'Fullscreen alternate-screen TUI by default',
                '140+ Direct BYOK provider integrations',
                'Configure aws rds postgresql connection',
            ],
            url: 'https://trydecember.com/docs/changelog',
        }
        const { lastFrame } = render(<Header announcement={announcement} />)
        const frame = lastFrame()
        expect(frame).toContain("▎ What's New in v0.4.0")
        expect(frame).toContain('▎ Fullscreen alternate-screen TUI by default')
        expect(frame).toContain('▎ 140+ Direct BYOK provider integrations')
        expect(frame).toContain('▎ Configure aws rds postgresql connection')
        expect(frame).toContain('Check out detailed changelog on')
        expect(frame).toContain('https://trydecember.com/docs/changelog')
    })

    it('does not render announcement when announcement is null or undefined', () => {
        const { lastFrame: frameUndefined } = render(<Header />)
        expect(frameUndefined()).not.toContain("What's New")

        const { lastFrame: frameNull } = render(<Header announcement={null} />)
        expect(frameNull()).not.toContain("What's New")
    })
})
