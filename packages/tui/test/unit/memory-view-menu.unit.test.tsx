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

    it('renders memory view menu with tabs, file header, and line-numbered viewport', async () => {
        const handleClose = mock()
        const { lastFrame } = renderWithProviders(
            <MemoryViewMenu onClose={handleClose} workspaceDir={testDir} />
        )

        // Wait a tick for async loading
        await new Promise((resolve) => setTimeout(resolve, 50))
        const frame = lastFrame()

        expect(frame).toContain('memory.md')
        expect(frame).toContain('AGENTS.md')
        expect(frame).toContain('lowercase commits')
        expect(frame).toContain('no em dashes')
        expect(frame).toContain('bun test before push')
        expect(frame).toContain('line')
    })

    it('switches between memory.md and AGENTS.md tabs via Tab or arrow keys', async () => {
        const handleClose = mock()
        const { lastFrame, stdin } = renderWithProviders(
            <MemoryViewMenu onClose={handleClose} workspaceDir={testDir} />
        )

        await new Promise((resolve) => setTimeout(resolve, 50))
        expect(lastFrame()).toContain('lowercase commits')

        // Press Tab to switch to AGENTS.md
        stdin.write('\t')
        await new Promise((resolve) => setTimeout(resolve, 50))

        const rulesFrame = lastFrame()
        expect(rulesFrame).toContain('Project Guidelines')
        expect(rulesFrame).toContain('follow module architecture')

        // Press Left arrow to switch back to memory.md
        stdin.write('\u001B[D')
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
        expect(frame).toContain('AGENTS.md')
        expect(frame).toContain('Project Guidelines')
        expect(frame).toContain('follow module architecture')
    })

    it('scrolls content with Up/Down arrow keys', async () => {
        const handleClose = mock()
        const { lastFrame, stdin } = renderWithProviders(
            <MemoryViewMenu onClose={handleClose} workspaceDir={testDir} />
        )

        await new Promise((resolve) => setTimeout(resolve, 50))
        expect(lastFrame()).toContain('line 1:')

        // Down arrow scrolls down
        stdin.write('\u001B[B')
        await new Promise((resolve) => setTimeout(resolve, 50))
        expect(lastFrame()).toContain('line 2:')

        // Up arrow scrolls back up
        stdin.write('\u001B[A')
        await new Promise((resolve) => setTimeout(resolve, 50))
        expect(lastFrame()).toContain('line 1:')
    })

    it('does not scroll with j or k keys (arrow navigation only)', async () => {
        const handleClose = mock()
        const { lastFrame, stdin } = renderWithProviders(
            <MemoryViewMenu onClose={handleClose} workspaceDir={testDir} />
        )

        await new Promise((resolve) => setTimeout(resolve, 50))
        expect(lastFrame()).toContain('line 1:')

        // Press 'j' - should NOT scroll
        stdin.write('j')
        await new Promise((resolve) => setTimeout(resolve, 50))
        expect(lastFrame()).toContain('line 1:')

        // Press 'k' - should NOT scroll
        stdin.write('k')
        await new Promise((resolve) => setTimeout(resolve, 50))
        expect(lastFrame()).toContain('line 1:')
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
