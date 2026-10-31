import { THEME } from '../../theme'
import { drawDivider, drawText } from '../ui'

import { MenuFooterView } from './menu-footer-view'

import type { DiffFileEntry } from '../../utils/diff'
import type { ScreenBuffer } from '../buffer'

export const DIFF_WINDOW_SIZE = 8

export interface DiffViewMenuViewProps {
    x?: number
    y: number
    width: number
    height: number
    files: DiffFileEntry[]
    selectedFileIndex: number
    windowStart: number
    isDetailView: boolean
    detailScrollOffset: number
}

export const DiffViewMenuView = {
    render(buffer: ScreenBuffer, props: DiffViewMenuViewProps): void {
        const x = (props.x ?? 0) + (THEME.padding.paddingLeft ?? 2)
        let y = props.y
        const width = props.width
        const files = props.files
        const windowSize = DIFF_WINDOW_SIZE

        if (files.length === 0) {
            drawText(buffer, 'Workspace Changes', {
                x,
                y,
                style: { fg: THEME.colors.text, bold: true },
            })
            y += 1
            drawDivider(buffer, {
                x: props.x ?? 0,
                y,
                width,
                char: '─',
                style: { fg: THEME.colors.border },
            })
            y += 2
            drawText(buffer, 'No changed files in workspace.', {
                x,
                y,
                style: { fg: THEME.colors.muted },
            })

            const footerY = props.y + props.height - 1
            MenuFooterView.render(buffer, {
                x: props.x ?? 0,
                y: footerY,
                width,
                items: [{ key: 'Esc', label: 'Close' }],
            })
            return
        }

        const safeIndex = Math.max(0, Math.min(props.selectedFileIndex, files.length - 1))
        const currentFile = files[safeIndex]

        if (!props.isDetailView) {
            // 1. Files List Mode
            drawText(buffer, `Workspace Changes (${files.length} changed files)`, {
                x,
                y,
                style: { fg: THEME.colors.text, bold: true },
            })
            y += 1
            drawDivider(buffer, {
                x: props.x ?? 0,
                y,
                width,
                char: '─',
                style: { fg: THEME.colors.border },
            })
            y += 1

            const windowStart = Math.max(
                0,
                Math.min(props.windowStart, Math.max(0, files.length - windowSize))
            )
            const windowEnd = Math.min(windowStart + windowSize, files.length)
            const visible = files.slice(windowStart, windowEnd)

            for (let i = 0; i < visible.length; i++) {
                const file = visible[i]
                const absIdx = windowStart + i
                const isSelected = absIdx === safeIndex
                const rowY = y + i

                // Selector indicator
                const selector = isSelected ? `${THEME.glyphs.selector} ` : '  '
                drawText(buffer, selector, {
                    x,
                    y: rowY,
                    style: { fg: isSelected ? THEME.colors.brand : THEME.colors.muted },
                })

                // Status badge: M, A, D, ?
                let badge = 'M'
                let badgeColor = THEME.colors.warning
                if (file.status === 'added' || file.status === 'untracked') {
                    badge = file.status === 'untracked' ? '?' : 'A'
                    badgeColor = THEME.colors.success
                } else if (file.status === 'deleted') {
                    badge = 'D'
                    badgeColor = THEME.colors.error
                }

                drawText(buffer, badge, {
                    x: x + 2,
                    y: rowY,
                    style: { fg: badgeColor, bold: true },
                })

                // File path
                drawText(buffer, file.path, {
                    x: x + 5,
                    y: rowY,
                    maxWidth: Math.max(10, width - x - 25),
                    style: {
                        fg: isSelected ? THEME.colors.brand : THEME.colors.text,
                        bold: isSelected,
                    },
                })

                // Stats: +X -Y
                const statsText = `+${file.additions} -${file.deletions}`
                const statsX = Math.max(x + 40, width - statsText.length - 4)
                drawText(buffer, `+${file.additions}`, {
                    x: statsX,
                    y: rowY,
                    style: { fg: THEME.colors.success },
                })
                drawText(buffer, ` -${file.deletions}`, {
                    x: statsX + `+${file.additions}`.length,
                    y: rowY,
                    style: { fg: THEME.colors.error },
                })
            }

            // Pagination overflow
            if (files.length > windowSize) {
                const itemsAbove = windowStart
                const itemsBelow = files.length - windowEnd
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

            // Footer
            const footerY = props.y + props.height - 1
            MenuFooterView.render(buffer, {
                x: props.x ?? 0,
                y: footerY,
                width,
                items: [
                    { key: '↑↓', label: 'Navigate' },
                    { key: 'Enter', label: 'View Diff' },
                    { key: 'Esc', label: 'Close' },
                ],
            })
        } else {
            // 2. Diff Detail Mode
            drawText(
                buffer,
                `Diff: ${currentFile.path} (+${currentFile.additions} -${currentFile.deletions})`,
                {
                    x,
                    y,
                    style: { fg: THEME.colors.brand, bold: true },
                }
            )
            y += 1
            drawDivider(buffer, {
                x: props.x ?? 0,
                y,
                width,
                char: '─',
                style: { fg: THEME.colors.border },
            })
            y += 1

            const rawDiffLines = (currentFile.diff || 'No diff content.').split('\n')
            const visibleDiffHeight = Math.max(2, props.height - 4)
            const maxScroll = Math.max(0, rawDiffLines.length - visibleDiffHeight)
            const scrollOffset = Math.min(props.detailScrollOffset, maxScroll)
            const visibleLines = rawDiffLines.slice(scrollOffset, scrollOffset + visibleDiffHeight)

            for (let i = 0; i < visibleLines.length; i++) {
                const line = visibleLines[i]
                const rowY = y + i
                let lineColor = THEME.colors.text
                if (line.startsWith('+') && !line.startsWith('+++')) {
                    lineColor = THEME.colors.success
                } else if (line.startsWith('-') && !line.startsWith('---')) {
                    lineColor = THEME.colors.error
                } else if (line.startsWith('@@')) {
                    lineColor = THEME.colors.brand
                } else {
                    lineColor = THEME.colors.muted
                }

                drawText(buffer, line, {
                    x,
                    y: rowY,
                    maxWidth: width - x - 2,
                    style: { fg: lineColor },
                })
            }

            // Footer
            const footerY = props.y + props.height - 1
            MenuFooterView.render(buffer, {
                x: props.x ?? 0,
                y: footerY,
                width,
                items: [
                    { key: '↑↓', label: 'Scroll' },
                    { key: 'Esc', label: 'Back to File List' },
                ],
            })
        }
    },
}
