import { THEME } from '../../theme'
import { drawDivider, drawText } from '../ui'

import type { ScreenBuffer } from '../buffer'
import type { CursorPosition } from '../types'

export interface InputBarViewProps {
    x?: number
    y: number
    width: number
    input: string
    cursorPos?: number
    placeholder?: string
    isStreaming?: boolean
    activeModel?: string
    modelLabel?: string
    isAuthenticated?: boolean
    authMethod?: string
    contextTokens?: number
    maxContextTokens?: number
    tasksCount?: number
    runningTasksCount?: number
    mcpServersCount?: number
    queuedPromptsCount?: number
    modeTag?: string
    showExitConfirm?: boolean
    toast?: { message: string; variant?: string } | null
}

export function formatTokenCount(n: number): string {
    if (n >= 1_000_000) {
        const val = n / 1_000_000
        return `${Number.isInteger(val) ? val : val.toFixed(1).replace(/\.0$/, '')}M`
    }
    if (n >= 1_000) {
        const val = n / 1_000
        return `${Number.isInteger(val) ? val : val.toFixed(1).replace(/\.0$/, '')}k`
    }
    return n.toString()
}

export function tokenizeInputLine(
    lineText: string,
    isFirstLine: boolean
): Array<{ text: string; style: any }> {
    if (!lineText) return []

    const tokens: Array<{ text: string; style: any }> = []
    const tokenRegex = /(\[Pasted \d+ lines(?: #\d+)?\])|(@[^\s]+)/g

    let lastIdx = 0
    let match: RegExpExecArray | null

    // Highlight leading slash command on first line
    if (isFirstLine && lineText.startsWith('/')) {
        const spaceIdx = lineText.indexOf(' ')
        const cmdText = spaceIdx === -1 ? lineText : lineText.slice(0, spaceIdx)
        tokens.push({
            text: cmdText,
            style: { fg: THEME.colors.brand, bold: true },
        })
        lastIdx = cmdText.length
    }

    tokenRegex.lastIndex = lastIdx
    while ((match = tokenRegex.exec(lineText)) !== null) {
        const matchIdx = match.index
        if (matchIdx < lastIdx) continue
        if (matchIdx > lastIdx) {
            tokens.push({
                text: lineText.slice(lastIdx, matchIdx),
                style: { fg: THEME.colors.text },
            })
        }
        if (match[1]) {
            tokens.push({
                text: match[1],
                style: { fg: THEME.colors.brand, bold: true },
            })
        } else if (match[2]) {
            tokens.push({
                text: match[2],
                style: { fg: THEME.colors.brand },
            })
        }
        lastIdx = matchIdx + match[0].length
    }

    if (lastIdx < lineText.length) {
        tokens.push({
            text: lineText.slice(lastIdx),
            style: { fg: THEME.colors.text },
        })
    }

    return tokens
}

export interface WrappedInputLine {
    text: string
    startIndex: number
    endIndex: number
}

export function wrapInputText(input: string, maxWidth: number): WrappedInputLine[] {
    if (!input) {
        return [{ text: '', startIndex: 0, endIndex: 0 }]
    }

    const lines: WrappedInputLine[] = []
    const paragraphs = input.split('\n')
    let rawPos = 0

    for (let p = 0; p < paragraphs.length; p++) {
        const paragraph = paragraphs[p]!
        const pLen = paragraph.length

        if (pLen === 0) {
            lines.push({ text: '', startIndex: rawPos, endIndex: rawPos })
            rawPos += 1 // account for \n
            continue
        }

        let pOffset = 0
        while (pOffset < pLen) {
            const remaining = pLen - pOffset
            if (remaining <= maxWidth) {
                lines.push({
                    text: paragraph.slice(pOffset),
                    startIndex: rawPos + pOffset,
                    endIndex: rawPos + pLen,
                })
                break
            }

            // Look ahead up to maxWidth + 1 to find word boundaries
            const chunk = paragraph.slice(pOffset, pOffset + maxWidth + 1)
            const spaceIdx = chunk.lastIndexOf(' ')

            let takeLen = maxWidth
            let nextOffsetStep = maxWidth

            if (spaceIdx > 0 && spaceIdx <= maxWidth) {
                takeLen = spaceIdx
                nextOffsetStep = spaceIdx + 1
            }

            lines.push({
                text: paragraph.slice(pOffset, pOffset + takeLen),
                startIndex: rawPos + pOffset,
                endIndex: rawPos + pOffset + takeLen,
            })

            pOffset += nextOffsetStep
        }

        rawPos += pLen + 1 // account for paragraph + \n
    }

    return lines.length > 0 ? lines : [{ text: '', startIndex: 0, endIndex: 0 }]
}

export function getWrappedCursorPosition(
    wrappedLines: WrappedInputLine[],
    cursorPos: number
): { line: number; col: number } {
    if (wrappedLines.length === 0) {
        return { line: 0, col: 0 }
    }

    for (let i = 0; i < wrappedLines.length; i++) {
        const line = wrappedLines[i]!
        if (cursorPos >= line.startIndex && cursorPos <= line.endIndex) {
            return { line: i, col: cursorPos - line.startIndex }
        }
        if (i + 1 < wrappedLines.length && cursorPos < wrappedLines[i + 1]!.startIndex) {
            return { line: i + 1, col: 0 }
        }
    }

    const lastIdx = wrappedLines.length - 1
    const lastLine = wrappedLines[lastIdx]!
    return { line: lastIdx, col: lastLine.text.length }
}

export const InputBarView = {
    getHeight(input = '', width = 80): number {
        if (!input) return 4
        const paddingLeft = THEME.padding.paddingLeft ?? 2
        const paddingRight = THEME.padding.paddingRight ?? 4
        const textOffsetX = paddingLeft + `${THEME.glyphs.prompt} `.length
        const maxInputWidth = Math.max(10, width - textOffsetX - paddingRight)

        const wrappedLines = wrapInputText(input, maxInputWidth)
        const promptRows = Math.min(8, Math.max(1, wrappedLines.length))
        return promptRows + 3 // Top separator, prompt rows, bottom separator, status row
    },

    render(buffer: ScreenBuffer, props: InputBarViewProps): CursorPosition {
        const x = props.x ?? 0
        const y = props.y
        const width = props.width
        const input = props.input
        const cursorPos = props.cursorPos ?? input.length
        const paddingLeft = THEME.padding.paddingLeft ?? 2
        const paddingRight = THEME.padding.paddingRight ?? 4
        const sepWidth = Math.max(10, width - paddingLeft - paddingRight)

        const promptGlyph = `${THEME.glyphs.prompt} `
        const promptGlyphLen = promptGlyph.length
        let tagPrefixLen = 0
        if (props.modeTag) {
            tagPrefixLen = `[${props.modeTag}] `.length
        }
        const textOffsetX = x + paddingLeft + promptGlyphLen + tagPrefixLen
        const maxInputWidth = Math.max(10, width - textOffsetX - paddingRight)

        const wrappedLines = wrapInputText(input, maxInputWidth)
        const promptRows = Math.min(8, Math.max(1, wrappedLines.length))

        // Determine cursor line and column inside wrapped lines
        const { line: cursorLine, col: cursorCol } = getWrappedCursorPosition(
            wrappedLines,
            cursorPos
        )

        // Vertical windowing if lines exceed max visible prompt rows (8 rows)
        let windowStart = 0
        if (cursorLine >= promptRows) {
            windowStart = cursorLine - promptRows + 1
        }

        // 1. Top separator
        drawDivider(buffer, {
            x: x + paddingLeft,
            y,
            width: sepWidth,
            char: '─',
            style: { fg: THEME.colors.border },
        })

        // 2. Prompt rows
        let activeCursorX = textOffsetX + cursorCol
        let activeCursorY = y + 1

        for (let r = 0; r < promptRows; r++) {
            const lineIdx = windowStart + r
            const currentY = y + 1 + r
            const lineItem = wrappedLines[lineIdx]
            const lineText = lineItem ? lineItem.text : ''

            if (lineIdx === 0) {
                drawText(buffer, promptGlyph, {
                    x: x + paddingLeft,
                    y: currentY,
                    style: {
                        fg: props.isStreaming ? THEME.colors.muted : THEME.colors.brand,
                    },
                })
                if (props.modeTag) {
                    const tagStr = `[${props.modeTag}] `
                    drawText(buffer, tagStr, {
                        x: x + paddingLeft + promptGlyphLen,
                        y: currentY,
                        style: { fg: THEME.colors.brand, bold: true },
                    })
                }
            } else {
                // Continuation glyph on subsequent multiline rows
                drawText(buffer, '· ', {
                    x: x + paddingLeft,
                    y: currentY,
                    style: { fg: THEME.colors.muted },
                })
            }

            if (!input && lineIdx === 0) {
                const placeholder =
                    props.placeholder ??
                    'Ask December to build features, fix bugs, or work on your code...'
                drawText(buffer, placeholder, {
                    x: textOffsetX,
                    y: currentY,
                    maxWidth: maxInputWidth,
                    style: { fg: THEME.colors.dim },
                })
            } else if (lineText) {
                // Tokenize and highlight prompt text (pastes, commands, @context mentions)
                const segments = tokenizeInputLine(lineText, lineIdx === 0)
                let curX = textOffsetX
                for (const seg of segments) {
                    if (curX >= width - paddingRight) break
                    const maxSegWidth = Math.max(0, width - curX - paddingRight)
                    drawText(buffer, seg.text, {
                        x: curX,
                        y: currentY,
                        maxWidth: maxSegWidth,
                        style: seg.style,
                    })
                    curX += seg.text.length
                }
            }

            if (cursorLine === lineIdx) {
                activeCursorX = textOffsetX + cursorCol
                activeCursorY = currentY
            }
        }

        // 3. Bottom separator
        const bottomDividerY = y + 1 + promptRows
        drawDivider(buffer, {
            x: x + paddingLeft,
            y: bottomDividerY,
            width: sepWidth,
            char: '─',
            style: { fg: THEME.colors.border },
        })

        // 4. Status row
        const statusY = bottomDividerY + 1
        if (props.showExitConfirm) {
            drawText(buffer, '· Press Ctrl+C again to exit', {
                x: x + paddingLeft,
                y: statusY,
                maxWidth: width - paddingLeft - 2,
                style: { fg: THEME.colors.muted },
            })
        } else {
            // Left side status items
            let leftX = x + paddingLeft

            // Model label
            let modelText: string
            if (props.isAuthenticated === false) {
                modelText = 'Not connected (run /login)'
            } else {
                modelText = props.modelLabel || props.activeModel || 'Gemini 3.7 Flash'
            }
            drawText(buffer, modelText, {
                x: leftX,
                y: statusY,
                style: { fg: THEME.colors.muted },
            })
            leftX += modelText.length

            // Tasks indicator
            const totalTasks = props.tasksCount ?? 0
            const runningTasks = props.runningTasksCount ?? 0
            if (totalTasks > 0) {
                const taskText =
                    runningTasks > 0
                        ? ` · ${runningTasks} running (Ctrl+T)`
                        : ` · ${totalTasks} tasks (Ctrl+T)`
                drawText(buffer, taskText, {
                    x: leftX,
                    y: statusY,
                    style: {
                        fg: runningTasks > 0 ? THEME.colors.warning : THEME.colors.muted,
                    },
                })
                leftX += taskText.length
            }

            // MCP indicator
            const mcpCount = props.mcpServersCount ?? 0
            if (mcpCount > 0) {
                const mcpText = ` · ${mcpCount} MCP`
                drawText(buffer, mcpText, {
                    x: leftX,
                    y: statusY,
                    style: { fg: THEME.colors.muted },
                })
                leftX += mcpText.length
            }

            // Queued prompts indicator
            const queuedCount = props.queuedPromptsCount ?? 0
            if (queuedCount > 0) {
                const queuedText = ` · ${queuedCount} queued`
                drawText(buffer, queuedText, {
                    x: leftX,
                    y: statusY,
                    style: { fg: THEME.colors.brand },
                })
                leftX += queuedText.length
            }

            // Toast message if active
            if (props.toast?.message) {
                const toastText = ` · ${props.toast.message.trim()}`
                const toastColor =
                    props.toast.variant === 'success'
                        ? THEME.colors.success
                        : props.toast.variant === 'error'
                          ? THEME.colors.error
                          : THEME.colors.muted
                drawText(buffer, toastText, {
                    x: leftX,
                    y: statusY,
                    maxWidth: Math.max(10, width - leftX - 25),
                    style: { fg: toastColor },
                })
            }

            // Right side status: Context tokens
            if (props.contextTokens !== undefined) {
                const tokensFormatted = formatTokenCount(props.contextTokens)
                let tokenLabel: string
                let tokenFg: string = THEME.colors.muted
                let tokenBold = false
                if (props.maxContextTokens && props.maxContextTokens > 0) {
                    const maxFormatted = formatTokenCount(props.maxContextTokens)
                    const pct = Math.min(
                        100,
                        Math.round((props.contextTokens / props.maxContextTokens) * 100)
                    )
                    tokenLabel = `${tokensFormatted} / ${maxFormatted} (${pct}%)`
                    if (pct >= 90) {
                        tokenFg = THEME.colors.error
                        tokenBold = true
                    } else if (pct >= 70) {
                        tokenFg = THEME.colors.warning
                    }
                } else {
                    tokenLabel = `${tokensFormatted} tokens`
                }

                const rightX = Math.max(leftX + 2, width - tokenLabel.length - paddingRight)
                drawText(buffer, tokenLabel, {
                    x: rightX,
                    y: statusY,
                    style: { fg: tokenFg, bold: tokenBold },
                })
            }
        }

        // Return terminal cursor position
        return {
            x: activeCursorX,
            y: activeCursorY,
            visible: !props.isStreaming || input.length > 0,
        }
    },
}
