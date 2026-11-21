import { formatProviderName } from '../../constants/providers'
import { THEME } from '../../theme'
import { drawText } from '../ui'

import { MenuFooterView } from './menu-footer-view'
import { drawPanelTitle } from './panel'

import type { ScreenBuffer } from '../buffer'

export interface SettingItem {
    id: string
    title: string
    value: string
    /** M4.3: one line under the list that explains the selected setting */
    description?: string
}

export interface SettingsMenuViewProps {
    x?: number
    y: number
    width: number
    height: number
    selectedIndex: number
    settings: SettingItem[]
}

/** M4.3: short descriptions, used when a setting has no `description` of its own */
export const SETTING_DESCRIPTIONS: Record<string, string> = {
    provider: 'The provider December sends requests to. /switch changes it.',
    model: 'The model December uses for new turns.',
    tool_permission: 'Run tools at once, or ask before each one.',
    pathguard: 'Blocks tools from system, credential and secret files.',
    non_workspace: 'Lets tools read and write files outside this folder.',
    thinking_level: 'How much the model reasons before it answers.',
    steering_mode: 'How messages you send during a turn are delivered.',
    follow_up_mode: 'How queued follow-up messages are sent after a turn.',
    browser_visible: 'Show the browser window when December opens a page.',
}

/**
 * M4.2: the value as the user reads it. The stored value does not change (the toggle logic
 * reads "on", "off", "always-proceed"), only the words on screen.
 */
export function formatSettingValue(item: Pick<SettingItem, 'id' | 'value'>): string {
    const value = item.value ?? ''
    // "none" stays lowercase, like every other value
    if (value === 'none') return value
    if (item.id === 'provider') return formatProviderName(value) || value
    if (item.id === 'browser_visible') {
        if (value === 'on') return 'shown'
        if (value === 'off') return 'hidden'
    }
    return value.replace(/-/g, ' ')
}

/** Label column width: the longest label ("Files outside workspace") plus 3 cells */
const LABEL_WIDTH = 26

export const SettingsMenuView = {
    getHeight(settingsCount = 8): number {
        // Title (1) + gap (1) + items + gap (1) + description (1) + gap (1) + footer (1)
        return 2 + settingsCount + 4
    },

    render(buffer: ScreenBuffer, props: SettingsMenuViewProps): void {
        const x = (props.x ?? 0) + (THEME.padding.paddingLeft ?? 2)
        let y = props.y
        const width = props.width
        const rowWidth = Math.max(0, width - x - 2)

        drawPanelTitle(buffer, { x, y, title: 'Settings', width: rowWidth })
        y += 2

        for (let i = 0; i < props.settings.length; i++) {
            const item = props.settings[i]
            const isSelected = i === props.selectedIndex
            const rowY = y + i
            const color = isSelected ? THEME.colors.brand : THEME.colors.text

            drawText(buffer, isSelected ? `${THEME.glyphs.selector} ` : '  ', {
                x,
                y: rowY,
                style: { fg: THEME.colors.brand },
            })
            drawText(buffer, item.title, {
                x: x + 2,
                y: rowY,
                maxWidth: LABEL_WIDTH - 1,
                ellipsis: true,
                style: { fg: color },
            })
            // M4.1: no brackets, the value in text color (brand on the selected row)
            drawText(buffer, formatSettingValue(item), {
                x: x + 2 + LABEL_WIDTH,
                y: rowY,
                maxWidth: Math.max(0, rowWidth - 2 - LABEL_WIDTH),
                ellipsis: true,
                style: { fg: color },
            })
        }

        const footerY = props.y + props.height - 1

        // M4.3: the selected setting's description, one muted line under the list
        const selected = props.settings[props.selectedIndex]
        const description = selected
            ? (selected.description ?? SETTING_DESCRIPTIONS[selected.id])
            : undefined
        const descY = y + props.settings.length + 1
        if (description && descY < footerY - 1) {
            drawText(buffer, description, {
                x,
                y: descY,
                maxWidth: rowWidth,
                ellipsis: true,
                style: { fg: THEME.colors.muted },
            })
        }

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
