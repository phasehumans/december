import { getFilteredCommands } from '../../commands/filter-commands'
import { THEME } from '../../theme'
import { drawText } from '../ui'

import { drawCommandRow, drawWindowOverflow } from './panel'

import type { ScreenBuffer } from '../buffer'

export const WINDOW_SIZE = 5
/** M1.2: the name column is 22 cells, so descriptions are not cut at 80 columns */
export const CMD_COL_WIDTH = 22

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

        // Clear command menu bounding box so zero chat or residual characters bleed through
        const height = this.getHeight(props.query, windowSize)
        buffer.clearArea(props.x ?? 0, y, width, height)

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
            drawCommandRow(buffer, {
                x,
                y: y + i,
                width: Math.max(0, width - x - 2),
                selected: windowStart + i === props.selectedIndex,
                name: `/${cmd.name}`,
                args: cmd.args,
                desc: cmd.description,
                nameWidth: CMD_COL_WIDTH,
            })
        }

        // "↑ N more · ↓ N more" under the last row
        if (hasOverflow) {
            drawWindowOverflow(buffer, x, y + visibleItems.length, itemsAbove, itemsBelow)
        }
    },
}
