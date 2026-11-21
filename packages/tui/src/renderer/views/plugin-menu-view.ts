import { homedir } from 'node:os'

import { THEME } from '../../theme'
import { drawText } from '../ui'

import { MenuFooterView } from './menu-footer-view'
import {
    drawInlineConfirm,
    drawMetaParts,
    drawPanelTitle,
    drawTabs,
    toggleMark,
    requestPanelCursor,
} from './panel'
import {
    discoverMetaText,
    formatAge,
    PLUGIN_TABS,
    PLUGIN_WINDOW_SIZE,
    visibleListLines,
} from './plugin-menu-model'

import type { ScreenBuffer } from '../buffer'
import type { MenuFooterItem } from './menu-footer-view'
import type { MetaPart } from './panel'
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
    /** Counts on the right of the tab row (see pluginSubtitle) */
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

type Style = { fg?: string }

const KIND_FILTER_LABELS: Record<PluginKindFilter, string> = {
    all: 'all',
    plugin: 'plugins',
    skill: 'skills',
    mcp: 'mcp',
}

const META_MAX_WIDTH = 40
const LABEL_WIDTH = 11
/** M15: the "Adds" / "Needs" label column */
const INSTALL_LABEL_WIDTH = 7
/** M15: the scope label column ("For you" / "This project") */
const SCOPE_LABEL_WIDTH = 15

function tildePath(p?: string): string {
    if (!p) return ''
    const home = homedir()
    return p.startsWith(home) ? '~' + p.slice(home.length) : p
}

function contentWidth(width: number): number {
    return Math.max(20, width - THEME.padding.paddingLeft - THEME.padding.paddingRight)
}

/** Status dot colour for an MCP server inside a plugin: green when on, red on a fault, dim when off */
function dotColor(row: ExtensionRow): string {
    if (!row.enabled) return THEME.colors.dim
    if (row.status === 'error') return THEME.colors.error
    return THEME.colors.success
}

function drawSelector(buffer: ScreenBuffer, x: number, y: number, selected: boolean) {
    drawText(buffer, selected ? `${THEME.glyphs.selector} ` : '  ', {
        x,
        y,
        style: { fg: THEME.colors.brand },
    })
}

/** "uninstall" becomes "Uninstall", for the inline "[Uninstall? y/n]" */
function capitalize(word: string): string {
    return word ? word[0]!.toUpperCase() + word.slice(1) : word
}

/** The row under a sub-screen title. It doubles as the confirm and busy line. */
function drawSubtitle(
    buffer: ScreenBuffer,
    x: number,
    y: number,
    width: number,
    props: PluginMenuViewProps,
    fallback: string,
    fallbackColor: string = THEME.colors.muted
) {
    if (props.confirm) {
        drawText(buffer, `${props.confirm} [y/n]`, {
            x,
            y,
            maxWidth: width,
            style: { fg: THEME.colors.error },
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
            style: { fg: fallbackColor },
        })
    }
}

/** M14: the tab row (G14), with the counts on the right, or the busy line while an action runs */
function drawTabRow(
    buffer: ScreenBuffer,
    x: number,
    y: number,
    width: number,
    props: PluginMenuViewProps
) {
    const tabsEnd = drawTabs(buffer, {
        x,
        y,
        tabs: PLUGIN_TABS,
        active: Math.max(0, PLUGIN_TABS.indexOf(props.activeTab)),
    })
    const busy = props.busy ? `${props.busy}…` : ''
    const text = busy || props.subtitle || ''
    if (!text) return
    const room = x + width - tabsEnd - 3
    if (room < 4) return
    const shown = text.length > room ? `${text.slice(0, room - 1)}…` : text
    drawText(buffer, shown, {
        x: x + width - shown.length,
        y,
        style: { fg: busy ? THEME.colors.brand : THEME.colors.muted },
    })
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
        style: { fg: searching ? THEME.colors.brand : THEME.colors.muted },
    })
    const query = props.query || ''
    const hint = searching ? query : query ? `${query} [/ to filter]` : '[/ to filter]'
    // G11: the real terminal cursor while typing, placed by the app
    if (searching) requestPanelCursor(x + label.length + query.length, y)
    drawText(buffer, hint, {
        x: x + label.length,
        y,
        maxWidth: Math.max(4, width - label.length),
        style: { fg: query || searching ? THEME.colors.brand : THEME.colors.dim },
    })

    // Right side: which filter the list shows, in the tab style (G14)
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

    const text = options.map((o) => o.label).join('   ')
    const cx = x + width - text.length
    if (cx <= x + label.length + hint.length + 2) return
    drawTabs(buffer, {
        x: cx,
        y,
        tabs: options.map((o) => o.label),
        active: options.findIndex((o) => o.active),
    })
}

function nameColumnWidth(items: PluginSelectable[]): number {
    let longest = 10
    for (const item of items) longest = Math.max(longest, item.row.name.length)
    return Math.min(longest + 2, 28)
}

/** M14: the right-hand column of a row, with faults in red words and "update" in brand */
function metaFor(item: PluginSelectable, showMarketplace: boolean): MetaPart[] {
    const muted = THEME.colors.muted
    if (item.type === 'extension') {
        const row = item.row
        const parts: MetaPart[] = [
            {
                text: [row.kind, row.meta, row.parentPlugin].filter(Boolean).join(' · '),
                color: muted,
            },
        ]
        if (row.enabled && row.status === 'error') {
            parts.push(
                { text: ' · ', color: muted },
                { text: 'failed to load', color: THEME.colors.error }
            )
        }
        if (row.updateAvailable) {
            parts.push({ text: ' · ', color: muted }, { text: 'update', color: THEME.colors.brand })
        }
        return parts
    }
    if (item.type === 'discover') {
        const row = item.row
        return [
            {
                text: discoverMetaText(row, showMarketplace),
                color: row.updateAvailable ? THEME.colors.brand : muted,
            },
        ]
    }
    const row = item.row
    if (row.error) return [{ text: row.error, color: THEME.colors.error }]
    const parts = [`${row.available} plugins`, `${row.installedCount} installed`]
    if (!row.builtIn) parts.push(formatAge(row.updatedAt))
    return [{ text: parts.join(' · '), color: muted }]
}

/** Cut meta parts to at most `max` cells, with a one-cell ellipsis */
function clipMeta(parts: MetaPart[], max: number): MetaPart[] {
    const out: MetaPart[] = []
    let used = 0
    for (const part of parts) {
        const room = max - used
        if (room <= 0) break
        if (part.text.length > room) {
            out.push({ text: `${part.text.slice(0, Math.max(0, room - 1))}…`, color: part.color })
            break
        }
        out.push(part)
        used += part.text.length
    }
    return out
}

function drawRow(
    buffer: ScreenBuffer,
    x: number,
    y: number,
    width: number,
    item: PluginSelectable,
    selected: boolean,
    nameWidth: number,
    showMarketplace: boolean,
    confirmText: string
) {
    drawSelector(buffer, x, y, selected)

    // Right-aligned muted column, like the time column in /tasks
    const meta = clipMeta(metaFor(item, showMarketplace), META_MAX_WIDTH)
    const metaX = drawMetaParts(buffer, { right: x + width, y, parts: meta })

    let cx = x + 2
    if (item.type === 'extension') {
        // G6: ✓ for on, ○ for off
        const mark = toggleMark(item.row.enabled)
        drawText(buffer, `${mark.char} `, { x: cx, y, style: { fg: mark.color } })
        cx += 2
    } else if (item.type === 'marketplace') {
        drawText(buffer, `${THEME.glyphs.status} `, {
            x: cx,
            y,
            style: { fg: item.row.error ? THEME.colors.error : THEME.colors.success },
        })
        cx += 2
    }

    const nameRoom = Math.max(4, Math.min(nameWidth, metaX - cx - 1 - confirmText.length))
    const nameResult = drawText(buffer, item.row.name, {
        x: cx,
        y,
        maxWidth: nameRoom,
        ellipsis: true,
        style: { fg: selected ? THEME.colors.brand : THEME.colors.text },
    })

    // G10: the confirm stays inline on the row, in red with no bold
    if (confirmText) {
        drawInlineConfirm(buffer, { x: nameResult.x, y, text: confirmText, tone: 'danger' })
        return
    }

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

    drawTabRow(buffer, x, y, width, props)
    y += 1
    const loadingNow = props.loading && list.items.length === 0
    drawSearchRow(buffer, x, y, width, props)
    y += 2

    const safeIndex = Math.min(Math.max(0, props.selectedIndex), Math.max(0, list.items.length - 1))
    const current = list.items[safeIndex]

    if (list.items.length === 0) {
        const empty = loadingNow
            ? '  Loading plugins…'
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
                    style: { fg: THEME.colors.muted },
                })
            } else {
                const item = list.items[line.index]
                if (item) {
                    const isSelected = line.index === safeIndex
                    drawRow(
                        buffer,
                        x,
                        y,
                        width,
                        item,
                        isSelected,
                        nameWidth,
                        showMarketplace,
                        isSelected && props.confirm
                            ? ` [${capitalize(props.confirmVerb || 'confirm')}? y/n]`
                            : ''
                    )
                }
            }
            y += 1
        }
        const more = overflowText(list, start, shown.length)
        if (more) {
            drawText(buffer, more, { x: x + 2, y, style: { fg: THEME.colors.dim } })
        }
    }

    MenuFooterView.render(buffer, {
        x: props.x ?? 0,
        y: footerY,
        width: props.width,
        items: listFooter(props, current),
    })
}

/** G17: a "Label  value" row, label muted with no colon, values in one column */
function drawField(
    buffer: ScreenBuffer,
    x: number,
    y: number,
    width: number,
    label: string,
    value: string,
    style: Style = { fg: THEME.colors.text }
) {
    drawText(buffer, label.padEnd(LABEL_WIDTH), {
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
    drawPanelTitle(buffer, { x, y, title, width })
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
            drawText(buffer, (i === 0 ? 'MCP' : '').padEnd(LABEL_WIDTH), {
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
            style: { fg: selected ? THEME.colors.brand : THEME.colors.text },
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

    // M15: a confirm, so the title is the question; version and source are meta
    drawPanelTitle(buffer, {
        x,
        y,
        title: `Install ${row.name}?`,
        meta: [row.version, row.marketplace].filter(Boolean).join(' · '),
        width,
    })
    drawSubtitle(buffer, x, y + 1, width, props, row.description, THEME.colors.text)
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
    const drawInstallField = (label: string, value: string, color: string) => {
        drawText(buffer, label, { x, y, style: { fg: THEME.colors.muted } })
        drawText(buffer, value, {
            x: x + INSTALL_LABEL_WIDTH,
            y,
            maxWidth: Math.max(4, width - INSTALL_LABEL_WIDTH),
            ellipsis: true,
            style: { fg: color },
        })
        y += 1
    }
    if (adds.length) drawInstallField('Adds', adds.join(', '), THEME.colors.text)
    const missing = props.missingEnv || []
    if (missing.length) {
        // M15.2: yellow stays, a missing token is a real warning
        drawInstallField(
            'Needs',
            `${missing.join(', ')} ${missing.length === 1 ? 'is' : 'are'} not set`,
            THEME.colors.warning
        )
    }
    if (adds.length || missing.length) y += 1

    const scopes: Array<{ scope: PluginInstallScope; label: string; note: string }> = [
        { scope: 'user', label: 'For you', note: ', all your projects' },
        { scope: 'project', label: 'This project', note: ', commit it to share' },
    ]
    for (const option of scopes) {
        const selected = props.installScope === option.scope
        drawSelector(buffer, x, y, selected)
        drawText(buffer, option.label, {
            x: x + 2,
            y,
            style: { fg: selected ? THEME.colors.brand : THEME.colors.text },
        })
        const pathX = x + 2 + SCOPE_LABEL_WIDTH
        const path = tildePath(props.installPaths?.[option.scope]) || ''
        const pathResult = drawText(buffer, path, {
            x: pathX,
            y,
            maxWidth: Math.max(4, x + width - pathX),
            ellipsis: true,
            style: { fg: selected ? THEME.colors.brand : THEME.colors.muted },
        })
        drawText(buffer, option.note, {
            x: pathResult.x,
            y,
            maxWidth: Math.max(0, x + width - pathResult.x),
            style: { fg: selected ? THEME.colors.text : THEME.colors.muted },
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
    drawText(buffer, label, { x, y, style: { fg: THEME.colors.brand } })
    requestPanelCursor(x + label.length + (props.inputValue || '').length, y)
    drawText(buffer, props.inputValue || '', {
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
        // Title, description, gap, adds, needs, gap, 2 scopes, gap, footer
        if (props.screen === 'install') return 10
        if (props.screen === 'details') {
            const servers = (props.detailRow?.children || []).filter((c) => c.kind === 'mcp').length
            // Title, subtitle, gap, fields, gap, actions, gap, footer
            return 3 + 6 + Math.max(1, servers) + 1 + (props.detailActions?.length || 0) + 2
        }
        const lines = Math.max(1, props.list.lines.length)
        const shown = Math.min(lines, PLUGIN_WINDOW_SIZE)
        const overflow = lines > PLUGIN_WINDOW_SIZE ? 1 : 0
        // Tabs and counts, search, gap, rows, overflow, gap, footer
        return 3 + shown + overflow + 2
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
