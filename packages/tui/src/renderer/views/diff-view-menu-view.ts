import { THEME } from '../../theme'
import { parseUnifiedDiffToRows, type DiffFileEntry, type DiffRow } from '../../utils/diff'
import { middleEllipsis } from '../../utils/tool-kind'
import { drawText } from '../ui'

import { MenuFooterView } from './menu-footer-view'
import { formatDiffRow } from './message-line-cache'
import { drawPanelTitle } from './panel'

import type { ScreenBuffer } from '../buffer'

export const DIFF_WINDOW_SIZE = 7

/** Which changes /diff shows: since the session's first turn, or every git change (#618) */
export type DiffScope = 'session' | 'all'

const SCOPE_LABEL: Record<DiffScope, string> = {
    session: 'this session',
    all: 'all changes',
}

export interface DiffViewMenuViewProps {
    x?: number
    y: number
    width: number
    height: number
    files: DiffFileEntry[]
    /** The view shown; the title row names it and `s` switches to the other one */
    scope?: DiffScope
    isLoading?: boolean
    selectedFileIndex: number
    windowStart: number
    isDetailView: boolean
    detailScrollOffset: number
    cursorLineIndex?: number
    isFullFile?: boolean
    fullContent?: string | null
}

/** "+12 -4" parts; a zero count is not shown (M16.1) */
function countParts(additions: number, deletions: number): { text: string; color: string }[] {
    const parts: { text: string; color: string }[] = []
    if (additions > 0) parts.push({ text: `+${additions}`, color: THEME.colors.success })
    if (deletions > 0) parts.push({ text: `-${deletions}`, color: THEME.colors.error })
    return parts
}

/** Draws "+12 -4" from x and returns the x after it */
function drawCounts(
    buffer: ScreenBuffer,
    x: number,
    y: number,
    parts: { text: string; color: string }[]
): number {
    let cx = x
    parts.forEach((part, i) => {
        if (i > 0) cx += 1
        drawText(buffer, part.text, { x: cx, y, style: { fg: part.color } })
        cx += part.text.length
    })
    return cx
}

function countsWidth(parts: { text: string }[]): number {
    return parts.reduce((sum, p, i) => sum + p.text.length + (i > 0 ? 1 : 0), 0)
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
        /** Right edge of the panel content, as in the other panels */
        const rightEdge = (props.x ?? 0) + width - (THEME.padding.paddingRight ?? 4)
        const files = props.files
        const windowSize = DIFF_WINDOW_SIZE
        const footerY = props.y + props.height - 1

        const scope = props.scope
        const scopeLabel = scope ? SCOPE_LABEL[scope] : undefined
        /** `s` names the view it switches to, as `f` does in the diff (full file / compact) */
        const scopeKey =
            scope && !props.isLoading
                ? [{ key: 's', label: SCOPE_LABEL[scope === 'session' ? 'all' : 'session'] }]
                : []

        if (files.length === 0) {
            drawPanelTitle(buffer, { x, y, title: 'Changes', meta: scopeLabel })
            y += 2
            const emptyText = props.isLoading
                ? 'Loading changes…'
                : scope === 'session'
                  ? 'No changes in this session.'
                  : 'No changed files in workspace.'
            drawText(buffer, emptyText, {
                x,
                y,
                style: { fg: THEME.colors.muted },
            })
            MenuFooterView.render(buffer, {
                x: props.x ?? 0,
                y: footerY,
                width,
                items: [...scopeKey, { key: 'esc', label: 'dismiss' }],
            })
            return
        }

        const safeIndex = Math.max(0, Math.min(props.selectedFileIndex, files.length - 1))
        const currentFile = files[safeIndex]!

        if (!props.isDetailView) {
            // M16: the list of changed files
            const totalAdditions = files.reduce((acc, f) => acc + (f.additions || 0), 0)
            const totalDeletions = files.reduce((acc, f) => acc + (f.deletions || 0), 0)
            const filesText = `${files.length} file${files.length === 1 ? '' : 's'}`
            // Title row: Changes  this session · 2 files +4 -1
            const meta = scopeLabel ? `${scopeLabel} · ${filesText}` : filesText

            drawPanelTitle(buffer, { x, y, title: 'Changes', meta })
            drawCounts(
                buffer,
                x + 'Changes'.length + 2 + meta.length + 1,
                y,
                countParts(totalAdditions, totalDeletions)
            )
            y += 2

            const windowStart = Math.max(
                0,
                Math.min(props.windowStart, Math.max(0, files.length - windowSize))
            )
            const windowEnd = Math.min(windowStart + windowSize, files.length)
            const visible = files.slice(windowStart, windowEnd)

            for (let i = 0; i < visible.length; i++) {
                const file = visible[i]!
                const isSelected = windowStart + i === safeIndex
                const rowY = y + i

                // Counts end at the right edge; "-N" keeps its column when only additions show
                const adds = file.additions > 0 ? `+${file.additions}` : ''
                const dels = file.deletions > 0 ? `-${file.deletions}` : ''
                const delSlot = dels || (adds ? ' '.repeat(`-${file.deletions}`.length) : '')
                const stats = adds && delSlot ? `${adds} ${delSlot}` : adds || delSlot
                const statsX = rightEdge - stats.length
                if (adds) {
                    drawText(buffer, adds, {
                        x: statsX,
                        y: rowY,
                        style: { fg: THEME.colors.success },
                    })
                }
                if (dels) {
                    drawText(buffer, dels, {
                        x: statsX + (adds ? adds.length + 1 : 0),
                        y: rowY,
                        style: { fg: THEME.colors.error },
                    })
                }

                if (isSelected) {
                    drawText(buffer, `${THEME.glyphs.selector} `, {
                        x,
                        y: rowY,
                        style: { fg: THEME.colors.brand },
                    })
                }
                const pathRoom = Math.max(10, statsX - (x + 2) - 2)
                drawText(buffer, middleEllipsis(file.path, pathRoom), {
                    x: x + 2,
                    y: rowY,
                    maxWidth: pathRoom,
                    style: { fg: isSelected ? THEME.colors.brand : THEME.colors.text },
                })
            }

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
                        style: { fg: THEME.colors.dim },
                    })
                }
            }

            MenuFooterView.render(buffer, {
                x: props.x ?? 0,
                y: footerY,
                width,
                items: [
                    { key: '↑/↓', label: 'navigate' },
                    { key: 'enter', label: 'view diff' },
                    { key: 'tab', label: 'insert context' },
                    ...scopeKey,
                    { key: 'esc', label: 'dismiss' },
                ],
            })
            return
        }

        // M17: the diff of one file, full screen. Rows are the chat's diff rows (formatDiffRow).
        const parsed = parseUnifiedDiffToRows(currentFile.diff || '', {
            fullContent: props.fullContent,
            expandAllFolds: props.isFullFile,
        })
        const diffRows: DiffRow[] = parsed.rows
        const changeBlocks = parsed.changeBlocks
        const cursorLine = props.cursorLineIndex ?? 0

        const currentChange = (() => {
            if (changeBlocks.length === 0) return '-'
            const insideIdx = changeBlocks.findIndex(
                (b) => cursorLine >= b.startIndex && cursorLine <= b.endIndex
            )
            if (insideIdx >= 0) return `${insideIdx + 1}`
            let nearestBefore = -1
            for (let i = 0; i < changeBlocks.length; i++) {
                const b = changeBlocks[i]
                if (b && b.startIndex <= cursorLine) nearestBefore = i + 1
            }
            return nearestBefore > 0 ? `${nearestBefore}` : '1'
        })()

        // Title row: path  +12 -4 · full file              change 1/3 · file 1/3
        const rightHeader = `change ${currentChange}/${changeBlocks.length || 0} · file ${safeIndex + 1}/${files.length}`
        const counts = countParts(currentFile.additions, currentFile.deletions)
        const fullTag = props.isFullFile ? ' · full file' : ''
        const pathRoom = Math.max(
            10,
            rightEdge - x - rightHeader.length - 2 - countsWidth(counts) - 2 - fullTag.length
        )
        const shownPath = middleEllipsis(currentFile.path, pathRoom)
        drawPanelTitle(buffer, { x, y, title: shownPath, width: pathRoom })
        let headX = drawCounts(buffer, x + shownPath.length + 2, y, counts)
        if (fullTag) {
            drawText(buffer, fullTag, { x: headX, y, style: { fg: THEME.colors.brand } })
            headX += fullTag.length
        }
        drawText(buffer, rightHeader, {
            x: Math.max(headX + 2, rightEdge - rightHeader.length),
            y,
            style: { fg: THEME.colors.muted },
        })
        y += 2

        const visibleDiffHeight = Math.max(2, props.height - 4)
        const maxScroll = Math.max(0, diffRows.length - visibleDiffHeight)
        const scrollOffset = Math.min(props.detailScrollOffset, maxScroll)
        const visibleRows = diffRows.slice(scrollOffset, scrollOffset + visibleDiffHeight)
        // The diff row starts after the 2-cell selector slot and ends at the right edge
        const rowX = x + 2
        const rowWidth = Math.max(12, rightEdge - rowX + 1)

        for (let i = 0; i < visibleRows.length; i++) {
            const row = visibleRows[i]!
            const rowY = y + i
            const isCursor = cursorLine === row.index

            if (row.type === 'fold') {
                drawText(buffer, `   ↕ ${row.data.count} unchanged lines · ${row.data.preview}`, {
                    x,
                    y: rowY,
                    maxWidth: Math.max(10, rightEdge - x),
                    style: { fg: THEME.colors.dim },
                })
                continue
            }

            const line = row.data
            const lineNo = line.type === 'delete' ? line.oldLineNumber : line.newLineNumber
            const segments = formatDiffRow(line.type, line.content, rowWidth, lineNo)

            // G15: the cursor row gets the surface band (an add/delete row keeps its tint),
            // the line number in brand, and the code in text color, all regular weight
            const tint = segments[0]?.style?.bg
            const bg = isCursor ? (tint ?? THEME.colors.surface) : tint
            if (isCursor) {
                for (let c = 0; c < rowWidth - 1 + 2; c++) {
                    buffer.setChar(x + c, rowY, ' ', { bg })
                }
                drawText(buffer, `${THEME.glyphs.selector} `, {
                    x,
                    y: rowY,
                    style: { fg: THEME.colors.brand, bg },
                })
            }

            let cx = rowX
            segments.forEach((segment, s) => {
                const style = { ...segment.style, bg }
                if (isCursor && s === 0) style.fg = THEME.colors.brand
                // Code stays in text color, context lines too, at today's brightness (M17)
                if (s === 2) style.fg = THEME.colors.text
                buffer.write(cx, rowY, segment.text, style)
                cx += segment.text.length
            })
        }

        MenuFooterView.render(buffer, {
            x: props.x ?? 0,
            y: footerY,
            width,
            items: [
                { key: '↑/↓', label: 'scroll' },
                { key: 'p/n', label: 'change' },
                { key: 'f', label: props.isFullFile ? 'compact' : 'full file' },
                { key: '←/→', label: 'cycle file' },
                { key: 'enter', label: 'insert @file:line' },
                { key: 'esc', label: 'back' },
            ],
        })
    },
}
