import { THEME } from '../../theme'
import { drawDivider, drawText } from '../ui'

import { MenuFooterView } from './menu-footer-view'

import type { ScreenBuffer } from '../buffer'

export interface SettingItem {
    id: string
    title: string
    value: string
}

export interface SettingsMenuViewProps {
    x?: number
    y: number
    width: number
    height: number
    selectedIndex: number
    settings: SettingItem[]
}

export const SettingsMenuView = {
    render(buffer: ScreenBuffer, props: SettingsMenuViewProps): void {
        const x = (props.x ?? 0) + (THEME.padding.paddingLeft ?? 2)
        let y = props.y
        const width = props.width

        drawText(buffer, 'December Settings', {
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

        for (let i = 0; i < props.settings.length; i++) {
            const item = props.settings[i]
            const isSelected = i === props.selectedIndex
            const rowY = y + i

            // Selector
            const selector = isSelected ? `${THEME.glyphs.selector} ` : '  '
            drawText(buffer, selector, {
                x,
                y: rowY,
                style: { fg: isSelected ? THEME.colors.brand : THEME.colors.muted },
            })

            // Setting Title
            drawText(buffer, item.title, {
                x: x + 2,
                y: rowY,
                maxWidth: 26,
                style: {
                    fg: isSelected ? THEME.colors.brand : THEME.colors.text,
                    bold: isSelected,
                },
            })

            // Setting Value Badge [value]
            drawText(buffer, `[${item.value}]`, {
                x: x + 30,
                y: rowY,
                maxWidth: width - x - 32,
                style: {
                    fg: isSelected ? THEME.colors.brand : THEME.colors.muted,
                },
            })
        }

        // Footer at bottom
        const footerY = props.y + props.height - 1
        MenuFooterView.render(buffer, {
            x: props.x ?? 0,
            y: footerY,
            width,
            items: [
                { key: '↑↓', label: 'Navigate' },
                { key: 'Enter', label: 'Toggle/Select' },
                { key: 'Esc', label: 'Close' },
            ],
        })
    },
}
