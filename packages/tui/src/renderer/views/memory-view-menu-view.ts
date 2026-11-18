import { THEME } from '../../theme'
import { drawText } from '../ui'

import { MenuFooterView } from './menu-footer-view'

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

        // 1. Header: file path and line count
        const filePath = file?.path || 'AGENTS.md'
        drawText(buffer, filePath, {
            x,
            y,
            style: { fg: THEME.colors.text, bold: true },
        })
        if (lines.length > 0) {
            drawText(buffer, ` · ${lines.length} line${lines.length === 1 ? '' : 's'}`, {
                x: x + filePath.length,
                y,
                style: { fg: THEME.colors.dim },
            })
        }
        y += 2

        // 2. Content viewport
        const contentHeight = Math.max(1, footerY - y - 1)

        if (props.isLoading) {
            drawText(buffer, 'Loading...', {
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
                const lineText = visibleLines[i] || ''
                const rowY = y + i
                const isCursor = lineIndex === cursorLine
                const rowBg = isCursor ? THEME.colors.codespanBg : undefined

                // Active cursor line highlight bar across the full row (matching FileViewMenuView)
                if (isCursor) {
                    const rowWidth = Math.max(10, width - x - 2)
                    for (let c = 0; c < rowWidth; c++) {
                        buffer.setChar(x + c, rowY, ' ', { bg: rowBg })
                    }
                }

                const selector = isCursor ? `${THEME.glyphs.selector} ` : '  '
                drawText(buffer, selector, {
                    x,
                    y: rowY,
                    style: {
                        fg: isCursor ? THEME.colors.brand : THEME.colors.muted,
                        bg: rowBg,
                        bold: isCursor,
                    },
                })

                const numStr = String(lineIndex + 1).padStart(gutterWidth, ' ')
                drawText(buffer, `${numStr} `, {
                    x: x + 2,
                    y: rowY,
                    style: {
                        fg: isCursor ? THEME.colors.brand : THEME.colors.dim,
                        bg: rowBg,
                        bold: isCursor,
                    },
                })

                const codeX = x + 2 + gutterWidth + 1
                drawText(buffer, lineText, {
                    x: codeX,
                    y: rowY,
                    maxWidth: Math.max(10, width - codeX - 4),
                    style: {
                        fg: isCursor ? THEME.colors.brand : THEME.colors.text,
                        bg: rowBg,
                        bold: isCursor,
                    },
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
