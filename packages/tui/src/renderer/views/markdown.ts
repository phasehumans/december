import { THEME } from '../../theme'
import { areStylesEqual, getCharWidth, sliceToWidth, stringWidth } from '../cell'

import type { CellStyle } from '../types'

export interface TextSegment {
    text: string
    style?: CellStyle
}

export type FormattedLine = TextSegment[]

/**
 * Formats a single line containing inline markdown like **bold**, *italic*, and `code`
 * into styled text segments.
 */
function parseInlineMarkdown(
    lineText: string,
    options?: { streamingTail?: boolean }
): FormattedLine {
    const segments: TextSegment[] = []
    let i = 0

    while (i < lineText.length) {
        // 1. Inline code: `code`
        if (lineText[i] === '`') {
            const closing = lineText.indexOf('`', i + 1)
            if (closing !== -1) {
                const codeText = lineText.slice(i + 1, closing)
                segments.push({
                    text: codeText,
                    style: {
                        fg: THEME.colors.brand,
                    },
                })
                i = closing + 1
                continue
            } else if (options?.streamingTail && i + 1 < lineText.length) {
                // Stabilize trailing unclosed code span during active streaming: apply style without raw backtick
                const remaining = lineText.slice(i + 1)
                segments.push({
                    text: remaining,
                    style: {
                        fg: THEME.colors.brand,
                    },
                })
                break
            }
        }

        // 2. Bold: **text**
        if (lineText.slice(i, i + 2) === '**') {
            const closing = lineText.indexOf('**', i + 2)
            if (closing !== -1) {
                const boldText = lineText.slice(i + 2, closing)
                segments.push({
                    text: boldText,
                    style: {
                        fg: THEME.colors.text,
                        bold: true,
                    },
                })
                i = closing + 2
                continue
            } else if (options?.streamingTail && i + 2 < lineText.length) {
                // Stabilize trailing unclosed bold during active streaming: apply style without raw asterisks
                const remaining = lineText.slice(i + 2)
                segments.push({
                    text: remaining,
                    style: {
                        fg: THEME.colors.text,
                        bold: true,
                    },
                })
                break
            }
        }

        // 3. Markdown links: [label](url)
        if (lineText[i] === '[') {
            const closeBracket = lineText.indexOf(']', i + 1)
            if (closeBracket !== -1 && lineText[closeBracket + 1] === '(') {
                const closeParen = lineText.indexOf(')', closeBracket + 2)
                if (closeParen !== -1) {
                    const label = lineText.slice(i + 1, closeBracket)
                    const url = lineText.slice(closeBracket + 2, closeParen)
                    if (label === url || !label) {
                        segments.push({
                            text: url,
                            style: {
                                fg: THEME.colors.brand,
                                underline: true,
                            },
                        })
                    } else {
                        segments.push({
                            text: label,
                            style: {
                                fg: THEME.colors.brand,
                                underline: true,
                            },
                        })
                        segments.push({
                            text: ` (${url})`,
                            style: {
                                fg: THEME.colors.dim,
                                underline: true,
                            },
                        })
                    }
                    i = closeParen + 1
                    continue
                }
            }
        }

        // 4. Raw URLs (https://... or http://...)
        const urlMatch = lineText.slice(i).match(/^(https?:\/\/[^\s\)]+)/)
        if (urlMatch) {
            const rawUrl = urlMatch[1]
            segments.push({
                text: rawUrl,
                style: {
                    fg: THEME.colors.brand,
                    underline: true,
                },
            })
            i += rawUrl.length
            continue
        }

        // 5. Regular text segment until next formatting token
        // Must search starting from i + 1 so that if lineText[i] is an unmatched special character,
        // we advance past it rather than re-matching at i and creating an infinite loop!
        let nextSpecial = lineText.length
        const nextTick = lineText.indexOf('`', i + 1)
        const nextBold = lineText.indexOf('**', i + 1)
        const nextBracket = lineText.indexOf('[', i + 1)
        const nextHttp = lineText.indexOf('http://', i + 1)
        const nextHttps = lineText.indexOf('https://', i + 1)

        if (nextTick !== -1) nextSpecial = Math.min(nextSpecial, nextTick)
        if (nextBold !== -1) nextSpecial = Math.min(nextSpecial, nextBold)
        if (nextBracket !== -1) nextSpecial = Math.min(nextSpecial, nextBracket)
        if (nextHttp !== -1) nextSpecial = Math.min(nextSpecial, nextHttp)
        if (nextHttps !== -1) nextSpecial = Math.min(nextSpecial, nextHttps)

        const plainText = lineText.slice(i, nextSpecial)
        if (plainText) {
            segments.push({ text: plainText, style: { fg: THEME.colors.text } })
        }
        i = Math.max(i + 1, nextSpecial)
    }

    return segments.length > 0 ? segments : [{ text: '', style: {} }]
}

/**
 * Wraps formatted text segments across lines based on maxWidth.
 * Long tokens (such as URLs) exceeding maxWidth are broken into chunks so
 * no line exceeds maxWidth.
 */
export function wrapSegments(segments: FormattedLine, maxWidth: number): FormattedLine[] {
    const lines: FormattedLine[] = []
    let currentLine: FormattedLine = []
    let currentLen = 0
    const targetWidth = Math.max(10, Number.isFinite(maxWidth) ? maxWidth : 80)

    for (const seg of segments) {
        const words = seg.text.split(/(\s+)/)
        for (let token of words) {
            if (!token) continue

            // Widths are terminal columns, so CJK text and emoji wrap where they are drawn
            let tokenWidth = stringWidth(token)

            // If token alone exceeds targetWidth (e.g. long URLs), chunk it cleanly
            while (tokenWidth > targetWidth) {
                const available = targetWidth - currentLen
                const fitted = available > 0 && currentLen > 0 ? sliceToWidth(token, available) : ''
                if (fitted) {
                    currentLine.push({ text: fitted, style: seg.style })
                    lines.push(currentLine)
                    currentLine = []
                    currentLen = 0
                    token = token.slice(fitted.length)
                } else {
                    if (currentLen > 0) {
                        lines.push(currentLine)
                        currentLine = []
                        currentLen = 0
                    }
                    const chunk = sliceToWidth(token, targetWidth)
                    lines.push([{ text: chunk, style: seg.style }])
                    token = token.slice(chunk.length)
                }
                tokenWidth = stringWidth(token)
            }

            if (!token) continue

            if (currentLen + tokenWidth > targetWidth && currentLen > 0) {
                lines.push(currentLine)
                currentLine = []
                currentLen = 0
            }

            if (currentLen === 0 && token.trim() === '') {
                continue
            }

            const lastSeg = currentLine[currentLine.length - 1]
            if (lastSeg && areStylesEqual(lastSeg.style ?? {}, seg.style ?? {})) {
                lastSeg.text += token
            } else {
                currentLine.push({ text: token, style: seg.style })
            }
            currentLen += tokenWidth
        }
    }

    if (currentLine.length > 0) {
        lines.push(currentLine)
    }

    return lines.length > 0 ? lines : [[{ text: '', style: {} }]]
}

const CODE_INDENT = '  '

/**
 * Basic syntax highlighter for code block lines across common languages
 * (TypeScript, JavaScript, Python, JSON, Shell, SQL).
 */
function highlightCodeLine(lineText: string, language: string): FormattedLine {
    if (!lineText) {
        return [{ text: '', style: {} }]
    }

    // Code blocks sit 2 columns in from the reply text, with no gutter
    const segments: TextSegment[] = [{ text: CODE_INDENT, style: {} }]
    // Match comments, strings, keywords, numbers, types, or words
    const regex =
        /(\/\/[^\n]*|#[^\n]*)|("(?:\\.|[^"\\])*"|'[^']*'|`[^`]*`)|(\b(?:const|let|var|function|return|import|export|from|if|else|for|while|class|type|interface|async|await|def|lambda|with|as|try|except|finally|public|private|protected|static|readonly|case|switch|break|continue|default|throw|catch|new|this|typeof|instanceof|true|false|null|undefined|None|True|False)\b)|(\b\d+(?:\.\d+)?\b)|(\b[A-Z][a-zA-Z0-9_]*\b)|([^\s"'\`\d\w#\/]+|\s+|[a-z_][a-zA-Z0-9_]*)/g

    let match: RegExpExecArray | null
    while ((match = regex.exec(lineText)) !== null) {
        if (match.index === regex.lastIndex) {
            regex.lastIndex++
        }
        const [full, comment, str, keyword, num, typeIdent, other] = match
        if (comment) {
            segments.push({ text: comment, style: { fg: THEME.colors.dim } })
        } else if (str) {
            segments.push({ text: str, style: { fg: THEME.colors.success } })
        } else if (keyword) {
            segments.push({ text: keyword, style: { fg: THEME.colors.brand } })
        } else if (num) {
            segments.push({ text: num, style: { fg: THEME.colors.warning } })
        } else if (typeIdent) {
            segments.push({ text: typeIdent, style: { fg: THEME.colors.brand } })
        } else {
            segments.push({ text: other || full, style: { fg: THEME.colors.text } })
        }
    }

    return segments.length > 1
        ? segments
        : [{ text: CODE_INDENT + lineText, style: { fg: THEME.colors.text } }]
}

/** Narrowest a table column may shrink to before the table switches to a list */
const TABLE_MIN_CELL_WIDTH = 10

/** Terminal columns a string takes up (CJK and emoji count as 2) */
const textWidth = (text: string) => {
    let width = 0
    for (const char of text) width += getCharWidth(char)
    return width
}

const segmentsWidth = (segments: FormattedLine) =>
    segments.reduce((width, seg) => width + textWidth(seg.text), 0)

/**
 * Word-wraps styled segments to an exact terminal-column width. Words wider
 * than the width are broken by character. Used for table cells, where a line
 * that overflows by even one column pushes the right border off screen.
 */
function wrapToWidth(segments: FormattedLine, width: number): FormattedLine[] {
    const lines: FormattedLine[] = []
    let line: FormattedLine = []
    let lineWidth = 0

    const append = (text: string, style?: CellStyle) => {
        const last = line[line.length - 1]
        if (last && areStylesEqual(last.style ?? {}, style ?? {})) {
            last.text += text
        } else {
            line.push({ text, style })
        }
        lineWidth += textWidth(text)
    }
    const breakLine = () => {
        const last = line[line.length - 1]
        if (last?.text.endsWith(' ')) {
            last.text = last.text.slice(0, -1)
        }
        lines.push(line)
        line = []
        lineWidth = 0
    }

    for (const seg of segments) {
        for (const token of seg.text.split(/(\s+)/)) {
            if (!token) continue

            if (/^\s+$/.test(token)) {
                if (lineWidth === 0) continue
                if (lineWidth + 1 >= width) {
                    breakLine()
                } else {
                    append(' ', seg.style)
                }
                continue
            }

            const tokenWidth = textWidth(token)
            if (lineWidth > 0 && lineWidth + tokenWidth > width) {
                breakLine()
            }
            if (tokenWidth <= width) {
                append(token, seg.style)
                continue
            }
            for (const char of token) {
                if (lineWidth > 0 && lineWidth + getCharWidth(char) > width) {
                    breakLine()
                }
                append(char, seg.style)
            }
        }
    }

    if (line.length > 0 || lines.length === 0) {
        lines.push(line)
    }
    return lines
}

/**
 * Fits column widths into the space left after borders. Width is taken from
 * the widest column first, so short columns keep their full width and long
 * columns share what is left. No column goes below TABLE_MIN_CELL_WIDTH (or
 * its natural width, if that is smaller).
 */
function fitColumnWidths(naturalWidths: number[], available: number): number[] {
    const widths = [...naturalWidths]
    const floors = naturalWidths.map((w) => Math.min(w, TABLE_MIN_CELL_WIDTH))
    let total = widths.reduce((a, b) => a + b, 0)

    while (total > available) {
        let widest = -1
        for (let c = 0; c < widths.length; c++) {
            if (widths[c] > floors[c] && (widest === -1 || widths[c] > widths[widest])) {
                widest = c
            }
        }
        if (widest === -1) break
        widths[widest]--
        total--
    }
    return widths
}

/**
 * Narrow-screen fallback: each body row becomes a block. The first cell is the
 * title and the other cells follow as `Header: value` lines.
 */
function formatTableAsList(cells: FormattedLine[][], maxWidth: number): FormattedLine[] {
    const output: FormattedLine[] = []
    const hasHeader = cells.length > 1
    const headers = cells[0].map((cell) => cell.map((s) => s.text).join(''))
    const bodyRows = hasHeader ? cells.slice(1) : cells
    const indent = '  '

    bodyRows.forEach((row, r) => {
        if (r > 0) output.push([{ text: '', style: {} }])

        // D6: bold only for headings and **strong**; the first cell is a label in brand
        const title = row[0].map((s) => ({ ...s, style: { ...s.style, fg: THEME.colors.brand } }))
        output.push(...wrapToWidth(title, maxWidth))

        for (let c = 1; c < row.length; c++) {
            const label: FormattedLine = hasHeader
                ? [{ text: `${headers[c]}: `, style: { fg: THEME.colors.muted } }]
                : []
            for (const line of wrapToWidth([...label, ...row[c]], maxWidth - indent.length)) {
                output.push([{ text: indent, style: {} }, ...line])
            }
        }
    })

    return output
}

/**
 * Formats markdown table rows into box-drawn rows that always fit maxWidth.
 * Long cells wrap inside their column. When the screen is too narrow for every
 * column to get TABLE_MIN_CELL_WIDTH, rows render as a list instead.
 */
function formatMarkdownTable(tableLines: string[], maxWidth: number): FormattedLine[] {
    const parsedRows: string[][] = []

    for (const line of tableLines) {
        const trimmed = line.trim()
        if (!trimmed.startsWith('|')) continue
        // Skip separator line e.g. |---|---|
        if (/^\|[-:\s|]+$/.test(trimmed)) continue

        const cells = trimmed
            .split('|')
            .slice(1, -1)
            .map((c) => c.trim())
        if (cells.length > 0) {
            parsedRows.push(cells)
        }
    }

    if (parsedRows.length === 0) return []

    const colCount = Math.max(...parsedRows.map((r) => r.length))
    const cells: FormattedLine[][] = parsedRows.map((row, r) =>
        Array.from({ length: colCount }, (_, c) => {
            const segments = parseInlineMarkdown(row[c] ?? '')
            if (r !== 0) return segments
            return segments.map((s) => ({
                ...s,
                style: { ...s.style, fg: THEME.colors.brand },
            }))
        })
    )

    // Each column adds `│ ` before and ` ` after its text, plus the closing `│`
    const available = maxWidth - (colCount * 3 + 1)
    if (available < colCount * TABLE_MIN_CELL_WIDTH) {
        return formatTableAsList(cells, Math.max(1, maxWidth))
    }

    const naturalWidths = Array.from({ length: colCount }, (_, c) =>
        Math.max(1, ...cells.map((row) => segmentsWidth(row[c])))
    )
    const colWidths = fitColumnWidths(naturalWidths, available)

    const border = (left: string, mid: string, right: string): FormattedLine => [
        {
            text: left + colWidths.map((w) => '─'.repeat(w + 2)).join(mid) + right,
            style: { fg: THEME.colors.border },
        },
    ]

    const wrappedRows = cells.map((row) => row.map((cell, c) => wrapToWidth(cell, colWidths[c])))
    const bodyWraps = wrappedRows.slice(1).some((row) => row.some((cell) => cell.length > 1))

    const output: FormattedLine[] = [border('┌', '┬', '┐')]

    wrappedRows.forEach((row, r) => {
        if (r === 1 || (r > 1 && bodyWraps)) {
            output.push(border('├', '┼', '┤'))
        }
        const height = Math.max(...row.map((cell) => cell.length))
        for (let i = 0; i < height; i++) {
            const lineSegs: FormattedLine = [{ text: '│', style: { fg: THEME.colors.border } }]
            row.forEach((cell, c) => {
                const segs = cell[i] ?? []
                lineSegs.push({ text: ' ', style: {} })
                lineSegs.push(...segs)
                lineSegs.push({
                    text: ' '.repeat(colWidths[c] - segmentsWidth(segs) + 1),
                    style: {},
                })
                lineSegs.push({ text: '│', style: { fg: THEME.colors.border } })
            })
            output.push(lineSegs)
        }
    })

    output.push(border('└', '┴', '┘'))
    return output
}

/**
 * Parses and renders Mermaid diagrams (flowchart, sequence, pie) into clean terminal lines.
 */
function formatMermaidDiagram(code: string): FormattedLine[] {
    const lines = code
        .trim()
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean)
    if (lines.length === 0) return []

    const firstLine = lines[0].toLowerCase()
    const output: FormattedLine[] = []

    // 1. Pie chart
    if (firstLine.startsWith('pie')) {
        let title = 'Chart'
        const titleMatch = lines[0].match(/title\s+(.*)$/i)
        if (titleMatch && titleMatch[1]) {
            title = titleMatch[1].trim()
        }
        output.push([{ text: `• ${title}`, style: { fg: THEME.colors.brand } }])

        const slices: { label: string; value: number }[] = []
        for (let i = 1; i < lines.length; i++) {
            const m = lines[i].match(/"([^"]+)"\s*:\s*([\d.]+)/)
            if (m) {
                slices.push({ label: m[1], value: parseFloat(m[2]) })
            }
        }
        const total = slices.reduce((acc, s) => acc + s.value, 0)
        for (let i = 0; i < slices.length; i++) {
            const s = slices[i]
            const pct = total > 0 ? Math.round((s.value / total) * 100) : 0
            const filled = Math.round((pct / 100) * 16)
            const empty = 16 - filled
            const bar = '█'.repeat(filled) + '░'.repeat(empty)
            output.push([
                { text: `  ${s.label.padEnd(16)} `, style: { fg: THEME.colors.text } },
                {
                    text: bar,
                    style: { fg: i % 2 === 0 ? THEME.colors.brand : THEME.colors.warning },
                },
                { text: ` ${pct}%`, style: { fg: THEME.colors.muted } },
            ])
        }
        return output
    }

    // 2. Sequence diagram
    if (firstLine.startsWith('sequencediagram')) {
        output.push([{ text: '• Sequence Diagram', style: { fg: THEME.colors.brand } }])
        for (let i = 1; i < lines.length; i++) {
            const m = lines[i].match(
                /^([A-Za-z0-9_]+)\s*(->>|-->>|->)\s*([A-Za-z0-9_]+)\s*:\s*(.*)$/
            )
            if (m) {
                const [, from, arrow, to, text] = m
                const arrowStr = arrow.includes('--') ? ' ◄┄┄ ' : ' ──► '
                output.push([
                    { text: `  [${from}]`, style: { fg: THEME.colors.brand } },
                    { text: arrowStr, style: { fg: THEME.colors.muted } },
                    { text: `[${to}]`, style: { fg: THEME.colors.brand } },
                    { text: `: ${text}`, style: { fg: THEME.colors.text } },
                ])
            }
        }
        return output
    }

    // 3. Flowchart / Graph
    if (firstLine.startsWith('graph') || firstLine.startsWith('flowchart')) {
        output.push([{ text: '• Flowchart', style: { fg: THEME.colors.brand } }])
        for (let i = 1; i < lines.length; i++) {
            const edgeMatch = lines[i].match(
                /^([A-Za-z0-9_]+)(?:\[(.*?)\])?\s*(-->|---|==>|-\.->)(?:\|(.*?)\|)?\s*([A-Za-z0-9_]+)(?:\[(.*?)\])?/
            )
            if (edgeMatch) {
                const [, fromId, fromLabel, arrow, edgeLabel, toId, toLabel] = edgeMatch
                const fromDisplay = fromLabel || fromId
                const toDisplay = toLabel || toId
                const arrowStr = arrow === '==>' ? ' ══► ' : arrow === '-.->' ? ' ┈► ' : ' ──► '
                const labelStr = edgeLabel ? ` (${edgeLabel})` : ''

                output.push([
                    { text: `  [${fromDisplay}]`, style: { fg: THEME.colors.brand } },
                    { text: arrowStr, style: { fg: THEME.colors.muted } },
                    { text: `[${toDisplay}]`, style: { fg: THEME.colors.brand } },
                    { text: labelStr, style: { fg: THEME.colors.dim } },
                ])
            }
        }
        return output
    }

    // Fallback: render as code lines
    return lines.map((l) => [{ text: `  ${l}`, style: { fg: THEME.colors.muted } }])
}

/**
 * Incremental state cache for active streaming markdown parsing.
 * Preserves completed lines and parser state so appending tokens is O(1) per frame.
 */
export interface StreamingMarkdownCache {
    lastText?: string
    lastWidth?: number
    stabilizeInline?: boolean
    committedOutputLines: FormattedLine[]
    committedRawCount: number
    inCodeBlock: boolean
    codeLanguage: string
    codeBlockBuffer: string[]
    inTable: boolean
    tableBuffer: string[]
}

export function createStreamingMarkdownCache(options?: {
    stabilizeInline?: boolean
}): StreamingMarkdownCache {
    return {
        stabilizeInline: options?.stabilizeInline ?? true,
        committedOutputLines: [],
        committedRawCount: 0,
        inCodeBlock: false,
        codeLanguage: '',
        codeBlockBuffer: [],
        inTable: false,
        tableBuffer: [],
    }
}

/** Horizontal rule: `---`, `***`, `___`, `- - -`, up to 3 leading spaces */
const HORIZONTAL_RULE = /^ {0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$/

const isBlankLine = (line: string | undefined) => line !== undefined && line.trim() === ''

/**
 * Parses markdown string and converts it into a list of formatted lines with ANSI styles.
 * Supports an optional StreamingMarkdownCache for O(1) incremental frame rendering.
 */
export function formatMarkdownToLines(
    markdown: string,
    maxWidth: number,
    cache?: StreamingMarkdownCache
): FormattedLine[] {
    const rawLines = markdown.split(/\r?\n/)
    const outputLines: FormattedLine[] = []

    let inCodeBlock = false
    let codeLanguage = ''
    let codeBlockBuffer: string[] = []
    let inTable = false
    let tableBuffer: string[] = []
    let startIdx = 0

    // Try resuming from cache if available and input text is an extension of prior text
    if (
        cache &&
        cache.lastWidth === maxWidth &&
        cache.lastText &&
        markdown.startsWith(cache.lastText) &&
        cache.committedRawCount <= rawLines.length
    ) {
        outputLines.push(...cache.committedOutputLines)
        startIdx = cache.committedRawCount
        inCodeBlock = cache.inCodeBlock
        codeLanguage = cache.codeLanguage
        codeBlockBuffer = [...cache.codeBlockBuffer]
        inTable = cache.inTable
        tableBuffer = [...cache.tableBuffer]
    } else if (cache) {
        cache.committedOutputLines = []
        cache.committedRawCount = 0
        cache.inCodeBlock = false
        cache.codeLanguage = ''
        cache.codeBlockBuffer = []
        cache.inTable = false
        cache.tableBuffer = []
    }

    const flushTable = (isCommit = false) => {
        if (tableBuffer.length > 0) {
            const tableLines = formatMarkdownTable(tableBuffer, maxWidth)
            outputLines.push(...tableLines)
            if (isCommit && cache) {
                cache.committedOutputLines.push(...tableLines)
            }
            tableBuffer = []
            inTable = false
        }
    }

    for (let r = startIdx; r < rawLines.length; r++) {
        const rawLine = rawLines[r]
        const trimmed = rawLine.trim()
        const isTrailingLine = r === rawLines.length - 1 && !markdown.endsWith('\n')

        // Handle fenced code block boundary ```
        if (trimmed.startsWith('```')) {
            flushTable(!isTrailingLine)
            if (!inCodeBlock) {
                inCodeBlock = true
                codeLanguage = trimmed.slice(3).trim().toLowerCase()
                codeBlockBuffer = []
            } else {
                inCodeBlock = false
                if (codeLanguage === 'mermaid') {
                    const mermaidLines = formatMermaidDiagram(codeBlockBuffer.join('\n'))
                    outputLines.push(...mermaidLines)
                    if (!isTrailingLine && cache) {
                        cache.committedOutputLines.push(...mermaidLines)
                    }
                } else {
                    for (const codeLine of codeBlockBuffer) {
                        const hl = highlightCodeLine(codeLine, codeLanguage)
                        outputLines.push(hl)
                        if (!isTrailingLine && cache) {
                            cache.committedOutputLines.push(hl)
                        }
                    }
                }
                codeBlockBuffer = []
                codeLanguage = ''
            }
            if (!isTrailingLine && cache) {
                cache.committedRawCount = r + 1
            }
            continue
        }

        // Inside fenced code block
        if (inCodeBlock) {
            if (codeLanguage === 'mermaid') {
                codeBlockBuffer.push(rawLine)
            } else if (!isTrailingLine) {
                // Completed line in code block: highlight and commit immediately
                const hl = highlightCodeLine(rawLine, codeLanguage)
                outputLines.push(hl)
                if (cache) {
                    cache.committedOutputLines.push(hl)
                    cache.committedRawCount = r + 1
                }
            } else {
                // Trailing incomplete line in code block
                codeBlockBuffer.push(rawLine)
            }
            continue
        }

        // Handle markdown table lines
        if (trimmed.startsWith('|') && trimmed.endsWith('|') && trimmed.length > 2) {
            inTable = true
            tableBuffer.push(trimmed)
            continue
        } else if (inTable) {
            flushTable(!isTrailingLine)
        }

        // Horizontal rules are hidden: the blank lines and the heading that
        // usually follow already mark the section break. Checked before
        // bullets so `* * *` and `- - -` do not render as list items. A blank
        // line right after a hidden rule is also dropped when a blank line
        // came before it, so the gap stays one line high.
        if (
            HORIZONTAL_RULE.test(rawLine) ||
            (isBlankLine(rawLine) &&
                r >= 1 &&
                HORIZONTAL_RULE.test(rawLines[r - 1]) &&
                (r === 1 || isBlankLine(rawLines[r - 2])))
        ) {
            if (!isTrailingLine && cache) {
                cache.committedRawCount = r + 1
            }
            continue
        }

        // Heading lines (# Heading)
        if (rawLine.startsWith('#')) {
            const level = rawLine.match(/^#+/)?.[0].length ?? 1
            const headingText = rawLine.replace(/^#+\s*/, '')
            const hLine: FormattedLine = [
                {
                    text: headingText,
                    style: {
                        fg: level <= 2 ? THEME.colors.text : THEME.colors.muted,
                        bold: true,
                    },
                },
            ]
            outputLines.push(hLine)
            if (!isTrailingLine && cache) {
                cache.committedOutputLines.push(hLine)
                cache.committedRawCount = r + 1
            }
            continue
        }

        // Bullet lists (- item or * item)
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
            const bulletContent = trimmed.slice(2)
            const inlineParsed = parseInlineMarkdown(bulletContent, {
                streamingTail: isTrailingLine && Boolean(cache?.stabilizeInline),
            })
            const formattedBullet: FormattedLine = [
                { text: '• ', style: { fg: THEME.colors.dim } },
                ...inlineParsed,
            ]
            const wrapped = wrapSegments(formattedBullet, maxWidth)
            outputLines.push(...wrapped)
            if (!isTrailingLine && cache) {
                cache.committedOutputLines.push(...wrapped)
                cache.committedRawCount = r + 1
            }
            continue
        }

        // Plain paragraph / text line
        const inlineSegments = parseInlineMarkdown(rawLine, {
            streamingTail: isTrailingLine && Boolean(cache?.stabilizeInline),
        })
        const wrapped = wrapSegments(inlineSegments, maxWidth)
        outputLines.push(...wrapped)
        if (!isTrailingLine && cache) {
            cache.committedOutputLines.push(...wrapped)
            cache.committedRawCount = r + 1
        }
    }

    flushTable(false)

    // Flush any in-progress fenced code block lines during active streaming
    if (inCodeBlock && codeBlockBuffer.length > 0) {
        if (codeLanguage === 'mermaid') {
            outputLines.push([
                {
                    text: '  [Generating diagram...]',
                    style: { fg: THEME.colors.dim },
                },
            ])
        } else {
            for (const codeLine of codeBlockBuffer) {
                outputLines.push(highlightCodeLine(codeLine, codeLanguage))
            }
        }
    }

    if (cache) {
        cache.lastText = markdown
        cache.lastWidth = maxWidth
        cache.inCodeBlock = inCodeBlock
        cache.codeLanguage = codeLanguage
        cache.codeBlockBuffer = [...codeBlockBuffer]
        cache.inTable = inTable
        cache.tableBuffer = [...tableBuffer]
    }

    return outputLines
}
