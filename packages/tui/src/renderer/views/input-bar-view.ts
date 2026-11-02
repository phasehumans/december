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

export const InputBarView = {
    getHeight(input = ''): number {
        if (!input) return 4
        const lines = input.split('\n')
        const promptRows = Math.min(6, Math.max(1, lines.length))
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

        const promptLines = input ? input.split('\n') : ['']
        const promptRows = Math.min(6, Math.max(1, promptLines.length))

        // Determine cursor line and column inside multiline prompt
        let cursorLine = 0
        let cursorCol = 0
        let charCount = 0
        let found = false
        for (let i = 0; i < promptLines.length; i++) {
            const lineLen = promptLines[i]!.length
            if (cursorPos <= charCount + lineLen) {
                cursorLine = i
                cursorCol = cursorPos - charCount
                found = true
                break
            }
            charCount += lineLen + 1 // +1 for the newline
        }
        if (!found && promptLines.length > 0) {
            cursorLine = promptLines.length - 1
            cursorCol = promptLines[cursorLine]!.length
        }

        // Vertical windowing if lines exceed max visible prompt rows
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
        const promptGlyph = `${THEME.glyphs.prompt} `
        const promptGlyphLen = promptGlyph.length
        let tagPrefixLen = 0
        if (props.modeTag) {
            tagPrefixLen = `[${props.modeTag}] `.length
        }
        const textOffsetX = x + paddingLeft + promptGlyphLen + tagPrefixLen
        const maxInputWidth = Math.max(10, width - textOffsetX - 2)

        let activeCursorX = textOffsetX + cursorCol
        let activeCursorY = y + 1

        for (let r = 0; r < promptRows; r++) {
            const lineIdx = windowStart + r
            const currentY = y + 1 + r
            const lineText = promptLines[lineIdx] ?? ''

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
            } else {
                let hScroll = 0
                if (cursorLine === lineIdx && cursorCol >= maxInputWidth) {
                    hScroll = cursorCol - maxInputWidth + 1
                }
                const visibleLineText = lineText.slice(hScroll)

                // Highlight paste tokens e.g. [Pasted 42 lines]
                const pasteRegex = /(\[Pasted \d+ lines(?: #\d+)?\])/g
                if (pasteRegex.test(visibleLineText)) {
                    let curX = textOffsetX
                    let lastIdx = 0
                    pasteRegex.lastIndex = 0
                    let match: RegExpExecArray | null
                    while ((match = pasteRegex.exec(visibleLineText)) !== null) {
                        const matchIdx = match.index
                        if (matchIdx > lastIdx) {
                            const plain = visibleLineText.slice(lastIdx, matchIdx)
                            drawText(buffer, plain, {
                                x: curX,
                                y: currentY,
                                maxWidth: Math.max(0, width - curX - paddingRight),
                                style: { fg: THEME.colors.text },
                            })
                            curX += plain.length
                        }
                        const token = match[1]!
                        drawText(buffer, token, {
                            x: curX,
                            y: currentY,
                            maxWidth: Math.max(0, width - curX - paddingRight),
                            style: { fg: THEME.colors.brand, bold: true },
                        })
                        curX += token.length
                        lastIdx = matchIdx + token.length
                    }
                    if (lastIdx < visibleLineText.length) {
                        const tail = visibleLineText.slice(lastIdx)
                        drawText(buffer, tail, {
                            x: curX,
                            y: currentY,
                            maxWidth: Math.max(0, width - curX - paddingRight),
                            style: { fg: THEME.colors.text },
                        })
                    }
                } else {
                    drawText(buffer, visibleLineText, {
                        x: textOffsetX,
                        y: currentY,
                        maxWidth: maxInputWidth,
                        style: { fg: THEME.colors.text },
                    })
                }

                if (cursorLine === lineIdx) {
                    activeCursorX = textOffsetX + (cursorCol - hScroll)
                    activeCursorY = currentY
                }
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
                if (props.maxContextTokens && props.maxContextTokens > 0) {
                    const maxFormatted = formatTokenCount(props.maxContextTokens)
                    const pct = Math.min(
                        100,
                        Math.round((props.contextTokens / props.maxContextTokens) * 100)
                    )
                    tokenLabel = `${tokensFormatted} / ${maxFormatted} (${pct}%)`
                } else {
                    tokenLabel = `${tokensFormatted} tokens`
                }

                const rightX = Math.max(leftX + 2, width - tokenLabel.length - paddingRight)
                drawText(buffer, tokenLabel, {
                    x: rightX,
                    y: statusY,
                    style: { fg: THEME.colors.muted },
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
