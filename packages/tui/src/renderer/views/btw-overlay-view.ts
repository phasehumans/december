import { THEME } from '../../theme'
import { drawText } from '../ui'

import type { BtwState } from '../../types'
import type { ScreenBuffer } from '../buffer'

export const BTW_MAX_VISIBLE_LINES = 6
export const BTW_EXPANDED_MAX_VISIBLE_LINES = 16

export interface BtwOverlayViewProps {
    x?: number
    y: number
    width: number
    state: BtwState
    scrollOffset: number
    maxVisibleLines?: number
}

export const BtwOverlayView = {
    getHeight(state: BtwState, maxVisible?: number): number {
        if (!state) return 0
        const limit =
            maxVisible ??
            (state.isExpanded ? BTW_EXPANDED_MAX_VISIBLE_LINES : BTW_MAX_VISIBLE_LINES)
        let bodyLines = 1
        let hasOverflow = false

        if (state.status === 'streaming' || state.status === 'complete') {
            const lines = (state.answer || '').split(/\r?\n/)
            bodyLines = Math.min(limit, Math.max(1, lines.length))
            hasOverflow = lines.length > limit
        } else if (state.status === 'error') {
            const err = state.error || 'Failed to answer side question'
            const is401 = err.includes('401')
            bodyLines = is401 ? 3 : Math.min(limit, Math.max(1, err.split(/\r?\n/).length))
        }

        // Header (1) + Body (bodyLines) + Overflow (0|1) + Footer (1)
        return 1 + bodyLines + (hasOverflow ? 1 : 0) + 1
    },

    render(buffer: ScreenBuffer, props: BtwOverlayViewProps): void {
        const x = (props.x ?? 0) + (THEME.padding.paddingLeft ?? 2)
        let y = props.y
        const width = props.width
        const state = props.state
        const maxVisible =
            props.maxVisibleLines ??
            (state.isExpanded ? BTW_EXPANDED_MAX_VISIBLE_LINES : BTW_MAX_VISIBLE_LINES)

        const borderGlyph = '▎ '

        // 1. Header row
        drawText(buffer, borderGlyph, {
            x,
            y,
            style: { fg: THEME.colors.brand },
        })
        drawText(buffer, '[btw] ', {
            x: x + 2,
            y,
            style: { fg: THEME.colors.brand, bold: true },
        })
        drawText(buffer, state.question, {
            x: x + 8,
            y,
            maxWidth: Math.max(10, width - x - 10),
            style: { fg: THEME.colors.text, bold: true },
        })
        y += 1

        // 2. Body row(s)
        if (state.status === 'loading') {
            drawText(buffer, borderGlyph, {
                x,
                y,
                style: { fg: THEME.colors.brand },
            })
            drawText(buffer, 'Looking up cached context...', {
                x: x + 2,
                y,
                style: { fg: THEME.colors.muted },
            })
            y += 1
        } else if (state.status === 'error') {
            const rawError = state.error || 'Failed to answer side question'
            const is401 = rawError.includes('401')
            const errLines = is401
                ? [
                      `Error: ${rawError}`,
                      'Authentication Failed: Invalid or missing API key.',
                      'Tip: Configure your key via /login or set API keys in your environment.',
                  ]
                : rawError.split(/\r?\n/).map((l) => (l.startsWith('Error:') ? l : `Error: ${l}`))

            for (let i = 0; i < errLines.length; i++) {
                const errLine = errLines[i] || ''
                drawText(buffer, borderGlyph, {
                    x,
                    y,
                    style: { fg: THEME.colors.brand },
                })
                drawText(buffer, errLine, {
                    x: x + 2,
                    y,
                    maxWidth: Math.max(10, width - x - 4),
                    style: { fg: i === 2 && is401 ? THEME.colors.muted : THEME.colors.error },
                })
                y += 1
            }
        } else {
            const allLines = (state.answer || '').split(/\r?\n/)
            const totalLines = allLines.length
            const offset = Math.max(
                0,
                Math.min(props.scrollOffset, Math.max(0, totalLines - maxVisible))
            )
            const visible = allLines.slice(offset, offset + maxVisible)

            for (let i = 0; i < visible.length; i++) {
                const line = visible[i] || ''
                const rowY = y + i
                drawText(buffer, borderGlyph, {
                    x,
                    y: rowY,
                    style: { fg: THEME.colors.brand },
                })
                drawText(buffer, line, {
                    x: x + 2,
                    y: rowY,
                    maxWidth: Math.max(10, width - x - 4),
                    style: { fg: THEME.colors.text },
                })
            }
            y += visible.length

            // Overflow Indicator
            if (totalLines > maxVisible) {
                const itemsAbove = offset
                const itemsBelow = Math.max(0, totalLines - (offset + maxVisible))
                let overflowText = ''
                if (itemsAbove > 0 && itemsBelow > 0) {
                    overflowText = `↑ ${itemsAbove} more · ↓ ${itemsBelow} more`
                } else if (itemsAbove > 0) {
                    overflowText = `↑ ${itemsAbove} more`
                } else if (itemsBelow > 0) {
                    overflowText = `↓ ${itemsBelow} more`
                }
                if (overflowText) {
                    drawText(buffer, borderGlyph, {
                        x,
                        y,
                        style: { fg: THEME.colors.brand },
                    })
                    drawText(buffer, overflowText, {
                        x: x + 2,
                        y,
                        style: { fg: THEME.colors.muted },
                    })
                    y += 1
                }
            }
        }

        // 3. Branded Footer
        drawText(buffer, borderGlyph, {
            x,
            y,
            style: { fg: THEME.colors.brand },
        })
        let footerX = x + 2

        if (state.status !== 'loading') {
            const allLines = (state.answer || '').split(/\r?\n/)
            if (allLines.length > maxVisible) {
                drawText(buffer, '↑/↓', { x: footerX, y, style: { fg: THEME.colors.brand } })
                footerX += 4
                drawText(buffer, 'scroll', { x: footerX, y, style: { fg: THEME.colors.muted } })
                footerX += 7
                drawText(buffer, '· ', { x: footerX, y, style: { fg: THEME.colors.muted } })
                footerX += 2
            }

            drawText(buffer, 'e', { x: footerX, y, style: { fg: THEME.colors.brand } })
            footerX += 2
            const expandLabel = state.isExpanded ? 'collapse' : 'expand'
            drawText(buffer, expandLabel, { x: footerX, y, style: { fg: THEME.colors.muted } })
            footerX += expandLabel.length + 1
            drawText(buffer, '· ', { x: footerX, y, style: { fg: THEME.colors.muted } })
            footerX += 2

            if (state.status === 'complete' && state.answer) {
                drawText(buffer, 'p', { x: footerX, y, style: { fg: THEME.colors.brand } })
                footerX += 2
                drawText(buffer, 'promote', { x: footerX, y, style: { fg: THEME.colors.muted } })
                footerX += 8
                drawText(buffer, '· ', { x: footerX, y, style: { fg: THEME.colors.muted } })
                footerX += 2
            }

            drawText(buffer, 'c', { x: footerX, y, style: { fg: THEME.colors.brand } })
            footerX += 2
            drawText(buffer, 'copy', { x: footerX, y, style: { fg: THEME.colors.muted } })
            footerX += 5
            drawText(buffer, '· ', { x: footerX, y, style: { fg: THEME.colors.muted } })
            footerX += 2
        }

        drawText(buffer, 'esc', { x: footerX, y, style: { fg: THEME.colors.brand } })
        footerX += 4
        const closeLabel = state.status === 'loading' ? 'cancel' : 'dismiss'
        drawText(buffer, closeLabel, { x: footerX, y, style: { fg: THEME.colors.muted } })
    },
}
