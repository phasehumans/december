import { describe, it, expect, mock } from 'bun:test'
import { render } from 'ink-testing-library'
import React from 'react'

import { DiffViewMenu } from '../../src/components/menus/diff-view-menu'

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

    const mockCommitTree = [
        '@  Working Copy (Uncommitted Changes)',
        '* 3ff91f8 - feat: add /diff command (2m ago) <chaitanya>',
        '* 1234abc - fix: previous bug (1h ago) <chaitanya>',
    ]

    it('renders tabs, file count summary, and list of changed files with additions/deletions', () => {
        const { lastFrame } = render(
            <DiffViewMenu
                filesData={mockFiles}
                commitTreeData={mockCommitTree}
                modelLabel="Gemini 3.8 Flash · high"
            />
        )
        const output = lastFrame() || ''

        // Tabs
        expect(output).toContain('Diff (git)')
        expect(output).toContain('All Changes')
        expect(output).toContain('Per Turn')
        expect(output).toContain('Commit Tree')

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

        // Footer & model
        expect(output).toContain('←/→ switch view')
        expect(output).toContain('enter view diff')
        expect(output).toContain('Gemini 3.8 Flash · high')
    })

    it('navigates file list with down and up arrows', async () => {
        const { lastFrame, stdin } = render(
            <DiffViewMenu filesData={mockFiles} commitTreeData={mockCommitTree} />
        )
        expect(lastFrame()).toContain('> public/_headers')

        stdin.write('\u001B[B') // Down arrow
        await new Promise((r) => setTimeout(r, 20))
        expect(lastFrame()).toContain('> public/install.ps1')

        stdin.write('\u001B[A') // Up arrow
        await new Promise((r) => setTimeout(r, 20))
        expect(lastFrame()).toContain('> public/_headers')
    })

    it('switches to Commit Tree tab on Tab keypress', async () => {
        const { lastFrame, stdin } = render(
            <DiffViewMenu filesData={mockFiles} commitTreeData={mockCommitTree} />
        )

        // Press Tab to switch views
        stdin.write('\t')
        await new Promise((r) => setTimeout(r, 20))
        // Tab 1 -> All Changes
        stdin.write('\t')
        await new Promise((r) => setTimeout(r, 20))
        // Tab 2 -> Per Turn
        stdin.write('\t')
        await new Promise((r) => setTimeout(r, 20))
        // Tab 3 -> Commit Tree

        const output = lastFrame() || ''
        expect(output).toContain('Working Copy (Uncommitted Changes)')
        expect(output).toContain('3ff91f8')
    })

    it('opens detail view on Enter and renders diff lines, line numbers, and position indicator', async () => {
        const { lastFrame, stdin } = render(
            <DiffViewMenu
                filesData={mockFiles}
                commitTreeData={mockCommitTree}
                initialSelectedIndex={1} // public/install.ps1
                modelLabel="Gemini 3.8 Flash · high"
            />
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
        expect(output).toContain('n/N next/prev diff')
        expect(output).toContain('ctrl+o expand')
        expect(output).toContain('c comment')

        // Esc returns back to file list
        stdin.write('\u001B')
        await new Promise((r) => setTimeout(r, 20))
        expect(lastFrame()).toContain('4 file(s) changed')
    })

    it('allows adding and viewing review comments with c key in detail view', async () => {
        const onCommentAdded = mock(() => {})
        const { lastFrame, stdin } = render(
            <DiffViewMenu
                filesData={mockFiles}
                commitTreeData={mockCommitTree}
                initialSelectedIndex={0}
                initialDetailView={true}
                onCommentAdded={onCommentAdded}
            />
        )

        // Press 'c' to initiate comment
        stdin.write('c')
        await new Promise((r) => setTimeout(r, 20))

        expect(lastFrame()).toContain('💬 Comment:')

        // Type comment text
        stdin.write('Keep this header')
        await new Promise((r) => setTimeout(r, 20))

        // Press Enter to save
        stdin.write('\r')
        await new Promise((r) => setTimeout(r, 20))

        expect(lastFrame()).toContain('💬 Comment: Keep this header')
        expect(onCommentAdded).toHaveBeenCalled()
    })
})
