import { THEME } from '../../theme'
import { groupCodeSearchResults } from '../../utils/code-search'
import { middleEllipsis } from '../../utils/tool-kind'
import { drawHighlightedText, drawText } from '../ui'

import { MenuFooterView } from './menu-footer-view'
import { drawPanelTitle } from './panel'

import type { CodeSearchGroupItem, CodeSearchResultItem } from '../../types'
import type { ScreenBuffer } from '../buffer'

export const CODE_SEARCH_WINDOW_SIZE = 6

export interface CodeSearchMenuViewProps {
    x?: number
    y: number
    width: number
    height: number
    query: string
    results: CodeSearchResultItem[]
    groups?: CodeSearchGroupItem[]
    selectedIndex: number
    windowStart: number
    windowSize?: number
}

export const CodeSearchMenuView = {
    getHeight(resultsCount: number, windowSize = CODE_SEARCH_WINDOW_SIZE): number {
        const count = resultsCount || 1
        const visibleCount = Math.min(windowSize, count)
        const hasOverflow = count > windowSize
        // Title (1) + Top Margin (1) + Items (visibleCount) + Overflow (0|1) + Bottom Margin (1) + Footer (1)
        return 2 + visibleCount + (hasOverflow ? 1 : 0) + 1 + 1
    },

    render(buffer: ScreenBuffer, props: CodeSearchMenuViewProps): void {
        const paddingLeft = THEME.padding.paddingLeft ?? 2
        const x = (props.x ?? 0) + paddingLeft
        let y = props.y
        const width = props.width
        const windowSize = props.windowSize ?? CODE_SEARCH_WINDOW_SIZE
        const groups = props.groups || groupCodeSearchResults(props.results)
        const totalFiles = groups.length
        const totalMatches = groups.reduce((acc, g) => acc + g.matchCount, 0)

        // M18: title row with the query and counts as meta (no position counter, M18.2)
        const meta = props.query
            ? totalFiles > 1 && totalMatches !== totalFiles
                ? `"${props.query}" · ${totalMatches} matches in ${totalFiles} files`
                : `"${props.query}" · ${totalMatches} match${totalMatches === 1 ? '' : 'es'}`
            : undefined
        drawPanelTitle(buffer, {
            x,
            y,
            title: 'Code search',
            meta,
            width: Math.max(10, width - x - (THEME.padding.paddingRight ?? 4)),
        })
        y += 2

        if (totalFiles === 0) {
            drawText(buffer, 'No matches found in workspace.', {
                x: x + 2,
                y,
                style: { fg: THEME.colors.dim },
            })
        } else {
            const fileColWidth = Math.min(38, Math.max(24, Math.floor(width * 0.35)))
            const windowEnd = Math.min(props.windowStart + windowSize, totalFiles)
            const visibleGroups = groups.slice(props.windowStart, windowEnd)

            for (let i = 0; i < visibleGroups.length; i++) {
                const group = visibleGroups[i]
                if (!group) continue
                const absIdx = props.windowStart + i
                const isSelected = absIdx === props.selectedIndex
                const rowY = y + i

                if (isSelected) {
                    drawText(buffer, `${THEME.glyphs.selector} `, {
                        x,
                        y: rowY,
                        style: { fg: THEME.colors.brand },
                    })
                }

                // File and line number; long paths are shortened in the middle (S24)
                const lineTag = `:${group.firstLine}`
                const fileStr = `${middleEllipsis(group.file, Math.max(8, fileColWidth - lineTag.length))}${lineTag}`
                drawText(buffer, fileStr, {
                    x: x + 2,
                    y: rowY,
                    maxWidth: fileColWidth,
                    style: { fg: isSelected ? THEME.colors.brand : THEME.colors.text },
                })

                // Snippet in text color, the matches in brand blue (M18.1)
                const snippetX = x + fileColWidth + 3
                const snippetMaxW = Math.max(10, width - snippetX - 2)
                drawHighlightedText(buffer, group.firstSnippet.trim(), props.query, {
                    x: snippetX,
                    y: rowY,
                    maxWidth: snippetMaxW,
                    normalStyle: { fg: THEME.colors.text },
                    highlightStyle: { fg: THEME.colors.brand },
                })
            }
            y += visibleGroups.length

            const itemsAbove = props.windowStart
            const itemsBelow = totalFiles - windowEnd
            if (totalFiles > windowSize) {
                let overflowText = ''
                if (itemsAbove > 0 && itemsBelow > 0) {
                    overflowText = `↑ ${itemsAbove} more · ↓ ${itemsBelow} more`
                } else if (itemsAbove > 0) {
                    overflowText = `↑ ${itemsAbove} more`
                } else if (itemsBelow > 0) {
                    overflowText = `↓ ${itemsBelow} more`
                }
                if (overflowText) {
                    drawText(buffer, overflowText, {
                        x: x + 2,
                        y,
                        style: { fg: THEME.colors.dim },
                    })
                }
            }
        }

        // Branded Footer Navigation
        const footerY = props.y + props.height - 1
        const footerItems =
            totalFiles > 0
                ? [
                      { key: '↑/↓', label: 'navigate' },
                      { key: 'enter', label: 'view file' },
                      { key: 'tab', label: 'insert @file:line' },
                      { key: 'esc', label: 'dismiss' },
                  ]
                : [{ key: 'esc', label: 'dismiss' }]

        MenuFooterView.render(buffer, {
            x: props.x ?? 0,
            y: footerY,
            width,
            items: footerItems,
        })
    },
}
