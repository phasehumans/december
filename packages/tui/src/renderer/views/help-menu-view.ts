import { THEME } from '../../theme'
import { drawText } from '../ui'

import { MenuFooterView } from './menu-footer-view'

import type { ScreenBuffer } from '../buffer'

export type HelpTab = 'general' | 'commands' | 'shortcuts'

export const TABS: HelpTab[] = ['general', 'commands', 'shortcuts']

export const SHORTCUTS = [
    { key: '/', desc: 'Open slash commands' },
    { key: '! <cmd>', desc: 'Execute shell command directly (e.g. !git status)' },
    { key: '↑ / ↓', desc: 'Scroll chat up / down (when prompt empty)' },
    { key: 'pageup / pagedown', desc: 'Scroll chat by page' },
    { key: 'ctrl / shift + ↑ / ↓', desc: 'Scroll chat smoothly / line by line' },
    { key: 'home / end', desc: 'Jump to top / bottom' },
    { key: 'ctrl+p', desc: 'Previous prompt history' },
    { key: 'ctrl+n', desc: 'Next prompt history' },
    { key: 'ctrl+a', desc: 'Go to start of line' },
    { key: 'ctrl+e', desc: 'Go to end of line' },
    { key: 'ctrl+k', desc: 'Delete to end of line' },
    { key: 'ctrl+u', desc: 'Delete to start of line' },
    { key: 'ctrl+w', desc: 'Delete word' },
    { key: 'ctrl+y', desc: 'Quick copy (yank)' },
    { key: 'ctrl+c', desc: 'Exit / Graceful interrupt' },
    { key: 'ctrl+t', desc: 'Tasks mode' },
    { key: 'alt+enter', desc: 'Insert newline' },
    { key: 'esc', desc: 'Cancel / Return to bottom' },
]

export const HELP_WINDOW_SIZE = 8

export interface HelpMenuViewProps {
    x?: number
    y: number
    width: number
    height: number
    activeTab?: HelpTab
    cliVersion?: string
    userEmail?: string
    activeModel?: string
    modelLabel?: string
    authMethod?: string
    selectedProvider?: string
    cwd?: string
    branch?: string
    sessionId?: string
    configPath?: string
    // Commands tab
    commands?: { name: string; description: string }[]
    cmdSelectedIndex?: number
    cmdWindowStart?: number
    // Shortcuts tab
    shortcuts?: { key: string; desc: string }[]
    shortcutSelectedIndex?: number
    shortcutWindowStart?: number
}

export const HelpMenuView = {
    getHeight(): number {
        // Tab bar (2) + tab content (9) + gap (1) + footer (1) = 13
        return 13
    },

    render(buffer: ScreenBuffer, props: HelpMenuViewProps): void {
        const x = (props.x ?? 0) + (THEME.padding.paddingLeft ?? 2)
        let y = props.y
        const width = props.width
        const activeTab = props.activeTab || 'general'

        // 1. Top Tab Bar: general   commands   shortcuts
        let tabX = x
        for (const t of TABS) {
            const isCurrent = t === activeTab
            drawText(buffer, t, {
                x: tabX,
                y,
                style: {
                    fg: isCurrent ? THEME.colors.brand : THEME.colors.muted,
                    bold: isCurrent,
                },
            })
            tabX += t.length + 4
        }
        y += 2

        // 2. Tab Content
        if (activeTab === 'general') {
            // Summary paragraph
            drawText(
                buffer,
                'December is a (so much) better coding agent. It helps you build faster by writing',
                { x, y, style: { fg: THEME.colors.text } }
            )
            y += 1
            drawText(
                buffer,
                'code, fixing bugs, and running commands directly in your terminal or favorite IDE.',
                { x, y, style: { fg: THEME.colors.text } }
            )
            y += 2

            // System info table
            const email = props.userEmail
                ? `${props.userEmail} (${props.authMethod || 'december'})`
                : 'Guest'
            const model = props.modelLabel || props.activeModel || 'Claude 3.7 Sonnet'
            const ws = `${props.cwd || process.cwd()}${props.branch ? ` (${props.branch})` : ''}`
            const config = props.configPath || '~/.december/config.json'
            const session = props.sessionId || 'Active'

            const infoRows = [
                { label: 'Version', value: `v${(props.cliVersion || '0.4.15').replace(/^v/, '')}` },
                { label: 'Account', value: email },
                { label: 'Active Model', value: model },
                { label: 'Workspace', value: ws },
                { label: 'Project Config', value: config },
                { label: 'Session', value: session },
            ]

            for (const row of infoRows) {
                drawText(buffer, `${row.label}:`, {
                    x,
                    y,
                    style: { fg: THEME.colors.muted },
                })
                drawText(buffer, row.value, {
                    x: x + 16,
                    y,
                    maxWidth: width - x - 18,
                    style: { fg: THEME.colors.text },
                })
                y += 1
            }
        } else if (activeTab === 'commands') {
            const cmds = props.commands || []
            const windowStart = Math.max(
                0,
                Math.min(props.cmdWindowStart || 0, Math.max(0, cmds.length - HELP_WINDOW_SIZE))
            )
            const windowEnd = Math.min(windowStart + HELP_WINDOW_SIZE, cmds.length)
            const visibleCmds = cmds.slice(windowStart, windowEnd)
            const safeSelected = props.cmdSelectedIndex || 0

            for (let i = 0; i < visibleCmds.length; i++) {
                const cmd = visibleCmds[i]
                const absIdx = windowStart + i
                const isSelected = absIdx === safeSelected
                const rowY = y + i

                const selector = isSelected ? `${THEME.glyphs.selector} ` : '  '
                drawText(buffer, selector, {
                    x,
                    y: rowY,
                    style: {
                        fg: isSelected ? THEME.colors.brand : THEME.colors.muted,
                        bold: isSelected,
                    },
                })

                drawText(buffer, `/${cmd.name}`, {
                    x: x + 2,
                    y: rowY,
                    maxWidth: 24,
                    style: {
                        fg: isSelected ? THEME.colors.brand : THEME.colors.text,
                        bold: isSelected,
                    },
                })

                drawText(buffer, cmd.description, {
                    x: x + 28,
                    y: rowY,
                    maxWidth: Math.max(10, width - x - 30),
                    style: { fg: THEME.colors.muted },
                })
            }
            y += visibleCmds.length

            if (cmds.length > HELP_WINDOW_SIZE) {
                const itemsAbove = windowStart
                const itemsBelow = cmds.length - windowEnd
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
                        y,
                        style: { fg: THEME.colors.subtle },
                    })
                }
            }
        } else if (activeTab === 'shortcuts') {
            const scs = props.shortcuts || SHORTCUTS
            const windowStart = Math.max(
                0,
                Math.min(props.shortcutWindowStart || 0, Math.max(0, scs.length - HELP_WINDOW_SIZE))
            )
            const windowEnd = Math.min(windowStart + HELP_WINDOW_SIZE, scs.length)
            const visibleScs = scs.slice(windowStart, windowEnd)
            const safeSelected = props.shortcutSelectedIndex || 0

            for (let i = 0; i < visibleScs.length; i++) {
                const sc = visibleScs[i]
                const absIdx = windowStart + i
                const isSelected = absIdx === safeSelected
                const rowY = y + i

                const selector = isSelected ? `${THEME.glyphs.selector} ` : '  '
                drawText(buffer, selector, {
                    x,
                    y: rowY,
                    style: {
                        fg: isSelected ? THEME.colors.brand : THEME.colors.muted,
                        bold: isSelected,
                    },
                })

                drawText(buffer, sc.key, {
                    x: x + 2,
                    y: rowY,
                    maxWidth: 28,
                    style: {
                        fg: isSelected ? THEME.colors.brand : THEME.colors.text,
                        bold: isSelected,
                    },
                })

                drawText(buffer, sc.desc, {
                    x: x + 32,
                    y: rowY,
                    maxWidth: Math.max(10, width - x - 34),
                    style: { fg: THEME.colors.muted },
                })
            }
            y += visibleScs.length

            if (scs.length > HELP_WINDOW_SIZE) {
                const itemsAbove = windowStart
                const itemsBelow = scs.length - windowEnd
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
                        y,
                        style: { fg: THEME.colors.subtle },
                    })
                }
            }
        }

        // 3. Footer
        const footerY = props.y + (props.height ?? this.getHeight()) - 1
        const footerItems = [
            ...(activeTab === 'general' ? [] : [{ key: '↑/↓', label: 'navigate' }]),
            { key: '←/→', label: 'cycle tab' },
            { key: 'esc', label: 'dismiss' },
        ]
        MenuFooterView.render(buffer, {
            x: props.x ?? 0,
            y: footerY,
            width,
            items: footerItems,
        })
    },
}
