import { THEME } from '../../theme'
import { parseUnifiedDiffToRows, type DiffFileEntry, type DiffRow } from '../../utils/diff'
import { drawText } from '../ui'

import { MenuFooterView } from './menu-footer-view'

import type { ScreenBuffer } from '../buffer'

export const DIFF_WINDOW_SIZE = 7

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
    cursorLineIndex?: number
}

export const DiffViewMenuView = {
    getHeight(filesCount: number, windowSize = DIFF_WINDOW_SIZE): number {
        const count = filesCount || 1
        const visible = Math.min(windowSize, count)
        const hasOverflow = count > windowSize
        return 2 + visible + (hasOverflow ? 1 : 0) + 1 + 1
    },

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
                items: [{ key: 'esc', label: 'dismiss' }],
            })
            return
        }

        const safeIndex = Math.max(0, Math.min(props.selectedFileIndex, files.length - 1))
        const currentFile = files[safeIndex]

        if (!props.isDetailView) {
            // ==========================================
            // 1. FILES LIST MODE (MATCHING REACT)
            // ==========================================
            const totalAdditions = files.reduce((acc, f) => acc + (f.additions || 0), 0)
            const totalDeletions = files.reduce((acc, f) => acc + (f.deletions || 0), 0)
            const summaryText = `${files.length} file${files.length === 1 ? '' : 's'} (+${totalAdditions} -${totalDeletions})`

            drawText(buffer, 'Workspace Changes', {
                x,
                y,
                style: { fg: THEME.colors.text, bold: true },
            })
            if (files.length > 0) {
                drawText(buffer, ` · ${summaryText}`, {
                    x: x + 17,
                    y,
                    style: { fg: THEME.colors.muted },
                })
                const countLabel = `${safeIndex + 1}/${files.length}`
                const countX = Math.max(x + 40, width - countLabel.length - 4)
                drawText(buffer, countLabel, {
                    x: countX,
                    y,
                    style: { fg: THEME.colors.muted },
                })
            }
            y += 2

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

                // Selector indicator (No background highlight band)
                const selector = isSelected ? `${THEME.glyphs.selector} ` : '  '
                drawText(buffer, selector, {
                    x,
                    y: rowY,
                    style: {
                        fg: isSelected ? THEME.colors.brand : THEME.colors.muted,
                        bold: isSelected,
                    },
                })

                // File path (Clean display without artificial badges or ? marks)
                drawText(buffer, file.path, {
                    x: x + 2,
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
                if (file.additions > 0 || file.deletions > 0) {
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
                    { key: '↑/↓', label: 'navigate' },
                    { key: 'enter', label: 'view diff' },
                    { key: 'tab', label: 'insert context' },
                    { key: 'esc', label: 'dismiss' },
                ],
            })
        } else {
            // ==========================================
            // 2. DETAILED DIFF VIEW MODE (MATCHING REACT)
            // ==========================================
            const parsed = parseUnifiedDiffToRows(currentFile.diff || '')
            const diffRows: DiffRow[] = parsed.rows
            const changeBlocks = parsed.changeBlocks
            const cursorLine = props.cursorLineIndex ?? 0

            // Current change hunk under cursor
            const currentChangeUnderCursor = (() => {
                if (changeBlocks.length === 0) return '-'
                const insideIdx = changeBlocks.findIndex(
                    (b) => cursorLine >= b.startIndex && cursorLine <= b.endIndex
                )
                if (insideIdx >= 0) return `${insideIdx + 1}`
                let nearestBefore = -1
                for (let i = 0; i < changeBlocks.length; i++) {
                    const b = changeBlocks[i]
                    if (b && b.startIndex <= cursorLine) {
                        nearestBefore = i + 1
                    }
                }
                return nearestBefore > 0 ? `${nearestBefore}` : '1'
            })()

            // Header line: [path] +X -Y          change X/Y · file A/B
            drawText(buffer, currentFile.path, {
                x,
                y,
                style: { fg: THEME.colors.text, bold: true },
            })
            const statsOffset = x + currentFile.path.length + 2
            drawText(buffer, `+${currentFile.additions}`, {
                x: statsOffset,
                y,
                style: { fg: THEME.colors.success },
            })
            drawText(buffer, ` -${currentFile.deletions}`, {
                x: statsOffset + `+${currentFile.additions}`.length,
                y,
                style: { fg: THEME.colors.error },
            })

            const rightHeader = `change ${currentChangeUnderCursor}/${changeBlocks.length || 0} · file ${safeIndex + 1}/${files.length}`
            const rightHeaderX = Math.max(statsOffset + 15, width - rightHeader.length - 2)
            drawText(buffer, rightHeader, {
                x: rightHeaderX,
                y,
                style: { fg: THEME.colors.muted },
            })
            y += 2

            const visibleDiffHeight = Math.max(2, props.height - 4)
            const maxScroll = Math.max(0, diffRows.length - visibleDiffHeight)
            const scrollOffset = Math.min(props.detailScrollOffset, maxScroll)
            const visibleRows = diffRows.slice(scrollOffset, scrollOffset + visibleDiffHeight)

            for (let i = 0; i < visibleRows.length; i++) {
                const row = visibleRows[i]
                const rowY = y + i
                const isCursor = (props.cursorLineIndex ?? 0) === row.index

                if (row.type === 'fold') {
                    drawText(
                        buffer,
                        `   ↕ ${row.data.count} unchanged lines · ${row.data.preview}`,
                        {
                            x,
                            y: rowY,
                            maxWidth: width - x - 2,
                            style: { fg: THEME.colors.dim },
                        }
                    )
                    continue
                }

                const line = row.data
                const lineNum = line.type === 'delete' ? line.oldLineNumber : line.newLineNumber
                const paddedNum = lineNum ? String(lineNum).padStart(5, ' ') : '     '

                const sign = line.type === 'add' ? '+' : line.type === 'delete' ? '-' : ' '
                const signColor =
                    line.type === 'add'
                        ? THEME.colors.success
                        : line.type === 'delete'
                          ? THEME.colors.error
                          : THEME.colors.dim
                const textColor =
                    line.type === 'add'
                        ? THEME.colors.success
                        : line.type === 'delete'
                          ? THEME.colors.error
                          : THEME.colors.text
                const bgColor =
                    line.type === 'add'
                        ? THEME.colors.diffAddBg
                        : line.type === 'delete'
                          ? THEME.colors.diffDeleteBg
                          : undefined

                const rowBg = isCursor ? bgColor || THEME.colors.codespanBg : bgColor
                if (rowBg) {
                    const rowWidth = Math.max(10, width - x - 2)
                    for (let c = 0; c < rowWidth; c++) {
                        buffer.setChar(x + c, rowY, ' ', { bg: rowBg })
                    }
                }

                const cursorGlyph = isCursor ? `${THEME.glyphs.selector} ` : '  '
                drawText(buffer, cursorGlyph, {
                    x,
                    y: rowY,
                    style: { fg: isCursor ? THEME.colors.brand : THEME.colors.dim, bg: rowBg },
                })

                drawText(buffer, `${paddedNum} `, {
                    x: x + 2,
                    y: rowY,
                    style: {
                        fg: isCursor ? THEME.colors.brand : THEME.colors.dim,
                        bg: rowBg,
                        bold: isCursor,
                    },
                })

                drawText(buffer, `${sign} `, {
                    x: x + 8,
                    y: rowY,
                    style: { fg: signColor, bg: rowBg, bold: line.type !== 'context' || isCursor },
                })

                drawText(buffer, line.content, {
                    x: x + 10,
                    y: rowY,
                    maxWidth: width - x - 12,
                    style: { fg: textColor, bg: rowBg, bold: isCursor },
                })
            }

            // Footer
            const footerY = props.y + props.height - 1
            MenuFooterView.render(buffer, {
                x: props.x ?? 0,
                y: footerY,
                width,
                items: [
                    { key: '↑/↓', label: 'scroll' },
                    { key: 'p/n', label: 'hunk' },
                    { key: '←/→', label: 'cycle file' },
                    { key: 'enter', label: 'insert @file:line' },
                    { key: 'esc', label: 'back' },
                ],
            })
        }
    },
}
