import { THEME } from '../../theme'
import { drawText } from '../ui'

import { MenuFooterView } from './menu-footer-view'
import { drawInlineConfirm, drawPanelTitle } from './panel'

import type { ScreenBuffer } from '../buffer'

export const SESSION_WINDOW_SIZE = 7

export interface SessionItem {
    id: string
    /** display title (manual, model-written, or cut from the first prompt) */
    title?: string
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

/**
 * the name to show for a session: its title, else a legacy custom id
 * (sessions renamed before titles existed), else the first prompt, else the id.
 */
export function getSessionDisplayTitle(session: SessionItem): string {
    if (session.title && session.title.trim()) return session.title.trim()
    if (!session.id.startsWith('session-')) return session.id
    return sanitizeSessionTitle(session.preview || '') || session.id
}

export const SessionSelectMenuView = {
    getFiltered(sessions: SessionItem[], query?: string): SessionItem[] {
        if (!query || !query.trim()) return sessions
        const q = query.toLowerCase().trim()
        return sessions.filter((s) => {
            const title = (s.title || '').toLowerCase()
            const preview = (s.preview || '').toLowerCase()
            const id = s.id.toLowerCase()
            return title.includes(q) || preview.includes(q) || id.includes(q)
        })
    },

    getHeight(sessionsCount: number, windowSize = SESSION_WINDOW_SIZE): number {
        const count = sessionsCount || 1
        const visible = Math.min(windowSize, count)
        const hasOverflow = count > windowSize
        // Title (1) + Search (1) + Gap (1) + Visible + Overflow (0|1) + Gap (1) + Footer (1)
        return 3 + visible + (hasOverflow ? 1 : 0) + 2
    },

    /**
     * Where the real terminal cursor goes (G11, M21.2): after the query while searching, or after
     * the name while renaming. Null when no field is being edited. The view draws no fake cursor.
     */
    getCursorPosition(props: SessionSelectMenuViewProps): { x: number; y: number } | null {
        const x = (props.x ?? 0) + THEME.padding.paddingLeft
        if (props.isSearching) {
            return { x: x + 'Search: '.length + (props.searchQuery || '').length, y: props.y + 1 }
        }
        if (props.renameMode) {
            const sessions = SessionSelectMenuView.getFiltered(
                props.sessions || [],
                props.searchQuery
            )
            const windowSize = props.windowSize ?? SESSION_WINDOW_SIZE
            const windowStart = Math.max(
                0,
                Math.min(props.windowStart || 0, Math.max(0, sessions.length - windowSize))
            )
            const row = props.selectedIndex - windowStart
            if (row < 0 || row >= windowSize || props.selectedIndex >= sessions.length) return null
            return { x: x + 2 + (props.renameValue || '').length, y: props.y + 3 + row }
        }
        return null
    },

    render(buffer: ScreenBuffer, props: SessionSelectMenuViewProps): void {
        const x = (props.x ?? 0) + THEME.padding.paddingLeft
        let y = props.y
        const width = Math.max(
            20,
            props.width - THEME.padding.paddingLeft - THEME.padding.paddingRight
        )
        const windowSize = props.windowSize ?? SESSION_WINDOW_SIZE
        const allSessions = props.sessions || []
        const sessions = SessionSelectMenuView.getFiltered(allSessions, props.searchQuery)
        const totalItems = sessions.length

        // 1. Title row (M21.1): the command name and the session count; "Rename session" while renaming
        const countText = `${allSessions.length} session${allSessions.length === 1 ? '' : 's'}`
        const meta =
            props.searchQuery && props.searchQuery.trim() && totalItems !== allSessions.length
                ? `${totalItems} of ${countText}`
                : countText
        drawPanelTitle(buffer, {
            x,
            y,
            title: props.renameMode ? 'Rename session' : 'Resume',
            meta: props.renameMode ? undefined : meta,
            width,
        })
        y += 1

        // 2. Filter row, as today with no bold and no drawn cursor (G11)
        const isSearching = Boolean(props.isSearching)
        const query = props.searchQuery || ''
        const searchLabel = isSearching ? 'Search: ' : 'Filter: '
        drawText(buffer, searchLabel, {
            x,
            y,
            style: { fg: isSearching ? THEME.colors.brand : THEME.colors.muted },
        })
        const qx = x + searchLabel.length
        if (isSearching || query) {
            const queryResult = drawText(buffer, query, {
                x: qx,
                y,
                maxWidth: Math.max(1, width - searchLabel.length),
                style: { fg: THEME.colors.brand },
            })
            if (!isSearching) {
                drawText(buffer, ' [/ to filter]', {
                    x: queryResult.x,
                    y,
                    style: { fg: THEME.colors.dim },
                })
            }
        } else {
            drawText(buffer, '[/ to search]', { x: qx, y, style: { fg: THEME.colors.dim } })
        }
        y += 2

        // 3. Session rows
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
                const session = visible[i]!
                const absIdx = windowStart + i
                const isSelected = absIdx === props.selectedIndex
                const rowY = y + i

                if (isSelected) {
                    drawText(buffer, `${THEME.glyphs.selector} `, {
                        x,
                        y: rowY,
                        style: { fg: THEME.colors.brand },
                    })
                }

                // M21.2: rename edits the name in place; app.ts places the real terminal cursor
                if (isSelected && props.renameMode) {
                    drawText(buffer, props.renameValue || '', {
                        x: x + 2,
                        y: rowY,
                        maxWidth: Math.max(1, width - 2),
                        style: { fg: THEME.colors.text },
                    })
                    continue
                }

                const isConfirmDelete = session.id === props.confirmDeleteId
                const timeStr = formatSessionTimeAgo(session.updatedAt)
                const timeWidth = 12
                const maxTitleWidth = Math.max(10, width - 2 - timeWidth - 2)
                const confirmSuffix = ' [Delete? y/n]'
                const titleWidth = isConfirmDelete
                    ? Math.max(4, maxTitleWidth - confirmSuffix.length)
                    : maxTitleWidth

                const titleResult = drawText(buffer, getSessionDisplayTitle(session), {
                    x: x + 2,
                    y: rowY,
                    maxWidth: titleWidth,
                    ellipsis: true,
                    style: { fg: isSelected ? THEME.colors.brand : THEME.colors.text },
                })
                if (isConfirmDelete) {
                    drawInlineConfirm(buffer, {
                        x: titleResult.x,
                        y: rowY,
                        text: confirmSuffix,
                        tone: 'danger',
                    })
                }

                drawText(buffer, timeStr.padStart(timeWidth), {
                    x: x + width - timeWidth,
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
                        style: { fg: THEME.colors.dim },
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
