import { describe, it, expect, mock } from 'bun:test'
import { render } from 'ink-testing-library'
import React from 'react'

import { DiffViewMenu } from '../../src/components/menus/diff-view-menu'
import { THEME } from '../../src/theme'

import type { DiffFileEntry } from '../../src/utils/diff'

describe('DiffViewMenu Component (Unit)', () => {
    const mockFiles: DiffFileEntry[] = [
        {
            path: 'public/_headers',
            additions: 9,
            deletions: 0,
            status: 'modified',
            diff: '@@ -1,1 +1,10 @@\n-old\n+new line 1\n+new line 2',
        },
        {
            path: 'public/install.ps1',
            additions: 22,
            deletions: 17,
            status: 'modified',
            diff: '@@ -19,4 +19,4 @@\n-$Trunk = "old"\n+$Trunk = "new"\n-function Log-Step() {}\n+function Log-Step() { Write-Host }',
        },
        {
            path: 'test/config.test.ts',
            additions: 14,
            deletions: 0,
            status: 'modified',
            diff: '@@ -1,1 +1,15 @@\n+test("sample", () => {})',
        },
        {
            path: 'install.ps1',
            additions: 22,
            deletions: 17,
            status: 'modified',
            diff: '@@ -19,2 +19,2 @@\n-old line\n+new line',
        },
    ]

    it('renders file count summary, list of changed files with additions/deletions, and branded footer without tabs or model', () => {
        const { lastFrame } = render(<DiffViewMenu filesData={mockFiles} />)
        const output = lastFrame() || ''

        // No tabs
        expect(output).not.toContain('Diff (git)')
        expect(output).not.toContain('All Changes')
        expect(output).not.toContain('Per Turn')
        expect(output).not.toContain('Commit Tree')

        // File count summary
        expect(output).toContain('4 file(s) changed')

        // Files with stats
        expect(output).toContain('public/_headers')
        expect(output).toContain('+9')
        expect(output).toContain('public/install.ps1')
        expect(output).toContain('+22')
        expect(output).toContain('-17')
        expect(output).toContain('test/config.test.ts')
        expect(output).toContain('install.ps1')

        // Branded footer items
        expect(output).toContain('←/→')
        expect(output).toContain('switch view')
        expect(output).toContain('↑/↓/j/k')
        expect(output).toContain('navigate')
        expect(output).toContain('enter')
        expect(output).toContain('view diff')
        expect(output).toContain('esc')
        expect(output).toContain('dismiss')

        // No model label
        expect(output).not.toContain('Gemini')
        expect(output).not.toContain('Flash')
    })

    it('navigates file list with down and up arrows', async () => {
        const { lastFrame, stdin } = render(<DiffViewMenu filesData={mockFiles} />)
        expect(lastFrame()).toContain(`${THEME.glyphs.selector} public/_headers`)

        stdin.write('\u001B[B') // Down arrow
        await new Promise((r) => setTimeout(r, 20))
        expect(lastFrame()).toContain(`${THEME.glyphs.selector} public/install.ps1`)

        stdin.write('\u001B[A') // Up arrow
        await new Promise((r) => setTimeout(r, 20))
        expect(lastFrame()).toContain(`${THEME.glyphs.selector} public/_headers`)
    })

    it('opens detail view on Enter and renders diff lines, line numbers, and position indicator', async () => {
        const { lastFrame, stdin } = render(
            <DiffViewMenu filesData={mockFiles} initialSelectedIndex={1} />
        )

        // Press Enter to view diff
        stdin.write('\r')
        await new Promise((r) => setTimeout(r, 20))

        const output = lastFrame() || ''
        expect(output).toContain('public/install.ps1')
        expect(output).toContain('+22')
        expect(output).toContain('-17')
        expect(output).toContain('file 2/4')
        expect(output).toContain('change')

        // Detail footer items (clean without ctrl+o)
        expect(output).toContain('n/N')
        expect(output).toContain('next/prev diff')
        expect(output).toContain('←/→')
        expect(output).toContain('cycle file')
        expect(output).not.toContain('ctrl+o')
        expect(output).not.toContain('expand')
        expect(output).toContain('esc')
        expect(output).toContain('back')

        // No full file, comments, or model label in detail view
        expect(output).not.toContain('full file')
        expect(output).not.toContain('comment')
        expect(output).not.toContain('Gemini')
    })

    it('strict 1-step Esc navigation: Esc in detail view returns to file list without calling onClose or setAuthMode', async () => {
        const onClose = mock(() => {})
        const setAuthMode = mock(() => {})

        const { lastFrame, stdin } = render(
            <DiffViewMenu
                filesData={mockFiles}
                initialSelectedIndex={0}
                initialDetailView={true}
                onClose={onClose}
                setAuthMode={setAuthMode}
            />
        )

        // Currently in detail view
        expect(lastFrame()).toContain('public/_headers')
        expect(lastFrame()).toContain('file 1/4')

        // Press Esc in detail view
        stdin.write('\u001B')
        await new Promise((r) => setTimeout(r, 20))

        // Must step back to file list view
        expect(lastFrame()).toContain('4 file(s) changed')
        expect(lastFrame()).toContain('public/_headers')

        // Must NOT have closed the menu
        expect(onClose).not.toHaveBeenCalled()
        expect(setAuthMode).not.toHaveBeenCalled()

        // Press Esc again from file list view
        stdin.write('\u001B')
        await new Promise((r) => setTimeout(r, 20))

        // Now it must dismiss the diff viewer
        expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('cycles files in detail view with left and right arrow keys', async () => {
        const { lastFrame, stdin } = render(
            <DiffViewMenu filesData={mockFiles} initialSelectedIndex={0} initialDetailView={true} />
        )

        expect(lastFrame()).toContain('public/_headers')
        expect(lastFrame()).toContain('file 1/4')

        // Press right arrow to cycle next file
        stdin.write('\u001B[C')
        await new Promise((r) => setTimeout(r, 20))

        expect(lastFrame()).toContain('public/install.ps1')
        expect(lastFrame()).toContain('file 2/4')

        // Press left arrow to cycle back
        stdin.write('\u001B[D')
        await new Promise((r) => setTimeout(r, 20))

        expect(lastFrame()).toContain('public/_headers')
        expect(lastFrame()).toContain('file 1/4')
    })

    it('windows file list with sliding window and indicators when files exceed WINDOW_SIZE (6)', async () => {
        const manyFiles: DiffFileEntry[] = Array.from({ length: 9 }, (_, i) => ({
            path: `src/file-${i + 1}.ts`,
            additions: 5,
            deletions: 2,
            status: 'modified' as const,
            diff: '@@ -1,1 +1,2 @@\n-old\n+new',
        }))

        const { lastFrame, stdin } = render(<DiffViewMenu filesData={manyFiles} />)
        const frameInitial = lastFrame() || ''

        // Initially shows first 6 files and indicator for remaining 3 files below
        expect(frameInitial).toContain('src/file-1.ts')
        expect(frameInitial).toContain('src/file-6.ts')
        expect(frameInitial).not.toContain('src/file-7.ts')
        expect(frameInitial).toContain('↓ 3 more')
        expect(frameInitial).not.toContain('more lines')

        // Move down 6 times past file 6 to reach file 7
        for (let i = 0; i < 6; i++) {
            stdin.write('\u001B[B') // Down arrow
            await new Promise((r) => setTimeout(r, 10))
        }

        const frameAfterScroll = lastFrame() || ''
        expect(frameAfterScroll).toContain('↑ 1 more')
        expect(frameAfterScroll).toContain('src/file-7.ts')
        expect(frameAfterScroll).toContain('↓ 2 more')
    })

    it('navigates file list with mouse wheel down and up', async () => {
        const manyFiles: DiffFileEntry[] = Array.from({ length: 9 }, (_, i) => ({
            path: `src/file-${i + 1}.ts`,
            additions: 5,
            deletions: 2,
            status: 'modified' as const,
            diff: '@@ -1,1 +1,2 @@\n-old\n+new',
        }))

        const { lastFrame, stdin } = render(<DiffViewMenu filesData={manyFiles} />)
        expect(lastFrame()).toContain(`${THEME.glyphs.selector} src/file-1.ts`)

        // Mouse wheel down: \u001B[<65;10;10M
        stdin.write('\u001B[<65;10;10M')
        await new Promise((r) => setTimeout(r, 20))

        expect(lastFrame()).toContain(`${THEME.glyphs.selector} src/file-2.ts`)

        // Mouse wheel up: \u001B[<64;10;10M
        stdin.write('\u001B[<64;10;10M')
        await new Promise((r) => setTimeout(r, 20))

        expect(lastFrame()).toContain(`${THEME.glyphs.selector} src/file-1.ts`)
    })
})
