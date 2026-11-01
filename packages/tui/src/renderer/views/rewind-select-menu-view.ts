import { THEME } from '../../theme'
import { drawDivider, drawText } from '../ui'

import { MenuFooterView } from './menu-footer-view'
import { formatSessionTimeAgo } from './session-select-menu-view'

import type { ScreenBuffer } from '../buffer'

export const REWIND_WINDOW_SIZE = 7

export interface RewindTurnEntry {
    turnIndex: number
    commitHash?: string
    prompt?: string
    timestamp: number
    touchedFiles?: string[]
}

export interface RewindSelectMenuViewProps {
    x?: number
    y: number
    width: number
    height?: number
    turns: RewindTurnEntry[]
    selectedIndex: number
    windowStart: number
    windowSize?: number
}

export const RewindSelectMenuView = {
    getHeight(turnsCount: number, windowSize = REWIND_WINDOW_SIZE): number {
        const listRows = Math.min(Math.max(turnsCount, 1), windowSize)
        // Title (1), Subtitle (1), Divider (1), List (listRows), Status (1), Divider (1), Footer (1) = 6 + listRows
        return 6 + listRows
    },

    render(buffer: ScreenBuffer, props: RewindSelectMenuViewProps): void {
        const x = (props.x ?? 0) + THEME.padding.paddingLeft
        let y = props.y
        const width = Math.max(
            20,
            props.width - THEME.padding.paddingLeft - THEME.padding.paddingRight
        )
        const windowSize = props.windowSize ?? REWIND_WINDOW_SIZE

        // 1. Title Row
        drawText(buffer, 'Rewind Checkpoint / Turn Snapshot', {
            x,
            y,
            style: { fg: THEME.colors.brand, bold: true },
        })
        y += 1

        // 2. Subtitle Row
        drawText(
            buffer,
            'Select a previous turn to restore filesystem state and rewind conversation.',
            {
                x,
                y,
                style: { fg: THEME.colors.muted },
            }
        )
        y += 1

        // 3. Divider
        drawDivider(buffer, {
            x,
            y,
            width,
            char: '─',
            style: { fg: THEME.colors.border },
        })
        y += 1

        // 4. Turns List
        const turns = props.turns || []
        const totalItems = turns.length

        if (totalItems === 0) {
            drawText(buffer, '  No checkpoints recorded in this session.', {
                x,
                y,
                style: { fg: THEME.colors.muted },
            })
            y += 1
        } else {
            const windowStart = Math.max(
                0,
                Math.min(props.windowStart || 0, Math.max(0, totalItems - windowSize))
            )
            const windowEnd = Math.min(windowStart + windowSize, totalItems)
            const visible = turns.slice(windowStart, windowEnd)

            for (let i = 0; i < visible.length; i++) {
                const turn = visible[i]
                const absIdx = windowStart + i
                const isSelected = absIdx === props.selectedIndex
                const rowY = y + i

                // Indicator
                const selector = isSelected ? `${THEME.glyphs.selector} ` : '  '
                drawText(buffer, selector, {
                    x,
                    y: rowY,
                    style: { fg: isSelected ? THEME.colors.brand : THEME.colors.muted },
                })

                // Turn badge
                const turnTag = `Turn ${turn.turnIndex}`
                drawText(buffer, turnTag.padEnd(8), {
                    x: x + 2,
                    y: rowY,
                    style: {
                        fg: isSelected ? THEME.colors.brand : THEME.colors.text,
                        bold: isSelected,
                    },
                })

                // Commit hash
                const commitTag = turn.commitHash ? turn.commitHash.slice(0, 7) : '       '
                drawText(buffer, commitTag, {
                    x: x + 11,
                    y: rowY,
                    style: { fg: THEME.colors.muted },
                })

                // Time ago
                const timeStr = formatSessionTimeAgo(turn.timestamp)
                drawText(buffer, timeStr.padEnd(10), {
                    x: x + 20,
                    y: rowY,
                    style: { fg: THEME.colors.muted },
                })

                // Prompt preview + files count
                const filesCount = turn.touchedFiles?.length || 0
                const filesTag =
                    filesCount > 0 ? ` (${filesCount} file${filesCount === 1 ? '' : 's'})` : ''
                const rawPrompt = (turn.prompt || 'Turn snapshot').replace(/\s+/g, ' ').trim()
                const maxPromptWidth = Math.max(10, width - 32 - filesTag.length)
                const promptSnippet =
                    rawPrompt.length > maxPromptWidth
                        ? `${rawPrompt.slice(0, maxPromptWidth - 3)}...`
                        : rawPrompt

                drawText(buffer, promptSnippet, {
                    x: x + 31,
                    y: rowY,
                    maxWidth: maxPromptWidth,
                    style: {
                        fg: isSelected ? THEME.colors.text : THEME.colors.dim,
                        bold: isSelected,
                    },
                })

                if (filesTag) {
                    drawText(buffer, filesTag, {
                        x: x + 31 + promptSnippet.length,
                        y: rowY,
                        style: { fg: THEME.colors.brand },
                    })
                }
            }
            y += visible.length

            // Status bar
            const statusText = `[${windowStart + 1}-${windowEnd} of ${totalItems} checkpoints]`
            drawText(buffer, statusText, {
                x: x + 2,
                y,
                style: { fg: THEME.colors.subtle },
            })
            y += 1
        }

        // 5. Divider
        const height = props.height ?? buffer.height
        const footerY = (props.y ?? 0) + height - 1
        const bottomDividerY = (props.y ?? 0) + height - 2

        drawDivider(buffer, {
            x,
            y: bottomDividerY,
            width,
            char: '─',
            style: { fg: THEME.colors.border },
        })

        // 6. Navigation Footer
        MenuFooterView.render(buffer, {
            x,
            y: footerY,
            width,
            items: [
                { key: '↑/↓', label: 'navigate' },
                { key: 'enter', label: 'rewind to turn' },
                { key: 'esc', label: 'close' },
            ],
        })
    },
}
