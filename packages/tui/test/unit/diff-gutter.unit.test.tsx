import { render } from 'ink-testing-library'
import React from 'react'
import { describe, expect, it } from 'vitest'

import { DiffGutterView, parseDiffHunks } from '../../src/components/diff-gutter'

describe('parseDiffHunks', () => {
    it('parses raw +/- diff with startLine', () => {
        const diff = '-const a = 1\n+const a = 2'
        const lines = parseDiffHunks(diff, 10)
        expect(lines).toHaveLength(2)
        expect(lines[0]).toEqual({
            oldLineNumber: 10,
            newLineNumber: undefined,
            type: 'delete',
            content: 'const a = 1',
        })
        expect(lines[1]).toEqual({
            oldLineNumber: undefined,
            newLineNumber: 10,
            type: 'add',
            content: 'const a = 2',
        })
    })

    it('parses hunk header @@ -20,3 +20,4 @@', () => {
        const diff = '@@ -20,2 +20,3 @@\n context line\n-old line\n+new line 1\n+new line 2'
        const lines = parseDiffHunks(diff)
        expect(lines[0].type).toBe('context')
        expect(lines[0].oldLineNumber).toBe(20)
        expect(lines[0].newLineNumber).toBe(20)

        expect(lines[1].type).toBe('delete')
        expect(lines[1].oldLineNumber).toBe(21)

        expect(lines[2].type).toBe('add')
        expect(lines[2].newLineNumber).toBe(21)

        expect(lines[3].type).toBe('add')
        expect(lines[3].newLineNumber).toBe(22)
    })
})

describe('DiffGutterView Component', () => {
    it('renders collapsed state by default with file stats and clickable path', () => {
        const diff = '-old\n+new'
        const { lastFrame } = render(
            <DiffGutterView
                filePath="src/theme.ts"
                diff={diff}
                startLine={15}
                forceExpanded={false}
            />
        )
        const frame = lastFrame() || ''
        expect(frame).toContain('Updated')
        expect(frame).toContain('src/theme.ts')
        expect(frame).toContain('+1')
        expect(frame).toContain('-1')
        expect(frame).toContain('ctrl+o to view')
        // In collapsed state, lines should not be rendered
        expect(frame).not.toContain('│')
    })

    it('renders expanded gutter with line numbers and separator', () => {
        const diff = '-old code\n+new code'
        const { lastFrame } = render(
            <DiffGutterView
                filePath="src/theme.ts"
                diff={diff}
                startLine={15}
                forceExpanded={true}
            />
        )
        const frame = lastFrame() || ''
        expect(frame).toContain('ctrl+o to collapse')
        expect(frame).toContain('15')
        expect(frame).toContain('│')
        expect(frame).toContain('old code')
        expect(frame).toContain('new code')
    })
})
