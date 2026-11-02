import { THEME } from '../../theme'
import { drawText } from '../ui'

import { formatTokenCount } from './input-bar-view'
import { MenuFooterView } from './menu-footer-view'

import type { ScreenBuffer } from '../buffer'

export interface ContextMenuViewProps {
    x?: number
    y: number
    width: number
    height: number
    activeModel?: string
    modelLabel?: string
    contextTokens?: number
    maxContextTokens?: number
    messageCount?: number
    usageStats?: {
        requests?: number
        inputTokens?: number
        outputTokens?: number
        cacheReadTokens?: number
        totalTokens?: number
    }
}

export const ContextMenuView = {
    getHeight(): number {
        return 9
    },

    render(buffer: ScreenBuffer, props: ContextMenuViewProps): void {
        const paddingLeft = THEME.padding.paddingLeft ?? 2
        const x = (props.x ?? 0) + paddingLeft
        let y = props.y
        const width = props.width

        const modelName = props.modelLabel || props.activeModel || 'Claude 3.5 Sonnet'
        const currentTokens = props.contextTokens ?? 0
        const maxTokens = props.maxContextTokens || 200000
        const percentage = Math.min(100, (currentTokens / maxTokens) * 100)
        const currentFormatted = formatTokenCount(currentTokens)
        const maxFormatted = formatTokenCount(maxTokens)
        const freeTokens = Math.max(0, maxTokens - currentTokens)
        const freePercentage = Math.max(0, 100 - percentage)
        const freeFormatted = formatTokenCount(freeTokens)
        const messageCount = props.messageCount ?? 0
        const inTokens = props.usageStats?.inputTokens ?? currentTokens
        const outTokens = props.usageStats?.outputTokens ?? 0

        // Line 1: Header (Context · Model · Tokens (Pct%))
        drawText(buffer, 'Context', {
            x,
            y,
            style: { fg: THEME.colors.text, bold: true },
        })
        let headerX = x + 8
        drawText(buffer, '· ', { x: headerX, y, style: { fg: THEME.colors.muted } })
        headerX += 2
        drawText(buffer, modelName, {
            x: headerX,
            y,
            style: { fg: THEME.colors.brand },
        })
        headerX += modelName.length + 1
        drawText(buffer, '· ', { x: headerX, y, style: { fg: THEME.colors.muted } })
        headerX += 2
        drawText(buffer, `${currentFormatted}/${maxFormatted} tokens (${percentage.toFixed(1)}%)`, {
            x: headerX,
            y,
            style: { fg: THEME.colors.muted },
        })
        y += 2 // Clean 1-row empty margin matching React/Ink

        // Line 3: Enhanced Progress Bar (Fullscreen Width scaling)
        const paddingRight = THEME.padding.paddingRight ?? 4
        const barWidth = Math.max(20, width - x - paddingRight)
        const totalFilled =
            currentTokens > 0
                ? Math.max(
                      1,
                      Math.min(barWidth, Math.round((currentTokens / maxTokens) * barWidth))
                  )
                : 0

        if (totalFilled > 0) {
            drawText(buffer, '█'.repeat(totalFilled), {
                x,
                y,
                style: { fg: THEME.colors.brand },
            })
        }

        const emptyBlocks = Math.max(0, barWidth - totalFilled)
        if (emptyBlocks > 0) {
            drawText(buffer, '░'.repeat(emptyBlocks), {
                x: x + totalFilled,
                y,
                style: { fg: THEME.colors.border },
            })
        }
        y += 2 // Clean 1-row empty margin matching React/Ink

        // Lines 5-7: Symmetrical 2-column breakdown dynamically balanced across full screen width
        const col2X =
            width >= 80
                ? x + Math.max(38, Math.floor(barWidth / 2))
                : x + Math.max(26, Math.floor((width - x - paddingRight) / 2))

        // Row 1
        drawText(buffer, '■ ', { x, y, style: { fg: THEME.colors.brand } })
        drawText(buffer, `Context Used: ${currentFormatted} tokens (${percentage.toFixed(1)}%)`, {
            x: x + 2,
            y,
            style: { fg: THEME.colors.muted },
        })
        drawText(buffer, '■ ', { x: col2X, y, style: { fg: THEME.colors.success } })
        drawText(
            buffer,
            `Messages: ${messageCount} ${messageCount === 1 ? 'message' : 'messages'}`,
            {
                x: col2X + 2,
                y,
                style: { fg: THEME.colors.muted },
            }
        )
        y += 1

        // Row 2
        drawText(buffer, '■ ', { x, y, style: { fg: THEME.colors.warning } })
        drawText(buffer, `Input Tokens: ${formatTokenCount(inTokens)} tokens`, {
            x: x + 2,
            y,
            style: { fg: THEME.colors.muted },
        })
        drawText(buffer, '■ ', { x: col2X, y, style: { fg: THEME.colors.brand } })
        drawText(buffer, `Output Tokens: ${formatTokenCount(outTokens)} tokens`, {
            x: col2X + 2,
            y,
            style: { fg: THEME.colors.muted },
        })
        y += 1

        // Row 3
        drawText(buffer, '■ ', { x, y, style: { fg: THEME.colors.muted } })
        drawText(buffer, `Total Window: ${maxFormatted} tokens`, {
            x: x + 2,
            y,
            style: { fg: THEME.colors.muted },
        })
        drawText(buffer, '□ ', { x: col2X, y, style: { fg: THEME.colors.border } })
        drawText(buffer, `Free Space: ${freeFormatted} (${freePercentage.toFixed(1)}%)`, {
            x: col2X + 2,
            y,
            style: { fg: THEME.colors.muted },
        })

        // Footer at bottom
        const footerY = props.y + props.height - 1
        MenuFooterView.render(buffer, {
            x: props.x ?? 0,
            y: footerY,
            width,
            items: [
                { key: 'c', label: 'clear context' },
                { key: 'esc', label: 'dismiss' },
            ],
        })
    },
}
