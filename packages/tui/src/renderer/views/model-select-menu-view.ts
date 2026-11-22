import { THEME } from '../../theme'
import { drawText } from '../ui'

import { MenuFooterView } from './menu-footer-view'
import {
    drawEmpty,
    drawInlineConfirm,
    drawListRow,
    drawPanelTitle,
    drawWindowOverflow,
    requestPanelCursor,
} from './panel'

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
    providerName?: string
    selectedIndex: number
    windowStart: number
    searchQuery: string
    isSearching: boolean
    /** the picked model is not available on this key: offer `fallbackLabel` inline */
    confirmSwitch?: { failedValue: string; fallbackLabel: string } | null
}

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

        const models = props.models
        const filtered = ModelSelectMenuView.getFilteredModels(models, props.searchQuery)
        const provider = props.providerName ? props.providerName.toLowerCase() : undefined
        const isFiltered = props.searchQuery.trim().length > 0

        // G2: title "Model", then provider and count in muted
        // No count when there are no models: the empty state says so below
        const count = isFiltered
            ? `${filtered.length} of ${models.length}`
            : models.length === 0
              ? ''
              : `${models.length} ${models.length === 1 ? 'model' : 'models'}`
        drawPanelTitle(buffer, {
            x,
            y,
            title: 'Model',
            meta: [provider, count].filter(Boolean).join(' · ') || undefined,
            width,
        })
        y += 1

        // G11: today's search row, label muted and hint dim, query brand while typing
        const searchLabel = 'Search: '
        drawText(buffer, searchLabel, {
            x,
            y,
            style: { fg: props.isSearching ? THEME.colors.brand : THEME.colors.muted },
        })
        const qx = x + searchLabel.length
        if (props.isSearching) {
            drawText(buffer, props.searchQuery, { x: qx, y, style: { fg: THEME.colors.brand } })
            // G11: the real terminal cursor, placed by the app
            requestPanelCursor(qx + props.searchQuery.length, y)
        } else if (props.searchQuery) {
            drawText(buffer, props.searchQuery, { x: qx, y, style: { fg: THEME.colors.brand } })
            drawText(buffer, ' [/ to filter]', {
                x: qx + props.searchQuery.length,
                y,
                style: { fg: THEME.colors.dim },
            })
        } else {
            drawText(buffer, '[/ to filter]', { x: qx, y, style: { fg: THEME.colors.dim } })
        }
        y += 2

        if (models.length === 0) {
            // M5.3: no fixed list of old models
            drawEmpty(
                buffer,
                x + 2,
                y,
                `No models from ${provider ?? 'this provider'}. Check /login.`,
                width - 2
            )
        } else if (filtered.length === 0) {
            drawText(buffer, 'No models found.', { x: x + 2, y, style: { fg: THEME.colors.muted } })
        } else {
            const windowStart = Math.max(
                0,
                Math.min(props.windowStart, Math.max(0, filtered.length - windowSize))
            )
            const windowEnd = Math.min(windowStart + windowSize, filtered.length)
            const visible = filtered.slice(windowStart, windowEnd)

            for (let i = 0; i < visible.length; i++) {
                const item = visible[i]
                const isActive =
                    props.activeModel === item.value || props.activeModel === item.label
                // G3, G5: the current model gets the word "current", no green, no bold
                drawListRow(buffer, {
                    x,
                    y: y + i,
                    width,
                    selected: windowStart + i === props.selectedIndex,
                    label: item.label,
                    tag: isActive ? 'current' : undefined,
                })
                if (props.confirmSwitch && props.confirmSwitch.failedValue === item.value) {
                    const labelEnd = x + 2 + Math.min(item.label.length, Math.max(4, width - 2))
                    drawInlineConfirm(buffer, {
                        x: labelEnd,
                        y: y + i,
                        text: ` [Not available on this key · switch to ${props.confirmSwitch.fallbackLabel}? (y/n)]`,
                        tone: 'warning',
                    })
                }
            }

            if (filtered.length > windowSize) {
                drawWindowOverflow(
                    buffer,
                    x,
                    y + visible.length,
                    windowStart,
                    filtered.length - windowEnd
                )
            }
        }

        // Footer at bottom of viewport
        const footerY = (props.y ?? 0) + (props.height ?? this.getHeight(filtered.length)) - 1
        const footerItems = props.confirmSwitch
            ? [
                  { key: 'y', label: 'switch' },
                  { key: 'n / esc', label: 'cancel' },
              ]
            : props.isSearching
              ? [
                    { key: 'enter / ↓', label: 'focus list' },
                    { key: 'esc', label: 'exit search' },
                ]
              : [
                    { key: '↑/↓', label: 'navigate' },
                    { key: 'enter', label: 'select' },
                    { key: '/', label: 'search' },
                    { key: '/switch', label: 'provider' },
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
