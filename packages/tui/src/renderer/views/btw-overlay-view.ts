import { THEME } from '../../theme'
import { drawText } from '../ui'

import { MenuFooterView, type MenuFooterItem } from './menu-footer-view'

import type { BtwState } from '../../types'
import type { ScreenBuffer } from '../buffer'

export const BTW_COLLAPSED_MAX_VISIBLE_LINES = 3
export const BTW_EXPANDED_MAX_VISIBLE_LINES = 16
export const BTW_MAX_VISIBLE_LINES = BTW_COLLAPSED_MAX_VISIBLE_LINES

export function wrapBtwLines(rawText: string, maxWidth: number): string[] {
    if (!rawText) return ['']
    const paragraphs = rawText.split(/\r?\n/)
    const wrapped: string[] = []

    for (const paragraph of paragraphs) {
        if (!paragraph || paragraph.length <= maxWidth) {
            wrapped.push(paragraph)
            continue
        }

        const bulletMatch = paragraph.match(/^(\s*[-*•]\s+|\s*\d+\.\s+)/)
        const indent = bulletMatch ? ' '.repeat(bulletMatch[0].length) : ''

        const words = paragraph.split(/\s+/)
        let current = ''

        for (const word of words) {
            if (!word) continue
            if (!current) {
                current = word
            } else if (current.length + 1 + word.length <= maxWidth) {
                current += ' ' + word
            } else {
                wrapped.push(current)
                current = indent ? indent + word : word
            }
        }
        if (current) {
            wrapped.push(current)
        }
    }

    return wrapped.length > 0 ? wrapped : ['']
}

export interface BtwOverlayViewProps {
    x?: number
    y: number
    width: number
    state: BtwState
    scrollOffset: number
    maxVisibleLines?: number
    /** Clock for the breathing loader (M25.2); the loader is a static ✱ when it is not set */
    now?: number
}

/** The breathing ✱ of the activity line, one frame every 130 ms */
const BTW_STAR_FRAMES = ['·', '∙', '∗', '✱', '✲', '✱', '∗', '∙']

export function btwLoaderGlyph(now?: number): string {
    if (now === undefined) return '✱'
    return BTW_STAR_FRAMES[Math.floor(now / 130) % BTW_STAR_FRAMES.length] ?? '✱'
}

export const BtwOverlayView = {
    getHeight(state: BtwState, maxVisible?: number, contentWidth?: number): number {
        if (!state) return 0
        const limit =
            maxVisible ??
            (state.isExpanded ? BTW_EXPANDED_MAX_VISIBLE_LINES : BTW_COLLAPSED_MAX_VISIBLE_LINES)
        let bodyLines = 1
        let hasOverflow = false

        if (state.status === 'streaming' || state.status === 'complete') {
            const lines = contentWidth
                ? wrapBtwLines(state.answer || '', contentWidth)
                : (state.answer || '').split(/\r?\n/)
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
            (state.isExpanded ? BTW_EXPANDED_MAX_VISIBLE_LINES : BTW_COLLAPSED_MAX_VISIBLE_LINES)

        const borderGlyph = '▎ '

        // 1. Header row (M25.1): "btw" in muted, the question in regular text color
        drawText(buffer, borderGlyph, {
            x,
            y,
            style: { fg: THEME.colors.brand },
        })
        drawText(buffer, 'btw', {
            x: x + 2,
            y,
            style: { fg: THEME.colors.muted },
        })
        drawText(buffer, state.question, {
            x: x + 7,
            y,
            maxWidth: Math.max(10, width - x - 9),
            style: { fg: THEME.colors.text },
        })
        y += 1

        // 2. Body row(s)
        if (state.status === 'loading') {
            // M25.2: the breathing ✱ in brand blue, with the chat sentence
            drawText(buffer, `${borderGlyph}${btwLoaderGlyph(props.now)} `, {
                x,
                y,
                style: { fg: THEME.colors.brand },
            })
            drawText(buffer, 'Thinking it through…', {
                x: x + 4,
                y,
                style: { fg: THEME.colors.text },
            })
            y += 1
        } else if (state.status === 'error') {
            const rawError = state.error || 'Failed to answer side question'
            const cleanErr = rawError.replace(/^Error:\s*/i, '').trim()
            const is401 = cleanErr.includes('401')
            const errLines = is401
                ? [
                      cleanErr,
                      'Authentication Failed: Invalid or missing API key.',
                      'Configure your key via /login or set API keys in your environment.',
                  ]
                : cleanErr.split(/\r?\n/).map((l) => l.replace(/^Error:\s*/i, '').trim())

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
            const contentWidth = Math.max(10, width - x - 4)
            const allLines = wrapBtwLines(state.answer || '', contentWidth)
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
                    maxWidth: contentWidth,
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
                        style: { fg: THEME.colors.dim },
                    })
                    y += 1
                }
            }
        }

        // 3. Footer (M25.3): drawn by MenuFooterView after the border glyph
        drawText(buffer, borderGlyph, {
            x,
            y,
            style: { fg: THEME.colors.brand },
        })
        let footerItems: MenuFooterItem[]
        if (state.status === 'loading') {
            footerItems = [{ key: 'esc', label: 'cancel' }]
        } else if (state.isFocused) {
            // B12: decide on the scroll hint from the wrapped lines, as drawn above
            const wrappedCount = wrapBtwLines(
                state.answer || '',
                Math.max(10, width - x - 4)
            ).length
            footerItems = [
                ...(wrappedCount > maxVisible ? [{ key: '↑/↓', label: 'scroll' }] : []),
                { key: 'esc', label: 'back' },
            ]
        } else {
            footerItems = [
                { key: 'tab', label: 'scroll' },
                { key: 'esc', label: 'dismiss' },
            ]
        }
        MenuFooterView.render(buffer, {
            x: (props.x ?? 0) + borderGlyph.length,
            y,
            width,
            items: footerItems,
        })
    },
}
