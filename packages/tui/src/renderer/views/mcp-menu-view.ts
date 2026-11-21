import { THEME } from '../../theme'
import { drawText } from '../ui'

import { MenuFooterView } from './menu-footer-view'
import {
    drawInlineConfirm,
    drawLabelValue,
    drawMetaParts,
    drawOverflow,
    drawPanelTitle,
    metaPartsWidth,
    statusMark,
    toggleMark,
    requestPanelCursor,
} from './panel'

import type { MetaPart } from './panel'
import type { ScreenBuffer } from '../buffer'

export type McpViewMode = 'list' | 'detail' | 'add_custom'

export interface McpToolItem {
    name: string
    description?: string
}

export interface McpServerMenuItem {
    name: string
    scope: 'global' | 'project'
    transport: 'stdio' | 'sse' | 'http'
    status: 'connected' | 'connecting' | 'disconnected' | 'error'
    target: string
    eager?: boolean
    error?: string
    tools?: McpToolItem[]
    resourcesCount?: number
    /** Set when the server comes from a plugin; it is managed in /plugin */
    plugin?: string
}

export interface McpMenuViewProps {
    x?: number
    y: number
    width: number
    height?: number
    selectedIndex: number
    windowStart?: number
    servers?: McpServerMenuItem[]
    isDetailView?: boolean
    scrollOffset?: number
    mode?: McpViewMode
    confirmDeleteName?: string | null
    // Add Custom props
    customName?: string
    customCommand?: string
    customScope?: 'global' | 'project'
    customEager?: boolean
    customEnv?: string
    customActiveField?: number
}

/** M13: the form label column ("Command/URL  ") */
const FORM_LABEL_WIDTH = 13
/** M12: the label column of the details ("Tools load ") */
const DETAIL_LABEL_WIDTH = 11

/** M11: a server is on unless it is stopped; a failed server is on, with its fault in red words */
function isServerOn(s: McpServerMenuItem): boolean {
    return s.status !== 'disconnected'
}

/** where the server is configured: the plugin name, or "user" / "project" */
function serverSource(s: McpServerMenuItem): string {
    if (s.plugin) return s.plugin
    return s.scope === 'project' ? 'project' : 'user'
}

/** M11: the meta words of a list row, "12 tools · stdio · user", with faults in red */
function serverMetaParts(s: McpServerMenuItem): MetaPart[] {
    const source = serverSource(s)
    const muted = THEME.colors.muted
    switch (s.status) {
        case 'connected': {
            const count = s.tools?.length ?? 0
            return [
                {
                    text: `${count} tool${count === 1 ? '' : 's'} · ${s.transport} · ${source}`,
                    color: muted,
                },
            ]
        }
        case 'connecting':
            return [{ text: `starting… · ${s.transport} · ${source}`, color: muted }]
        case 'error':
            return [
                { text: 'failed to start', color: THEME.colors.error },
                { text: ` · ${source}`, color: muted },
            ]
        default:
            return [{ text: `off · ${source}`, color: muted }]
    }
}

/** M12: lowercase status words and the color of their dot */
function serverStatus(s: McpServerMenuItem): { dot: string; word: string; wordColor: string } {
    switch (s.status) {
        case 'connected':
            return {
                dot: statusMark('connected').color,
                word: 'connected',
                wordColor: THEME.colors.text,
            }
        case 'connecting':
            return {
                dot: statusMark('running').color,
                word: 'starting…',
                wordColor: THEME.colors.text,
            }
        case 'error':
            return { dot: statusMark('failed').color, word: 'error', wordColor: THEME.colors.error }
        default:
            return { dot: statusMark('off').color, word: 'stopped', wordColor: THEME.colors.dim }
    }
}

function truncate(text: string, room: number): string {
    if (room <= 0) return ''
    return text.length > room ? `${text.slice(0, Math.max(0, room - 1))}…` : text
}

export const McpMenuView = {
    getHeight(mode?: McpViewMode, serverCount: number = 0, isDetailView?: boolean): number {
        // Title, blank, 5 fields, blank, footer
        if (mode === 'add_custom') return 9
        if (mode === 'detail' || isDetailView) return 7
        // Title, blank, rows, blank, "More servers in /plugin", blank, footer
        return Math.max(serverCount, 1) + 6
    },

    render(buffer: ScreenBuffer, props: McpMenuViewProps): void {
        const x = (props.x ?? 0) + (THEME.padding.paddingLeft ?? 2)
        let y = props.y
        const width = props.width
        const innerWidth = Math.max(
            20,
            width - (THEME.padding.paddingLeft ?? 2) - (THEME.padding.paddingRight ?? 2)
        )
        const right = x + innerWidth
        const footerY = (props.y ?? 0) + (props.height ?? buffer.height) - 1
        const servers = props.servers || []
        const safeIndex = Math.min(
            Math.max(0, props.selectedIndex),
            Math.max(0, servers.length - 1)
        )
        const currentServer = servers[safeIndex]
        const mode = props.mode || (props.isDetailView ? 'detail' : 'list')
        const confirmItems = [
            { key: 'y', label: 'remove' },
            { key: 'n/esc', label: 'cancel' },
        ]

        // ==========================================
        // M13: ADD AN MCP SERVER (one row per field, no button row)
        // ==========================================
        if (mode === 'add_custom') {
            drawPanelTitle(buffer, { x, y, title: 'Add an MCP server', width: innerWidth })
            y += 2

            const activeField = props.customActiveField ?? 0
            const cScope = props.customScope || 'global'
            const cEager = props.customEager ?? false

            type Field =
                | { label: string; kind: 'text'; value: string; placeholder: string }
                | { label: string; kind: 'choice'; choices: string[]; chosen: number }
            const fields: Field[] = [
                {
                    label: 'Name',
                    kind: 'text',
                    value: props.customName || '',
                    placeholder: 'e.g. github',
                },
                {
                    label: 'Command/URL',
                    kind: 'text',
                    value: props.customCommand || '',
                    placeholder: 'a command, or a server URL',
                },
                {
                    label: 'Scope',
                    kind: 'choice',
                    choices: ['user', 'project'],
                    chosen: cScope === 'global' ? 0 : 1,
                },
                {
                    label: 'Tools load',
                    kind: 'choice',
                    choices: ['at start', 'on demand'],
                    chosen: cEager ? 0 : 1,
                },
                {
                    label: 'Env',
                    kind: 'text',
                    value: props.customEnv || '',
                    placeholder: 'KEY=value, KEY2=value (optional)',
                },
            ]

            fields.forEach((f, i) => {
                const rowY = y + i
                const isSelected = i === activeField
                drawText(buffer, isSelected ? `${THEME.glyphs.selector} ` : '  ', {
                    x,
                    y: rowY,
                    style: { fg: THEME.colors.brand },
                })
                drawText(buffer, f.label, {
                    x: x + 2,
                    y: rowY,
                    style: { fg: isSelected ? THEME.colors.brand : THEME.colors.text },
                })
                const valX = x + 2 + FORM_LABEL_WIDTH
                const room = Math.max(0, right - valX)
                if (f.kind === 'choice') {
                    let cx = valX
                    f.choices.forEach((choice, ci) => {
                        if (ci > 0) cx += 3
                        drawText(buffer, choice, {
                            x: cx,
                            y: rowY,
                            maxWidth: Math.max(0, right - cx),
                            style: {
                                fg: ci === f.chosen ? THEME.colors.brand : THEME.colors.muted,
                            },
                        })
                        cx += choice.length
                    })
                    return
                }
                if (f.value) {
                    const shown = truncate(f.value, Math.max(0, room - 1))
                    drawText(buffer, shown, { x: valX, y: rowY, style: { fg: THEME.colors.text } })
                    // G11: the real terminal cursor, placed by the app
                    if (isSelected) requestPanelCursor(valX + shown.length, rowY)
                    return
                }
                // Empty field: the real cursor sits at the start, then the hint in muted
                const hintX = isSelected ? valX + 1 : valX
                if (isSelected) requestPanelCursor(valX, rowY)
                drawText(buffer, f.placeholder, {
                    x: hintX,
                    y: rowY,
                    maxWidth: Math.max(0, right - hintX),
                    style: { fg: THEME.colors.muted },
                })
            })

            MenuFooterView.render(buffer, {
                x: props.x ?? 0,
                y: footerY,
                width,
                items: [
                    { key: 'tab', label: 'next field' },
                    { key: 'shift+tab', label: 'prev' },
                    { key: 'space', label: 'toggle option' },
                    { key: 'enter', label: 'save' },
                    { key: 'esc', label: 'cancel' },
                ],
            })
            return
        }

        // ==========================================
        // M12: MCP SERVER DETAILS
        // ==========================================
        if (mode === 'detail' && currentServer) {
            const isConn = currentServer.status === 'connected'
            const confirming = props.confirmDeleteName === currentServer.name

            // Title row: the server name, the inline remove confirm, then the meta
            drawPanelTitle(buffer, { x, y, title: currentServer.name, width: innerWidth })
            let cx = x + currentServer.name.length
            if (confirming) {
                const text = ' [Remove? y/n]'
                drawInlineConfirm(buffer, { x: cx, y, text, tone: 'danger' })
                cx += text.length
            }
            drawText(buffer, `MCP server · ${serverSource(currentServer)}`, {
                x: cx + 2,
                y,
                maxWidth: Math.max(0, right - cx - 2),
                style: { fg: THEME.colors.muted },
            })
            y += 2

            // Status: a dot and a lowercase word
            const status = serverStatus(currentServer)
            drawText(buffer, 'Status', { x, y, style: { fg: THEME.colors.muted } })
            drawText(buffer, THEME.glyphs.status, {
                x: x + DETAIL_LABEL_WIDTH,
                y,
                style: { fg: status.dot },
            })
            drawText(buffer, status.word, {
                x: x + DETAIL_LABEL_WIDTH + 2,
                y,
                style: { fg: status.wordColor },
            })
            y += 1

            drawLabelValue(buffer, {
                x,
                y,
                label: 'Transport',
                value: currentServer.transport,
                labelWidth: DETAIL_LABEL_WIDTH,
                width: innerWidth,
            })
            y += 1

            drawLabelValue(buffer, {
                x,
                y,
                label: currentServer.transport === 'stdio' ? 'Command' : 'URL',
                value: currentServer.target,
                labelWidth: DETAIL_LABEL_WIDTH,
                width: innerWidth,
            })
            y += 1

            const loadWord = currentServer.eager ? 'at start' : 'on demand'
            const loadNote = currentServer.eager ? ', in the first prompt' : ', through tool search'
            drawLabelValue(buffer, {
                x,
                y,
                label: 'Tools load',
                value: loadWord,
                labelWidth: DETAIL_LABEL_WIDTH,
                width: innerWidth,
            })
            drawText(buffer, loadNote, {
                x: x + DETAIL_LABEL_WIDTH + loadWord.length,
                y,
                maxWidth: Math.max(0, right - (x + DETAIL_LABEL_WIDTH + loadWord.length)),
                style: { fg: THEME.colors.muted },
            })
            y += 1

            if (currentServer.error) {
                drawLabelValue(buffer, {
                    x,
                    y,
                    label: 'Error',
                    value: currentServer.error,
                    labelWidth: DETAIL_LABEL_WIDTH,
                    width: innerWidth,
                    valueColor: THEME.colors.error,
                })
                y += 1
            }

            y += 1

            // Tools: names in text color in one column, descriptions muted, no bullets
            const tools = currentServer.tools || []
            drawText(buffer, `${'Tools'.padEnd(DETAIL_LABEL_WIDTH)}${tools.length}`, {
                x,
                y,
                style: { fg: THEME.colors.muted },
            })
            y += 1

            if (tools.length === 0) {
                drawText(buffer, 'This server has no tools.', {
                    x: x + 2,
                    y,
                    style: { fg: THEME.colors.muted },
                })
            } else {
                // Rows up to one blank row above the footer; the last row turns into "↓ N more"
                const room = Math.max(1, footerY - y - 1)
                const scrollOffset = Math.max(
                    0,
                    Math.min(props.scrollOffset ?? 0, tools.length - 1)
                )
                const remaining = tools.length - scrollOffset
                const showCount = remaining > room ? Math.max(1, room - 1) : remaining
                const visibleTools = tools.slice(scrollOffset, scrollOffset + showCount)
                const nameWidth = Math.min(
                    32,
                    Math.max(22, ...visibleTools.map((t) => t.name.length + 2))
                )
                for (const tool of visibleTools) {
                    drawText(buffer, truncate(tool.name, nameWidth - 2), {
                        x: x + 2,
                        y,
                        style: { fg: THEME.colors.text },
                    })
                    if (tool.description) {
                        const descX = x + 2 + nameWidth
                        drawText(buffer, tool.description.replace(/\s+/g, ' ').trim(), {
                            x: descX,
                            y,
                            maxWidth: Math.max(0, right - descX),
                            ellipsis: true,
                            style: { fg: THEME.colors.muted },
                        })
                    }
                    y += 1
                }
                drawOverflow(buffer, x, y, remaining - visibleTools.length)
            }

            MenuFooterView.render(buffer, {
                x: props.x ?? 0,
                y: footerY,
                width,
                items: confirming
                    ? confirmItems
                    : [
                          { key: '↑/↓', label: 'scroll' },
                          { key: 'space', label: isConn ? 'stop' : 'start' },
                          { key: 'r', label: 'restart' },
                          ...(currentServer.plugin ? [] : [{ key: 'd', label: 'remove' }]),
                          { key: 'esc', label: 'back' },
                      ],
            })
            return
        }

        // ==========================================
        // M11: MCP SERVERS (list)
        // ==========================================
        const onCount = servers.filter(isServerOn).length
        drawPanelTitle(buffer, {
            x,
            y,
            title: 'MCP servers',
            meta: servers.length > 0 ? `${onCount} of ${servers.length} on` : undefined,
            width: innerWidth,
        })
        y += 2

        if (servers.length === 0) {
            drawText(
                buffer,
                'No servers configured. Press a to add one, or install one from /plugin.',
                {
                    x,
                    y,
                    maxWidth: innerWidth,
                    style: { fg: THEME.colors.muted },
                }
            )
            y += 1
        } else {
            // Rows, then a blank row, the /plugin line and a blank row above the footer
            const room = Math.max(1, footerY - y - 3)
            const windowStart = Math.max(0, Math.min(props.windowStart ?? 0, servers.length - 1))
            const remaining = servers.length - windowStart
            const showCount = remaining > room ? Math.max(1, room - 1) : remaining
            const visibleServers = servers.slice(windowStart, windowStart + showCount)

            for (let i = 0; i < visibleServers.length; i++) {
                const actualIndex = windowStart + i
                const s = visibleServers[i]!
                const isSelected = actualIndex === safeIndex
                const confirming = props.confirmDeleteName === s.name
                const mark = toggleMark(isServerOn(s))

                drawText(buffer, isSelected ? `${THEME.glyphs.selector} ` : '  ', {
                    x,
                    y,
                    style: { fg: THEME.colors.brand },
                })
                drawText(buffer, mark.char, { x: x + 2, y, style: { fg: mark.color } })

                const parts = serverMetaParts(s)
                const metaWidth = metaPartsWidth(parts)
                const confirmText = confirming ? ' [Remove? y/n]' : ''
                const nameX = x + 4
                const nameRoom = Math.max(4, right - nameX - metaWidth - 2 - confirmText.length)
                const name = truncate(s.name, nameRoom)
                drawText(buffer, name, {
                    x: nameX,
                    y,
                    style: { fg: isSelected ? THEME.colors.brand : THEME.colors.text },
                })
                if (confirming) {
                    drawInlineConfirm(buffer, {
                        x: nameX + name.length,
                        y,
                        text: confirmText,
                        tone: 'danger',
                    })
                }
                drawMetaParts(buffer, {
                    right,
                    y,
                    parts,
                    minX: nameX + name.length + confirmText.length + 2,
                })
                y += 1
            }
            if (remaining > visibleServers.length) {
                drawOverflow(buffer, x, y, remaining - visibleServers.length)
                y += 1
            }
        }

        // "More servers in /plugin", one blank row under the list; the empty state already says it
        y += 1
        if (servers.length > 0 && y < footerY - 1) {
            const lead = 'More servers in '
            drawText(buffer, lead, { x: x + 2, y, style: { fg: THEME.colors.muted } })
            drawText(buffer, '/plugin', {
                x: x + 2 + lead.length,
                y,
                style: { fg: THEME.colors.brand },
            })
        }

        const footerItems = props.confirmDeleteName
            ? confirmItems
            : servers.length === 0
              ? [
                    { key: 'a', label: 'add server' },
                    { key: 'esc', label: 'close' },
                ]
              : [
                    { key: 'space', label: 'toggle' },
                    { key: 'enter', label: 'details' },
                    { key: 'a', label: 'add' },
                    { key: 'd', label: 'remove' },
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
