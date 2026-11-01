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

        // Breakdown estimates
        const basePrompt = Math.min(currentTokens, 1200)
        const rulesTokens = Math.min(Math.max(0, currentTokens - basePrompt), 500)
        const skillsTokens = 0
        const toolsEst = Math.min(Math.max(0, currentTokens - basePrompt - rulesTokens), 2400)
        const messagesEst = Math.max(0, currentTokens - basePrompt - rulesTokens - toolsEst)
        const freeTokens = Math.max(0, maxTokens - currentTokens)

        const categories = [
            { name: 'base', tokens: basePrompt, color: THEME.colors.muted },
            { name: 'rules', tokens: rulesTokens, color: THEME.colors.warning },
            { name: 'skills', tokens: skillsTokens, color: THEME.colors.error },
            { name: 'tools', tokens: toolsEst, color: THEME.colors.brand },
            { name: 'history', tokens: messagesEst, color: THEME.colors.success },
        ]

        // Line 3: Enhanced Progress Bar (Wider & Multi-Color Segmented)
        // Dynamically scales with terminal width up to 88 columns (nearly 2x the previous 48)
        const barWidth = Math.max(30, Math.min(88, width - x - 4))
        const totalFilled =
            currentTokens > 0
                ? Math.max(
                      1,
                      Math.min(barWidth, Math.round((currentTokens / maxTokens) * barWidth))
                  )
                : 0

        let allocated = 0
        const catBlocks = categories.map((cat, idx) => {
            if (cat.tokens <= 0 || currentTokens <= 0) return 0
            if (idx === categories.length - 1) {
                return Math.max(0, totalFilled - allocated)
            }
            const count = Math.min(
                totalFilled - allocated,
                Math.round((cat.tokens / currentTokens) * totalFilled)
            )
            allocated += count
            return count
        })

        if (allocated < totalFilled) {
            let maxIdx = 0
            let maxVal = -1
            categories.forEach((cat, idx) => {
                if (cat.tokens > maxVal) {
                    maxVal = cat.tokens
                    maxIdx = idx
                }
            })
            catBlocks[maxIdx] += totalFilled - allocated
        }

        let barCursorX = x
        for (let i = 0; i < categories.length; i++) {
            const count = catBlocks[i]
            if (count > 0) {
                drawText(buffer, '█'.repeat(count), {
                    x: barCursorX,
                    y,
                    style: { fg: categories[i].color },
                })
                barCursorX += count
            }
        }

        const emptyBlocks = Math.max(0, barWidth - (barCursorX - x))
        if (emptyBlocks > 0) {
            drawText(buffer, '░'.repeat(emptyBlocks), {
                x: barCursorX,
                y,
                style: { fg: THEME.colors.border },
            })
        }
        y += 2 // Clean 1-row empty margin matching React/Ink

        // Lines 5-7: 2-column breakdown with balanced column gap
        const col1Width = 42
        const col2X =
            width >= 90
                ? x + Math.max(col1Width, Math.floor(barWidth * 0.52))
                : x + Math.min(38, Math.floor((width - x - 2) * 0.5))

        // Row 1
        drawText(buffer, '■ ', { x, y, style: { fg: THEME.colors.muted } })
        drawText(
            buffer,
            `Base System Prompt: ${formatTokenCount(basePrompt)} tokens (${((basePrompt / maxTokens) * 100).toFixed(1)}%)`,
            {
                x: x + 2,
                y,
                style: { fg: THEME.colors.muted },
            }
        )
        drawText(buffer, '■ ', { x: col2X, y, style: { fg: THEME.colors.brand } })
        drawText(
            buffer,
            `Tool Schemas: ${formatTokenCount(toolsEst)} tokens (${((toolsEst / maxTokens) * 100).toFixed(1)}%)`,
            {
                x: col2X + 2,
                y,
                style: { fg: THEME.colors.muted },
            }
        )
        y += 1

        // Row 2
        drawText(buffer, '■ ', { x, y, style: { fg: THEME.colors.warning } })
        drawText(
            buffer,
            `Project Rules: ${formatTokenCount(rulesTokens)} tokens (${((rulesTokens / maxTokens) * 100).toFixed(1)}%)`,
            {
                x: x + 2,
                y,
                style: { fg: THEME.colors.muted },
            }
        )
        drawText(buffer, '■ ', { x: col2X, y, style: { fg: THEME.colors.success } })
        drawText(
            buffer,
            `Conversation History: ${formatTokenCount(messagesEst)} tokens (${((messagesEst / maxTokens) * 100).toFixed(1)}%)`,
            {
                x: col2X + 2,
                y,
                style: { fg: THEME.colors.muted },
            }
        )
        y += 1

        // Row 3
        drawText(buffer, '■ ', { x, y, style: { fg: THEME.colors.error } })
        drawText(buffer, `Workspace Skills: ${formatTokenCount(skillsTokens)} tokens (0.0%)`, {
            x: x + 2,
            y,
            style: { fg: THEME.colors.muted },
        })
        drawText(buffer, '□ ', { x: col2X, y, style: { fg: THEME.colors.border } })
        drawText(
            buffer,
            `Free space: ${formatTokenCount(freeTokens)} (${((freeTokens / maxTokens) * 100).toFixed(1)}%)`,
            {
                x: col2X + 2,
                y,
                style: { fg: THEME.colors.muted },
            }
        )

        // Footer at bottom
        const footerY = props.y + props.height - 1
        MenuFooterView.render(buffer, {
            x: props.x ?? 0,
            y: footerY,
            width,
            items: [
                { key: 'c', label: 'clear history' },
                { key: 'm', label: 'switch model' },
                { key: 'n', label: 'new session' },
                { key: 'esc', label: 'dismiss' },
            ],
        })
    },
}
