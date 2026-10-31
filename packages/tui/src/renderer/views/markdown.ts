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
                        fg: THEME.colors.text,
                        bg: THEME.colors.codespanBg,
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

        // 3. Regular text segment until next formatting token
        let nextSpecial = lineText.length
        const nextTick = lineText.indexOf('`', i)
        const nextBold = lineText.indexOf('**', i)

        if (nextTick !== -1) nextSpecial = Math.min(nextSpecial, nextTick)
        if (nextBold !== -1) nextSpecial = Math.min(nextSpecial, nextBold)

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
 */
function wrapSegments(segments: FormattedLine, maxWidth: number): FormattedLine[] {
    const lines: FormattedLine[] = []
    let currentLine: FormattedLine = []
    let currentLen = 0

    for (const seg of segments) {
        const words = seg.text.split(/(\s+)/)
        for (const token of words) {
            if (!token) continue

            if (currentLen + token.length > maxWidth && currentLen > 0) {
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
 * Parses markdown string and converts it into a list of formatted lines with ANSI styles.
 */
export function formatMarkdownToLines(markdown: string, maxWidth: number): FormattedLine[] {
    const rawLines = markdown.split(/\r?\n/)
    const outputLines: FormattedLine[] = []
    let inCodeBlock = false
    let codeLanguage = ''

    for (const rawLine of rawLines) {
        const trimmed = rawLine.trim()

        // Handle fenced code block boundary ```
        if (trimmed.startsWith('```')) {
            if (!inCodeBlock) {
                inCodeBlock = true
                codeLanguage = trimmed.slice(3).trim()
            } else {
                inCodeBlock = false
                codeLanguage = ''
            }
            continue
        }

        // Inside fenced code block
        if (inCodeBlock) {
            outputLines.push([
                {
                    text: rawLine,
                    style: {
                        fg: THEME.colors.text,
                        bg: THEME.colors.codespanBg,
                    },
                },
            ])
            continue
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

    return outputLines
}
