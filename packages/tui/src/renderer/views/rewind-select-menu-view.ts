import { THEME } from '../../theme'
import { drawText } from '../ui'

import { MenuFooterView } from './menu-footer-view'
import { formatSessionTimeAgo, sanitizeSessionTitle } from './session-select-menu-view'

import type { ScreenBuffer } from '../buffer'

export const REWIND_WINDOW_SIZE = 7

export interface RewindTurnEntry {
    /** Snapshot id used to restore this turn. */
    id: string
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
    confirming?: boolean
    windowSize?: number
}

export const RewindSelectMenuView = {
    getHeight(turnsCount: number, windowSize = REWIND_WINDOW_SIZE): number {
        const count = turnsCount || 1
        const visible = Math.min(windowSize, count)
        const hasOverflow = count > windowSize
        // Title (1) + Subtitle (1) + Gap (1) + Visible + Overflow (0|1) + Gap (1) + Footer (1)
        return 3 + visible + (hasOverflow ? 1 : 0) + 2
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
        drawText(buffer, 'Rewind', {
            x,
            y,
            style: { fg: THEME.colors.text, bold: true },
        })
        y += 1

        // 2. Subtitle Row
        drawText(buffer, 'Restore files and conversation to the start of a turn.', {
            x,
            y,
            maxWidth: width,
            style: { fg: THEME.colors.muted },
        })
        y += 2

        // 3. Turn Items
        const turns = props.turns || []
        const totalItems = turns.length

        if (totalItems === 0) {
            drawText(buffer, '  No turns to rewind in this conversation.', {
                x,
                y,
                style: { fg: THEME.colors.muted },
            })
        } else {
            const windowStart = Math.max(
                0,
                Math.min(props.windowStart || 0, Math.max(0, totalItems - windowSize))
            )
            const windowEnd = Math.min(windowStart + windowSize, totalItems)
            const visible = turns.slice(windowStart, windowEnd)
            const turnLabelWidth = `Turn ${Math.max(...turns.map((t) => t.turnIndex))}`.length + 2

            for (let i = 0; i < visible.length; i++) {
                const turn = visible[i]!
                const absIdx = windowStart + i
                const isSelected = absIdx === props.selectedIndex
                const isConfirming = isSelected && Boolean(props.confirming)
                const rowY = y + i

                // Indicator
                const selector = isSelected ? `${THEME.glyphs.selector} ` : '  '
                drawText(buffer, selector, {
                    x,
                    y: rowY,
                    style: {
                        fg: isSelected ? THEME.colors.brand : THEME.colors.muted,
                        bold: isSelected,
                    },
                })

                // Turn label
                drawText(buffer, `Turn ${turn.turnIndex}`, {
                    x: x + 2,
                    y: rowY,
                    style: { fg: isSelected ? THEME.colors.brand : THEME.colors.muted },
                })

                // Right aligned meta: file count and time
                const filesCount = turn.touchedFiles?.length || 0
                const filesTag =
                    filesCount > 0 ? `${filesCount} file${filesCount === 1 ? '' : 's'} · ` : ''
                const metaText = `${filesTag}${formatSessionTimeAgo(turn.timestamp)}`
                const metaWidth = 20
                drawText(buffer, metaText.padStart(metaWidth), {
                    x: x + width - metaWidth,
                    y: rowY,
                    maxWidth: metaWidth,
                    style: { fg: THEME.colors.muted },
                })

                // Prompt
                const promptX = x + 2 + turnLabelWidth
                const maxPromptWidth = Math.max(10, width - 2 - turnLabelWidth - metaWidth - 2)
                const prompt = sanitizeSessionTitle(turn.prompt || '') || '(empty prompt)'
                const confirmSuffix = ' [Rewind? y/n]'
                const promptWidth = isConfirming
                    ? Math.max(4, maxPromptWidth - confirmSuffix.length)
                    : maxPromptWidth
                const promptResult = drawText(buffer, prompt, {
                    x: promptX,
                    y: rowY,
                    maxWidth: promptWidth,
                    ellipsis: true,
                    style: {
                        fg: isConfirming
                            ? THEME.colors.warning
                            : isSelected
                              ? THEME.colors.brand
                              : THEME.colors.text,
                        bold: isSelected,
                    },
                })
                if (isConfirming) {
                    drawText(buffer, confirmSuffix, {
                        x: promptResult.x,
                        y: rowY,
                        style: { fg: THEME.colors.warning, bold: true },
                    })
                }
            }

            // Pagination overflow indicator
            if (totalItems > windowSize) {
                const itemsAbove = windowStart
                const itemsBelow = totalItems - windowEnd
                let statusText = ''
                if (itemsAbove > 0 && itemsBelow > 0) {
                    statusText = `↑ ${itemsAbove} more · ↓ ${itemsBelow} more`
                } else if (itemsAbove > 0) {
                    statusText = `↑ ${itemsAbove} more`
                } else if (itemsBelow > 0) {
                    statusText = `↓ ${itemsBelow} more`
                }
                if (statusText) {
                    drawText(buffer, statusText, {
                        x: x + 2,
                        y: y + visible.length,
                        style: { fg: THEME.colors.subtle },
                    })
                }
            }
        }

        // 4. Navigation Footer
        const height = props.height ?? buffer.height
        const footerY = (props.y ?? 0) + height - 1
        const footerItems = props.confirming
            ? [
                  { key: 'y', label: 'confirm rewind' },
                  { key: 'n/esc', label: 'cancel' },
              ]
            : totalItems > 0
              ? [
                    { key: '↑/↓', label: 'navigate' },
                    { key: 'enter', label: 'rewind' },
                    { key: 'esc', label: 'close' },
                ]
              : [{ key: 'esc', label: 'close' }]

        MenuFooterView.render(buffer, {
            x: props.x ?? 0,
            y: footerY,
            width,
            items: footerItems,
        })
    },
}
