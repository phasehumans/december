import { THEME } from '../../theme'
import { drawText } from '../ui'

import { MenuFooterView } from './menu-footer-view'
import { drawInlineConfirm, drawListRow, drawPanelTitle } from './panel'

import type { ScreenBuffer } from '../buffer'

export interface SwitchItem {
    label: string
    value: string
    model?: string
    isActive?: boolean
    account?: string
    tag?: string
}

export interface SwitchSelectMenuViewProps {
    x?: number
    y: number
    width: number
    height?: number
    items: SwitchItem[]
    selectedIndex: number
    confirmDeleteValue?: string | null
}

export const SwitchSelectMenuView = {
    getHeight(itemCount: number): number {
        // Title (1) + gap (1) + Math.max(1, itemCount) + gap (1) + footer (1)
        return Math.max(itemCount, 1) + 4
    },

    render(buffer: ScreenBuffer, props: SwitchSelectMenuViewProps): void {
        const x = (props.x ?? 0) + (THEME.padding.paddingLeft ?? 2)
        let y = props.y
        const width = props.width
        const items = props.items
        const safeIndex = Math.min(props.selectedIndex, Math.max(0, items.length - 1))

        // G2: title "Provider", then how many are set up in muted
        drawPanelTitle(buffer, {
            x,
            y,
            title: 'Provider',
            meta: items.length > 0 ? `${items.length} set up` : undefined,
            width: Math.max(0, width - x - 2),
        })
        y += 2

        if (items.length === 0) {
            drawText(buffer, 'No configured providers found.', {
                x: x + 2,
                y,
                style: { fg: THEME.colors.muted },
            })
        } else {
            for (let i = 0; i < items.length; i++) {
                const item = items[i]
                const isSelected = i === safeIndex
                const rowY = y + i

                const rowTag = item.tag
                    ? item.isActive
                        ? `${item.tag} · current`
                        : item.tag
                    : item.isActive
                      ? 'current'
                      : undefined

                // G3, G5: "current" as a muted word, no green, no bold
                drawListRow(buffer, {
                    x,
                    y: rowY,
                    width: Math.max(0, width - x - 2),
                    selected: isSelected,
                    label: item.label,
                    tag: rowTag,
                })

                // M6.1: the delete confirm stays inline on the row, red, no bold
                if (item.value === props.confirmDeleteValue) {
                    const tagWidth = rowTag ? `  ${rowTag}`.length : 0
                    drawInlineConfirm(buffer, {
                        x: x + 2 + item.label.length + tagWidth,
                        y: rowY,
                        text: ' [Delete? (y/n)]',
                        tone: 'danger',
                    })
                }
            }
        }

        // Footer
        const naturalHeight = this.getHeight(items.length)
        const footerY = props.y + (props.height ?? naturalHeight) - 1
        const footerItems = props.confirmDeleteValue
            ? [
                  { key: 'y', label: 'confirm' },
                  { key: 'n / esc', label: 'cancel' },
              ]
            : [
                  { key: '↑/↓', label: 'navigate' },
                  { key: 'enter', label: 'switch' },
                  { key: 'd', label: 'delete' },
                  { key: 'esc', label: 'close' },
              ]

        MenuFooterView.render(buffer, {
            x: props.x ?? 0,
            y: footerY,
            width,
            items: footerItems,
        })
    },
}
