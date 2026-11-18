import { THEME } from '../../theme'
import { drawText } from '../ui'

import { MenuFooterView } from './menu-footer-view'

import type { ScreenBuffer } from '../buffer'

export type McpViewMode = 'list' | 'detail' | 'add_preset' | 'add_custom'

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
}

export interface McpPresetTemplate {
    id: string
    name: string
    title: string
    description: string
    command: string
    args?: string[]
    defaultScope: 'global' | 'project'
    envHint?: string
}

export const MCP_PRESET_TEMPLATES: McpPresetTemplate[] = [
    {
        id: 'github',
        name: 'github',
        title: 'GitHub',
        description: 'Repository search, issues, pull requests, and git contents',
        command: 'npx -y @modelcontextprotocol/server-github',
        defaultScope: 'global',
        envHint: 'GITHUB_PERSONAL_ACCESS_TOKEN',
    },
    {
        id: 'postgres',
        name: 'postgres',
        title: 'PostgreSQL',
        description: 'Database query execution, schema inspection, and query plans',
        command: 'npx -y @modelcontextprotocol/server-postgres postgresql://localhost/db',
        defaultScope: 'project',
    },
    {
        id: 'sqlite',
        name: 'sqlite',
        title: 'SQLite',
        description: 'Read and query local SQLite database files',
        command: 'npx -y @modelcontextprotocol/server-sqlite --db ./app.db',
        defaultScope: 'project',
    },
    {
        id: 'brave-search',
        name: 'brave-search',
        title: 'Brave Search',
        description: 'Real-time internet web search and content retrieval',
        command: 'npx -y @modelcontextprotocol/server-brave-search',
        defaultScope: 'global',
        envHint: 'BRAVE_API_KEY',
    },
    {
        id: 'fetch',
        name: 'fetch',
        title: 'Fetch & Web',
        description: 'Web page scraping and markdown extraction',
        command: 'npx -y @modelcontextprotocol/server-fetch',
        defaultScope: 'global',
    },
    {
        id: 'puppeteer',
        name: 'puppeteer',
        title: 'Puppeteer',
        description: 'Browser automation and web screenshot captures',
        command: 'npx -y @modelcontextprotocol/server-puppeteer',
        defaultScope: 'global',
    },
    {
        id: 'filesystem',
        name: 'filesystem',
        title: 'Filesystem Sandboxed',
        description: 'Direct sandboxed local directory read and write access',
        command: 'npx -y @modelcontextprotocol/server-filesystem .',
        defaultScope: 'project',
    },
]

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
    // Add Preset props
    presetSelectedIndex?: number
    // Add Custom props
    customName?: string
    customCommand?: string
    customScope?: 'global' | 'project'
    customEager?: boolean
    customEnv?: string
    customActiveField?: number
}

export const McpMenuView = {
    getHeight(mode?: McpViewMode, serverCount: number = 0, isDetailView?: boolean): number {
        if (mode === 'add_preset') return 9
        if (mode === 'add_custom') return 10
        if (mode === 'detail' || isDetailView) return 7
        return Math.max(serverCount, 1) + 4
    },

    render(buffer: ScreenBuffer, props: McpMenuViewProps): void {
        const x = (props.x ?? 0) + (THEME.padding.paddingLeft ?? 2)
        let y = props.y
        const width = props.width
        const footerY = (props.y ?? 0) + (props.height ?? buffer.height) - 1
        const servers = props.servers || []
        const safeIndex = Math.min(
            Math.max(0, props.selectedIndex),
            Math.max(0, servers.length - 1)
        )
        const currentServer = servers[safeIndex]
        const mode = props.mode || (props.isDetailView ? 'detail' : 'list')

        // ==========================================
        // 1. ADD PRESET TEMPLATES MODE
        // ==========================================
        if (mode === 'add_preset') {
            drawText(buffer, 'Add MCP Server · Preset Templates', {
                x,
                y,
                style: { fg: THEME.colors.brand, bold: true },
            })
            y += 1
            drawText(buffer, 'Choose a template or press [c] for custom command / URL', {
                x,
                y,
                style: { fg: THEME.colors.muted },
            })
            y += 2

            const presetIdx = Math.min(
                Math.max(0, props.presetSelectedIndex ?? 0),
                MCP_PRESET_TEMPLATES.length - 1
            )

            for (let i = 0; i < MCP_PRESET_TEMPLATES.length; i++) {
                const item = MCP_PRESET_TEMPLATES[i]
                const isSelected = i === presetIdx
                const rowY = y + i

                drawText(buffer, isSelected ? '❭ ' : '  ', {
                    x,
                    y: rowY,
                    style: { fg: isSelected ? THEME.colors.brand : THEME.colors.dim },
                })

                drawText(buffer, item.title, {
                    x: x + 2,
                    y: rowY,
                    style: {
                        fg: isSelected ? THEME.colors.brand : THEME.colors.text,
                        bold: isSelected,
                    },
                })

                const descX = x + 2 + item.title.length + 2
                drawText(buffer, `- ${item.description}`, {
                    x: descX,
                    y: rowY,
                    maxWidth: Math.max(10, width - descX - 2),
                    style: { fg: THEME.colors.muted },
                })
            }

            MenuFooterView.render(buffer, {
                x: props.x ?? 0,
                y: footerY,
                width,
                items: [
                    { key: '↑/↓', label: 'select' },
                    { key: 'enter', label: 'use preset' },
                    { key: 'c', label: 'custom command' },
                    { key: 'esc', label: 'back' },
                ],
            })
            return
        }

        // ==========================================
        // 2. ADD CUSTOM SERVER MODE
        // ==========================================
        if (mode === 'add_custom') {
            drawText(buffer, 'Add MCP Server · Custom Configuration', {
                x,
                y,
                style: { fg: THEME.colors.brand, bold: true },
            })
            y += 1
            drawText(buffer, 'Configure server connection details', {
                x,
                y,
                style: { fg: THEME.colors.muted },
            })
            y += 2

            const activeField = props.customActiveField ?? 0
            const cName = props.customName || ''
            const cCmd = props.customCommand || ''
            const cScope = props.customScope || 'global'
            const cEager = props.customEager ?? false
            const cEnv = props.customEnv || ''

            const fields = [
                {
                    label: 'Server Name:',
                    value: cName || '(enter name, e.g. github)',
                    isPlaceholder: !cName,
                },
                {
                    label: 'Target (Cmd/URL):',
                    value: cCmd || '(command or sse url)',
                    isPlaceholder: !cCmd,
                },
                {
                    label: 'Scope:',
                    value: cScope === 'global' ? '[*Global* / Project]' : '[Global / *Project*]',
                    isPlaceholder: false,
                },
                {
                    label: 'Loading Mode:',
                    value: cEager
                        ? '[*Eager (turn-1)* / Deferred]'
                        : '[Eager / *Deferred (search_tools)*]',
                    isPlaceholder: false,
                },
                {
                    label: 'Environment:',
                    value: cEnv || '(optional KEY=val, KEY2=val2)',
                    isPlaceholder: !cEnv,
                },
                {
                    label: '[ Save & Connect Server ]',
                    value: '',
                    isPlaceholder: false,
                },
            ]

            for (let i = 0; i < fields.length; i++) {
                const f = fields[i]
                const isSelected = i === activeField
                const rowY = y + i * 2

                drawText(buffer, isSelected ? '❭ ' : '  ', {
                    x,
                    y: rowY,
                    style: { fg: isSelected ? THEME.colors.brand : THEME.colors.dim },
                })

                if (i === 5) {
                    drawText(buffer, f.label, {
                        x: x + 2,
                        y: rowY,
                        style: {
                            fg: isSelected ? THEME.colors.brand : THEME.colors.text,
                            bold: isSelected,
                        },
                    })
                    continue
                }

                drawText(buffer, f.label, {
                    x: x + 2,
                    y: rowY,
                    style: {
                        fg: isSelected ? THEME.colors.brand : THEME.colors.text,
                        bold: isSelected,
                    },
                })

                const valX = x + 20
                drawText(buffer, f.value, {
                    x: valX,
                    y: rowY,
                    maxWidth: Math.max(10, width - valX - 2),
                    style: {
                        fg: f.isPlaceholder ? THEME.colors.dim : THEME.colors.text,
                        bold: isSelected && !f.isPlaceholder,
                    },
                })
            }

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
        // 3. DETAIL VIEW
        // ==========================================
        if (mode === 'detail' && currentServer) {
            drawText(buffer, `MCP Server: ${currentServer.name}`, {
                x,
                y,
                style: { fg: THEME.colors.brand, bold: true },
            })

            const scopeBadge = ` [${currentServer.scope}]`
            drawText(buffer, scopeBadge, {
                x: x + `MCP Server: ${currentServer.name}`.length,
                y,
                style: { fg: THEME.colors.dim },
            })
            y += 2

            // Status and Transport
            const isConn = currentServer.status === 'connected'
            const statusColor = isConn
                ? THEME.colors.success
                : currentServer.status === 'error'
                  ? THEME.colors.error
                  : THEME.colors.dim
            const statusBullet = isConn ? '● CONNECTED' : `● ${currentServer.status.toUpperCase()}`
            drawText(buffer, statusBullet, {
                x,
                y,
                style: { fg: statusColor, bold: true },
            })

            drawText(buffer, ` · Transport: ${currentServer.transport}`, {
                x: x + statusBullet.length,
                y,
                style: { fg: THEME.colors.muted },
            })
            y += 1

            // Target
            drawText(buffer, `Target: ${currentServer.target}`, {
                x,
                y,
                maxWidth: Math.max(10, width - x - 4),
                style: { fg: THEME.colors.text },
            })
            y += 1

            if (currentServer.eager) {
                drawText(buffer, 'Loading: Eager (injected in turn-1 prompt)', {
                    x,
                    y,
                    style: { fg: THEME.colors.brand },
                })
                y += 1
            }

            if (currentServer.error) {
                drawText(buffer, `Error: ${currentServer.error}`, {
                    x,
                    y,
                    style: { fg: THEME.colors.error },
                })
                y += 1
            }

            y += 1

            // Delete confirmation prompt if active
            if (props.confirmDeleteName === currentServer.name) {
                drawText(buffer, `Remove MCP server "${currentServer.name}"? [y/N]`, {
                    x,
                    y,
                    style: { fg: THEME.colors.error, bold: true },
                })
                y += 2
            }

            // Tools Section
            const tools = currentServer.tools || []
            drawText(buffer, `Available Tools (${tools.length}):`, {
                x,
                y,
                style: { fg: THEME.colors.text, bold: true },
            })
            y += 1

            const maxVisibleTools = Math.max(1, footerY - y - 1)
            const scrollOffset = props.scrollOffset ?? 0
            const visibleTools = tools.slice(scrollOffset, scrollOffset + maxVisibleTools)

            if (tools.length === 0) {
                drawText(buffer, '  (No tools exposed by this server)', {
                    x,
                    y,
                    style: { fg: THEME.colors.dim },
                })
            } else {
                for (const tool of visibleTools) {
                    drawText(buffer, `  • ${tool.name}`, {
                        x,
                        y,
                        style: { fg: THEME.colors.brand, bold: true },
                    })
                    if (tool.description) {
                        const cleanDesc = tool.description.replace(/\s+/g, ' ').slice(0, 50)
                        drawText(buffer, ` - ${cleanDesc}`, {
                            x: x + tool.name.length + 4,
                            y,
                            maxWidth: Math.max(10, width - x - tool.name.length - 8),
                            style: { fg: THEME.colors.muted },
                        })
                    }
                    y += 1
                }
            }

            MenuFooterView.render(buffer, {
                x: props.x ?? 0,
                y: footerY,
                width,
                items: [
                    { key: '↑/↓', label: 'scroll' },
                    { key: 'space', label: isConn ? 'stop' : 'start' },
                    { key: 'r', label: 'restart' },
                    { key: 'd', label: 'remove' },
                    { key: 'esc', label: 'back' },
                ],
            })
            return
        }

        // ==========================================
        // 4. LIST VIEW (MINIMAL SWITCHBOARD)
        // ==========================================
        // Header Title
        drawText(buffer, `MCP Servers (${servers.length})`, {
            x,
            y,
            style: { fg: THEME.colors.text, bold: true },
        })
        y += 2

        if (servers.length === 0) {
            drawText(buffer, 'No servers configured. Press [a] to add a server.', {
                x,
                y,
                style: { fg: THEME.colors.muted },
            })
            y += 1
        } else {
            const windowSize = Math.max(1, footerY - y - 1)
            const windowStart = props.windowStart ?? 0
            const visibleServers = servers.slice(windowStart, windowStart + windowSize)

            for (let i = 0; i < visibleServers.length; i++) {
                const actualIndex = windowStart + i
                const s = visibleServers[i]
                const isSelected = actualIndex === safeIndex
                const rowY = y + i
                const isConn = s.status === 'connected'

                // Selection cursor
                drawText(buffer, isSelected ? '❭ ' : '  ', {
                    x,
                    y: rowY,
                    style: { fg: isSelected ? THEME.colors.brand : THEME.colors.dim },
                })

                // [x] enabled or [ ] disabled checkbox
                const toggleCheck = isConn ? '[x] ' : '[ ] '
                drawText(buffer, toggleCheck, {
                    x: x + 2,
                    y: rowY,
                    style: {
                        fg: isConn ? THEME.colors.success : THEME.colors.dim,
                        bold: isConn,
                    },
                })

                // Server name
                let nameX = x + 6
                drawText(buffer, s.name, {
                    x: nameX,
                    y: rowY,
                    style: {
                        fg: isSelected ? THEME.colors.brand : THEME.colors.text,
                        bold: isSelected,
                    },
                })
                nameX += s.name.length + 2

                // Tool count and transport
                const toolCount = s.tools?.length ?? 0
                const statusText = isConn
                    ? `${toolCount} tool${toolCount === 1 ? '' : 's'}  [${s.transport}]`
                    : '(stopped)'
                drawText(buffer, statusText, {
                    x: nameX,
                    y: rowY,
                    style: { fg: isConn ? THEME.colors.muted : THEME.colors.dim },
                })
            }
        }

        // Inline confirmation message if user initiated delete
        if (props.confirmDeleteName) {
            drawText(
                buffer,
                `Confirm remove "${props.confirmDeleteName}"? Press [y] to confirm, [n] or [esc] to cancel`,
                {
                    x,
                    y: footerY - 1,
                    maxWidth: Math.max(10, width - x - 2),
                    style: { fg: THEME.colors.error, bold: true },
                }
            )
        }

        const footerItems =
            servers.length === 0
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
