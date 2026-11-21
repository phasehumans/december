import { THEME } from '../../theme'
import { drawText } from '../ui'

import { MenuFooterView } from './menu-footer-view'
import { drawEmpty, drawPanelTitle } from './panel'

import type { ScreenBuffer } from '../buffer'

export type ReasoningLevel = 'fast' | 'deep' | 'off'

export const REASONING_OPTIONS: { label: string; value: 'fast' | 'deep'; desc: string }[] = [
    {
        label: 'Fast',
        value: 'fast',
        desc: 'Quick answers, lowest cost',
    },
    {
        label: 'Deep',
        value: 'deep',
        desc: 'More reasoning for hard bugs and design work',
    },
]

export function normalizeReasoningLevel(level?: string): 'fast' | 'deep' {
    if (!level) return 'fast'
    const l = level.toLowerCase().trim()
    if (l === 'deep' || l === 'high' || l === 'medium') return 'deep'
    return 'fast'
}

export function getReasoningSupportType(model?: string): 'controllable' | 'fixed' | 'none' {
    if (!model) return 'controllable'
    let lower = model.toLowerCase().replace(/\s+/g, '-').trim()
    if (lower.includes('/')) {
        lower = lower.split('/').pop() || lower
    }

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
        lower === 'gemini-pro' ||
        lower === 'gemini-flash' ||
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

/** M7.2: the one line for a model with no reasoning setting */
export function fixedReasoningMessage(support: 'fixed' | 'none', modelLabel?: string): string {
    const model = modelLabel || 'This model'
    return support === 'fixed'
        ? `${model} uses fixed reasoning. There is nothing to set.`
        : `${model} has no reasoning setting. There is nothing to set.`
}

/** Description column, relative to the label: the longest label ("Fast", "Deep") plus 4 cells */
const EFFORT_LABEL_WIDTH = 8

export const EffortMenuView = {
    getHeight(reasoningSupport?: 'controllable' | 'fixed' | 'none'): number {
        if (reasoningSupport === 'none' || reasoningSupport === 'fixed') {
            // Title (1) + gap (1) + message (1) + gap (1) + footer (1)
            return 5
        }
        // Title (1) + margin (1) + options + margin (1) + footer (1)
        return 4 + REASONING_OPTIONS.length
    },

    render(buffer: ScreenBuffer, props: EffortMenuViewProps): void {
        const x = (props.x ?? 0) + (THEME.padding.paddingLeft ?? 2)
        let y = props.y
        const width = props.width
        const rowWidth = Math.max(0, width - x - 2)

        // G2: title "Reasoning", then the model in muted
        drawPanelTitle(buffer, {
            x,
            y,
            title: 'Reasoning',
            meta: props.modelLabel,
            width: rowWidth,
        })
        y += 2

        const footerY = props.y + (props.height ?? this.getHeight(props.reasoningSupport)) - 1

        // M7.2: models with no reasoning setting get one dim line
        if (props.reasoningSupport === 'none' || props.reasoningSupport === 'fixed') {
            drawEmpty(
                buffer,
                x,
                y,
                fixedReasoningMessage(props.reasoningSupport, props.modelLabel),
                rowWidth
            )
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

            drawText(buffer, isSelected ? `${THEME.glyphs.selector} ` : '  ', {
                x,
                y: rowY,
                style: { fg: THEME.colors.brand },
            })
            drawText(buffer, opt.label, {
                x: x + 2,
                y: rowY,
                style: { fg: isSelected ? THEME.colors.brand : THEME.colors.text },
            })

            // M7.1: short description, then "current" at the end of the row
            const descX = x + 2 + EFFORT_LABEL_WIDTH
            const tag = isCurrent ? '  current' : ''
            const descRoom = Math.max(0, x + rowWidth - descX - tag.length)
            const desc =
                opt.desc.length > descRoom
                    ? `${opt.desc.slice(0, Math.max(0, descRoom - 1))}…`
                    : opt.desc
            drawText(buffer, desc, {
                x: descX,
                y: rowY,
                style: { fg: isSelected ? THEME.colors.text : THEME.colors.muted },
            })
            if (tag) {
                drawText(buffer, tag, {
                    x: descX + desc.length,
                    y: rowY,
                    style: { fg: THEME.colors.muted },
                })
            }
        }

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
