import { highlight } from 'cli-highlight'
import { Box, Text } from 'ink'
import { marked } from 'marked'
import React from 'react'

import { useTerminalColumns } from '../hooks/use-terminal-columns'
import { THEME } from '../theme'
import { fileLink, terminalLink } from '../utils/terminal-link'

import { Mermaid } from './mermaid'

type Props = {
    children: string
    isStreaming?: boolean
}

function getTokensPlainText(tokens: any[]): string {
    if (!tokens) return ''
    return tokens
        .map((t: any) => {
            if (t.tokens) return getTokensPlainText(t.tokens)
            return t.text || t.raw || ''
        })
        .join('')
}

function getCellPlainText(cell: any): string {
    if (!cell) return ''
    if (typeof cell === 'string') return cell
    if (cell.tokens && Array.isArray(cell.tokens)) {
        return getTokensPlainText(cell.tokens)
    }
    return cell.text || cell.raw || ''
}

function wrapCellText(text: string, width: number): string[] {
    if (!text) return ['']
    const words = text.split(/\s+/).filter(Boolean)
    if (words.length === 0) return ['']
    const lines: string[] = []
    let currentLine = ''
    for (const word of words) {
        if (!currentLine) {
            if (word.length <= width) {
                currentLine = word
            } else {
                let remaining = word
                while (remaining.length > width) {
                    lines.push(remaining.slice(0, width))
                    remaining = remaining.slice(width)
                }
                currentLine = remaining
            }
        } else if (currentLine.length + 1 + word.length <= width) {
            currentLine += ' ' + word
        } else {
            lines.push(currentLine)
            if (word.length <= width) {
                currentLine = word
            } else {
                let remaining = word
                while (remaining.length > width) {
                    lines.push(remaining.slice(0, width))
                    remaining = remaining.slice(width)
                }
                currentLine = remaining
            }
        }
    }
    if (currentLine) lines.push(currentLine)
    return lines
}

function Table({ token }: { token: any }) {
    const columns = useTerminalColumns()
    const headers = token.header || []
    const rows = token.rows || []

    if (headers.length === 0 && rows.length === 0) {
        return <Text>{token.raw}</Text>
    }

    const colCount = Math.max(headers.length, ...rows.map((r: any[]) => r.length))
    if (colCount === 0) return null

    const maxIdeals: number[] = []
    const minWidths: number[] = []

    for (let c = 0; c < colCount; c++) {
        let maxLen = headers[c] ? getCellPlainText(headers[c]).length : 0
        let maxWord = 3
        if (headers[c]) {
            const hWords = getCellPlainText(headers[c]).split(/\s+/).filter(Boolean)
            for (const w of hWords) maxWord = Math.max(maxWord, w.length)
        }
        for (const row of rows) {
            if (row[c]) {
                const text = getCellPlainText(row[c])
                maxLen = Math.max(maxLen, text.length)
                const rWords = text.split(/\s+/).filter(Boolean)
                for (const w of rWords) maxWord = Math.max(maxWord, w.length)
            }
        }
        maxIdeals.push(Math.max(maxLen, 3))
        minWidths.push(Math.max(maxWord, 4))
    }

    const borderOverhead = colCount * 3 + 1
    const maxTableWidth = Math.max(30, columns - 6)
    const availContentWidth = Math.max(colCount * 4, maxTableWidth - borderOverhead)

    const sumMin = minWidths.reduce((a, b) => a + b, 0)
    const sumMax = maxIdeals.reduce((a, b) => a + b, 0)
    const colWidths: number[] = []

    if (availContentWidth >= sumMax) {
        for (let c = 0; c < colCount; c++) {
            colWidths[c] = maxIdeals[c] ?? 3
        }
    } else if (availContentWidth <= sumMin) {
        let distributed = 0
        for (let c = 0; c < colCount; c++) {
            const scaled = Math.max(
                4,
                Math.floor(((minWidths[c] ?? 4) / sumMin) * availContentWidth)
            )
            colWidths[c] = scaled
            distributed += scaled
        }
        const remaining = availContentWidth - distributed
        if (remaining > 0) {
            const largestIdx = colWidths.indexOf(Math.max(...colWidths))
            if (largestIdx !== -1) {
                colWidths[largestIdx] = (colWidths[largestIdx] ?? 0) + remaining
            }
        }
    } else {
        const extraAvail = availContentWidth - sumMin
        const sumFlex = maxIdeals.map((m, i) => m - (minWidths[i] ?? 4)).reduce((a, b) => a + b, 0)

        let distributed = 0
        for (let c = 0; c < colCount; c++) {
            const minW = minWidths[c] ?? 4
            const flex = (maxIdeals[c] ?? minW) - minW
            const share = sumFlex > 0 ? Math.floor(extraAvail * (flex / sumFlex)) : 0
            const allocated = minW + share
            colWidths[c] = allocated
            distributed += allocated
        }
        const remaining = availContentWidth - distributed
        if (remaining > 0) {
            const largestIdx = colWidths.indexOf(Math.max(...colWidths))
            if (largestIdx !== -1) {
                colWidths[largestIdx] = (colWidths[largestIdx] ?? 0) + remaining
            }
        }
    }

    const topBorder = `┌${colWidths.map((w) => '─'.repeat(w + 2)).join('┬')}┐`
    const headerSep = `├${colWidths.map((w) => '─'.repeat(w + 2)).join('┼')}┤`
    const bottomBorder = `└${colWidths.map((w) => '─'.repeat(w + 2)).join('┴')}┘`

    const hLines = headers.map((h: any, c: number) =>
        wrapCellText(getCellPlainText(h), colWidths[c] ?? 10)
    )
    const hMaxLines = Math.max(...hLines.map((l: string[]) => l.length), 1)

    return (
        <Box flexDirection="column" marginY={1}>
            <Text color={THEME.colors.border}>{topBorder}</Text>
            {headers.length > 0 && (
                <>
                    {Array.from({ length: hMaxLines }).map((_, l) => (
                        <Box flexDirection="row" key={`h-${l}`}>
                            <Text color={THEME.colors.border}>│</Text>
                            {colWidths.map((w, c) => (
                                <React.Fragment key={c}>
                                    <Box width={w + 2} paddingX={1}>
                                        <Text bold color={THEME.colors.text}>
                                            {(hLines[c] && hLines[c][l]) || ''}
                                        </Text>
                                    </Box>
                                    <Text color={THEME.colors.border}>│</Text>
                                </React.Fragment>
                            ))}
                        </Box>
                    ))}
                    <Text color={THEME.colors.border}>{headerSep}</Text>
                </>
            )}
            {rows.map((row: any[], r: number) => {
                const rLines = colWidths.map((w, c) => wrapCellText(getCellPlainText(row[c]), w))
                const rMaxLines = Math.max(...rLines.map((l: string[]) => l.length), 1)
                return (
                    <React.Fragment key={r}>
                        {Array.from({ length: rMaxLines }).map((_, l) => (
                            <Box flexDirection="row" key={`r-${r}-${l}`}>
                                <Text color={THEME.colors.border}>│</Text>
                                {colWidths.map((w, c) => (
                                    <React.Fragment key={c}>
                                        <Box width={w + 2} paddingX={1}>
                                            <Text color={THEME.colors.text}>
                                                {(rLines[c] && rLines[c][l]) || ''}
                                            </Text>
                                        </Box>
                                        <Text color={THEME.colors.border}>│</Text>
                                    </React.Fragment>
                                ))}
                            </Box>
                        ))}
                    </React.Fragment>
                )
            })}
            <Text color={THEME.colors.border}>{bottomBorder}</Text>
        </Box>
    )
}

const CALLOUT_BORDER = {
    topLeft: '',
    topRight: '',
    bottomLeft: '',
    bottomRight: '',
    top: '',
    bottom: '',
    left: '▎',
    right: '',
}

type AlertType = 'NOTE' | 'TIP' | 'IMPORTANT' | 'WARNING' | 'CAUTION'

function getAlertColor(alertType: AlertType): string {
    switch (alertType) {
        case 'NOTE':
        case 'IMPORTANT':
            return THEME.colors.brand
        case 'TIP':
            return THEME.colors.success
        case 'WARNING':
            return THEME.colors.warning
        case 'CAUTION':
            return THEME.colors.error
    }
}

function extractAlert(token: any): { alertType: AlertType | null; tokens: any[] } {
    if (!token?.tokens || token.tokens.length === 0) {
        return { alertType: null, tokens: token?.tokens || [] }
    }

    const firstBlock = token.tokens[0]
    if (firstBlock?.type !== 'paragraph' || !firstBlock.tokens || firstBlock.tokens.length === 0) {
        return { alertType: null, tokens: token.tokens }
    }

    const firstInline = firstBlock.tokens[0]
    if (firstInline?.type !== 'text') {
        return { alertType: null, tokens: token.tokens }
    }

    const match = (firstInline.text || '').match(
        /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\](?:\r?\n|[ \t]*)/i
    )
    if (!match) {
        return { alertType: null, tokens: token.tokens }
    }

    const alertType = match[1].toUpperCase() as AlertType
    const remainingText = firstInline.text.slice(match[0].length)

    const newTokens = JSON.parse(JSON.stringify(token.tokens))
    if (!remainingText.trim()) {
        newTokens[0].tokens.shift()
        if (newTokens[0].tokens.length === 0) {
            newTokens.shift()
            if (newTokens[0]?.type === 'space') {
                newTokens.shift()
            }
        }
    } else {
        newTokens[0].tokens[0].text = remainingText
        newTokens[0].tokens[0].raw = remainingText
    }

    return { alertType, tokens: newTokens }
}

function CalloutBlock({ token }: { token: any }) {
    const { alertType, tokens } = extractAlert(token)
    const color = alertType ? getAlertColor(alertType) : THEME.colors.dim

    return (
        <Box
            flexDirection="column"
            borderStyle={CALLOUT_BORDER}
            borderLeft
            borderRight={false}
            borderTop={false}
            borderBottom={false}
            borderColor={color}
            paddingLeft={1}
        >
            {alertType && (
                <Text bold color={color}>
                    {alertType}
                </Text>
            )}
            {tokens.map((t: any, i: number) => renderToken(t, i))}
        </Box>
    )
}

export function isFilePath(text: string): boolean {
    if (!text || text.includes('\n')) return false
    const trimmed = text.trim()
    if (trimmed.includes(' ')) return false
    if (
        /^\/(?:artifacts|ask|auth|btw|changelog|clear|codesearch|context|copy|diff|docs|doctor|effort|exit|feedback|fork|grill|grill-me|help|key|link|login|mcp|memory|model|new|open|plan|resume|rewind|settings|skills|switch|tasks|undo|update|usage|voice)\b/i.test(
            trimmed
        )
    ) {
        return false
    }
    if (/^(\/|\.\/|\.\.\/|~\/|[a-zA-Z]:[/\\])/.test(trimmed)) return true
    if (trimmed.includes('/') || trimmed.includes('\\')) return true
    if (
        /\.(tsx?|jsx?|json|mdx?|css|scss|html|py|go|rs|sh|bash|zsh|ya?ml|toml|prisma|sql|env(\.[\w-]+)?|lock|log|svg|png|jpg|ico|dockerignore|gitignore)(:\d+(:\d+)?)?$/i.test(
            trimmed
        )
    ) {
        return true
    }
    if (/^(Dockerfile|Makefile|LICENSE|README|CONTAINERFILE)(:\d+(:\d+)?)?$/i.test(trimmed)) {
        return true
    }
    return false
}

const renderToken = (token: any, index: number, isStreaming?: boolean): React.ReactNode => {
    switch (token.type) {
        case 'paragraph':
            return (
                <Text key={index}>
                    {token.tokens?.map((t: any, i: number) => renderToken(t, i, isStreaming))}
                </Text>
            )
        case 'text': {
            if ('tokens' in token && token.tokens) {
                return (
                    <Text key={index}>
                        {token.tokens.map((t: any, i: number) => renderToken(t, i, isStreaming))}
                    </Text>
                )
            }
            const rawText = token.text || token.raw || ''
            if (rawText.includes('/login')) {
                const parts = rawText.split(/(\/login\b)/g)
                return (
                    <Text key={index}>
                        {parts.map((part: string, pIdx: number) =>
                            part === '/login' ? (
                                <Text key={pIdx} color={THEME.colors.brand}>
                                    {part}
                                </Text>
                            ) : (
                                part
                            )
                        )}
                    </Text>
                )
            }
            return <Text key={index}>{rawText}</Text>
        }
        case 'strong':
            return (
                <Text key={index} bold>
                    {token.tokens?.map((t: any, i: number) => renderToken(t, i, isStreaming))}
                </Text>
            )
        case 'em':
            return (
                <Text key={index} italic>
                    {token.tokens?.map((t: any, i: number) => renderToken(t, i, isStreaming))}
                </Text>
            )
        case 'codespan': {
            if (isFilePath(token.text)) {
                const lineMatch = token.text.match(/^([^:]+):(\d+)(?::(\d+))?$/)
                const targetPath = lineMatch ? lineMatch[1] : token.text
                const lineNum = lineMatch ? parseInt(lineMatch[2], 10) : undefined
                const colNum = lineMatch && lineMatch[3] ? parseInt(lineMatch[3], 10) : undefined
                const linkedPath = fileLink(token.text, targetPath, lineNum, colNum)
                return (
                    <Text key={index} color={THEME.colors.text} bold={false}>
                        {linkedPath}
                    </Text>
                )
            }
            const isSlashCommand = token.text.startsWith('/')
            return (
                <Text
                    key={index}
                    backgroundColor={isSlashCommand ? undefined : THEME.colors.codespanBg}
                    color={THEME.colors.brand}
                >
                    {token.text}
                </Text>
            )
        }
        case 'space':
            return null
        case 'code':
            if (token.lang === 'mermaid') {
                return <Mermaid key={index} code={token.text} />
            }
            return <CodeBlock token={token} key={index} isStreaming={isStreaming} />
        case 'list':
            return (
                <Box key={index} flexDirection="column" paddingLeft={1}>
                    {token.items.map((item: any, i: number) => (
                        <Box key={i} flexDirection="row">
                            <Text color={THEME.colors.dim}>
                                {token.ordered
                                    ? `${(token.start ?? 1) + i}. `
                                    : `${THEME.glyphs.bullet} `}
                            </Text>
                            <Box flexDirection="column" flexShrink={1}>
                                {item.tokens.map((t: any, j: number) =>
                                    renderToken(t, j, isStreaming)
                                )}
                            </Box>
                        </Box>
                    ))}
                </Box>
            )
        case 'heading': {
            const depth = token.depth || 1
            const prefix = '#'.repeat(depth) + ' '
            return (
                <Box key={index}>
                    <Text color={THEME.colors.dim}>{prefix}</Text>
                    <Text color={THEME.colors.brand}>
                        {token.tokens?.map((t: any, i: number) => renderToken(t, i, isStreaming))}
                    </Text>
                </Box>
            )
        }
        case 'link': {
            const href = token.href || ''
            const label = getCellPlainText(token) || token.text || token.raw || ''
            const display = href ? terminalLink(label, href) : label
            return (
                <Text key={index} color={THEME.colors.brand}>
                    {display}
                </Text>
            )
        }
        case 'hr':
            return null
        case 'blockquote':
            return <CalloutBlock key={index} token={token} />
        case 'html':
            return <Text key={index}>{token.text}</Text>
        case 'escape':
            return <Text key={index}>{token.text}</Text>
        case 'table':
            return <Table key={index} token={token} />
        default:
            return <Text key={index}>{token.raw}</Text>
    }
}

const MAX_HIGHLIGHT_CACHE_SIZE = 500
const highlightCache = new Map<string, string>()

export function getHighlightedCode(code: string, lang: string): string {
    const key = `${lang}:${code}`
    const cached = highlightCache.get(key)
    if (cached !== undefined) return cached

    let result = code
    try {
        result = highlight(code, {
            language: lang,
            ignoreIllegals: true,
        })
    } catch {
        // Intentionally swallowed: fallback to plain text if highlighting fails
    }

    if (highlightCache.size >= MAX_HIGHLIGHT_CACHE_SIZE) {
        const firstKey = highlightCache.keys().next().value
        if (firstKey) highlightCache.delete(firstKey)
    }
    highlightCache.set(key, result)
    return result
}

const MAX_AST_CACHE_SIZE = 500
const astCache = new Map<string, any[]>()

export function normalizeMarkdown(source: string): string {
    if (!source) return ''
    return source.replace(/^([ \t]*)[•●▪‣⁃][ \t]+/gm, '$1* ')
}

export function parseMarkdownTokens(source: string): any[] {
    if (!source) return []
    const cached = astCache.get(source)
    if (cached) return cached

    const normalized = normalizeMarkdown(source)
    const tokens = marked.lexer(normalized).filter((t) => t.type !== 'space')

    if (astCache.size >= MAX_AST_CACHE_SIZE) {
        const firstKey = astCache.keys().next().value
        if (firstKey) astCache.delete(firstKey)
    }
    astCache.set(source, tokens)
    return tokens
}

export function clearMarkdownCache(): void {
    highlightCache.clear()
    astCache.clear()
}

export function getMarkdownCacheStats(): { astCacheSize: number; highlightCacheSize: number } {
    return {
        astCacheSize: astCache.size,
        highlightCacheSize: highlightCache.size,
    }
}

const CodeBlock = React.memo(function CodeBlock({
    token,
    isStreaming,
}: {
    token: any
    isStreaming?: boolean
}) {
    const lang = token.lang || 'typescript'

    const highlighted = React.useMemo(() => {
        if (!token.text) return ''
        if (isStreaming) {
            return token.text
        }
        return getHighlightedCode(token.text, lang)
    }, [token.text, lang, isStreaming])

    return (
        <Box flexDirection="column" paddingY={1} paddingLeft={2}>
            <Text>{highlighted}</Text>
        </Box>
    )
})

export const Markdown = React.memo(function Markdown({ children, isStreaming }: Props) {
    const tokens = React.useMemo(() => {
        if (isStreaming || !children) return []
        return parseMarkdownTokens(children)
    }, [children, isStreaming])

    if (!children) return null

    if (isStreaming) {
        return <Text>{children}</Text>
    }

    return (
        <Box flexDirection="column" gap={1}>
            {tokens.map((token, index) => renderToken(token, index))}
        </Box>
    )
})
