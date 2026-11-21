import { homedir } from 'node:os'

import { KEYBINDING_ACTIONS } from '../../keybindings'
import { THEME } from '../../theme'
import { formatBillingLabel } from '../../utils/header-format'
import { drawText } from '../ui'

import { CMD_COL_WIDTH } from './command-menu-view'
import { MenuFooterView } from './menu-footer-view'
import { drawCommandRow, drawLabelValue, drawTabs, drawWindowOverflow } from './panel'

import type { KeybindingActionName, Keymap } from '../../keybindings'
import type { ScreenBuffer } from '../buffer'

export type HelpTab = 'general' | 'commands' | 'shortcuts'

export const TABS: HelpTab[] = ['general', 'commands', 'shortcuts']

export interface ShortcutItem {
    key: string
    desc: string
    /** keybinding actions this row shows; their user keys replace `key` when changed */
    actions?: KeybindingActionName[]
    /** text after the bound keys, for keys that cannot be rebound */
    suffix?: string
}

export const SHORTCUTS: ShortcutItem[] = [
    { key: '/', desc: 'Open slash commands' },
    { key: '@ <file>', desc: 'Mention file into context' },
    { key: '! <cmd>', desc: 'Execute shell command directly (e.g. !git status)' },
    { key: 'tab', desc: 'Autocomplete command or file path' },
    { key: 'shift+tab', desc: 'Toggle plan mode', actions: ['togglePlanMode'] },
    { key: 'alt / shift + enter', desc: 'Insert newline in prompt', actions: ['newline'] },
    { key: 'esc', desc: 'Cancel / Clear input / Dismiss menu' },
    {
        key: 'ctrl+a / ctrl+e',
        desc: 'Go to start / end of line',
        actions: ['lineStart', 'lineEnd'],
    },
    { key: 'alt+b / alt+f', desc: 'Jump backward / forward by word' },
    {
        key: 'ctrl+w / alt+bksp',
        desc: 'Delete word backward',
        actions: ['deleteWordBack'],
        suffix: ' / alt+bksp',
    },
    {
        key: 'ctrl+u / ctrl+k',
        desc: 'Delete to start / end of line',
        actions: ['killToStart', 'killToEnd'],
    },
    { key: 'ctrl+y', desc: 'Quick copy last assistant response', actions: ['copyLastResponse'] },
    {
        key: 'ctrl+p / ctrl+n',
        desc: 'Previous / next prompt history',
        actions: ['historyPrev', 'historyNext'],
    },
    { key: '↑ / ↓', desc: 'Scroll chat up / down (when prompt empty)' },
    { key: 'k / j', desc: 'Navigate up / down in menus and overlays' },
    { key: 'ctrl / shift + ↑ / ↓', desc: 'Scroll chat smoothly / line by line' },
    { key: 'pageup / pagedown', desc: 'Scroll chat by page' },
    { key: 'home / end', desc: 'Jump to top / bottom of chat' },
    { key: 'ctrl+t', desc: 'Toggle background tasks', actions: ['toggleTasks'] },
    {
        key: 'ctrl+b',
        desc: 'Move the running command to the background',
        actions: ['moveToBackground'],
    },
    { key: 'ctrl+h', desc: 'Session history menu' },
    { key: 'ctrl+l', desc: 'Toggle slash command menu', actions: ['commandMenu'] },
    { key: 'ctrl+c', desc: 'Exit / Graceful interrupt' },
]

/** SHORTCUTS with the user's keys for rebound actions */
export function resolveShortcuts(keymap?: Keymap): ShortcutItem[] {
    if (!keymap) return SHORTCUTS
    return SHORTCUTS.map((item) => {
        if (!item.actions) return item
        const changed = item.actions.some((a) => {
            const keys = keymap.keysFor(a)
            const defaults = KEYBINDING_ACTIONS[a].defaults as readonly string[]
            return keys.length !== defaults.length || keys.some((k, i) => k !== defaults[i])
        })
        if (!changed) return item
        const key = item.actions.map((a) => keymap.keysFor(a).join(', ')).join(' / ')
        return { ...item, key: `${key}${item.suffix || ''}` }
    })
}

export const HELP_WINDOW_SIZE = 8

/** M3.2: one plain sentence in place of the marketing text */
export const HELP_INTRO = 'December writes code, fixes bugs and runs commands in your terminal.'

/** G17: values line up in one column after the longest label ("Workspace") */
const HELP_LABEL_WIDTH = 11

/** The "general" tab rows. A value of undefined means not known and shows "none". */
export function buildHelpInfoRows(
    props: Pick<
        HelpMenuViewProps,
        | 'cliVersion'
        | 'userEmail'
        | 'authMethod'
        | 'selectedProvider'
        | 'activeModel'
        | 'modelLabel'
        | 'cwd'
        | 'branch'
        | 'configPath'
        | 'sessionId'
        | 'sessionTitle'
    >
): { label: string; value?: string }[] {
    let account: string | undefined
    if (props.userEmail) {
        const method =
            !props.authMethod || props.authMethod === 'december'
                ? 'December account'
                : formatBillingLabel(props.authMethod, props.selectedProvider, props.activeModel)
        account = method ? `${props.userEmail} · ${method}` : props.userEmail
    }
    // Same short form as the header: ~ for the home folder
    const home = homedir()
    const rawCwd = props.cwd || process.cwd()
    const cwd = home && rawCwd.startsWith(home) ? `~${rawCwd.slice(home.length)}` : rawCwd
    const session = props.sessionTitle
        ? `${props.sessionTitle}${props.sessionId ? ` · ${props.sessionId}` : ''}`
        : props.sessionId
    return [
        {
            label: 'Version',
            value: props.cliVersion ? props.cliVersion.replace(/^v/, '') : undefined,
        },
        { label: 'Account', value: account },
        { label: 'Model', value: props.modelLabel || props.activeModel || undefined },
        { label: 'Workspace', value: `${cwd}${props.branch ? ` · ${props.branch}` : ''}` },
        { label: 'Config', value: props.configPath || '~/.december/config.json' },
        { label: 'Session', value: session || undefined },
    ]
}

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
    sessionTitle?: string
    configPath?: string
    // Commands tab
    commands?: { name: string; description: string; args?: string }[]
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

        // 1. G14: the tabs are the title row. Active tab brand, others muted, no bold.
        drawTabs(buffer, { x, y, tabs: TABS, active: Math.max(0, TABS.indexOf(activeTab)) })
        y += 2

        // 2. Tab Content
        if (activeTab === 'general') {
            drawText(buffer, HELP_INTRO, {
                x,
                y,
                maxWidth: Math.max(0, width - x - 2),
                ellipsis: true,
                style: { fg: THEME.colors.text },
            })
            y += 2

            // G17: label muted, value in text color. M3.4: unknown values show "none" in dim.
            for (const row of buildHelpInfoRows(props)) {
                drawLabelValue(buffer, {
                    x,
                    y,
                    label: row.label,
                    value: row.value ?? 'none',
                    labelWidth: HELP_LABEL_WIDTH,
                    width: Math.max(0, width - x - 2),
                    valueColor: row.value ? THEME.colors.text : THEME.colors.dim,
                })
                y += 1
            }
        } else if (activeTab === 'commands') {
            // M3.3: the same rows as the command menu (M1)
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
                drawCommandRow(buffer, {
                    x,
                    y: y + i,
                    width: Math.max(0, width - x - 2),
                    selected: windowStart + i === safeSelected,
                    name: `/${cmd.name}`,
                    args: cmd.args,
                    desc: cmd.description,
                    nameWidth: CMD_COL_WIDTH,
                })
            }
            y += visibleCmds.length

            if (cmds.length > HELP_WINDOW_SIZE) {
                drawWindowOverflow(buffer, x, y, windowStart, cmds.length - windowEnd)
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
                drawCommandRow(buffer, {
                    x,
                    y: y + i,
                    width: Math.max(0, width - x - 2),
                    selected: windowStart + i === safeSelected,
                    name: sc.key,
                    desc: sc.desc,
                    nameWidth: CMD_COL_WIDTH,
                })
            }
            y += visibleScs.length

            if (scs.length > HELP_WINDOW_SIZE) {
                drawWindowOverflow(buffer, x, y, windowStart, scs.length - windowEnd)
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
