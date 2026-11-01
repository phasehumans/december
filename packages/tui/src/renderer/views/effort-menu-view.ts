import { THEME } from '../../theme'
import { drawText } from '../ui'

import { MenuFooterView } from './menu-footer-view'

import type { ScreenBuffer } from '../buffer'

export type ReasoningLevel = 'auto' | 'off' | 'low' | 'medium' | 'high'

export const REASONING_OPTIONS: { label: string; value: ReasoningLevel; desc: string }[] = [
    { label: 'Auto', value: 'auto', desc: 'Dynamically scale reasoning based on task complexity' },
    { label: 'Off', value: 'off', desc: 'Disable extended thinking tokens completely' },
    { label: 'Low', value: 'low', desc: 'Brief reflection before generating output' },
    { label: 'Medium', value: 'medium', desc: 'Balanced reasoning for standard coding tasks' },
    { label: 'High', value: 'high', desc: 'Deep multi-step reasoning for complex architecture' },
]

export interface EffortMenuViewProps {
    x?: number
    y: number
    width: number
    height?: number
    modelLabel?: string
    currentLevel?: string
    selectedIndex: number
}

export const EffortMenuView = {
    getHeight(): number {
        // Title (1) + margin (1) + 5 options (5) + margin (1) + footer (1) = 9
        return 9
    },

    render(buffer: ScreenBuffer, props: EffortMenuViewProps): void {
        const x = (props.x ?? 0) + (THEME.padding.paddingLeft ?? 2)
        let y = props.y
        const width = props.width

        // Title: Reasoning · Model
        drawText(buffer, 'Reasoning', {
            x,
            y,
            style: { fg: THEME.colors.text, bold: true },
        })
        if (props.modelLabel) {
            drawText(buffer, ` · ${props.modelLabel}`, {
                x: x + 9,
                y,
                style: { fg: THEME.colors.brand },
            })
        }
        y += 2

        const currentVal = props.currentLevel || 'auto'

        for (let i = 0; i < REASONING_OPTIONS.length; i++) {
            const opt = REASONING_OPTIONS[i]
            const isSelected = i === props.selectedIndex
            const isCurrent = opt.value === currentVal
            const rowY = y + i

            // Selector indicator
            const selector = isSelected ? `${THEME.glyphs.selector} ` : '  '
            drawText(buffer, selector, {
                x,
                y: rowY,
                style: {
                    fg: isSelected ? THEME.colors.brand : THEME.colors.muted,
                    bold: isSelected,
                },
            })

            // Option Label
            drawText(buffer, opt.label, {
                x: x + 2,
                y: rowY,
                style: {
                    fg: isSelected ? THEME.colors.brand : THEME.colors.text,
                    bold: isSelected,
                },
            })

            let labelOffset = x + 2 + opt.label.length
            if (isCurrent) {
                drawText(buffer, ' (Current)', {
                    x: labelOffset,
                    y: rowY,
                    style: { fg: THEME.colors.success, bold: true },
                })
                labelOffset += 10
            }

            // Description
            const descX = Math.max(labelOffset + 2, x + 20)
            drawText(buffer, opt.desc, {
                x: descX,
                y: rowY,
                maxWidth: Math.max(10, width - descX - 2),
                style: { fg: THEME.colors.muted },
            })
        }

        // Footer
        const footerY = props.y + (props.height ?? this.getHeight()) - 1
        MenuFooterView.render(buffer, {
            x: props.x ?? 0,
            y: footerY,
            width,
            items: [
                { key: '↑/↓', label: 'navigate' },
                { key: 'enter', label: 'select' },
                { key: 'esc', label: 'close' },
            ],
        })
    },
}
