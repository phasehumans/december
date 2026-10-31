import { getFilteredCommands } from '../../components/command-menu/filter-commands'
import { THEME } from '../../theme'
import { drawText } from '../ui'

import type { ScreenBuffer } from '../buffer'

export const WINDOW_SIZE = 5
export const CMD_COL_WIDTH = 28

export interface CommandMenuViewProps {
    x?: number
    y: number
    width: number
    query: string
    selectedIndex: number
    windowStart: number
    windowSize?: number
}

export const CommandMenuView = {
    getHeight(query: string, windowSize = WINDOW_SIZE): number {
        const filtered = getFilteredCommands(query)
        if (filtered.length === 0) return 1
        const visibleCount = Math.min(filtered.length, windowSize)
        const hasOverflow = filtered.length > windowSize
        return visibleCount + (hasOverflow ? 1 : 0)
    },

    getFiltered(query: string) {
        return getFilteredCommands(query)
    },

    render(buffer: ScreenBuffer, props: CommandMenuViewProps): void {
        const x = (props.x ?? 0) + (THEME.padding.paddingLeft ?? 2)
        const y = props.y
        const width = props.width
        const windowSize = props.windowSize ?? WINDOW_SIZE
        const filtered = getFilteredCommands(props.query)

        if (filtered.length === 0) {
            drawText(buffer, 'No matching commands', {
                x,
                y,
                style: { fg: THEME.colors.muted },
            })
            return
        }

        const windowStart = Math.max(
            0,
            Math.min(props.windowStart, Math.max(0, filtered.length - windowSize))
        )
        const windowEnd = Math.min(windowStart + windowSize, filtered.length)
        const visibleItems = filtered.slice(windowStart, windowEnd)

        const itemsAbove = windowStart
        const itemsBelow = filtered.length - windowEnd
        const hasOverflow = filtered.length > windowSize

        for (let i = 0; i < visibleItems.length; i++) {
            const cmd = visibleItems[i]
            const absIdx = windowStart + i
            const isSelected = absIdx === props.selectedIndex
            const rowY = y + i

            // 1. Selector glyph: ❭ or spaces
            const selectorGlyph = isSelected ? `${THEME.glyphs.selector} ` : '  '
            drawText(buffer, selectorGlyph, {
                x,
                y: rowY,
                style: {
                    fg: isSelected ? THEME.colors.brand : THEME.colors.muted,
                },
            })

            // 2. Command name: /<name>
            const cmdName = `/${cmd.name}`
            drawText(buffer, cmdName, {
                x: x + 2,
                y: rowY,
                maxWidth: CMD_COL_WIDTH,
                style: {
                    fg: isSelected ? THEME.colors.brand : THEME.colors.muted,
                },
            })

            // 3. Command description
            const descX = x + 2 + CMD_COL_WIDTH
            const maxDescWidth = Math.max(10, width - descX - 2)
            drawText(buffer, cmd.description, {
                x: descX,
                y: rowY,
                maxWidth: maxDescWidth,
                style: {
                    fg: isSelected ? THEME.colors.muted : THEME.colors.subtle,
                },
            })
        }

        // 4. Overflow pagination line
        if (hasOverflow) {
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
                    y: y + visibleItems.length,
                    style: { fg: THEME.colors.subtle },
                })
            }
        }
    },
}
