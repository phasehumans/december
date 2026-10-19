import { describe, expect, it, mock } from 'bun:test'
import React from 'react'

import { CodeSearchMenu } from '../../src/components/menus/code-search-menu'
import { renderWithProviders } from '../test-providers'

import type { CodeSearchResultItem } from '../../src/types'

describe('CodeSearchMenu Component (Unit)', () => {
    it('renders empty message when no results are found', () => {
        const handleClose = mock()
        const { lastFrame } = renderWithProviders(
            <CodeSearchMenu
                codeSearchQuery="nonexistent"
                codeSearchResults={[]}
                onClose={handleClose}
            />
        )
        const frame = lastFrame()

        expect(frame).toContain('Code Search')
        expect(frame).toContain('nonexistent')
        expect(frame).toContain('No matches found in workspace.')
        expect(frame).toContain('dismiss')
    })

    it('renders compact single-line search results with file, line, and snippet', () => {
        const items: CodeSearchResultItem[] = [
            { file: 'src/app.tsx', line: 42, content: 'const app = express()' },
            { file: 'src/config.ts', line: 15, content: 'export const PORT = 3000' },
        ]
        const { lastFrame } = renderWithProviders(
            <CodeSearchMenu codeSearchQuery="express" codeSearchResults={items} />
        )
        const frame = lastFrame()

        expect(frame).toContain('Code Search')
        expect(frame).toContain('express')
        expect(frame).toContain('2 matches')
        expect(frame).toContain('src/app.tsx:42')
        expect(frame).toContain('const app = express()')
        expect(frame).toContain('src/config.ts:15')
        expect(frame).toContain('export const PORT = 3000')
        expect(frame).toContain('navigate')
        expect(frame).toContain('view file')
        expect(frame).toContain('insert @file:line')
    })

    it('renders sliding window overflow status when results exceed window size', async () => {
        const items: CodeSearchResultItem[] = Array.from({ length: 10 }, (_, i) => ({
            file: `src/file${i}.ts`,
            line: i + 1,
            content: `match ${i}`,
        }))

        const { lastFrame, stdin } = renderWithProviders(
            <CodeSearchMenu codeSearchQuery="match" codeSearchResults={items} />
        )

        let frame = lastFrame()
        expect(frame).toContain('1/10')
        expect(frame).toContain('↓ 4 more')

        // Move down 2 items
        stdin.write('\u001B[B')
        await new Promise((resolve) => setTimeout(resolve, 30))
        stdin.write('\u001B[B')
        await new Promise((resolve) => setTimeout(resolve, 30))
        frame = lastFrame()
        expect(frame).toContain('3/10')
    })

    it('triggers onOpenCodeSearchResult on Enter without calling onClose', () => {
        const onOpen = mock()
        const onClose = mock()
        const items: CodeSearchResultItem[] = [
            { file: 'src/test.ts', line: 10, content: 'test result' },
        ]

        const { stdin } = renderWithProviders(
            <CodeSearchMenu
                codeSearchQuery="test"
                codeSearchResults={items}
                onOpenCodeSearchResult={onOpen}
                onClose={onClose}
            />
        )

        stdin.write('\r')
        expect(onOpen).toHaveBeenCalledTimes(1)
        expect(onOpen).toHaveBeenCalledWith(items[0])
        expect(onClose).not.toHaveBeenCalled()
    })

    it('triggers onInsertCodeSearchResult on Tab', () => {
        const onInsert = mock()
        const onClose = mock()
        const items: CodeSearchResultItem[] = [
            { file: 'src/test.ts', line: 10, content: 'test result' },
        ]

        const { stdin } = renderWithProviders(
            <CodeSearchMenu
                codeSearchQuery="test"
                codeSearchResults={items}
                onInsertCodeSearchResult={onInsert}
                onClose={onClose}
            />
        )

        stdin.write('\t')
        expect(onInsert).toHaveBeenCalledTimes(1)
        expect(onInsert).toHaveBeenCalledWith(items[0])
        expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('closes on Escape', async () => {
        const onClose = mock()
        const { stdin } = renderWithProviders(
            <CodeSearchMenu codeSearchQuery="foo" codeSearchResults={[]} onClose={onClose} />
        )

        stdin.write('\x1B')
        await new Promise((resolve) => setTimeout(resolve, 50))
        expect(onClose).toHaveBeenCalledTimes(1)
    })
})
