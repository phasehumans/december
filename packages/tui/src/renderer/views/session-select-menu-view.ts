import { THEME } from '../../theme'
import { drawText } from '../ui'

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

export function sanitizeSessionTitle(rawTitle: string): string {
    if (!rawTitle) return ''
    const cleaned = rawTitle
        .replace(/<context_file[^>]*>[\s\S]*?<\/context_file>/gi, '')
        .replace(/<piped_stdin>[\s\S]*?<\/piped_stdin>/gi, '')
        .replace(/<[^>]+>/g, '')
        .replace(/\s+/g, ' ')
        .trim()
    return cleaned || rawTitle.replace(/\s+/g, ' ').trim()
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
        const count = sessionsCount || 1
        const visible = Math.min(windowSize, count)
        const hasOverflow = count > windowSize
        // Title (1) + Search (1) + Gap (1) + Visible + Overflow (0|1) + Gap (1) + Footer (1)
        return 3 + visible + (hasOverflow ? 1 : 0) + 2
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

        const queryDisplay = isSearching
            ? `${query}█`
            : query
              ? `${query} [/ to filter]`
              : '[/ to search]'
        drawText(buffer, queryDisplay, {
            x: x + searchLabel.length,
            y,
            style: { fg: query ? THEME.colors.brand : THEME.colors.dim },
        })
        y += 2

        // 3. Session Items
        const sessions = SessionSelectMenuView.getFiltered(props.sessions || [], props.searchQuery)
        const totalItems = sessions.length

        if (totalItems === 0) {
            drawText(buffer, '  No sessions found.', {
                x,
                y,
                style: { fg: THEME.colors.muted },
            })
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
                const cleanedTitle = sanitizeSessionTitle(rawTitle)

                let displayTitle = cleanedTitle
                if (isConfirmDelete) {
                    displayTitle = `${cleanedTitle} [Delete? y/n]`
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

            // Pagination overflow indicator
            if (totalItems > windowSize) {
                const itemsAbove = windowStart
                const itemsBelow = totalItems - windowEnd
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
                        y: y + visible.length,
                        style: { fg: THEME.colors.subtle },
                    })
                }
            }
        }

        // 4. Navigation Footer
        const height = props.height ?? buffer.height
        const footerY = (props.y ?? 0) + height - 1
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
            x: props.x ?? 0,
            y: footerY,
            width,
            items: footerItems,
        })
    },
}
