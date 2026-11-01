import { THEME } from '../../theme'
import { drawDivider, drawText } from '../ui'

import { MenuFooterView } from './menu-footer-view'

import type { ScreenBuffer } from '../buffer'

export const SESSION_WINDOW_SIZE = 7

export interface SessionItem {
    id: string
    preview?: string
    updatedAt: Date | string | number
    messageCount?: number
}

export interface SessionSelectMenuViewProps {
    x?: number
    y: number
    width: number
    height?: number
    sessions: SessionItem[]
    selectedIndex: number
    windowStart: number
    searchQuery?: string
    isSearching?: boolean
    renameMode?: boolean
    renameValue?: string
    confirmDeleteId?: string | null
    windowSize?: number
}

export function formatSessionTimeAgo(date: Date | string | number): string {
    if (!date) return ''
    const d = typeof date === 'number' || typeof date === 'string' ? new Date(date) : date
    const seconds = Math.floor((Date.now() - d.getTime()) / 1000)
    if (seconds < 60) return `${Math.max(0, seconds)}s ago`
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    return `${days}d ago`
}

export const SessionSelectMenuView = {
    getFiltered(sessions: SessionItem[], query?: string): SessionItem[] {
        if (!query || !query.trim()) return sessions
        const q = query.toLowerCase().trim()
        return sessions.filter((s) => {
            const preview = (s.preview || '').toLowerCase()
            const id = s.id.toLowerCase()
            return preview.includes(q) || id.includes(q)
        })
    },

    getHeight(sessionsCount: number, windowSize = SESSION_WINDOW_SIZE): number {
        const listRows = Math.min(Math.max(sessionsCount, 1), windowSize)
        // Title (1), Search Row (1), Divider (1), List (listRows), Status (1), Divider (1), Footer (1) = 6 + listRows
        return 6 + listRows
    },

    render(buffer: ScreenBuffer, props: SessionSelectMenuViewProps): void {
        const x = (props.x ?? 0) + THEME.padding.paddingLeft
        let y = props.y
        const width = Math.max(
            20,
            props.width - THEME.padding.paddingLeft - THEME.padding.paddingRight
        )
        const windowSize = props.windowSize ?? SESSION_WINDOW_SIZE

        // 1. Title Row
        drawText(buffer, 'Session History', {
            x,
            y,
            style: { fg: THEME.colors.text, bold: true },
        })
        y += 1

        // 2. Search Row
        const isSearching = Boolean(props.isSearching)
        const query = props.searchQuery || ''
        const searchLabel = isSearching ? 'Search: ' : 'Filter: '
        drawText(buffer, searchLabel, {
            x,
            y,
            style: { fg: isSearching ? THEME.colors.brand : THEME.colors.muted, bold: isSearching },
        })

        const queryDisplay = query ? `${query} ` : isSearching ? '' : '[/ to search] '
        drawText(buffer, queryDisplay, {
            x: x + searchLabel.length,
            y,
            style: { fg: query ? THEME.colors.brand : THEME.colors.dim },
        })
        y += 1

        // 3. Divider
        drawDivider(buffer, {
            x,
            y,
            width,
            char: '─',
            style: { fg: THEME.colors.border },
        })
        y += 1

        // 4. Session Items
        const sessions = SessionSelectMenuView.getFiltered(props.sessions || [], props.searchQuery)
        const totalItems = sessions.length

        if (totalItems === 0) {
            drawText(buffer, '  No sessions found.', {
                x,
                y,
                style: { fg: THEME.colors.muted },
            })
            y += 1
        } else {
            const windowStart = Math.max(
                0,
                Math.min(props.windowStart || 0, Math.max(0, totalItems - windowSize))
            )
            const windowEnd = Math.min(windowStart + windowSize, totalItems)
            const visible = sessions.slice(windowStart, windowEnd)

            for (let i = 0; i < visible.length; i++) {
                const session = visible[i]
                const absIdx = windowStart + i
                const isSelected = absIdx === props.selectedIndex
                const rowY = y + i

                // Indicator
                const selector = isSelected ? `${THEME.glyphs.selector} ` : '  '
                drawText(buffer, selector, {
                    x,
                    y: rowY,
                    style: { fg: isSelected ? THEME.colors.brand : THEME.colors.muted },
                })

                if (isSelected && props.renameMode) {
                    const renameText = `Rename: ${props.renameValue || ''}█`
                    drawText(buffer, renameText, {
                        x: x + 2,
                        y: rowY,
                        style: { fg: THEME.colors.brand, bold: true },
                    })
                    continue
                }

                const isConfirmDelete = session.id === props.confirmDeleteId
                const timeStr = formatSessionTimeAgo(session.updatedAt)
                const timeWidth = 12
                const maxTitleWidth = Math.max(10, width - 2 - timeWidth - 2)

                const isCustomName = !session.id.startsWith('session-')
                const rawTitle = isCustomName ? session.id : session.preview || session.id
                const singleLineTitle = (rawTitle || '').replace(/\s+/g, ' ').trim()

                let displayTitle = singleLineTitle
                if (isConfirmDelete) {
                    displayTitle = `${singleLineTitle} [Delete? y/n]`
                }

                drawText(buffer, displayTitle, {
                    x: x + 2,
                    y: rowY,
                    maxWidth: maxTitleWidth,
                    style: {
                        fg: isConfirmDelete
                            ? THEME.colors.error
                            : isSelected
                              ? THEME.colors.brand
                              : THEME.colors.text,
                        bold: isSelected,
                    },
                })

                // Right aligned time
                const timeX = x + width - timeWidth
                drawText(buffer, timeStr.padStart(timeWidth), {
                    x: timeX,
                    y: rowY,
                    maxWidth: timeWidth,
                    style: { fg: THEME.colors.muted },
                })
            }
            y += visible.length

            // Status bar
            const statusText = `[${windowStart + 1}-${windowEnd} of ${totalItems} sessions]`
            drawText(buffer, statusText, {
                x: x + 2,
                y,
                style: { fg: THEME.colors.subtle },
            })
            y += 1
        }

        // 5. Divider
        const height = props.height ?? buffer.height
        const footerY = (props.y ?? 0) + height - 1
        const bottomDividerY = (props.y ?? 0) + height - 2

        drawDivider(buffer, {
            x,
            y: bottomDividerY,
            width,
            char: '─',
            style: { fg: THEME.colors.border },
        })

        // 6. Navigation Footer
        const footerItems = props.confirmDeleteId
            ? [
                  { key: 'y', label: 'confirm delete' },
                  { key: 'n/esc', label: 'cancel' },
              ]
            : props.renameMode
              ? [
                    { key: 'enter', label: 'save name' },
                    { key: 'esc', label: 'cancel' },
                ]
              : isSearching
                ? [
                      { key: 'enter', label: 'confirm search' },
                      { key: 'esc', label: 'clear' },
                  ]
                : [
                      { key: '↑/↓', label: 'navigate' },
                      { key: 'enter', label: 'resume' },
                      { key: '/', label: 'search' },
                      { key: 'r', label: 'rename' },
                      { key: 'd', label: 'delete' },
                      { key: 'esc', label: 'close' },
                  ]

        MenuFooterView.render(buffer, {
            x,
            y: footerY,
            width,
            items: footerItems,
        })
    },
}
