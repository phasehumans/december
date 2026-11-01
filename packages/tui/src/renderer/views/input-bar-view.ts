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
    getHeight(): number {
        return 4 // Top separator, Prompt row, Bottom separator, Status row
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

        // 1. Top separator
        drawDivider(buffer, {
            x: x + paddingLeft,
            y,
            width: sepWidth,
            char: '─',
            style: { fg: THEME.colors.border },
        })

        // 2. Prompt row
        const promptY = y + 1
        const promptGlyph = `${THEME.glyphs.prompt} `
        drawText(buffer, promptGlyph, {
            x: x + paddingLeft,
            y: promptY,
            style: {
                fg: props.isStreaming ? THEME.colors.muted : THEME.colors.brand,
            },
        })

        let textOffsetX = x + paddingLeft + promptGlyph.length
        if (props.modeTag) {
            const tagStr = `[${props.modeTag}] `
            drawText(buffer, tagStr, {
                x: textOffsetX,
                y: promptY,
                style: { fg: THEME.colors.brand, bold: true },
            })
            textOffsetX += tagStr.length
        }

        const maxInputWidth = Math.max(10, width - textOffsetX - 2)

        if (!input) {
            const placeholder =
                props.placeholder ??
                'Ask December to build features, fix bugs, or work on your code...'
            drawText(buffer, placeholder, {
                x: textOffsetX,
                y: promptY,
                maxWidth: maxInputWidth,
                style: { fg: THEME.colors.dim },
            })
        } else {
            drawText(buffer, input, {
                x: textOffsetX,
                y: promptY,
                maxWidth: maxInputWidth,
                style: { fg: THEME.colors.text },
            })
        }

        // 3. Bottom separator
        const bottomDividerY = y + 2
        drawDivider(buffer, {
            x: x + paddingLeft,
            y: bottomDividerY,
            width: sepWidth,
            char: '─',
            style: { fg: THEME.colors.border },
        })

        // 4. Status row
        const statusY = y + 3
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
            x: textOffsetX + cursorPos,
            y: promptY,
            visible: !props.isStreaming,
        }
    },
}
