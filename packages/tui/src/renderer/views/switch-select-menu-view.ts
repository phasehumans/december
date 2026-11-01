import { THEME } from '../../theme'
import { drawText } from '../ui'

import { MenuFooterView } from './menu-footer-view'

import type { ScreenBuffer } from '../buffer'

export interface SwitchItem {
    label: string
    value: string
    model?: string
    isActive?: boolean
    account?: string
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

        // Title
        drawText(buffer, 'Switch Provider', {
            x,
            y,
            style: { fg: THEME.colors.text, bold: true },
        })
        y += 2

        if (items.length === 0) {
            drawText(buffer, 'No configured providers found.', {
                x: x + 2,
                y,
                style: { fg: THEME.colors.muted },
            })
            y += 1
        } else {
            for (let i = 0; i < items.length; i++) {
                const item = items[i]
                const isSelected = i === safeIndex
                const isConfirmingDelete = item.value === props.confirmDeleteValue
                const rowY = y + i

                // Selector
                const selector = isSelected ? `${THEME.glyphs.selector} ` : '  '
                drawText(buffer, selector, {
                    x,
                    y: rowY,
                    style: {
                        fg: isSelected ? THEME.colors.brand : THEME.colors.muted,
                        bold: isSelected,
                    },
                })

                // Label
                drawText(buffer, item.label, {
                    x: x + 2,
                    y: rowY,
                    style: {
                        fg: isSelected ? THEME.colors.brand : THEME.colors.text,
                        bold: isSelected,
                    },
                })

                let labelEnd = x + 2 + item.label.length

                // Active badge
                if (item.isActive) {
                    drawText(buffer, ' (Active)', {
                        x: labelEnd,
                        y: rowY,
                        style: { fg: THEME.colors.success },
                    })
                    labelEnd += ' (Active)'.length
                }

                // Delete confirmation prompt
                if (isConfirmingDelete) {
                    drawText(buffer, ' [Delete? (y/n)]', {
                        x: labelEnd,
                        y: rowY,
                        style: { fg: THEME.colors.error, bold: true },
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
