import { THEME } from '../../theme'
import { drawText } from '../ui'

import { MenuFooterView } from './menu-footer-view'

import type { ScreenBuffer } from '../buffer'

export const MODEL_WINDOW_SIZE = 7

export interface ModelItem {
    label: string
    value: string
}

export interface ModelSelectMenuViewProps {
    x?: number
    y: number
    width: number
    height: number
    models: ModelItem[]
    activeModel?: string
    selectedIndex: number
    windowStart: number
    searchQuery: string
    isSearching: boolean
}

export const DEFAULT_MODELS: ModelItem[] = [
    { label: 'Claude 3.7 Sonnet', value: 'claude-3-7-sonnet' },
    { label: 'Claude 3.5 Sonnet', value: 'claude-3-5-sonnet' },
    { label: 'Claude 3.5 Haiku', value: 'claude-3-5-haiku' },
    { label: 'Gemini 2.5 Flash', value: 'gemini-2.5-flash' },
    { label: 'Gemini 2.5 Pro', value: 'gemini-2.5-pro' },
    { label: 'Gemini 3.7 Flash', value: 'gemini-3.7-flash' },
    { label: 'GPT-4o', value: 'gpt-4o' },
    { label: 'GPT-4o Mini', value: 'gpt-4o-mini' },
    { label: 'o3-mini', value: 'o3-mini' },
    { label: 'Humans R1', value: 'humans-r1' },
]

export const ModelSelectMenuView = {
    getHeight(modelsCount: number, windowSize = MODEL_WINDOW_SIZE): number {
        const count = modelsCount || 1
        const visible = Math.min(windowSize, count)
        const hasOverflow = count > windowSize
        // Title (1) + Search (1) + Gap (1) + Visible + Overflow (0|1) + Gap (1) + Footer (1)
        return 3 + visible + (hasOverflow ? 1 : 0) + 2
    },

    getFilteredModels(models: ModelItem[], query: string): ModelItem[] {
        if (!query.trim()) return models
        const q = query.toLowerCase().trim()
        return models.filter(
            (m) => m.label.toLowerCase().includes(q) || m.value.toLowerCase().includes(q)
        )
    },

    render(buffer: ScreenBuffer, props: ModelSelectMenuViewProps): void {
        const x = (props.x ?? 0) + (THEME.padding.paddingLeft ?? 2)
        let y = props.y
        const width = Math.max(
            20,
            props.width - (THEME.padding.paddingLeft ?? 2) - (THEME.padding.paddingRight ?? 2)
        )
        const windowSize = MODEL_WINDOW_SIZE

        // Title
        drawText(buffer, 'Models', {
            x,
            y,
            style: { fg: THEME.colors.text, bold: true },
        })
        y += 1

        // Search row matching React + Ink style
        const searchLabel = 'Search: '
        drawText(buffer, searchLabel, {
            x,
            y,
            style: { fg: props.isSearching ? THEME.colors.brand : THEME.colors.muted },
        })
        const searchHint = props.isSearching
            ? `${props.searchQuery}█`
            : props.searchQuery
              ? `${props.searchQuery} [/ to filter]`
              : '[/ to filter]'
        drawText(buffer, searchHint, {
            x: x + searchLabel.length,
            y,
            style: { fg: props.searchQuery ? THEME.colors.brand : THEME.colors.dim },
        })
        y += 2

        const models = props.models.length > 0 ? props.models : DEFAULT_MODELS
        const filtered = ModelSelectMenuView.getFilteredModels(models, props.searchQuery)

        if (filtered.length === 0) {
            drawText(buffer, '  No models found.', {
                x,
                y,
                style: { fg: THEME.colors.muted },
            })
        } else {
            const windowStart = Math.max(
                0,
                Math.min(props.windowStart, Math.max(0, filtered.length - windowSize))
            )
            const windowEnd = Math.min(windowStart + windowSize, filtered.length)
            const visible = filtered.slice(windowStart, windowEnd)

            for (let i = 0; i < visible.length; i++) {
                const item = visible[i]
                const absIdx = windowStart + i
                const isSelected = absIdx === props.selectedIndex
                const isActive =
                    props.activeModel === item.value || props.activeModel === item.label
                const rowY = y + i

                // Selector indicator
                const selector = isSelected ? `${THEME.glyphs.selector} ` : '  '
                drawText(buffer, selector, {
                    x,
                    y: rowY,
                    style: { fg: isSelected ? THEME.colors.brand : THEME.colors.muted },
                })

                // Model label
                drawText(buffer, item.label, {
                    x: x + 2,
                    y: rowY,
                    maxWidth: width - 4,
                    style: {
                        fg: isActive
                            ? THEME.colors.success
                            : isSelected
                              ? THEME.colors.brand
                              : THEME.colors.text,
                        bold: isSelected || isActive,
                    },
                })

                // Active badge
                if (isActive) {
                    const labelEnd = x + 2 + item.label.length
                    drawText(buffer, ' (active)', {
                        x: labelEnd,
                        y: rowY,
                        style: { fg: THEME.colors.success },
                    })
                }
            }

            // Pagination overflow
            if (filtered.length > windowSize) {
                const itemsAbove = windowStart
                const itemsBelow = filtered.length - windowEnd
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

        // Footer at bottom of viewport
        const footerY = (props.y ?? 0) + (props.height ?? this.getHeight(filtered.length)) - 1
        const footerItems = props.isSearching
            ? [
                  { key: 'enter / ↓', label: 'focus list' },
                  { key: 'esc', label: 'exit search' },
              ]
            : [
                  { key: '↑/↓', label: 'navigate' },
                  { key: 'enter', label: 'select' },
                  { key: '/', label: 'search' },
                  { key: 'esc', label: 'close' },
              ]

        MenuFooterView.render(buffer, {
            x: props.x ?? 0,
            y: footerY,
            width: props.width,
            items: footerItems,
        })
    },
}
