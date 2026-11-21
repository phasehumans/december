import { homedir } from 'node:os'

import { THEME } from '../../theme'
import { drawText } from '../ui'

import { MenuFooterView } from './menu-footer-view'
import {
    discoverMetaText,
    extensionMetaText,
    formatAge,
    PLUGIN_TABS,
    PLUGIN_WINDOW_SIZE,
    visibleListLines,
} from './plugin-menu-model'

import type { ScreenBuffer } from '../buffer'
import type { MenuFooterItem } from './menu-footer-view'
import type {
    DiscoverRow,
    ExtensionRow,
    PluginInputKind,
    PluginInstallScope,
    PluginKindFilter,
    PluginList,
    PluginScreen,
    PluginSelectable,
    PluginTab,
} from './plugin-menu-model'

export * from './plugin-menu-model'

export interface PluginMenuViewProps {
    x?: number
    y: number
    width: number
    height?: number
    activeTab: PluginTab
    screen: PluginScreen
    list: PluginList
    selectedIndex: number
    windowStart: number
    /** Muted sentence under the tabs (see pluginSubtitle) */
    subtitle?: string
    query?: string
    isSearching?: boolean
    kindFilter?: PluginKindFilter
    marketFilter?: string | null
    marketNames?: string[]
    loading?: boolean
    busy?: string | null
    confirm?: string | null
    /** Footer verb while confirming, e.g. "uninstall" */
    confirmVerb?: string
    detailRow?: ExtensionRow | null
    detailActions?: string[]
    actionIndex?: number
    installRow?: DiscoverRow | null
    installScope?: PluginInstallScope
    installPaths?: Record<PluginInstallScope, string>
    missingEnv?: string[]
    inputKind?: PluginInputKind
    inputValue?: string
}

type Style = { fg?: string; bold?: boolean }

const KIND_FILTER_LABELS: Record<PluginKindFilter, string> = {
    all: 'all',
    plugin: 'plugins',
    skill: 'skills',
    mcp: 'mcp',
}

const META_MAX_WIDTH = 40
const LABEL_WIDTH = 11

function tildePath(p?: string): string {
    if (!p) return ''
    const home = homedir()
    return p.startsWith(home) ? '~' + p.slice(home.length) : p
}

function contentWidth(width: number): number {
    return Math.max(20, width - THEME.padding.paddingLeft - THEME.padding.paddingRight)
}

/** Status dot colour, the same scheme /tasks uses */
function dotColor(row: ExtensionRow): string {
    if (!row.enabled) return THEME.colors.dim
    if (row.status === 'error') return THEME.colors.error
    if (row.updateAvailable) return THEME.colors.warning
    return THEME.colors.success
}

function drawSelector(buffer: ScreenBuffer, x: number, y: number, selected: boolean) {
    drawText(buffer, selected ? `${THEME.glyphs.selector} ` : '  ', {
        x,
        y,
        style: { fg: selected ? THEME.colors.brand : THEME.colors.muted, bold: true },
    })
}

/** The subtitle row. It doubles as the confirm and busy line, like /tasks. */
function drawSubtitle(
    buffer: ScreenBuffer,
    x: number,
    y: number,
    width: number,
    props: PluginMenuViewProps,
    fallback: string
) {
    if (props.confirm) {
        drawText(buffer, `${props.confirm} [y/n]`, {
            x,
            y,
            maxWidth: width,
            style: { fg: THEME.colors.warning, bold: true },
        })
    } else if (props.busy) {
        drawText(buffer, `${props.busy}…`, {
            x,
            y,
            maxWidth: width,
            style: { fg: THEME.colors.brand },
        })
    } else {
        drawText(buffer, fallback, {
            x,
            y,
            maxWidth: width,
            ellipsis: true,
            style: { fg: THEME.colors.muted },
        })
    }
}

/** Tab bar in the /help style */
function drawTabs(buffer: ScreenBuffer, x: number, y: number, active: PluginTab) {
    let tabX = x
    for (const tab of PLUGIN_TABS) {
        const current = tab === active
        drawText(buffer, tab, {
            x: tabX,
            y,
            style: { fg: current ? THEME.colors.brand : THEME.colors.muted, bold: current },
        })
        tabX += tab.length + 4
    }
}

function drawSearchRow(
    buffer: ScreenBuffer,
    x: number,
    y: number,
    width: number,
    props: PluginMenuViewProps
) {
    const searching = Boolean(props.isSearching)
    const label = 'Search: '
    drawText(buffer, label, {
        x,
        y,
        style: { fg: searching ? THEME.colors.brand : THEME.colors.muted, bold: searching },
    })
    const query = props.query || ''
    const hint = searching ? `${query}█` : query ? `${query} [/ to filter]` : '[/ to filter]'
    drawText(buffer, hint, {
        x: x + label.length,
        y,
        maxWidth: Math.max(4, width - label.length),
        style: { fg: query || searching ? THEME.colors.brand : THEME.colors.dim },
    })

    // Right side: which filter the list shows
    let options: Array<{ label: string; active: boolean }> = []
    if (props.activeTab === 'installed') {
        options = (['all', 'plugin', 'skill', 'mcp'] as PluginKindFilter[]).map((kind) => ({
            label: KIND_FILTER_LABELS[kind],
            active: (props.kindFilter || 'all') === kind,
        }))
    } else if (props.activeTab === 'discover' && (props.marketNames?.length || 0) > 1) {
        options = [
            { label: 'all', active: !props.marketFilter },
            ...props.marketNames!.map((name) => ({
                label: name,
                active: props.marketFilter === name,
            })),
        ]
    }
    if (options.length === 0) return

    const text = options.map((o) => o.label).join(' · ')
    let cx = x + width - text.length
    if (cx <= x + label.length + hint.length + 2) return
    options.forEach((option, i) => {
        if (i > 0) {
            drawText(buffer, ' · ', { x: cx, y, style: { fg: THEME.colors.subtle } })
            cx += 3
        }
        drawText(buffer, option.label, {
            x: cx,
            y,
            style: option.active
                ? { fg: THEME.colors.brand, bold: true }
                : { fg: THEME.colors.muted },
        })
        cx += option.label.length
    })
}

function nameColumnWidth(items: PluginSelectable[]): number {
    let longest = 10
    for (const item of items) longest = Math.max(longest, item.row.name.length)
    return Math.min(longest + 2, 28)
}

function metaFor(item: PluginSelectable, showMarketplace: boolean): { text: string; style: Style } {
    if (item.type === 'extension') {
        const row = item.row
        const failed = row.enabled && row.status === 'error'
        return {
            text: extensionMetaText(row),
            style: {
                fg: failed
                    ? THEME.colors.error
                    : row.updateAvailable
                      ? THEME.colors.warning
                      : THEME.colors.muted,
            },
        }
    }
    if (item.type === 'discover') {
        const row = item.row
        return {
            text: discoverMetaText(row, showMarketplace),
            style: {
                fg: row.updateAvailable
                    ? THEME.colors.warning
                    : row.installed
                      ? THEME.colors.success
                      : THEME.colors.muted,
            },
        }
    }
    const row = item.row
    if (row.error) return { text: row.error, style: { fg: THEME.colors.error } }
    const parts = [`${row.available} plugins`, `${row.installedCount} installed`]
    if (!row.builtIn) parts.push(formatAge(row.updatedAt))
    return { text: parts.join(' · '), style: { fg: THEME.colors.muted } }
}

function drawRow(
    buffer: ScreenBuffer,
    x: number,
    y: number,
    width: number,
    item: PluginSelectable,
    selected: boolean,
    nameWidth: number,
    showMarketplace: boolean
) {
    drawSelector(buffer, x, y, selected)

    // Right-aligned muted column, like the time column in /tasks
    const meta = metaFor(item, showMarketplace)
    const metaText =
        meta.text.length > META_MAX_WIDTH ? meta.text.slice(0, META_MAX_WIDTH - 1) + '…' : meta.text
    const metaX = x + width - metaText.length
    drawText(buffer, metaText, { x: metaX, y, style: meta.style })

    let cx = x + 2
    let off = false
    if (item.type === 'extension' || item.type === 'marketplace') {
        const color =
            item.type === 'extension'
                ? dotColor(item.row)
                : item.row.error
                  ? THEME.colors.error
                  : THEME.colors.success
        drawText(buffer, `${THEME.glyphs.status} `, { x: cx, y, style: { fg: color } })
        cx += 2
        off = item.type === 'extension' && !item.row.enabled
    }

    const nameStyle: Style = selected
        ? { fg: THEME.colors.brand, bold: true }
        : { fg: off ? THEME.colors.muted : THEME.colors.text }
    drawText(buffer, item.row.name, {
        x: cx,
        y,
        maxWidth: Math.max(4, Math.min(nameWidth, metaX - cx - 1)),
        ellipsis: true,
        style: nameStyle,
    })

    // Discover rows and marketplaces fill the middle with a description or source
    const middle =
        item.type === 'discover'
            ? item.row.description
            : item.type === 'marketplace'
              ? item.row.builtIn
                  ? 'built in'
                  : item.row.source
              : ''
    if (middle) {
        const middleX = cx + nameWidth
        const middleWidth = metaX - middleX - 2
        if (middleWidth > 6) {
            drawText(buffer, middle, {
                x: middleX,
                y,
                maxWidth: middleWidth,
                ellipsis: true,
                style: { fg: THEME.colors.muted },
            })
        }
    }
}

function overflowText(list: PluginList, start: number, visible: number): string {
    const countItems = (from: number, to: number) =>
        list.lines.slice(from, to).filter((l) => l.type === 'item').length
    const above = countItems(0, start)
    const below = countItems(start + visible, list.lines.length)
    if (above > 0 && below > 0) return `↑ ${above} more · ↓ ${below} more`
    if (above > 0) return `↑ ${above} more`
    if (below > 0) return `↓ ${below} more`
    return ''
}

function confirmFooter(props: PluginMenuViewProps): MenuFooterItem[] {
    return [
        { key: 'y', label: props.confirmVerb || 'confirm' },
        { key: 'n/esc', label: 'cancel' },
    ]
}

function listFooter(
    props: PluginMenuViewProps,
    current: PluginSelectable | undefined
): MenuFooterItem[] {
    if (props.confirm) return confirmFooter(props)
    if (props.isSearching) {
        return [
            { key: 'enter / ↓', label: 'focus list' },
            { key: 'esc', label: 'clear search' },
        ]
    }
    if (props.activeTab === 'installed') {
        const items: MenuFooterItem[] = [
            { key: '↑/↓', label: 'navigate' },
            { key: 'space', label: 'toggle' },
            { key: 'enter', label: 'details' },
            { key: 'f', label: 'filter' },
        ]
        if (current?.type === 'extension' && current.row.removable) {
            items.push({ key: 'd', label: current.row.kind === 'plugin' ? 'uninstall' : 'remove' })
        }
        items.push({ key: '/', label: 'search' }, { key: 'esc', label: 'close' })
        return items
    }
    if (props.activeTab === 'discover') {
        const items: MenuFooterItem[] = [
            { key: '↑/↓', label: 'navigate' },
            { key: 'enter', label: 'install' },
            { key: 'i', label: 'install from path' },
        ]
        if ((props.marketNames?.length || 0) > 1) items.push({ key: 'm', label: 'marketplace' })
        items.push({ key: '/', label: 'search' }, { key: 'esc', label: 'close' })
        return items
    }
    const items: MenuFooterItem[] = [
        { key: '↑/↓', label: 'navigate' },
        { key: 'enter', label: 'browse' },
        { key: 'a', label: 'add' },
    ]
    if (current?.type === 'marketplace' && !current.row.builtIn) {
        items.push({ key: 'u', label: 'update' }, { key: 'd', label: 'remove' })
    }
    items.push({ key: 'esc', label: 'close' })
    return items
}

function renderList(buffer: ScreenBuffer, props: PluginMenuViewProps) {
    const x = (props.x ?? 0) + THEME.padding.paddingLeft
    const width = contentWidth(props.width)
    const height = props.height ?? buffer.height - props.y
    const footerY = props.y + height - 1
    const { list } = props
    let y = props.y

    drawTabs(buffer, x, y, props.activeTab)
    y += 1
    const loadingNow = props.loading && list.items.length === 0
    drawSubtitle(buffer, x, y, width, props, loadingNow ? 'Loading…' : props.subtitle || '')
    y += 1
    drawSearchRow(buffer, x, y, width, props)
    y += 2

    const safeIndex = Math.min(Math.max(0, props.selectedIndex), Math.max(0, list.items.length - 1))
    const current = list.items[safeIndex]

    if (list.items.length === 0) {
        const empty = loadingNow
            ? ''
            : props.query
              ? `  Nothing matches "${props.query}".`
              : props.activeTab === 'installed'
                ? '  Nothing installed yet. Press ← to discover plugins.'
                : '  No plugins found. Press → to add a marketplace.'
        drawText(buffer, empty, { x, y, maxWidth: width, style: { fg: THEME.colors.muted } })
    } else {
        const visible = visibleListLines(height, list.lines.length)
        const start = Math.max(0, Math.min(props.windowStart, list.lines.length - visible))
        const nameWidth = nameColumnWidth(list.items)
        const showMarketplace = (props.marketNames?.length || 0) > 1 && !props.marketFilter
        const shown = list.lines.slice(start, start + visible)
        // Never end the window on a section title with no row under it
        if (shown.length > 1 && shown[shown.length - 1]!.type === 'header') shown.pop()
        for (const line of shown) {
            if (line.type === 'header') {
                drawText(buffer, line.label, {
                    x,
                    y,
                    style: { fg: THEME.colors.muted, bold: true },
                })
            } else {
                const item = list.items[line.index]
                if (item) {
                    drawRow(
                        buffer,
                        x,
                        y,
                        width,
                        item,
                        line.index === safeIndex,
                        nameWidth,
                        showMarketplace
                    )
                }
            }
            y += 1
        }
        const more = overflowText(list, start, shown.length)
        if (more) {
            drawText(buffer, more, { x: x + 2, y, style: { fg: THEME.colors.subtle } })
        }
    }

    MenuFooterView.render(buffer, {
        x: props.x ?? 0,
        y: footerY,
        width: props.width,
        items: listFooter(props, current),
    })
}

/** A "Label:  value" row in the /help general-tab style */
function drawField(
    buffer: ScreenBuffer,
    x: number,
    y: number,
    width: number,
    label: string,
    value: string,
    style: Style = { fg: THEME.colors.text }
) {
    drawText(buffer, `${label}:`.padEnd(LABEL_WIDTH), {
        x,
        y,
        style: { fg: THEME.colors.muted },
    })
    drawText(buffer, value, {
        x: x + LABEL_WIDTH,
        y,
        maxWidth: Math.max(4, width - LABEL_WIDTH),
        ellipsis: true,
        style,
    })
}

function drawSubScreenHeader(
    buffer: ScreenBuffer,
    x: number,
    y: number,
    width: number,
    title: string,
    description: string,
    props: PluginMenuViewProps
) {
    drawText(buffer, title, {
        x,
        y,
        maxWidth: width,
        ellipsis: true,
        style: { fg: THEME.colors.text, bold: true },
    })
    drawSubtitle(buffer, x, y + 1, width, props, description)
}

function renderDetails(buffer: ScreenBuffer, props: PluginMenuViewProps) {
    const row = props.detailRow
    if (!row) return
    const x = (props.x ?? 0) + THEME.padding.paddingLeft
    const width = contentWidth(props.width)
    const footerY = props.y + (props.height ?? buffer.height - props.y) - 1
    let y = props.y

    drawSubScreenHeader(buffer, x, y, width, row.name, row.description, props)
    y += 3

    const children = row.children || []
    const skills = children.filter((c) => c.kind === 'skill')
    const servers = children.filter((c) => c.kind === 'mcp')

    if (row.version) drawField(buffer, x, y++, width, 'Version', row.version)
    drawField(buffer, x, y++, width, 'Source', row.source)
    drawField(buffer, x, y++, width, 'Scope', row.scope)
    drawField(buffer, x, y++, width, 'Status', row.enabled ? 'on' : 'off', {
        fg: row.enabled ? THEME.colors.success : THEME.colors.muted,
    })
    drawField(
        buffer,
        x,
        y++,
        width,
        'Skills',
        skills.length
            ? skills.map((s) => (s.enabled ? s.name : `${s.name} (off)`)).join(', ')
            : 'none',
        { fg: skills.length ? THEME.colors.text : THEME.colors.dim }
    )
    if (servers.length === 0) {
        drawField(buffer, x, y++, width, 'MCP', 'none', { fg: THEME.colors.dim })
    } else {
        servers.forEach((server, i) => {
            if (y >= footerY - 2) return
            drawText(buffer, (i === 0 ? 'MCP:' : '').padEnd(LABEL_WIDTH), {
                x,
                y,
                style: { fg: THEME.colors.muted },
            })
            drawText(buffer, `${THEME.glyphs.status} `, {
                x: x + LABEL_WIDTH,
                y,
                style: { fg: dotColor(server) },
            })
            drawText(buffer, server.name, {
                x: x + LABEL_WIDTH + 2,
                y,
                style: { fg: THEME.colors.text },
            })
            drawText(buffer, server.meta, {
                x: x + LABEL_WIDTH + 4 + server.name.length,
                y,
                style: {
                    fg: server.status === 'error' ? THEME.colors.error : THEME.colors.muted,
                },
            })
            y += 1
        })
    }
    if (row.path) {
        drawField(buffer, x, y++, width, 'Location', tildePath(row.path), {
            fg: THEME.colors.muted,
        })
    }
    y += 1

    const actions = props.detailActions || []
    actions.forEach((action, i) => {
        if (y >= footerY - 1) return
        const selected = i === (props.actionIndex ?? 0)
        drawSelector(buffer, x, y, selected)
        drawText(buffer, action, {
            x: x + 2,
            y,
            style: selected ? { fg: THEME.colors.brand, bold: true } : { fg: THEME.colors.text },
        })
        y += 1
    })

    MenuFooterView.render(buffer, {
        x: props.x ?? 0,
        y: footerY,
        width: props.width,
        items: props.confirm
            ? confirmFooter(props)
            : [
                  { key: '↑/↓', label: 'navigate' },
                  { key: 'enter', label: 'select' },
                  { key: 'esc', label: 'back' },
              ],
    })
}

function plural(count: number, word: string): string {
    return `${count} ${word}${count === 1 ? '' : 's'}`
}

function renderInstall(buffer: ScreenBuffer, props: PluginMenuViewProps) {
    const row = props.installRow
    if (!row) return
    const x = (props.x ?? 0) + THEME.padding.paddingLeft
    const width = contentWidth(props.width)
    const footerY = props.y + (props.height ?? buffer.height - props.y) - 1
    let y = props.y

    drawSubScreenHeader(buffer, x, y, width, `Install ${row.name}`, row.description, props)
    y += 3

    const adds: string[] = []
    if (row.skillNames?.length) {
        adds.push(`${plural(row.skillNames.length, 'skill')} (${row.skillNames.join(', ')})`)
    }
    if (row.mcpServerNames?.length) {
        adds.push(
            `${plural(row.mcpServerNames.length, 'MCP server')} (${row.mcpServerNames.join(', ')})`
        )
    }
    if (row.version) drawField(buffer, x, y++, width, 'Version', row.version)
    drawField(buffer, x, y++, width, 'From', row.marketplace)
    if (adds.length) drawField(buffer, x, y++, width, 'Adds', adds.join(' and '))
    if (props.missingEnv?.length) {
        drawField(buffer, x, y++, width, 'Needs', `${props.missingEnv.join(', ')} (not set)`, {
            fg: THEME.colors.warning,
        })
    }
    y += 1

    drawText(buffer, 'Install to:', { x, y, style: { fg: THEME.colors.muted } })
    y += 1
    const scopes: Array<{ scope: PluginInstallScope; note: string }> = [
        { scope: 'user', note: 'every project on this machine' },
        { scope: 'project', note: 'commit it to share with your team' },
    ]
    for (const option of scopes) {
        const selected = props.installScope === option.scope
        drawSelector(buffer, x, y, selected)
        drawText(buffer, option.scope, {
            x: x + 2,
            y,
            style: selected ? { fg: THEME.colors.brand, bold: true } : { fg: THEME.colors.text },
        })
        drawText(buffer, `${props.installPaths?.[option.scope] || ''} · ${option.note}`, {
            x: x + 11,
            y,
            maxWidth: Math.max(4, width - 11),
            ellipsis: true,
            style: { fg: THEME.colors.muted },
        })
        y += 1
    }

    MenuFooterView.render(buffer, {
        x: props.x ?? 0,
        y: footerY,
        width: props.width,
        items: [
            { key: '↑/↓', label: 'scope' },
            { key: 'enter', label: 'install' },
            { key: 'esc', label: 'cancel' },
        ],
    })
}

function renderInput(buffer: ScreenBuffer, props: PluginMenuViewProps) {
    const x = (props.x ?? 0) + THEME.padding.paddingLeft
    const width = contentWidth(props.width)
    const footerY = props.y + (props.height ?? buffer.height - props.y) - 1
    const isInstall = props.inputKind === 'install-source'
    let y = props.y

    drawSubScreenHeader(
        buffer,
        x,
        y,
        width,
        isInstall ? 'Install from path or git url' : 'Add marketplace',
        isInstall
            ? 'A folder with plugin.json, a git url, or owner/repo on GitHub.'
            : 'A folder or repo with marketplace.json: owner/repo, a git url, or a local path.',
        props
    )
    y += 3

    const label = 'Source: '
    drawText(buffer, label, { x, y, style: { fg: THEME.colors.brand, bold: true } })
    drawText(buffer, `${props.inputValue || ''}█`, {
        x: x + label.length,
        y,
        maxWidth: Math.max(4, width - label.length),
        style: { fg: THEME.colors.brand },
    })
    y += 2

    if (isInstall) {
        const scope = props.installScope || 'user'
        drawField(
            buffer,
            x,
            y,
            width,
            'Install to',
            `${scope}  ${props.installPaths?.[scope] || ''}`
        )
    }

    const items: MenuFooterItem[] = [{ key: 'enter', label: isInstall ? 'install' : 'add' }]
    if (isInstall) items.push({ key: 'tab', label: 'change scope' })
    items.push({ key: 'esc', label: 'cancel' })
    MenuFooterView.render(buffer, { x: props.x ?? 0, y: footerY, width: props.width, items })
}

export const PluginMenuView = {
    getHeight(
        props: Pick<PluginMenuViewProps, 'screen' | 'list' | 'detailRow' | 'detailActions'>
    ): number {
        if (props.screen === 'input') return 8
        if (props.screen === 'install') return 13
        if (props.screen === 'details') {
            const servers = (props.detailRow?.children || []).filter((c) => c.kind === 'mcp').length
            // Title, subtitle, gap, fields, gap, actions, gap, footer
            return 3 + 6 + Math.max(1, servers) + 1 + (props.detailActions?.length || 0) + 2
        }
        const lines = Math.max(1, props.list.lines.length)
        const shown = Math.min(lines, PLUGIN_WINDOW_SIZE)
        const overflow = lines > PLUGIN_WINDOW_SIZE ? 1 : 0
        // Tabs, subtitle, search, gap, rows, overflow, gap, footer
        return 4 + shown + overflow + 2
    },

    /** How many list lines fit on the list screen for a given overlay height */
    visibleListLines(height: number, totalLines: number): number {
        return visibleListLines(height, totalLines)
    },

    render(buffer: ScreenBuffer, props: PluginMenuViewProps): void {
        if (props.screen === 'details') return renderDetails(buffer, props)
        if (props.screen === 'install') return renderInstall(buffer, props)
        if (props.screen === 'input') return renderInput(buffer, props)
        return renderList(buffer, props)
    },
}
