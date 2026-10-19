import { describe, expect, it, mock } from 'bun:test'
import React from 'react'

import { HelpMenu } from '../../src/components/menus/help-menu'
import { renderWithProviders } from '../test-providers'

describe('HelpMenu Component (Unit)', () => {
    it('renders general tab by default with system info and readme definition', () => {
        const handleClose = mock()
        const { lastFrame } = renderWithProviders(
            <HelpMenu
                onClose={handleClose}
                cliVersion="1.4.2"
                userEmail="phasehumans@gmail.com"
                activeModel="gemini-3.8-flash"
                authMethod="december"
                workspaceRoot="/home/chaitanya/code/december"
            />
        )
        const frame = lastFrame()

        expect(frame).not.toContain('✱ December CLI')
        expect(frame).toContain('[general]')
        expect(frame).toContain('commands')
        expect(frame).toContain('shortcuts')
        expect(frame).toContain('v1.4.2')
        expect(frame).toContain('phasehumans@gmail.com')
        expect(frame).toContain('Gemini 3.8 Flash')
        expect(frame).toContain('better coding agent')
        expect(frame).not.toContain('Quick Reference')
        expect(frame).toContain('Switch View')
        expect(frame).toContain('Close')
    })

    it('renders commands tab when initialTab is set to commands', () => {
        const handleClose = mock()
        const { lastFrame } = renderWithProviders(
            <HelpMenu onClose={handleClose} initialTab="commands" />
        )
        const frame = lastFrame()

        expect(frame).toContain('[commands]')
        expect(frame).toContain('Available Commands')
        expect(frame).toContain('/clear')
        expect(frame).toContain('Navigate')
        expect(frame).not.toContain('Select')
    })

    it('renders shortcuts tab when initialTab is set to shortcuts', () => {
        const handleClose = mock()
        const { lastFrame } = renderWithProviders(
            <HelpMenu onClose={handleClose} initialTab="shortcuts" />
        )
        const frame = lastFrame()

        expect(frame).toContain('[shortcuts]')
        expect(frame).toContain('Keyboard Shortcuts')
        expect(frame).toContain('Open slash commands')
        expect(frame).toContain('ctrl+p')
    })

    it('cycles tabs with right arrow and left arrow keys', async () => {
        const handleClose = mock()
        const { lastFrame, stdin } = renderWithProviders(
            <HelpMenu onClose={handleClose} initialTab="general" />
        )

        expect(lastFrame()).toContain('[general]')

        // Press right arrow to switch to commands
        stdin.write('\u001B[C')
        await new Promise((resolve) => setTimeout(resolve, 30))
        expect(lastFrame()).toContain('[commands]')
        expect(lastFrame()).toContain('Available Commands')

        // Press right arrow to switch to shortcuts
        stdin.write('\u001B[C')
        await new Promise((resolve) => setTimeout(resolve, 30))
        expect(lastFrame()).toContain('[shortcuts]')
        expect(lastFrame()).toContain('Keyboard Shortcuts')

        // Press left arrow to switch back to commands
        stdin.write('\u001B[D')
        await new Promise((resolve) => setTimeout(resolve, 30))
        expect(lastFrame()).toContain('[commands]')
    })

    it('cycles tabs with Tab key', async () => {
        const handleClose = mock()
        const { lastFrame, stdin } = renderWithProviders(
            <HelpMenu onClose={handleClose} initialTab="general" />
        )

        expect(lastFrame()).toContain('[general]')

        // Press Tab to switch to commands
        stdin.write('\t')
        await new Promise((resolve) => setTimeout(resolve, 30))
        expect(lastFrame()).toContain('[commands]')
    })

    it('closes on escape keypress', async () => {
        const handleClose = mock()
        const { stdin } = renderWithProviders(<HelpMenu onClose={handleClose} />)

        stdin.write('\u001B')
        await new Promise((resolve) => setTimeout(resolve, 30))
        expect(handleClose).toHaveBeenCalledTimes(1)
    })

    it('does not execute command on Enter in commands tab (read-only reference)', async () => {
        const handleSelect = mock()
        const { stdin } = renderWithProviders(
            <HelpMenu initialTab="commands" onSelectCommand={handleSelect} />
        )

        stdin.write('\r')
        await new Promise((resolve) => setTimeout(resolve, 30))
        expect(handleSelect).not.toHaveBeenCalled()
    })

    it('invokes setAuthMode("none") when onClose is not provided', async () => {
        const setAuthMode = mock()
        const { stdin } = renderWithProviders(<HelpMenu setAuthMode={setAuthMode} />)

        stdin.write('\u001B')
        await new Promise((resolve) => setTimeout(resolve, 30))
        expect(setAuthMode).toHaveBeenCalledWith('none')
    })
})
