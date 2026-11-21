export type PluginTab = 'discover' | 'installed' | 'marketplaces'
export type PluginKindFilter = 'all' | 'plugin' | 'skill' | 'mcp'
export type PluginScreen = 'list' | 'details' | 'install' | 'input'
export type PluginInputKind = 'install-source' | 'add-marketplace'
export type PluginInstallScope = 'user' | 'project'

export const PLUGIN_TABS: PluginTab[] = ['discover', 'installed', 'marketplaces']
export const PLUGIN_KIND_FILTERS: PluginKindFilter[] = ['all', 'plugin', 'skill', 'mcp']

/** One installed item: a plugin, a skill, or an MCP server */
export interface ExtensionRow {
    key: string
    kind: 'plugin' | 'skill' | 'mcp'
    id: string
    name: string
    description: string
    scope: 'project' | 'user' | 'built-in'
    enabled: boolean
    source: string
    meta: string
    path?: string
    version?: string
    removable: boolean
    parentPlugin?: string
    entryFilePath?: string
    tokens?: number
    mcpScope?: 'global' | 'project'
    status?: 'connected' | 'connecting' | 'disconnected' | 'error'
    error?: string
    updatable?: boolean
    updateAvailable?: boolean
    latestVersion?: string
    children?: ExtensionRow[]
}

export interface DiscoverRow {
    id: string
    name: string
    description: string
    category?: string
    author?: string
    version?: string
    marketplace: string
    installed?: boolean
    installedVersion?: string
    updateAvailable?: boolean
    env?: string[]
    defaultScope?: PluginInstallScope
    skillNames?: string[]
    mcpServerNames?: string[]
}

export interface MarketplaceRow {
    name: string
    source: string
    builtIn: boolean
    available: number
    installedCount: number
    updatedAt?: number
    error?: string
}

export type PluginSelectable =
    | { type: 'extension'; row: ExtensionRow }
    | { type: 'discover'; row: DiscoverRow }
    | { type: 'marketplace'; row: MarketplaceRow }

export type PluginLine = { type: 'header'; label: string } | { type: 'item'; index: number }

export interface PluginList {
    lines: PluginLine[]
    items: PluginSelectable[]
}

export interface PluginListInput {
    tab: PluginTab
    installed: ExtensionRow[]
    discover: DiscoverRow[]
    marketplaces: MarketplaceRow[]
    query?: string
    kindFilter?: PluginKindFilter
    marketFilter?: string | null
}

/** Most list lines (rows and section titles) a /plugin list shows at once */
export const PLUGIN_WINDOW_SIZE = 10

const SCOPE_TITLES: Record<ExtensionRow['scope'], string> = {
    project: 'Project',
    user: 'User',
    'built-in': 'Built-in',
}

function matches(query: string, ...fields: Array<string | undefined>): boolean {
    if (!query) return true
    return fields.some((f) => f !== undefined && f.toLowerCase().includes(query))
}

/** Installed rows for a kind filter. "All" nests plugin parts; other filters flatten them. */
export function rowsForKind(installed: ExtensionRow[], kind: PluginKindFilter): ExtensionRow[] {
    if (kind === 'all') return installed
    if (kind === 'plugin') return installed.filter((r) => r.kind === 'plugin')
    const rows: ExtensionRow[] = []
    for (const row of installed) {
        if (row.kind === kind) rows.push(row)
        for (const child of row.children || []) {
            if (child.kind === kind) rows.push(child)
        }
    }
    const scopeOrder = { project: 0, user: 1, 'built-in': 2 }
    return rows.sort(
        (a, b) => scopeOrder[a.scope] - scopeOrder[b.scope] || a.name.localeCompare(b.name)
    )
}

export function kindCounts(installed: ExtensionRow[]): Record<PluginKindFilter, number> {
    return {
        all: installed.length,
        plugin: rowsForKind(installed, 'plugin').length,
        skill: rowsForKind(installed, 'skill').length,
        mcp: rowsForKind(installed, 'mcp').length,
    }
}

export function marketplaceCounts(discover: DiscoverRow[]): Array<{ name: string; count: number }> {
    const counts = new Map<string, number>()
    for (const row of discover) counts.set(row.marketplace, (counts.get(row.marketplace) || 0) + 1)
    return Array.from(counts, ([name, count]) => ({ name, count }))
}

export function buildPluginList(input: PluginListInput): PluginList {
    const query = (input.query || '').trim().toLowerCase()
    const lines: PluginLine[] = []
    const items: PluginSelectable[] = []
    const push = (item: PluginSelectable) => {
        lines.push({ type: 'item', index: items.length })
        items.push(item)
    }

    if (input.tab === 'installed') {
        const rows = rowsForKind(input.installed, input.kindFilter || 'all').filter((r) =>
            matches(query, r.name, r.description, r.source)
        )
        let currentScope: ExtensionRow['scope'] | null = null
        for (const row of rows) {
            if (row.scope !== currentScope) {
                lines.push({ type: 'header', label: SCOPE_TITLES[row.scope] })
                currentScope = row.scope
            }
            push({ type: 'extension', row })
        }
        return { lines, items }
    }

    if (input.tab === 'discover') {
        const rows = input.discover.filter(
            (r) =>
                (!input.marketFilter || r.marketplace === input.marketFilter) &&
                matches(query, r.name, r.description, r.category, r.marketplace)
        )
        const byCategory = new Map<string, DiscoverRow[]>()
        for (const row of rows) {
            const category = row.category || 'Other'
            byCategory.set(category, [...(byCategory.get(category) || []), row])
        }
        for (const [category, group] of byCategory) {
            lines.push({ type: 'header', label: category })
            for (const row of group) push({ type: 'discover', row })
        }
        return { lines, items }
    }

    for (const row of input.marketplaces) {
        if (matches(query, row.name, row.source)) push({ type: 'marketplace', row })
    }
    return { lines, items }
}

export interface PluginCatalogSummary {
    installed: ExtensionRow[]
    discover: DiscoverRow[]
    marketplaces: MarketplaceRow[]
}

/** The muted sentence under the tabs */
export function pluginSubtitle(
    tab: PluginTab,
    catalog: PluginCatalogSummary,
    marketFilter?: string | null
): string {
    if (tab === 'installed') {
        const off = catalog.installed.filter((r) => !r.enabled).length
        const total = catalog.installed.length
        return `Plugins, skills, and MCP servers. ${total} installed${off ? `, ${off} off` : ''}.`
    }
    if (tab === 'discover') {
        const markets = catalog.marketplaces.length
        const shown = marketFilter
            ? catalog.discover.filter((d) => d.marketplace === marketFilter).length
            : catalog.discover.length
        const from = marketFilter
            ? `from ${marketFilter}`
            : `from ${markets} marketplace${markets === 1 ? '' : 's'}`
        return `${shown} plugin${shown === 1 ? '' : 's'} ${from}.`
    }
    return 'Where December finds plugins: a git repo or folder with a marketplace.json.'
}

/** Text for the right-hand column of an Installed row */
export function extensionMetaText(row: ExtensionRow): string {
    const parts = [row.kind, row.meta]
    if (row.parentPlugin) parts.push(`via ${row.parentPlugin}`)
    if (row.updateAvailable) parts.push('update')
    return parts.filter(Boolean).join(' · ')
}

/** Text for the right-hand column of a Discover row */
export function discoverMetaText(row: DiscoverRow, showMarketplace: boolean): string {
    if (row.updateAvailable) return 'update'
    if (row.installed) return 'installed'
    const parts: string[] = []
    if (row.skillNames?.length) {
        parts.push(`${row.skillNames.length} skill${row.skillNames.length === 1 ? '' : 's'}`)
    }
    if (row.mcpServerNames?.length) parts.push(`${row.mcpServerNames.length} mcp`)
    if (showMarketplace) parts.push(row.marketplace)
    return parts.join(' · ')
}

/** How many list lines fit in a /plugin card of this height */
export function visibleListLines(height: number, totalLines: number): number {
    // tabs, subtitle, search, gap above the list; gap and footer below
    const available = Math.max(1, height - 6)
    if (totalLines <= Math.min(available, PLUGIN_WINDOW_SIZE)) return totalLines
    // Leave one row for the "↑ n more · ↓ n more" line
    return Math.max(1, Math.min(available - 1, PLUGIN_WINDOW_SIZE))
}

export function lineIndexOf(list: PluginList, itemIndex: number): number {
    return list.lines.findIndex((l) => l.type === 'item' && l.index === itemIndex)
}

/** Scroll offset (in lines) that keeps the selected line on screen, with its header when possible */
export function ensureVisible(windowStart: number, selectedLine: number, visible: number): number {
    if (visible <= 0 || selectedLine < 0) return 0
    let start = windowStart
    // Show the group header above the first item of a group
    const wantTop = Math.max(0, selectedLine - 1)
    if (wantTop < start) start = wantTop
    if (selectedLine >= start + visible) start = selectedLine - visible + 1
    return Math.max(0, start)
}

export function formatAge(timestamp: number | undefined, now: number = Date.now()): string {
    if (!timestamp) return 'never updated'
    const seconds = Math.max(0, Math.round((now - timestamp) / 1000))
    if (seconds < 60) return 'updated just now'
    const minutes = Math.round(seconds / 60)
    if (minutes < 60) return `updated ${minutes}m ago`
    const hours = Math.round(minutes / 60)
    if (hours < 48) return `updated ${hours}h ago`
    return `updated ${Math.round(hours / 24)}d ago`
}
