import { describe, expect, it, mock } from 'bun:test'
import { render } from 'ink-testing-library'
import React from 'react'

import { FileMenu } from '../../src/components/file-menu'
import { getFileQueryMatch, useFileMenu } from '../../src/components/file-menu/use-file-menu'
import { KeyboardLayerProvider } from '../../src/providers/keyboard-layer'
import { scoreAndSortFiles } from '../../src/utils/fuzzy'

describe('FileMenu Component (Unit)', () => {
    const mockFiles = [
        'AGENTS.md',
        'packages/agent/package.json',
        'packages/agent/tsconfig.json',
        'packages/agent/test/mock-provider.ts',
        'packages/agent/src/platform-adapter.ts',
        'apps/docs/src/pages/blog/self-improving-agents.mdx',
        'packages/server/src/modules/execution/execution.service.ts',
    ]

    it('renders single line paths with directory prefix and highlighted basename', () => {
        const scored = scoreAndSortFiles(mockFiles, '')
        const { lastFrame } = render(<FileMenu files={scored} selectedIndex={0} windowStart={0} />)
        const frame = lastFrame() || ''

        // Selector glyph on selected first item
        expect(frame).toContain('❭')
        // Basenames
        expect(frame).toContain('AGENTS.md')
        expect(frame).toContain('package.json')
        // Directory paths
        expect(frame).toContain('packages/agent/')
    })

    it('renders pagination overflow indicator when files exceed window size', () => {
        const scored = scoreAndSortFiles(mockFiles, '')
        expect(scored.length).toBeGreaterThan(5)

        const { lastFrame } = render(<FileMenu files={scored} selectedIndex={0} windowStart={0} />)
        const frame = lastFrame() || ''
        expect(frame).toContain('↓ 2 more')
    })

    it('renders scroll up indicator when windowStart is scrolled down', () => {
        const scored = scoreAndSortFiles(mockFiles, '')
        const { lastFrame } = render(<FileMenu files={scored} selectedIndex={5} windowStart={2} />)
        const frame = lastFrame() || ''
        expect(frame).toContain('↑ 2 more')
    })

    it('renders "No matching files" when file list is empty', () => {
        const { lastFrame } = render(<FileMenu files={[]} selectedIndex={0} windowStart={0} />)
        const frame = lastFrame() || ''
        expect(frame).toContain('No matching files')
    })
})

function TestTrigger({ onTrigger }: { onTrigger: () => void }) {
    const triggered = React.useRef(false)
    React.useLayoutEffect(() => {
        if (!triggered.current) {
            triggered.current = true
            onTrigger()
        }
    }, [onTrigger])
    return null
}

function FileMenuHarness({
    files,
    initialQuery = '@',
    onAutocomplete,
}: {
    files: string[]
    initialQuery?: string
    onAutocomplete?: (text: string) => void
}) {
    const fileMenu = useFileMenu({
        workspaceFiles: files,
        onAutocomplete: (completed) => {
            onAutocomplete?.(completed)
        },
    })

    return (
        <>
            <FileMenu
                files={fileMenu.filteredFiles}
                selectedIndex={fileMenu.selectedIndex}
                windowStart={fileMenu.windowStart}
            />
            <TestTrigger onTrigger={() => fileMenu.handleContentChange(initialQuery)} />
        </>
    )
}

describe('useFileMenu Hook (Unit)', () => {
    const mockFiles = [
        'AGENTS.md',
        'packages/agent/package.json',
        'packages/agent/tsconfig.json',
        'packages/agent/test/mock-provider.ts',
        'packages/agent/src/platform-adapter.ts',
        'apps/docs/src/pages/blog/self-improving-agents.mdx',
        'packages/server/src/modules/execution/execution.service.ts',
    ]

    it('navigates with down and up arrow keys and scrolls window', async () => {
        const { stdin, lastFrame } = render(
            <KeyboardLayerProvider>
                <FileMenuHarness files={mockFiles} />
            </KeyboardLayerProvider>
        )

        // Initial state has first item selected
        expect(lastFrame()).toContain('❭')
        expect(lastFrame()).toContain('AGENTS.md')

        // Move down
        stdin.write('\u001B[B') // Down arrow
        await new Promise((resolve) => setTimeout(resolve, 30))

        // Move down multiple times to scroll window past 5 items
        for (let i = 0; i < 4; i++) {
            stdin.write('\u001B[B')
            await new Promise((resolve) => setTimeout(resolve, 20))
        }

        const frameAfterScroll = lastFrame() || ''
        expect(frameAfterScroll).toContain('↑')
    })

    it('autocompletes on Tab keypress', async () => {
        const onAutocomplete = mock()
        const { stdin } = render(
            <KeyboardLayerProvider>
                <FileMenuHarness files={mockFiles} onAutocomplete={onAutocomplete} />
            </KeyboardLayerProvider>
        )

        stdin.write('\t') // Tab
        await new Promise((resolve) => setTimeout(resolve, 30))

        expect(onAutocomplete).toHaveBeenCalledWith('@AGENTS.md ')
    })

    it('autocompletes /open command on Tab keypress without trailing space', async () => {
        const onAutocomplete = mock()
        const { stdin } = render(
            <KeyboardLayerProvider>
                <FileMenuHarness
                    files={mockFiles}
                    initialQuery="/open AG"
                    onAutocomplete={onAutocomplete}
                />
            </KeyboardLayerProvider>
        )

        stdin.write('\t') // Tab
        await new Promise((resolve) => setTimeout(resolve, 30))

        expect(onAutocomplete).toHaveBeenCalledWith('/open AGENTS.md')
    })
})

describe('getFileQueryMatch Utility (Unit)', () => {
    it('matches @mentions at end of string', () => {
        expect(getFileQueryMatch('@')).toEqual({ type: 'at', query: '' })
        expect(getFileQueryMatch('hello @foo')).toEqual({ type: 'at', query: 'foo' })
        expect(getFileQueryMatch('@path/to/file.ts')).toEqual({
            type: 'at',
            query: 'path/to/file.ts',
        })
    })

    it('matches /open queries at start of line', () => {
        expect(getFileQueryMatch('/open ')).toEqual({ type: 'open', query: '' })
        expect(getFileQueryMatch('/open   ')).toEqual({ type: 'open', query: '' })
        expect(getFileQueryMatch('/open src/index')).toEqual({
            type: 'open',
            query: 'src/index',
        })
        expect(getFileQueryMatch('/open @src/index')).toEqual({
            type: 'open',
            query: 'src/index',
        })
    })

    it('returns null for commands without space or mid-sentence /open', () => {
        expect(getFileQueryMatch('/open')).toBeNull()
        expect(getFileQueryMatch('check out /open foo')).toBeNull()
        expect(getFileQueryMatch('/codesearch')).toBeNull()
    })
})
