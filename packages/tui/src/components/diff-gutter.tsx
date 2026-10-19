import { highlight } from 'cli-highlight'
import { Box, Text } from 'ink'
import React from 'react'

import { useTerminalColumns } from '../hooks/use-terminal-columns'
import { THEME } from '../theme'
import { fileLink, toRelativePath } from '../utils/terminal-link'

import { RawAnsi } from './raw-ansi'

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

function hexToRgb(hex: string): [number, number, number] {
    const clean = hex.replace('#', '')
    if (clean.length === 3) {
        const r = parseInt(clean[0] + clean[0], 16)
        const g = parseInt(clean[1] + clean[1], 16)
        const b = parseInt(clean[2] + clean[2], 16)
        return [r, g, b]
    }
    const r = parseInt(clean.substring(0, 2), 16) || 0
    const g = parseInt(clean.substring(2, 4), 16) || 0
    const b = parseInt(clean.substring(4, 6), 16) || 0
    return [r, g, b]
}

function ansiFg(color: string): string {
    if (color === 'white') return '\x1b[37m'
    if (color.startsWith('#')) {
        const [r, g, b] = hexToRgb(color)
        return `\x1b[38;2;${r};${g};${b}m`
    }
    return '\x1b[39m'
}

function ansiBg(color?: string): string {
    if (!color) return ''
    if (color.startsWith('#')) {
        const [r, g, b] = hexToRgb(color)
        return `\x1b[48;2;${r};${g};${b}m`
    }
    return ''
}

const ANSI_FG_RESET = '\x1b[39m'
const ANSI_BG_RESET = '\x1b[49m'

function detectLanguage(filePath?: string): string | undefined {
    if (!filePath) return undefined
    const ext = filePath.split('.').pop()?.toLowerCase()
    switch (ext) {
        case 'ts':
        case 'tsx': {
            return 'typescript'
        }
        case 'js':
        case 'jsx':
        case 'mjs':
        case 'cjs': {
            return 'javascript'
        }
        case 'json': {
            return 'json'
        }
        case 'py': {
            return 'python'
        }
        case 'rb': {
            return 'ruby'
        }
        case 'go': {
            return 'go'
        }
        case 'rs': {
            return 'rust'
        }
        case 'html': {
            return 'html'
        }
        case 'css': {
            return 'css'
        }
        case 'md': {
            return 'markdown'
        }
        case 'sh':
        case 'bash': {
            return 'bash'
        }
        case 'yaml':
        case 'yml': {
            return 'yaml'
        }
        case 'sql': {
            return 'sql'
        }
        default: {
            return undefined
        }
    }
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

    const visibleLines = React.useMemo(
        () => (isExpanded ? parsedLines.slice(0, maxVisibleLines) : []),
        [isExpanded, parsedLines, maxVisibleLines]
    )
    const isTruncated = isExpanded && parsedLines.length > maxVisibleLines

    // Calculate max line number width for aligned gutter
    const maxLineNum = Math.max(
        ...parsedLines.map((l) => Math.max(l.oldLineNumber || 0, l.newLineNumber || 0)),
        1
    )
    const gutterWidth = Math.max(2, String(maxLineNum).length)

    const columns = useTerminalColumns()
    const maxPathLen = Math.max(30, columns - 45)

    const language = React.useMemo(() => detectLanguage(filePath), [filePath])

    const ansiLines = React.useMemo(() => {
        if (!isExpanded || visibleLines.length === 0) return []

        return visibleLines.map((line) => {
            const lineNum = line.type === 'delete' ? line.oldLineNumber : line.newLineNumber
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

            let formattedContent: string
            if (language && line.type === 'context') {
                try {
                    formattedContent = highlight(line.content, { language, ignoreIllegals: true })
                } catch {
                    // Intentionally swallowed: syntax highlight fallback handled
                    formattedContent = `${ansiFg(textColor)}${line.content}${ANSI_FG_RESET}`
                }
            } else {
                formattedContent = `${ansiFg(textColor)}${line.content}${ANSI_FG_RESET}`
            }

            const gutterPart = `${ansiFg(THEME.colors.dim)}${paddedLineNum} ${ANSI_FG_RESET}`
            const signPart = `${ansiFg(signColor)}${sign} │ ${ANSI_FG_RESET}`

            let fullLine = `${gutterPart}${signPart}${formattedContent}`
            if (bgColor) {
                fullLine = `${ansiBg(bgColor)}${fullLine}${ANSI_BG_RESET}`
            }
            return fullLine
        })
    }, [isExpanded, visibleLines, gutterWidth, language])

    // Formatted clickable file link
    const cleanPath = filePath ? filePath.replace(/^\.\//, '') : ''
    const displayPath = cleanPath ? toRelativePath(cleanPath) : ''
    const truncatedDisplay =
        displayPath.length > maxPathLen
            ? displayPath.substring(0, maxPathLen - 3) + '...'
            : displayPath
    const linkedPath = displayPath
        ? fileLink(truncatedDisplay, filePath || displayPath, startLine)
        : ''

    return (
        <Box flexDirection="column" marginY={0}>
            {/* Header row */}
            <Box flexDirection="row" gap={1} alignItems="center">
                <Text>
                    <Text color={THEME.colors.warning}>{`${THEME.glyphs.status} `}</Text>
                    <Text color={THEME.colors.warning} bold>
                        {actionLabel}
                    </Text>
                </Text>
                {displayPath && <Text color={THEME.colors.text}>{linkedPath}</Text>}
                {(additions > 0 || deletions > 0) && (
                    <Text>
                        {additions > 0 && <Text color={THEME.colors.success}>+{additions} </Text>}
                        {deletions > 0 && <Text color={THEME.colors.error}>-{deletions}</Text>}
                    </Text>
                )}
            </Box>

            {/* Expanded gutter diff */}
            {isExpanded && parsedLines.length > 0 && (
                <Box flexDirection="column" marginTop={0} paddingLeft={2}>
                    <RawAnsi lines={ansiLines} />
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
