import { describe, it, expect } from 'bun:test'

import { parseUnifiedDiffToRows, formatDiffSummary, extractTurnDiffs } from '../../src/utils/diff'

describe('Diff Utils (TDD)', () => {
    it('parses unified diff hunks into lines with line numbers and fold blocks', () => {
        const rawDiff = `--- a/install.ps1
+++ b/install.ps1
@@ -19,4 +19,5 @@
-function Log-Step($msg)    { Write-Host "$Blue" }
+function Log-Step($msg)    { Write-Host "$Green" }
 context line 1
 context line 2`

        const result = parseUnifiedDiffToRows(rawDiff)
        expect(result.rows.length).toBeGreaterThan(0)
        expect(result.totalChanges).toBe(2) // 1 delete + 1 add
        expect(result.changeIndices).toContain(1)
        expect(result.changeIndices).toContain(2)

        const firstRow = result.rows[0]
        expect(firstRow?.type).toBe('fold')

        const deleteRow = result.rows[1]
        expect(deleteRow?.type).toBe('line')
        if (deleteRow && deleteRow.type === 'line') {
            expect(deleteRow.data.type).toBe('delete')
            expect(deleteRow.data.oldLineNumber).toBe(19)
            expect(deleteRow.data.content).toContain('Log-Step')
        }

        const addRow = result.rows[2]
        expect(addRow?.type).toBe('line')
        if (addRow && addRow.type === 'line') {
            expect(addRow.data.type).toBe('add')
            expect(addRow.data.newLineNumber).toBe(19)
        }
    })

    it('creates fold blocks for leading unchanged lines when start line > 1', () => {
        const rawDiff = `--- a/file.ts
+++ b/file.ts
@@ -25,2 +25,2 @@
-const x = 1
+const x = 2`

        const result = parseUnifiedDiffToRows(rawDiff)
        // Since start line is 25, there should be a fold block for lines 1-24
        const foldRow = result.rows.find((r) => r.type === 'fold')
        expect(foldRow).toBeDefined()
        if (foldRow && foldRow.type === 'fold') {
            expect(foldRow.data.count).toBe(24)
            expect(foldRow.data.isExpanded).toBe(false)
        }
    })

    it('formats diff summary counts correctly', () => {
        expect(formatDiffSummary(4)).toBe('4 file(s) changed')
        expect(formatDiffSummary(1)).toBe('1 file changed')
        expect(formatDiffSummary(0)).toBe('No files changed')
    })

    it('extracts turn diffs from agent messages', () => {
        const messages = [
            {
                role: 'user',
                content: 'change config',
            },
            {
                role: 'assistant',
                blocks: [
                    {
                        toolName: 'edit_file',
                        input: {
                            path: 'config.ts',
                            diff: '@@ -1,2 +1,2 @@\n-old\n+new',
                        },
                    },
                ],
            },
        ]

        const turns = extractTurnDiffs(messages)
        expect(turns.length).toBe(1)
        expect(turns[0]?.turn).toBe(1)
        expect(turns[0]?.files[0]?.path).toBe('config.ts')
        expect(turns[0]?.files[0]?.additions).toBe(1)
        expect(turns[0]?.files[0]?.deletions).toBe(1)
    })
})
