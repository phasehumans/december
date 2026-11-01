import { THEME } from '../../theme'
import { drawText } from '../ui'

import type { ScoredFile } from '../../utils/fuzzy'
import type { ScreenBuffer } from '../buffer'

export const FILE_WINDOW_SIZE = 5

export interface FileAutocompleteMenuViewProps {
    x?: number
    y: number
    width: number
    files: ScoredFile[]
    selectedIndex: number
    windowStart: number
    windowSize?: number
}

export const FileAutocompleteMenuView = {
    getHeight(filesCount: number, windowSize = FILE_WINDOW_SIZE): number {
        if (filesCount === 0) return 1
        const visibleCount = Math.min(filesCount, windowSize)
        const hasOverflow = filesCount > windowSize
        return visibleCount + (hasOverflow ? 1 : 0)
    },

    render(buffer: ScreenBuffer, props: FileAutocompleteMenuViewProps): void {
        const x = (props.x ?? 0) + THEME.padding.paddingLeft
        let y = props.y
        const windowSize = props.windowSize ?? FILE_WINDOW_SIZE

        const files = props.files || []
        if (files.length === 0) {
            drawText(buffer, 'No matching files found', {
                x: x + 2,
                y,
                style: { fg: THEME.colors.muted },
            })
            return
        }

        const windowStart = Math.max(
            0,
            Math.min(props.windowStart || 0, Math.max(0, files.length - windowSize))
        )
        const windowEnd = Math.min(windowStart + windowSize, files.length)
        const visible = files.slice(windowStart, windowEnd)

        for (let i = 0; i < visible.length; i++) {
            const file = visible[i]
            const absIdx = windowStart + i
            const isSelected = absIdx === props.selectedIndex
            const rowY = y + i

            // Selector indicator
            const selector = isSelected ? `${THEME.glyphs.selector} ` : '  '
            drawText(buffer, selector, {
                x,
                y: rowY,
                style: { fg: isSelected ? THEME.colors.brand : THEME.colors.muted },
            })

            let colX = x + 2
            const hasDir = file.dir && file.dir !== '.'
            if (hasDir) {
                const dirStr = `${file.dir}/`
                drawText(buffer, dirStr, {
                    x: colX,
                    y: rowY,
                    style: { fg: THEME.colors.muted },
                })
                colX += dirStr.length
            }

            // Render basename with match highlighting
            const basename = file.basename
            const matchIndices = new Set(file.basenameIndices || [])

            for (let c = 0; c < basename.length; c++) {
                const char = basename[c]
                const isMatch = matchIndices.has(c)
                drawText(buffer, char, {
                    x: colX + c,
                    y: rowY,
                    style: {
                        fg: isMatch
                            ? THEME.colors.brand
                            : isSelected
                              ? THEME.colors.brand
                              : THEME.colors.text,
                        bold: isSelected || isMatch,
                        underline: isMatch,
                    },
                })
            }
        }
        y += visible.length

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
                    y,
                    style: { fg: THEME.colors.subtle },
                })
            }
        }
    },
}
