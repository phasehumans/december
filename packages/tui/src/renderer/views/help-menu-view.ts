import { THEME } from '../../theme'
import { drawDivider, drawText } from '../ui'

import { MenuFooterView } from './menu-footer-view'

import type { ScreenBuffer } from '../buffer'

export interface HelpMenuViewProps {
    x?: number
    y: number
    width: number
    height: number
    scrollOffset?: number
}

const HELP_COMMANDS = [
    { cmd: '/model', desc: 'Select and switch active AI model' },
    { cmd: '/diff', desc: 'View git diff and workspace changes' },
    { cmd: '/tasks', desc: 'Inspect running and completed background tasks' },
    { cmd: '/clear', desc: 'Clear active conversation message history' },
    { cmd: '/help', desc: 'Show this interactive help & keyboard reference' },
    { cmd: '/exit', desc: 'Exit December CLI' },
]

const KEYBOARD_SHORTCUTS = [
    { key: 'Ctrl+C', desc: 'Cancel streaming prompt / Double-tap to exit CLI' },
    { key: 'Ctrl+T', desc: 'Toggle background tasks inspector' },
    { key: 'Esc', desc: 'Close any active overlay menu / return to prompt' },
    { key: 'Tab', desc: 'Autocomplete command or file mention' },
    { key: 'PageUp / PageDown', desc: 'Scroll message history viewport' },
    { key: '↑ / ↓ (when prompt empty)', desc: 'Scroll message history or navigate menus' },
]

export const HelpMenuView = {
    render(buffer: ScreenBuffer, props: HelpMenuViewProps): void {
        const x = (props.x ?? 0) + (THEME.padding.paddingLeft ?? 2)
        let y = props.y
        const width = props.width

        // Title
        drawText(buffer, 'Help & Commands', {
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

        // Commands section
        drawText(buffer, 'COMMANDS', {
            x,
            y,
            style: { fg: THEME.colors.brand, bold: true },
        })
        y += 1

        for (const item of HELP_COMMANDS) {
            drawText(buffer, item.cmd, {
                x: x + 2,
                y,
                maxWidth: 16,
                style: { fg: THEME.colors.brand },
            })
            drawText(buffer, item.desc, {
                x: x + 18,
                y,
                maxWidth: width - x - 20,
                style: { fg: THEME.colors.muted },
            })
            y += 1
        }
        y += 1

        // Keyboard Shortcuts section
        drawText(buffer, 'KEYBOARD SHORTCUTS', {
            x,
            y,
            style: { fg: THEME.colors.brand, bold: true },
        })
        y += 1

        for (const item of KEYBOARD_SHORTCUTS) {
            drawText(buffer, item.key, {
                x: x + 2,
                y,
                maxWidth: 22,
                style: { fg: THEME.colors.text },
            })
            drawText(buffer, item.desc, {
                x: x + 24,
                y,
                maxWidth: width - x - 26,
                style: { fg: THEME.colors.muted },
            })
            y += 1
        }

        // Footer at bottom of height
        const footerY = props.y + props.height - 1
        MenuFooterView.render(buffer, {
            x: props.x ?? 0,
            y: footerY,
            width,
            items: [{ key: 'Esc', label: 'Close Help' }],
        })
    },
}
