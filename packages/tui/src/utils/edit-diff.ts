import fs from 'node:fs'
import path from 'node:path'

import { classifyTool, parseToolInput, toolFilePath } from './tool-kind'

export interface EditDiffRow {
    type: 'add' | 'delete' | 'context'
    lineNo?: number
    text: string
}

export interface EditPair {
    oldText: string
    newText: string
}

/** The old/new text pairs of an edit tool call (single edit or an edits array) */
export function editPairs(input: Record<string, any>): EditPair[] {
    const one = (e: Record<string, any>): EditPair => ({
        oldText: String(
            e.targetContent ?? e.TargetContent ?? e.oldText ?? e.target ?? e.Target ?? ''
        ),
        newText: String(
            e.replacementContent ??
                e.ReplacementContent ??
                e.newText ??
                e.replacement ??
                e.Replacement ??
                ''
        ),
    })
    const list = Array.isArray(input.edits)
        ? input.edits
        : Array.isArray(input.ReplacementChunks)
          ? input.ReplacementChunks
          : null
    if (list) return list.filter((e: unknown) => e && typeof e === 'object').map(one)
    const single = one(input)
    return single.oldText || single.newText ? [single] : []
}

function splitLines(text: string): string[] {
    if (!text) return []
    const lines = text.split(/\r?\n/)
    if (lines.length > 1 && lines[lines.length - 1] === '') lines.pop()
    return lines
}

/** Line diff of two small texts, interleaved like a unified diff (LCS based) */
export function diffTextLines(oldText: string, newText: string): EditDiffRow[] {
    const a = splitLines(oldText)
    const b = splitLines(newText)
    if (a.length * b.length > 250_000) {
        return [
            ...a.map((text) => ({ type: 'delete' as const, text })),
            ...b.map((text) => ({ type: 'add' as const, text })),
        ]
    }
    const dp: number[][] = Array.from({ length: a.length + 1 }, () =>
        new Array(b.length + 1).fill(0)
    )
    for (let i = a.length - 1; i >= 0; i--) {
        for (let j = b.length - 1; j >= 0; j--) {
            dp[i]![j] =
                a[i] === b[j] ? dp[i + 1]![j + 1]! + 1 : Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!)
        }
    }
    const rows: EditDiffRow[] = []
    let i = 0
    let j = 0
    while (i < a.length && j < b.length) {
        if (a[i] === b[j]) {
            rows.push({ type: 'context', text: a[i]! })
            i++
            j++
        } else if (dp[i + 1]![j]! >= dp[i]![j + 1]!) {
            rows.push({ type: 'delete', text: a[i++]! })
        } else {
            rows.push({ type: 'add', text: b[j++]! })
        }
    }
    while (i < a.length) rows.push({ type: 'delete', text: a[i++]! })
    while (j < b.length) rows.push({ type: 'add', text: b[j++]! })
    return rows
}

export function countChanges(rows: EditDiffRow[]): { added: number; removed: number } {
    let added = 0
    let removed = 0
    for (const row of rows) {
        if (row.type === 'add') added++
        else if (row.type === 'delete') removed++
    }
    return { added, removed }
}

/** Added and removed line counts of one edit or write tool call */
export function toolCallChanges(tc: { name?: string; command?: string; input?: unknown }): {
    path: string
    added: number
    removed: number
} | null {
    const kind = classifyTool(tc.name, tc.command)
    if (kind !== 'edit' && kind !== 'write') return null
    const input = parseToolInput(tc.input)
    const filePath = toolFilePath(input, tc.command)
    if (kind === 'write') {
        const content = String(
            input.content ?? input.Content ?? input.CodeContent ?? input.code ?? ''
        )
        return { path: filePath, added: splitLines(content).length, removed: 0 }
    }
    let added = 0
    let removed = 0
    for (const pair of editPairs(input)) {
        const counts = countChanges(diffTextLines(pair.oldText, pair.newText))
        added += counts.added
        removed += counts.removed
    }
    return { path: filePath, added, removed }
}

const fileCache = new Map<string, { mtimeMs: number; lines: string[] }>()

function readLines(filePath: string): string[] | null {
    try {
        const abs = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath)
        const stat = fs.statSync(abs)
        const cached = fileCache.get(abs)
        if (cached && cached.mtimeMs === stat.mtimeMs) return cached.lines
        if (stat.size > 2_000_000) return null
        const lines = fs.readFileSync(abs, 'utf8').split(/\r?\n/)
        fileCache.set(abs, { mtimeMs: stat.mtimeMs, lines })
        return lines
    } catch {
        // Intentionally swallowed: without the file the diff shows no line numbers
        return null
    }
}

/**
 * Rows for the open diff of an edit (S4): the change with real line numbers and one line
 * of context, found by locating the new text in the file after the edit.
 */
/** Lines the edit tool reports in its result: "(line 15)" or "applied at lines 12, 40" (F8) */
export function editResultLines(output?: string): number[] {
    if (!output) return []
    const one = output.match(/\(line (\d+)\)/)
    if (one) return [Number(one[1])]
    const many = output.match(/applied at lines ([\d, ]+)\)/)
    return many
        ? many[1]!
              .split(/,\s*/)
              .map(Number)
              .filter((n) => n > 0)
        : []
}

function matchesAt(fileLines: string[], start: number, newLines: string[]): boolean {
    if (start < 0 || start + newLines.length > fileLines.length) return false
    return newLines.every((line, k) => fileLines[start + k] === line)
}

export function editDiffRows(
    filePath: string,
    pairs: EditPair[],
    hintLines: number[] = []
): EditDiffRow[] {
    const fileLines = filePath ? readLines(filePath) : null
    const rows: EditDiffRow[] = []
    pairs.forEach((pair, pairIndex) => {
        const diff = diffTextLines(pair.oldText, pair.newText)
        const newLines = splitLines(pair.newText)
        let start = -1
        // The line from the edit tool result comes first (F8): the hint that fits this edit,
        // else the hint in the same position. The search below is the fallback.
        const fitting = fileLines
            ? hintLines.find((h) => matchesAt(fileLines, h - 1, newLines))
            : undefined
        if (fitting !== undefined) start = fitting - 1
        else if (!fileLines && hintLines.length === pairs.length) {
            let newNo = hintLines[pairIndex]!
            let oldNo = newNo
            for (const row of diff) {
                if (row.type === 'add') rows.push({ ...row, lineNo: newNo++ })
                else if (row.type === 'delete') rows.push({ ...row, lineNo: oldNo++ })
                else {
                    rows.push({ ...row, lineNo: newNo })
                    newNo++
                    oldNo++
                }
            }
            return
        }
        if (start < 0 && fileLines && newLines.length > 0) {
            for (let i = 0; i + newLines.length <= fileLines.length; i++) {
                let match = true
                for (let k = 0; k < newLines.length; k++) {
                    if (fileLines[i + k] !== newLines[k]) {
                        match = false
                        break
                    }
                }
                if (match) {
                    start = i
                    break
                }
            }
        }
        if (start < 0) {
            rows.push(...diff)
            return
        }
        if (start > 0) rows.push({ type: 'context', lineNo: start, text: fileLines![start - 1]! })
        let newNo = start + 1
        let oldNo = start + 1
        for (const row of diff) {
            if (row.type === 'add') rows.push({ ...row, lineNo: newNo++ })
            else if (row.type === 'delete') rows.push({ ...row, lineNo: oldNo++ })
            else {
                rows.push({ ...row, lineNo: newNo })
                newNo++
                oldNo++
            }
        }
        const after = start + newLines.length
        if (fileLines && after < fileLines.length) {
            rows.push({ type: 'context', lineNo: after + 1, text: fileLines[after]! })
        }
    })
    return rows
}
