import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it, mock, beforeEach, afterEach } from 'bun:test'
import React from 'react'

import { MemoryViewMenu } from '../../src/components/menus/memory-view-menu'
import { renderWithProviders } from '../test-providers'

describe('MemoryViewMenu Component (Unit)', () => {
    let testDir: string

    beforeEach(async () => {
        testDir = await mkdtemp(join(tmpdir(), 'december-tui-mem-test-'))
        const decDir = join(testDir, '.december')
        await mkdir(decDir, { recursive: true })
        await writeFile(
            join(decDir, 'memory.md'),
            '## conventions\n- lowercase commits\n- no em dashes\n\n## build_and_test\n- bun test before push\n',
            'utf8'
        )
        await writeFile(
            join(testDir, 'AGENTS.md'),
            '# Project Guidelines\n\n- follow module architecture\n- write vitest unit tests\n',
            'utf8'
        )
    })

    afterEach(async () => {
        await rm(testDir, { recursive: true, force: true })
    })

    it('renders memory view menu with header, budget, and workspace memory entries', async () => {
        const handleClose = mock()
        const { lastFrame } = renderWithProviders(
            <MemoryViewMenu onClose={handleClose} workspaceDir={testDir} />
        )

        // Wait a tick for async loading
        await new Promise((resolve) => setTimeout(resolve, 50))
        const frame = lastFrame()

        expect(frame).toContain('Agent Memory & Rules')
        expect(frame).toContain('Budget:')
        expect(frame).toContain('Workspace Memory')
        expect(frame).toContain('Rules & Guidelines')
        expect(frame).toContain('lowercase commits')
        expect(frame).toContain('no em dashes')
        expect(frame).toContain('bun test before push')
    })

    it('switches between Workspace Memory and Rules tabs via Tab key', async () => {
        const handleClose = mock()
        const { lastFrame, stdin } = renderWithProviders(
            <MemoryViewMenu onClose={handleClose} workspaceDir={testDir} />
        )

        await new Promise((resolve) => setTimeout(resolve, 50))
        expect(lastFrame()).toContain('Workspace Memory')

        // Press Tab to switch to Rules tab
        stdin.write('\t')
        await new Promise((resolve) => setTimeout(resolve, 50))

        const rulesFrame = lastFrame()
        expect(rulesFrame).toContain('Discovered Rule Files')
        expect(rulesFrame).toContain('AGENTS.md')
        expect(rulesFrame).toContain('follow module architecture')

        // Press Tab again to switch back
        stdin.write('\t')
        await new Promise((resolve) => setTimeout(resolve, 50))
        expect(lastFrame()).toContain('lowercase commits')
    })

    it('opens directly to rules tab when initialTab is "rules"', async () => {
        const handleClose = mock()
        const { lastFrame } = renderWithProviders(
            <MemoryViewMenu onClose={handleClose} workspaceDir={testDir} initialTab="rules" />
        )

        await new Promise((resolve) => setTimeout(resolve, 50))
        const frame = lastFrame()
        expect(frame).toContain('Discovered Rule Files')
        expect(frame).toContain('AGENTS.md')
    })

    it('opens add entry sub-modal on "a" key', async () => {
        const handleClose = mock()
        const { lastFrame, stdin } = renderWithProviders(
            <MemoryViewMenu onClose={handleClose} workspaceDir={testDir} />
        )

        await new Promise((resolve) => setTimeout(resolve, 50))
        expect(lastFrame()).toContain('Agent Memory & Rules')

        // Press 'a' to enter add mode
        stdin.write('a')
        await new Promise((resolve) => setTimeout(resolve, 50))

        const addFrame = lastFrame()
        expect(addFrame).toContain('Record New Workspace Memory')
        expect(addFrame).toContain('Category:')
        expect(addFrame).toContain('Entry:')

        // Press Esc to exit add mode
        stdin.write('\u001B')
        await new Promise((resolve) => setTimeout(resolve, 50))
        expect(lastFrame()).not.toContain('Record New Workspace Memory')
    })

    it('opens confirm clear sub-modal on "x" key', async () => {
        const handleClose = mock()
        const { lastFrame, stdin } = renderWithProviders(
            <MemoryViewMenu onClose={handleClose} workspaceDir={testDir} />
        )

        await new Promise((resolve) => setTimeout(resolve, 50))

        // Press 'x' to confirm clear
        stdin.write('x')
        await new Promise((resolve) => setTimeout(resolve, 50))

        const clearFrame = lastFrame()
        expect(clearFrame).toContain('Clear All Workspace Memory?')
        expect(clearFrame).toContain('[y] Confirm and Erase')

        // Press 'n' to cancel
        stdin.write('n')
        await new Promise((resolve) => setTimeout(resolve, 50))
        expect(lastFrame()).not.toContain('Clear All Workspace Memory?')
    })

    it('closes menu when pressing Escape', async () => {
        const handleClose = mock()
        const { stdin } = renderWithProviders(
            <MemoryViewMenu onClose={handleClose} workspaceDir={testDir} />
        )

        await new Promise((resolve) => setTimeout(resolve, 50))

        stdin.write('\u001B')
        await new Promise((resolve) => setTimeout(resolve, 50))

        expect(handleClose).toHaveBeenCalled()
    })
})
