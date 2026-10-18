import { exec } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'

const execAsync = promisify(exec)

export type DiffTab = 'git' | 'all' | 'turns' | 'tree'

export interface DiffFileEntry {
    path: string
    additions: number
    deletions: number
    status: 'modified' | 'added' | 'deleted' | 'untracked'
    diff: string
}

export interface DiffHunkLine {
    oldLineNumber?: number
    newLineNumber?: number
    type: 'add' | 'delete' | 'context'
    content: string
}

export interface FoldBlock {
    id: string
    count: number
    startOld: number
    startNew: number
    preview: string
    isExpanded: boolean
    lines?: string[]
}

export type DiffRow =
    | { type: 'line'; data: DiffHunkLine; index: number }
    | { type: 'fold'; data: FoldBlock; index: number }

export interface DiffComment {
    filePath: string
    lineNumber: number
    text: string
    createdAt: Date
}

export interface ChangeBlock {
    startIndex: number
    endIndex: number
}

export function formatDiffSummary(count: number): string {
    if (count === 0) return 'No files changed'
    if (count === 1) return '1 file changed'
    return `${count} file(s) changed`
}

export function parseUnifiedDiffToRows(
    diffText: string,
    options?: {
        fullContent?: string | null
        expandedFolds?: Record<string, boolean>
    }
): {
    rows: DiffRow[]
    totalChanges: number
    changeIndices: number[]
    changeBlocks: ChangeBlock[]
} {
    const rawLines = (diffText || '').trim().split(/\r?\n/)
    const rows: DiffRow[] = []
    const changeIndices: number[] = []
    const fullLines = options?.fullContent ? options.fullContent.split(/\r?\n/) : null

    const getFoldPreview = (start: number, count: number): string => {
        if (fullLines && start - 1 >= 0 && start - 1 < fullLines.length) {
            const line = fullLines[start - 1]?.trim()
            if (line) {
                return line.length > 50 ? `${line.slice(0, 47)}...` : line
            }
        }
        return `line ${start}..${start + count - 1}`
    }

    let oldLine = 1
    let newLine = 1
    let lastOldLine = 1
    let lastNewLine = 1
    let isFirstHunk = true
    let rowIndex = 0

    for (let i = 0; i < rawLines.length; i++) {
        const raw = rawLines[i] ?? ''
        if (!raw) continue

        // Match hunk header e.g. @@ -19,4 +19,5 @@
        const hunkMatch = raw.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/)
        if (hunkMatch) {
            const hunkOldStart = parseInt(hunkMatch[1] || '1', 10)
            const hunkNewStart = parseInt(hunkMatch[3] || '1', 10)

            // If there are unchanged lines before this hunk, add a fold block
            if (isFirstHunk) {
                if (hunkOldStart > 1) {
                    const foldCount = hunkOldStart - 1
                    const foldId = `fold-0-${hunkOldStart}`
                    const isExpanded = options?.expandedFolds?.[foldId] ?? false

                    if (fullLines && isExpanded) {
                        for (let f = 0; f < foldCount; f++) {
                            const curOld = 1 + f
                            const curNew = 1 + f
                            rows.push({
                                type: 'line',
                                index: rowIndex++,
                                data: {
                                    oldLineNumber: curOld,
                                    newLineNumber: curNew,
                                    type: 'context',
                                    content: fullLines[curOld - 1] ?? '',
                                },
                            })
                        }
                    } else {
                        rows.push({
                            type: 'fold',
                            index: rowIndex++,
                            data: {
                                id: foldId,
                                count: foldCount,
                                startOld: 1,
                                startNew: 1,
                                preview: getFoldPreview(1, foldCount),
                                isExpanded,
                            },
                        })
                    }
                }
                isFirstHunk = false
            } else if (hunkOldStart > lastOldLine) {
                const gapCount = hunkOldStart - lastOldLine
                if (gapCount > 0) {
                    const foldId = `fold-${lastOldLine}-${hunkOldStart}`
                    const isExpanded = options?.expandedFolds?.[foldId] ?? false

                    if (fullLines && isExpanded) {
                        for (let f = 0; f < gapCount; f++) {
                            const curOld = lastOldLine + f
                            const curNew = lastNewLine + f
                            rows.push({
                                type: 'line',
                                index: rowIndex++,
                                data: {
                                    oldLineNumber: curOld,
                                    newLineNumber: curNew,
                                    type: 'context',
                                    content: fullLines[curOld - 1] ?? '',
                                },
                            })
                        }
                    } else {
                        rows.push({
                            type: 'fold',
                            index: rowIndex++,
                            data: {
                                id: foldId,
                                count: gapCount,
                                startOld: lastOldLine,
                                startNew: lastNewLine,
                                preview: getFoldPreview(lastOldLine, gapCount),
                                isExpanded,
                            },
                        })
                    }
                }
            }

            oldLine = hunkOldStart
            newLine = hunkNewStart
            continue
        }

        if (raw.startsWith('---') || raw.startsWith('+++') || raw.startsWith('diff --git')) {
            continue
        }

        if (raw.startsWith('+')) {
            changeIndices.push(rowIndex)
            rows.push({
                type: 'line',
                index: rowIndex++,
                data: {
                    newLineNumber: newLine++,
                    type: 'add',
                    content: raw.slice(1),
                },
            })
            lastNewLine = newLine
        } else if (raw.startsWith('-')) {
            changeIndices.push(rowIndex)
            rows.push({
                type: 'line',
                index: rowIndex++,
                data: {
                    oldLineNumber: oldLine++,
                    type: 'delete',
                    content: raw.slice(1),
                },
            })
            lastOldLine = oldLine
        } else {
            const content = raw.startsWith(' ') ? raw.slice(1) : raw
            rows.push({
                type: 'line',
                index: rowIndex++,
                data: {
                    oldLineNumber: oldLine++,
                    newLineNumber: newLine++,
                    type: 'context',
                    content,
                },
            })
            lastOldLine = oldLine
            lastNewLine = newLine
        }
    }

    if (fullLines && lastOldLine <= fullLines.length) {
        const trailingCount = fullLines.length - lastOldLine + 1
        if (trailingCount > 0) {
            const foldId = `fold-${lastOldLine}-${fullLines.length}`
            const isExpanded = options?.expandedFolds?.[foldId] ?? false
            if (isExpanded) {
                for (let f = 0; f < trailingCount; f++) {
                    const curOld = lastOldLine + f
                    const curNew = lastNewLine + f
                    rows.push({
                        type: 'line',
                        index: rowIndex++,
                        data: {
                            oldLineNumber: curOld,
                            newLineNumber: curNew,
                            type: 'context',
                            content: fullLines[curOld - 1] ?? '',
                        },
                    })
                }
            } else {
                rows.push({
                    type: 'fold',
                    index: rowIndex,
                    data: {
                        id: foldId,
                        count: trailingCount,
                        startOld: lastOldLine,
                        startNew: lastNewLine,
                        preview: getFoldPreview(lastOldLine, trailingCount),
                        isExpanded,
                    },
                })
            }
        }
    }

    const totalChanges = changeIndices.length

    // Compute contiguous change blocks (hunks of additions/deletions)
    const changeBlocks: ChangeBlock[] = []
    let currentBlock: ChangeBlock | null = null

    for (const row of rows) {
        if (row.type === 'line' && (row.data.type === 'add' || row.data.type === 'delete')) {
            if (!currentBlock) {
                currentBlock = { startIndex: row.index, endIndex: row.index }
            } else {
                currentBlock.endIndex = row.index
            }
        } else {
            if (currentBlock) {
                changeBlocks.push(currentBlock)
                currentBlock = null
            }
        }
    }
    if (currentBlock) {
        changeBlocks.push(currentBlock)
    }

    return { rows, totalChanges, changeIndices, changeBlocks }
}

export async function fetchGitStatusFiles(
    workspaceDir: string = process.cwd()
): Promise<DiffFileEntry[]> {
    try {
        const { stdout: statusOut } = await execAsync('git status --porcelain', {
            cwd: workspaceDir,
            timeout: 5000,
        })

        if (!statusOut.trim()) {
            return []
        }

        const lines = statusOut.split(/\r?\n/)
        const results: DiffFileEntry[] = []

        // Fetch numstat for tracked files
        const numstatMap: Record<string, { additions: number; deletions: number }> = {}
        try {
            const { stdout: numstatOut } = await execAsync('git diff HEAD --numstat', {
                cwd: workspaceDir,
                timeout: 5000,
            })
            for (const line of numstatOut.trim().split('\n')) {
                const parts = line.split('\t')
                if (parts.length >= 3) {
                    const adds = parseInt(parts[0] || '0', 10) || 0
                    const dels = parseInt(parts[1] || '0', 10) || 0
                    const p = parts[2]?.trim() || ''
                    if (p) numstatMap[p] = { additions: adds, deletions: dels }
                }
            }
        } catch {
            // Intentionally swallowed: fallback to unstaged diff numstat
            try {
                const { stdout: numstatOut } = await execAsync('git diff --numstat', {
                    cwd: workspaceDir,
                    timeout: 5000,
                })
                for (const line of numstatOut.trim().split('\n')) {
                    const parts = line.split('\t')
                    if (parts.length >= 3) {
                        const adds = parseInt(parts[0] || '0', 10) || 0
                        const dels = parseInt(parts[1] || '0', 10) || 0
                        const p = parts[2]?.trim() || ''
                        if (p) numstatMap[p] = { additions: adds, deletions: dels }
                    }
                }
            } catch {
                // Intentionally swallowed: numstat failure handled
            }
        }

        // Fetch complete unified diff for tracked files
        let fullTrackedDiff = ''
        try {
            const { stdout: diffOut } = await execAsync('git diff HEAD', {
                cwd: workspaceDir,
                timeout: 5000,
            })
            fullTrackedDiff = diffOut
        } catch {
            try {
                const { stdout: diffOut } = await execAsync('git diff', {
                    cwd: workspaceDir,
                    timeout: 5000,
                })
                fullTrackedDiff = diffOut
            } catch {
                fullTrackedDiff = ''
            }
        }

        // Also get cached / staged diff if any
        try {
            const { stdout: cachedDiff } = await execAsync('git diff --cached', {
                cwd: workspaceDir,
                timeout: 5000,
            })
            if (cachedDiff && !fullTrackedDiff.includes(cachedDiff.trim())) {
                fullTrackedDiff = `${cachedDiff}\n${fullTrackedDiff}`
            }
        } catch {
            // Intentionally swallowed: cached diff unavailable
        }

        // Split full tracked diff into file blocks
        const diffBlocksByFile: Record<string, string> = {}
        const diffBlockRegex = /^diff --git a\/(.+?) b\/(.+?)$/gm
        let match: RegExpExecArray | null
        const blockIndices: Array<{ file: string; start: number }> = []

        while ((match = diffBlockRegex.exec(fullTrackedDiff)) !== null) {
            const matchedFile = match[2] || match[1]
            if (matchedFile) {
                blockIndices.push({ file: matchedFile, start: match.index })
            }
        }

        for (let i = 0; i < blockIndices.length; i++) {
            const cur = blockIndices[i]
            if (!cur) continue
            const next = blockIndices[i + 1]
            const end = next ? next.start : fullTrackedDiff.length
            const blockContent = fullTrackedDiff.slice(cur.start, end).trim()
            diffBlocksByFile[cur.file] = blockContent
        }

        for (const line of lines) {
            if (!line || line.trim().length === 0) continue

            let code = ''
            let rawFilePath = ''
            if (/^[ MADRCU?!]{2} /.test(line)) {
                code = line.slice(0, 2)
                rawFilePath = line.slice(3).trim()
            } else if (/^[MADRCU?!] /.test(line.trimStart())) {
                const trimmed = line.trimStart()
                code = trimmed.slice(0, 1)
                rawFilePath = trimmed.slice(2).trim()
            } else {
                code = line.slice(0, 2)
                rawFilePath = line.slice(3).trim()
            }

            if (rawFilePath.includes(' -> ')) {
                rawFilePath = rawFilePath.split(' -> ').pop() || rawFilePath
            }
            const cleanPath = rawFilePath.replace(/^"|"$/g, '').trim()
            if (!cleanPath) continue

            let status: DiffFileEntry['status'] = 'modified'
            if (code === '??') {
                status = 'untracked'
            } else if (code.includes('A')) {
                status = 'added'
            } else if (code.includes('D')) {
                status = 'deleted'
            }

            let fileDiff = diffBlocksByFile[cleanPath] || ''
            let additions = numstatMap[cleanPath]?.additions || 0
            let deletions = numstatMap[cleanPath]?.deletions || 0

            // If untracked, generate synthetic diff from file content
            if (status === 'untracked') {
                try {
                    const absPath = path.resolve(workspaceDir, cleanPath)
                    const content = await fs.readFile(absPath, 'utf8')
                    const contentLines = content.split('\n')
                    additions = contentLines.length
                    deletions = 0
                    fileDiff = [
                        `--- /dev/null`,
                        `+++ b/${cleanPath}`,
                        `@@ -0,0 +1,${contentLines.length} @@`,
                        ...contentLines.map((l) => `+${l}`),
                    ].join('\n')
                } catch {
                    // Intentionally swallowed: unreadable untracked file fallback
                    fileDiff = `--- /dev/null\n+++ b/${cleanPath}\n@@ -0,0 +1,1 @@\n+[untracked file]`
                    additions = 1
                }
            } else if (!fileDiff) {
                // If tracked but diff not found in block, run targeted git diff
                try {
                    const { stdout: singleDiff } = await execAsync(
                        `git diff HEAD -- "${cleanPath}"`,
                        {
                            cwd: workspaceDir,
                            timeout: 3000,
                        }
                    )
                    fileDiff = singleDiff.trim()
                } catch {
                    // Intentionally swallowed: fallback to generic git diff
                }
            }

            // Fallback addition/deletion counting from diff text if numstat was 0
            if (additions === 0 && deletions === 0 && fileDiff) {
                const addMatches = fileDiff.match(/^\+[^+]/gm)
                const delMatches = fileDiff.match(/^-[^-]/gm)
                additions = addMatches ? addMatches.length : 0
                deletions = delMatches ? delMatches.length : 0
            }

            results.push({
                path: cleanPath,
                additions,
                deletions,
                status,
                diff: fileDiff,
            })
        }

        return results
    } catch {
        // Intentionally swallowed: git status error returns empty list
        return []
    }
}

export async function fetchGitCommitTree(workspaceDir: string = process.cwd()): Promise<string[]> {
    try {
        const { stdout } = await execAsync(
            'git log --graph --pretty=format:"%h - %s (%cr) <%an>" -n 20',
            {
                cwd: workspaceDir,
                timeout: 5000,
            }
        )
        const lines = stdout.trim().split('\n')
        return [
            '@  Working Copy (Uncommitted Changes)',
            ...lines.filter((l) => l.trim().length > 0),
        ]
    } catch {
        // Intentionally swallowed: git commit tree error fallback
        return ['@  Working Copy (Uncommitted Changes)', '(no git commits found)']
    }
}

export function extractTurnDiffs(messages: any[]): Array<{ turn: number; files: DiffFileEntry[] }> {
    if (!messages || messages.length === 0) return []

    const turns: Array<{ turn: number; files: DiffFileEntry[] }> = []
    let currentTurnIndex = 0

    for (const msg of messages) {
        if (msg.role === 'user') {
            currentTurnIndex++
            continue
        }

        if (msg.role === 'assistant' && Array.isArray(msg.blocks)) {
            const turnFiles: DiffFileEntry[] = []
            for (const block of msg.blocks) {
                const toolName = block.toolName || block.name
                const input = block.input || {}
                const filePath = input.path || input.TargetFile || block.path || ''
                const rawDiff = block.diff || input.diff || ''

                if (filePath && rawDiff) {
                    const addCount = (rawDiff.match(/^\+[^+]/gm) || []).length
                    const delCount = (rawDiff.match(/^-[^-]/gm) || []).length
                    turnFiles.push({
                        path: filePath,
                        additions: addCount,
                        deletions: delCount,
                        status: 'modified',
                        diff: rawDiff,
                    })
                }
            }

            if (turnFiles.length > 0) {
                turns.push({
                    turn: currentTurnIndex || 1,
                    files: turnFiles,
                })
            }
        }
    }

    return turns
}
