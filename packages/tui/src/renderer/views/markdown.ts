import { THEME } from '../../theme'

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
function parseInlineMarkdown(lineText: string): FormattedLine {
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
                        bg: THEME.colors.codespanBg,
                        bold: true,
                    },
                })
                i = closing + 1
                continue
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
        let nextSpecial = lineText.length
        const nextTick = lineText.indexOf('`', i)
        const nextBold = lineText.indexOf('**', i)
        const nextBracket = lineText.indexOf('[', i)
        const nextHttp = lineText.indexOf('http://', i)
        const nextHttps = lineText.indexOf('https://', i)

        if (nextTick !== -1) nextSpecial = Math.min(nextSpecial, nextTick)
        if (nextBold !== -1) nextSpecial = Math.min(nextSpecial, nextBold)
        if (nextBracket !== -1) nextSpecial = Math.min(nextSpecial, nextBracket)
        if (nextHttp !== -1) nextSpecial = Math.min(nextSpecial, nextHttp)
        if (nextHttps !== -1) nextSpecial = Math.min(nextSpecial, nextHttps)

        const plainText = lineText.slice(i, nextSpecial)
        if (plainText) {
            segments.push({ text: plainText, style: { fg: THEME.colors.text } })
        }
        i = nextSpecial
    }

    return segments.length > 0 ? segments : [{ text: '', style: {} }]
}

/**
 * Wraps formatted text segments across lines based on maxWidth.
 * Long tokens (such as URLs) exceeding maxWidth are broken into chunks so
 * no line exceeds maxWidth.
 */
function wrapSegments(segments: FormattedLine, maxWidth: number): FormattedLine[] {
    const lines: FormattedLine[] = []
    let currentLine: FormattedLine = []
    let currentLen = 0
    const targetWidth = Math.max(10, maxWidth)

    for (const seg of segments) {
        const words = seg.text.split(/(\s+)/)
        for (let token of words) {
            if (!token) continue

            // If token alone exceeds targetWidth (e.g. long URLs), chunk it cleanly
            while (token.length > targetWidth) {
                const available = targetWidth - currentLen
                if (available > 0 && currentLen > 0) {
                    const chunk = token.slice(0, available)
                    currentLine.push({ text: chunk, style: seg.style })
                    lines.push(currentLine)
                    currentLine = []
                    currentLen = 0
                    token = token.slice(available)
                } else {
                    if (currentLen > 0) {
                        lines.push(currentLine)
                        currentLine = []
                        currentLen = 0
                    }
                    const chunk = token.slice(0, targetWidth)
                    lines.push([{ text: chunk, style: seg.style }])
                    token = token.slice(targetWidth)
                }
            }

            if (!token) continue

            if (currentLen + token.length > targetWidth && currentLen > 0) {
                lines.push(currentLine)
                currentLine = []
                currentLen = 0
            }

            if (currentLen === 0 && token.trim() === '') {
                continue
            }

            currentLine.push({ text: token, style: seg.style })
            currentLen += token.length
        }
    }

    if (currentLine.length > 0) {
        lines.push(currentLine)
    }

    return lines.length > 0 ? lines : [[{ text: '', style: {} }]]
}

/**
 * Basic syntax highlighter for code block lines across common languages
 * (TypeScript, JavaScript, Python, JSON, Shell, SQL).
 */
function highlightCodeLine(lineText: string, language: string): FormattedLine {
    const bg = THEME.colors.codespanBg
    if (!lineText) {
        return [{ text: ' ', style: { bg } }]
    }

    const segments: TextSegment[] = []
    // Match comments, strings, keywords, numbers, types, or words
    const regex =
        /(\/\/[^\n]*|#[^\n]*)|("(?:\\.|[^"\\])*"|'[^']*'|`[^`]*`)|(\b(?:const|let|var|function|return|import|export|from|if|else|for|while|class|type|interface|async|await|def|lambda|with|as|try|except|finally|public|private|protected|static|readonly|case|switch|break|continue|default|throw|catch|new|this|typeof|instanceof|true|false|null|undefined|None|True|False)\b)|(\b\d+(?:\.\d+)?\b)|(\b[A-Z][a-zA-Z0-9_]*\b)|([^\s"'\`\d\w#\/]+|\s+|[a-z_][a-zA-Z0-9_]*)/g

    let match: RegExpExecArray | null
    while ((match = regex.exec(lineText)) !== null) {
        const [full, comment, str, keyword, num, typeIdent, other] = match
        if (comment) {
            segments.push({ text: comment, style: { fg: THEME.colors.dim, italic: true, bg } })
        } else if (str) {
            segments.push({ text: str, style: { fg: THEME.colors.success, bg } })
        } else if (keyword) {
            segments.push({ text: keyword, style: { fg: THEME.colors.brand, bold: true, bg } })
        } else if (num) {
            segments.push({ text: num, style: { fg: THEME.colors.warning, bg } })
        } else if (typeIdent) {
            segments.push({ text: typeIdent, style: { fg: THEME.colors.brand, bg } })
        } else {
            segments.push({ text: other || full, style: { fg: THEME.colors.text, bg } })
        }
    }

    return segments.length > 0
        ? segments
        : [{ text: lineText, style: { fg: THEME.colors.text, bg } }]
}

/**
 * Formats markdown table rows into aligned ASCII box-drawing border rows.
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
    const colWidths: number[] = new Array(colCount).fill(3)

    for (const row of parsedRows) {
        for (let c = 0; c < colCount; c++) {
            const val = row[c] || ''
            colWidths[c] = Math.max(colWidths[c], val.length)
        }
    }

    // Scale widths if table exceeds maxWidth
    const totalTableWidth = colWidths.reduce((a, b) => a + b + 3, 1)
    if (totalTableWidth > maxWidth && maxWidth > 20) {
        const excess = totalTableWidth - maxWidth
        const shrinkPerCol = Math.floor(excess / colCount)
        for (let c = 0; c < colCount; c++) {
            colWidths[c] = Math.max(4, colWidths[c] - shrinkPerCol)
        }
    }

    const output: FormattedLine[] = []

    // Top border: ┌───────┬───────┐
    let topBorder = '┌'
    for (let c = 0; c < colCount; c++) {
        topBorder += '─'.repeat(colWidths[c] + 2) + (c === colCount - 1 ? '┐' : '┬')
    }
    output.push([{ text: topBorder, style: { fg: THEME.colors.border } }])

    // Rows
    for (let r = 0; r < parsedRows.length; r++) {
        const row = parsedRows[r]
        const isHeader = r === 0
        const rowSegs: TextSegment[] = []
        rowSegs.push({ text: '│', style: { fg: THEME.colors.border } })

        for (let c = 0; c < colCount; c++) {
            const rawCell = row[c] || ''
            const cell =
                rawCell.length > colWidths[c]
                    ? rawCell.slice(0, colWidths[c] - 1) + '…'
                    : rawCell.padEnd(colWidths[c])
            rowSegs.push({
                text: ` ${cell} `,
                style: {
                    fg: isHeader ? THEME.colors.brand : THEME.colors.text,
                    bold: isHeader,
                },
            })
            rowSegs.push({ text: '│', style: { fg: THEME.colors.border } })
        }
        output.push(rowSegs)

        // Divider after header: ├───────┼───────┤
        if (isHeader && parsedRows.length > 1) {
            let midBorder = '├'
            for (let c = 0; c < colCount; c++) {
                midBorder += '─'.repeat(colWidths[c] + 2) + (c === colCount - 1 ? '┤' : '┼')
            }
            output.push([{ text: midBorder, style: { fg: THEME.colors.border } }])
        }
    }

    // Bottom border: └───────┴───────┘
    let botBorder = '└'
    for (let c = 0; c < colCount; c++) {
        botBorder += '─'.repeat(colWidths[c] + 2) + (c === colCount - 1 ? '┘' : '┴')
    }
    output.push([{ text: botBorder, style: { fg: THEME.colors.border } }])

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
        output.push([{ text: `• ${title}`, style: { fg: THEME.colors.brand, bold: true } }])

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
        output.push([{ text: '• Sequence Diagram', style: { fg: THEME.colors.brand, bold: true } }])
        for (let i = 1; i < lines.length; i++) {
            const m = lines[i].match(
                /^([A-Za-z0-9_]+)\s*(->>|-->>|->)\s*([A-Za-z0-9_]+)\s*:\s*(.*)$/
            )
            if (m) {
                const [, from, arrow, to, text] = m
                const arrowStr = arrow.includes('--') ? ' ◄┄┄ ' : ' ──► '
                output.push([
                    { text: `  [${from}]`, style: { fg: THEME.colors.brand, bold: true } },
                    { text: arrowStr, style: { fg: THEME.colors.muted } },
                    { text: `[${to}]`, style: { fg: THEME.colors.brand, bold: true } },
                    { text: `: ${text}`, style: { fg: THEME.colors.text } },
                ])
            }
        }
        return output
    }

    // 3. Flowchart / Graph
    if (firstLine.startsWith('graph') || firstLine.startsWith('flowchart')) {
        output.push([{ text: '• Flowchart', style: { fg: THEME.colors.brand, bold: true } }])
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
                    { text: `  [${fromDisplay}]`, style: { fg: THEME.colors.brand, bold: true } },
                    { text: arrowStr, style: { fg: THEME.colors.muted } },
                    { text: `[${toDisplay}]`, style: { fg: THEME.colors.brand, bold: true } },
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
 * Parses markdown string and converts it into a list of formatted lines with ANSI styles.
 */
export function formatMarkdownToLines(markdown: string, maxWidth: number): FormattedLine[] {
    const rawLines = markdown.split(/\r?\n/)
    const outputLines: FormattedLine[] = []
    let inCodeBlock = false
    let codeLanguage = ''
    let codeBlockBuffer: string[] = []

    let inTable = false
    let tableBuffer: string[] = []

    const flushTable = () => {
        if (tableBuffer.length > 0) {
            outputLines.push(...formatMarkdownTable(tableBuffer, maxWidth))
            tableBuffer = []
            inTable = false
        }
    }

    for (let r = 0; r < rawLines.length; r++) {
        const rawLine = rawLines[r]
        const trimmed = rawLine.trim()

        // Handle fenced code block boundary ```
        if (trimmed.startsWith('```')) {
            flushTable()
            if (!inCodeBlock) {
                inCodeBlock = true
                codeLanguage = trimmed.slice(3).trim().toLowerCase()
                codeBlockBuffer = []
            } else {
                inCodeBlock = false
                if (codeLanguage === 'mermaid') {
                    outputLines.push(...formatMermaidDiagram(codeBlockBuffer.join('\n')))
                } else {
                    for (const codeLine of codeBlockBuffer) {
                        outputLines.push(highlightCodeLine(codeLine, codeLanguage))
                    }
                }
                codeBlockBuffer = []
                codeLanguage = ''
            }
            continue
        }

        // Inside fenced code block
        if (inCodeBlock) {
            codeBlockBuffer.push(rawLine)
            continue
        }

        // Handle markdown table lines
        if (trimmed.startsWith('|') && trimmed.endsWith('|') && trimmed.length > 2) {
            inTable = true
            tableBuffer.push(trimmed)
            continue
        } else if (inTable) {
            flushTable()
        }

        // Heading lines (# Heading)
        if (rawLine.startsWith('#')) {
            outputLines.push([
                {
                    text: rawLine,
                    style: {
                        fg: THEME.colors.brand,
                        bold: true,
                    },
                },
            ])
            continue
        }

        // Bullet lists (- item or * item)
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
            const bulletContent = trimmed.slice(2)
            const inlineParsed = parseInlineMarkdown(bulletContent)
            const formattedBullet: FormattedLine = [
                { text: '• ', style: { fg: THEME.colors.brand, bold: true } },
                ...inlineParsed,
            ]
            outputLines.push(...wrapSegments(formattedBullet, maxWidth))
            continue
        }

        // Plain paragraph / text line
        const inlineSegments = parseInlineMarkdown(rawLine)
        outputLines.push(...wrapSegments(inlineSegments, maxWidth))
    }

    flushTable()

    return outputLines
}
