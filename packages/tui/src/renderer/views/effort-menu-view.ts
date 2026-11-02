import { THEME } from '../../theme'
import { drawText } from '../ui'

import { MenuFooterView } from './menu-footer-view'

import type { ScreenBuffer } from '../buffer'

export type ReasoningLevel = 'auto' | 'fast' | 'deep' | 'off' | 'low' | 'medium' | 'high'

export const REASONING_OPTIONS: { label: string; value: ReasoningLevel; desc: string }[] = [
    { label: 'Auto', value: 'auto', desc: 'Dynamically scale reasoning based on task complexity' },
    {
        label: 'Fast',
        value: 'fast',
        desc: 'Minimal reflection, fastest response, lowest token cost',
    },
    {
        label: 'Deep',
        value: 'deep',
        desc: 'Maximum reasoning effort for complex architecture and debugging',
    },
]

export function normalizeReasoningLevel(level?: string): ReasoningLevel {
    if (!level) return 'auto'
    const l = level.toLowerCase().trim()
    if (l === 'deep' || l === 'high' || l === 'medium') return 'deep'
    if (l === 'fast' || l === 'off' || l === 'low' || l === 'minimal') return 'fast'
    if (l === 'auto') return 'auto'
    return 'auto'
}

export function getReasoningSupportType(model?: string): 'controllable' | 'fixed' | 'none' {
    if (!model) return 'controllable'
    const lower = model.toLowerCase().replace(/\s+/g, '-').trim()

    // Fixed reasoning models (reasoning is built into model weights)
    if (
        lower.includes('deepseek-reasoner') ||
        lower.includes('deepseek-r1') ||
        lower.includes('r1-1776') ||
        lower.includes('qwq')
    ) {
        return 'fixed'
    }

    // Explicit non-thinking models
    if (
        lower.includes('claude-3-5') ||
        lower.includes('claude-3.5') ||
        lower.includes('claude-3-opus') ||
        lower.includes('claude-3-haiku') ||
        lower.includes('claude-2') ||
        lower.startsWith('gpt-4o') ||
        lower.startsWith('gpt-4') ||
        lower.startsWith('gpt-3.5') ||
        lower.includes('gemini-1.5') ||
        lower.includes('gemini-1.0') ||
        (lower.includes('gemini-2.0-flash') && !lower.includes('thinking')) ||
        lower.includes('llama') ||
        lower.includes('mistral') ||
        lower.includes('codestral')
    ) {
        return 'none'
    }

    return 'controllable'
}

export interface EffortMenuViewProps {
    x?: number
    y: number
    width: number
    height?: number
    modelLabel?: string
    currentLevel?: string
    selectedIndex: number
    reasoningSupport?: 'controllable' | 'fixed' | 'none'
}

export const EffortMenuView = {
    getHeight(reasoningSupport?: 'controllable' | 'fixed' | 'none'): number {
        if (reasoningSupport === 'none' || reasoningSupport === 'fixed') {
            return 6
        }
        // Title (1) + margin (1) + 3 options (3) + margin (1) + footer (1) = 7
        return 7
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

        // Handle models with no reasoning or fixed reasoning
        if (props.reasoningSupport === 'none') {
            drawText(buffer, 'This model does not support extended reasoning tokens.', {
                x: x + 2,
                y,
                style: { fg: THEME.colors.muted },
            })
            drawText(buffer, 'Requests run in standard fast response mode.', {
                x: x + 2,
                y: y + 1,
                style: { fg: THEME.colors.muted },
            })

            const footerY = props.y + (props.height ?? this.getHeight(props.reasoningSupport)) - 1
            MenuFooterView.render(buffer, {
                x: props.x ?? 0,
                y: footerY,
                width,
                items: [{ key: 'esc', label: 'close' }],
            })
            return
        }

        if (props.reasoningSupport === 'fixed') {
            drawText(buffer, 'This model has fixed reasoning built-in.', {
                x: x + 2,
                y,
                style: { fg: THEME.colors.muted },
            })
            drawText(buffer, 'Reasoning tokens are generated automatically by the provider.', {
                x: x + 2,
                y: y + 1,
                style: { fg: THEME.colors.muted },
            })

            const footerY = props.y + (props.height ?? this.getHeight(props.reasoningSupport)) - 1
            MenuFooterView.render(buffer, {
                x: props.x ?? 0,
                y: footerY,
                width,
                items: [{ key: 'esc', label: 'close' }],
            })
            return
        }

        const normalizedCurrent = normalizeReasoningLevel(props.currentLevel)

        for (let i = 0; i < REASONING_OPTIONS.length; i++) {
            const opt = REASONING_OPTIONS[i]
            const isSelected = i === props.selectedIndex
            const isCurrent = opt.value === normalizedCurrent
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
        const footerY = props.y + (props.height ?? this.getHeight(props.reasoningSupport)) - 1
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
