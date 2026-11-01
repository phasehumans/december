import { THEME } from '../../theme'
import { drawText } from '../ui'

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
    getHeight(settingsCount = 8): number {
        // Title (1) + Top Margin (1) + Settings items + Bottom Margin (1) + Footer (1)
        return 2 + settingsCount + 1 + 1
    },

    render(buffer: ScreenBuffer, props: SettingsMenuViewProps): void {
        const x = (props.x ?? 0) + (THEME.padding.paddingLeft ?? 2)
        let y = props.y
        const width = props.width

        drawText(buffer, 'Settings', {
            x,
            y,
            style: { fg: THEME.colors.text, bold: true },
        })
        y += 2 // Clean 1-row empty margin matching React/Ink marginBottom={1}

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
                { key: '↑/↓', label: 'navigate' },
                { key: 'enter', label: 'toggle' },
                { key: 'esc', label: 'dismiss' },
            ],
        })
    },
}
