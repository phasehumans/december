import { THEME } from '../../theme'
import { groupCodeSearchResults } from '../../utils/code-search'
import { drawHighlightedText, drawText } from '../ui'

import { MenuFooterView } from './menu-footer-view'

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

        // Header Title
        drawText(buffer, 'Code Search', {
            x,
            y,
            style: { fg: THEME.colors.text, bold: true },
        })

        if (props.query) {
            const queryLabel =
                totalFiles > 1 && totalMatches !== totalFiles
                    ? ` · "${props.query}" (${totalMatches} matches in ${totalFiles} files)`
                    : ` · "${props.query}" (${totalMatches} match${totalMatches === 1 ? '' : 'es'})`
            drawText(buffer, queryLabel, {
                x: x + 11,
                y,
                style: { fg: THEME.colors.muted },
            })
        }

        if (totalFiles > 0) {
            const countLabel = `${props.selectedIndex + 1}/${totalFiles}`
            const countX = Math.max(x + 40, width - countLabel.length - 4)
            drawText(buffer, countLabel, {
                x: countX,
                y,
                style: { fg: THEME.colors.muted },
            })
        }
        y += 2 // Clean 1 empty line spacing matching React/Ink marginBottom={1}

        if (totalFiles === 0) {
            drawText(buffer, 'No matches found in workspace.', {
                x: x + 2,
                y,
                style: { fg: THEME.colors.dim },
            })
            y += 1
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

                // Selector indicator (clean like command menu)
                const selector = isSelected ? `${THEME.glyphs.selector} ` : '  '
                drawText(buffer, selector, {
                    x,
                    y: rowY,
                    style: {
                        fg: isSelected ? THEME.colors.brand : THEME.colors.dim,
                        bold: isSelected,
                    },
                })

                // File and match count (or file:line if 1 match)
                const fileStr =
                    group.matchCount > 1
                        ? `${group.file} (${group.matchCount} matches)`
                        : `${group.file}:${group.firstLine}`

                drawText(buffer, fileStr, {
                    x: x + 2,
                    y: rowY,
                    maxWidth: fileColWidth,
                    style: {
                        fg: isSelected ? THEME.colors.brand : THEME.colors.muted,
                        bold: isSelected,
                    },
                })

                // Content snippet with search query highlighted
                const snippetX = x + fileColWidth + 3
                const snippetMaxW = Math.max(10, width - snippetX - 2)
                drawHighlightedText(buffer, group.firstSnippet.trim(), props.query, {
                    x: snippetX,
                    y: rowY,
                    maxWidth: snippetMaxW,
                    normalStyle: {
                        fg: THEME.colors.text,
                        bold: isSelected,
                    },
                    highlightStyle: {
                        fg: THEME.colors.warning,
                        bold: true,
                    },
                })
            }
            y += visibleGroups.length

            // Overflow Indicator
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
                        style: { fg: THEME.colors.muted },
                    })
                    y += 1
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
