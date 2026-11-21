import { THEME } from '../../theme'
import { drawText } from '../ui'

import { MenuFooterView } from './menu-footer-view'
import { drawPagerRow, drawPagerTitle } from './panel'

import type { ScreenBuffer } from '../buffer'

export interface AgentsFileViewItem {
    path: string
    content: string
}

export interface MemoryViewMenuViewProps {
    x?: number
    y: number
    width: number
    height?: number
    file?: AgentsFileViewItem | null
    cursorLineIndex?: number
    scrollOffset?: number
    isLoading?: boolean
    canGoBack?: boolean
}

export const MemoryViewMenuView = {
    getHeight(height = 14): number {
        return Math.max(10, height)
    },

    render(buffer: ScreenBuffer, props: MemoryViewMenuViewProps): void {
        const x = (props.x ?? 0) + (THEME.padding.paddingLeft ?? 2)
        let y = props.y
        const width = props.width
        const totalHeight = props.height ?? 14
        const footerY = props.y + totalHeight - 1

        const file = props.file
        const content = file?.content || ''
        const lines = content ? content.split('\n') : []

        // 1. Title row (M19.4): file path, line count as meta
        drawPagerTitle(buffer, {
            x,
            y,
            width: (props.x ?? 0) + width - (THEME.padding.paddingRight ?? 4) - x,
            title: file?.path || 'AGENTS.md',
            meta:
                lines.length > 0
                    ? `${lines.length} line${lines.length === 1 ? '' : 's'}`
                    : undefined,
        })
        y += 2

        // 2. Content viewport
        const contentHeight = Math.max(1, footerY - y - 1)

        if (props.isLoading) {
            drawText(buffer, 'Loading…', {
                x,
                y,
                style: { fg: THEME.colors.dim },
            })
        } else if (lines.length === 0) {
            drawText(buffer, 'No AGENTS.md found. Press [c] to create a starter AGENTS.md.', {
                x,
                y,
                style: { fg: THEME.colors.dim },
            })
        } else {
            const totalLines = lines.length
            const gutterWidth = Math.max(3, String(totalLines).length)
            const scrollOffset = Math.max(
                0,
                Math.min(props.scrollOffset ?? 0, Math.max(0, totalLines - contentHeight))
            )
            const cursorLine = props.cursorLineIndex ?? 0
            const visibleLines = lines.slice(scrollOffset, scrollOffset + contentHeight)

            for (let i = 0; i < visibleLines.length; i++) {
                const lineIndex = scrollOffset + i
                drawPagerRow(buffer, {
                    x,
                    y: y + i,
                    width: Math.max(10, width - x - 2),
                    lineNo: lineIndex + 1,
                    gutterWidth,
                    text: visibleLines[i] || '',
                    cursor: lineIndex === cursorLine,
                })
            }
        }

        // 3. Navigation footer
        const footerItems = [{ key: '↑/↓', label: 'scroll' }]
        if (!props.isLoading && lines.length === 0) {
            footerItems.push({ key: 'c', label: 'create AGENTS.md' })
        }
        footerItems.push({ key: 'esc', label: props.canGoBack ? 'back' : 'close' })

        MenuFooterView.render(buffer, {
            x: props.x ?? 0,
            y: footerY,
            width,
            items: footerItems,
        })
    },
}
