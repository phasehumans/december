import { THEME } from '../../theme'
import { drawDivider, drawText } from '../ui'

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
}

export const ContextMenuView = {
    render(buffer: ScreenBuffer, props: ContextMenuViewProps): void {
        const x = (props.x ?? 0) + (THEME.padding.paddingLeft ?? 2)
        let y = props.y
        const width = props.width

        const modelName = props.modelLabel || props.activeModel || 'Claude 3.5 Sonnet'
        const currentTokens = props.contextTokens ?? 0
        const maxTokens = props.maxContextTokens || 200000
        const percentage = Math.min(100, (currentTokens / maxTokens) * 100)

        // Title
        drawText(buffer, 'Context Window Usage', {
            x,
            y,
            style: { fg: THEME.colors.text, bold: true },
        })
        y += 1

        drawDivider(buffer, {
            x: props.x ?? 0,
            y,
            width,
            char: '─',
            style: { fg: THEME.colors.border },
        })
        y += 1

        // Model & Max Window
        drawText(buffer, `Active Model: ${modelName}`, {
            x,
            y,
            style: { fg: THEME.colors.brand, bold: true },
        })
        y += 1

        // Visual progress bar
        const barWidth = Math.max(10, Math.min(40, width - x - 30))
        const filledWidth = Math.round((percentage / 100) * barWidth)
        const emptyWidth = barWidth - filledWidth
        const filledBar = '█'.repeat(filledWidth)
        const emptyBar = '░'.repeat(emptyWidth)
        const currentFormatted = formatTokenCount(currentTokens)
        const maxFormatted = formatTokenCount(maxTokens)

        drawText(buffer, `[${filledBar}${emptyBar}] `, {
            x,
            y,
            style: { fg: THEME.colors.brand },
        })
        const barTextX = x + barWidth + 3
        drawText(buffer, `${currentFormatted} / ${maxFormatted} (${percentage.toFixed(1)}%)`, {
            x: barTextX,
            y,
            style: { fg: THEME.colors.text, bold: true },
        })
        y += 2

        // Breakdown section
        drawText(buffer, 'TOKEN BREAKDOWN', {
            x,
            y,
            style: { fg: THEME.colors.subtle, bold: true },
        })
        y += 1

        const basePrompt = Math.min(currentTokens, 1200)
        const toolsEst = Math.min(Math.max(0, currentTokens - basePrompt), 2400)
        const messagesEst = Math.max(0, currentTokens - basePrompt - toolsEst)
        const freeTokens = Math.max(0, maxTokens - currentTokens)

        const rows = [
            { label: 'System & Framework', tokens: basePrompt },
            { label: 'Tool Definitions & MCP', tokens: toolsEst },
            { label: 'Conversation History', tokens: messagesEst },
            { label: 'Free / Available', tokens: freeTokens },
        ]

        for (const row of rows) {
            const rowPct = ((row.tokens / maxTokens) * 100).toFixed(1)
            const rowTokensStr = formatTokenCount(row.tokens)

            drawText(buffer, row.label, {
                x: x + 2,
                y,
                maxWidth: 24,
                style: { fg: THEME.colors.muted },
            })
            drawText(buffer, `${rowTokensStr.padStart(6, ' ')} tokens`, {
                x: x + 28,
                y,
                style: { fg: THEME.colors.text },
            })
            drawText(buffer, `(${rowPct}%)`, {
                x: x + 44,
                y,
                style: { fg: THEME.colors.subtle },
            })
            y += 1
        }

        // Footer at bottom
        const footerY = props.y + props.height - 1
        MenuFooterView.render(buffer, {
            x: props.x ?? 0,
            y: footerY,
            width,
            items: [
                { key: 'c', label: 'Clear Context' },
                { key: 'm', label: 'Switch Model' },
                { key: 'Esc', label: 'Close' },
            ],
        })
    },
}
