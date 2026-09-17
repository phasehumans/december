import { Box, Text } from 'ink'
import React from 'react'

import { THEME } from '../theme'
import { fileLink } from '../utils/terminal-link'

export interface DiffLine {
    oldLineNumber?: number
    newLineNumber?: number
    type: 'add' | 'delete' | 'context' | 'header'
    content: string
}

export function parseDiffHunks(diffText: string, defaultStartLine: number = 1): DiffLine[] {
    const rawLines = (diffText || '').trim().split(/\r?\n/)
    const result: DiffLine[] = []

    let oldLine = defaultStartLine
    let newLine = defaultStartLine

    for (const raw of rawLines) {
        if (!raw) continue

        // Check for hunk header e.g. @@ -14,5 +14,6 @@
        const hunkMatch = raw.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/)
        if (hunkMatch) {
            oldLine = parseInt(hunkMatch[1] || '1', 10)
            newLine = parseInt(hunkMatch[2] || '1', 10)
            continue
        }

        if (raw.startsWith('---') || raw.startsWith('+++') || raw.startsWith('diff --git')) {
            continue
        }

        if (raw.startsWith('+')) {
            result.push({
                newLineNumber: newLine++,
                type: 'add',
                content: raw.slice(1),
            })
        } else if (raw.startsWith('-')) {
            result.push({
                oldLineNumber: oldLine++,
                type: 'delete',
                content: raw.slice(1),
            })
        } else {
            // Context line
            const content = raw.startsWith(' ') ? raw.slice(1) : raw
            result.push({
                oldLineNumber: oldLine++,
                newLineNumber: newLine++,
                type: 'context',
                content,
            })
        }
    }

    return result
}

export interface DiffGutterViewProps {
    diff: string
    filePath?: string
    startLine?: number
    forceExpanded?: boolean
    maxVisibleLines?: number
    actionLabel?: string
}

export const DiffGutterView = React.memo(function DiffGutterView({
    diff,
    filePath,
    startLine = 1,
    forceExpanded = false,
    maxVisibleLines = 25,
    actionLabel = 'Updated',
}: DiffGutterViewProps) {
    const isExpanded = forceExpanded
    const parsedLines = React.useMemo(() => parseDiffHunks(diff, startLine), [diff, startLine])

    const additions = parsedLines.filter((l) => l.type === 'add').length
    const deletions = parsedLines.filter((l) => l.type === 'delete').length

    const visibleLines = isExpanded ? parsedLines.slice(0, maxVisibleLines) : []
    const isTruncated = isExpanded && parsedLines.length > maxVisibleLines

    // Calculate max line number width for aligned gutter
    const maxLineNum = Math.max(
        ...parsedLines.map((l) => Math.max(l.oldLineNumber || 0, l.newLineNumber || 0)),
        1
    )
    const gutterWidth = Math.max(2, String(maxLineNum).length)

    // Formatted clickable file link
    const displayPath = filePath ? filePath.replace(/^\.\//, '') : ''
    const linkedPath = displayPath ? fileLink(displayPath, displayPath, startLine) : ''

    return (
        <Box flexDirection="column" marginY={0}>
            {/* Header row */}
            <Box flexDirection="row" gap={1} alignItems="center">
                <Text color={THEME.colors.warning}>{`${THEME.glyphs.status} `}</Text>
                <Text color={THEME.colors.warning} bold>
                    {actionLabel}
                </Text>
                {displayPath && <Text color={THEME.colors.text}>{linkedPath}</Text>}
                {(additions > 0 || deletions > 0) && (
                    <Text>
                        {additions > 0 && <Text color={THEME.colors.success}>+{additions} </Text>}
                        {deletions > 0 && <Text color={THEME.colors.error}>-{deletions}</Text>}
                    </Text>
                )}
                <Text color={THEME.colors.muted}>
                    ({isExpanded ? 'ctrl+o to collapse' : 'ctrl+o to view'})
                </Text>
            </Box>

            {/* Expanded gutter diff */}
            {isExpanded && parsedLines.length > 0 && (
                <Box flexDirection="column" marginTop={0} paddingLeft={2}>
                    {visibleLines.map((line, idx) => {
                        const lineNum =
                            line.type === 'delete' ? line.oldLineNumber : line.newLineNumber
                        const paddedLineNum = lineNum
                            ? String(lineNum).padStart(gutterWidth, ' ')
                            : ' '.repeat(gutterWidth)

                        const sign = line.type === 'add' ? '+' : line.type === 'delete' ? '-' : ' '
                        const signColor =
                            line.type === 'add'
                                ? THEME.colors.success
                                : line.type === 'delete'
                                  ? THEME.colors.error
                                  : THEME.colors.dim

                        const textColor =
                            line.type === 'add'
                                ? THEME.colors.success
                                : line.type === 'delete'
                                  ? THEME.colors.error
                                  : THEME.colors.text

                        const bgColor =
                            line.type === 'add'
                                ? THEME.colors.diffAddBg
                                : line.type === 'delete'
                                  ? THEME.colors.diffDeleteBg
                                  : undefined

                        return (
                            <Box key={idx} backgroundColor={bgColor} flexDirection="row">
                                <Text color={THEME.colors.dim}>{paddedLineNum} </Text>
                                <Text color={signColor}>{sign} │ </Text>
                                <Text color={textColor} wrap="truncate-end">
                                    {line.content}
                                </Text>
                            </Box>
                        )
                    })}
                    {isTruncated && (
                        <Box paddingTop={0}>
                            <Text color={THEME.colors.muted}>
                                ... ({parsedLines.length - maxVisibleLines} more lines)
                            </Text>
                        </Box>
                    )}
                </Box>
            )}
        </Box>
    )
})
