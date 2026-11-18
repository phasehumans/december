import { THEME } from '../../theme'
import { drawText } from '../ui'

import { MenuFooterView } from './menu-footer-view'

import type { ScreenBuffer } from '../buffer'

export type PluginTab = 'installed' | 'discover'

export interface PluginItemViewProps {
    id: string
    name: string
    description: string
    version?: string
    author?: string
    scope?: 'built-in' | 'workspace' | 'global'
    enabled?: boolean
    installed?: boolean
    isExpanded?: boolean
    components?: {
        skills?: string[]
        rules?: string[]
        mcpServers?: string[]
    }
}

export interface PluginMenuViewProps {
    x?: number
    y: number
    width: number
    height?: number
    activeTab: PluginTab
    searchQuery?: string
    isSearching?: boolean
    selectedIndex: number
    windowStart?: number
    installedPlugins: PluginItemViewProps[]
    discoverablePlugins: PluginItemViewProps[]
    expandedPluginId?: string | null
    confirmUninstallId?: string | null
}

export const PluginMenuView = {
    getHeight(
        activeTab: PluginTab = 'installed',
        itemCount: number = 0,
        isExpanded: boolean = false
    ): number {
        // Title (1) + Tabs (1) + Search Prompt (1) + items (max 6) + Footer (1) + (expanded ? 3 : 0)
        const visibleItems = Math.min(6, Math.max(1, itemCount))
        const expansionRows = isExpanded ? 3 : 0
        return visibleItems + expansionRows + 4
    },

    render(buffer: ScreenBuffer, props: PluginMenuViewProps): void {
        const x = (props.x ?? 0) + (THEME.padding.paddingLeft ?? 2)
        let y = props.y
        const width = props.width
        const footerY = (props.y ?? 0) + (props.height ?? buffer.height) - 1

        const isInstalled = props.activeTab === 'installed'
        const items = isInstalled ? props.installedPlugins : props.discoverablePlugins
        const installedCount = props.installedPlugins.length
        const discoverCount = props.discoverablePlugins.length

        // 1. Header Title
        drawText(buffer, 'Plugins', {
            x,
            y,
            style: { fg: THEME.colors.text, bold: true },
        })
        y += 1

        // 2. Tab Bar: Installed (N)    Discover (M)   (tab to cycle)
        const tab1 = `Installed (${installedCount})`
        const tab2 = `Discover (${discoverCount})`

        let tabX = x
        drawText(buffer, tab1, {
            x: tabX,
            y,
            style: isInstalled
                ? { fg: THEME.colors.brand, bold: true, underline: true }
                : { fg: THEME.colors.muted },
        })
        tabX += tab1.length + 4

        drawText(buffer, tab2, {
            x: tabX,
            y,
            style: !isInstalled
                ? { fg: THEME.colors.brand, bold: true, underline: true }
                : { fg: THEME.colors.muted },
        })
        tabX += tab2.length + 3

        drawText(buffer, '(tab to cycle)', {
            x: tabX,
            y,
            style: { fg: THEME.colors.dim },
        })
        y += 1

        // 3. Search Bar: Type to search plugins...
        const searchPrefix = props.searchQuery
            ? `Search: ${props.searchQuery}`
            : 'Type to search plugins...'
        drawText(buffer, searchPrefix, {
            x,
            y,
            style: props.searchQuery
                ? { fg: THEME.colors.brand, bold: true }
                : { fg: THEME.colors.dim },
        })
        y += 1

        // 4. Plugin Items
        const safeIndex = Math.min(Math.max(0, props.selectedIndex), Math.max(0, items.length - 1))
        const windowStart = props.windowStart ?? 0
        const maxVisibleItems = Math.max(1, footerY - y - 1)
        const visibleItems = items.slice(windowStart, windowStart + maxVisibleItems)

        if (items.length === 0) {
            const emptyText = isInstalled
                ? 'No plugins installed. Press [Tab] to discover and install plugins.'
                : 'No discoverable plugins matching search.'
            drawText(buffer, emptyText, {
                x,
                y,
                style: { fg: THEME.colors.muted },
            })
            y += 1
        } else {
            let rowY = y
            for (let i = 0; i < visibleItems.length; i++) {
                if (rowY >= footerY) break

                const actualIndex = windowStart + i
                const p = visibleItems[i]
                const isSelected = actualIndex === safeIndex
                const isExpanded = props.expandedPluginId === p.id

                // Selection cursor / arrow
                const cursorGlyph = isExpanded ? 'v ' : isSelected ? '> ' : '  '
                drawText(buffer, cursorGlyph, {
                    x,
                    y: rowY,
                    style: { fg: isSelected ? THEME.colors.brand : THEME.colors.dim },
                })

                let itemX = x + 2

                // Status badge
                if (isInstalled) {
                    const isEnabled = p.enabled !== false
                    const statusTag = isEnabled ? '[enabled] ' : '[disabled]'
                    drawText(buffer, statusTag, {
                        x: itemX,
                        y: rowY,
                        style: {
                            fg: isEnabled ? THEME.colors.success : THEME.colors.dim,
                            bold: isEnabled,
                        },
                    })
                    itemX += statusTag.length + 1
                } else {
                    const isInst = p.installed === true
                    const statusTag = isInst ? '[installed]' : '[install]  '
                    drawText(buffer, statusTag, {
                        x: itemX,
                        y: rowY,
                        style: {
                            fg: isInst ? THEME.colors.muted : THEME.colors.brand,
                            bold: !isInst,
                        },
                    })
                    itemX += statusTag.length + 1
                }

                // Name
                drawText(buffer, p.name, {
                    x: itemX,
                    y: rowY,
                    style: {
                        fg: isSelected ? THEME.colors.brand : THEME.colors.text,
                        bold: isSelected,
                    },
                })
                itemX += p.name.length

                // Built-in badge if applicable
                if (p.scope === 'built-in') {
                    const biText = ' (built-in)'
                    drawText(buffer, biText, {
                        x: itemX,
                        y: rowY,
                        style: { fg: THEME.colors.dim },
                    })
                    itemX += biText.length
                }

                itemX += 1

                // Description
                if (p.description) {
                    drawText(buffer, p.description, {
                        x: itemX,
                        y: rowY,
                        maxWidth: Math.max(10, width - itemX - 2),
                        style: { fg: THEME.colors.muted },
                    })
                }

                rowY += 1

                // Inline expansion drawer for components
                if (isExpanded && p.components && rowY + 3 <= footerY) {
                    const comp = p.components
                    const cX = x + 4

                    if (comp.skills && comp.skills.length > 0) {
                        drawText(buffer, `├─ Skills:     ${comp.skills.join(', ')}`, {
                            x: cX,
                            y: rowY,
                            maxWidth: Math.max(10, width - cX - 2),
                            style: { fg: THEME.colors.brand },
                        })
                        rowY += 1
                    }

                    if (comp.mcpServers && comp.mcpServers.length > 0) {
                        drawText(buffer, `├─ MCP Server: ${comp.mcpServers.join(', ')}`, {
                            x: cX,
                            y: rowY,
                            maxWidth: Math.max(10, width - cX - 2),
                            style: { fg: THEME.colors.text },
                        })
                        rowY += 1
                    }

                    if (comp.rules && comp.rules.length > 0) {
                        drawText(buffer, `└─ Rules:      ${comp.rules.join(', ')}`, {
                            x: cX,
                            y: rowY,
                            maxWidth: Math.max(10, width - cX - 2),
                            style: { fg: THEME.colors.muted },
                        })
                        rowY += 1
                    }
                }
            }
        }

        // 5. Confirmation message if uninstalling
        if (props.confirmUninstallId) {
            drawText(
                buffer,
                `Confirm uninstall "${props.confirmUninstallId}"? Press [y] to confirm, [n] to cancel`,
                {
                    x,
                    y: footerY - 1,
                    maxWidth: Math.max(10, width - x - 2),
                    style: { fg: THEME.colors.error, bold: true },
                }
            )
        }

        // 6. Keyboard Footer
        const footerItems = isInstalled
            ? [
                  { key: '↑/↓', label: 'Navigate' },
                  { key: 'tab', label: 'Cycle Tabs' },
                  { key: 'enter', label: 'Expand Details' },
                  { key: 'space', label: 'Toggle Enable' },
                  { key: 'ctrl+s', label: 'Uninstall' },
                  { key: 'esc', label: 'Exit' },
              ]
            : [
                  { key: '↑/↓', label: 'Navigate' },
                  { key: 'tab', label: 'Cycle Tabs' },
                  { key: 'enter', label: 'Install Plugin' },
                  { key: 'esc', label: 'Exit' },
              ]

        MenuFooterView.render(buffer, {
            x: props.x ?? 0,
            y: footerY,
            width,
            items: footerItems,
        })
    },
}
