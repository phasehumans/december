import {
    areCellsEqual,
    areStylesEqual,
    computeSgrTransition,
    extractStyle,
    hasActiveStyle,
} from './cell'

import type { ScreenBuffer } from './buffer'
import type { CellStyle, DiffOptions } from './types'

export function computeDiff(
    front: ScreenBuffer,
    back: ScreenBuffer,
    options?: DiffOptions
): string {
    let body = ''
    let cursorX = -1
    let cursorY = -1
    let activeStyle: CellStyle = {}

    const width = Math.min(front.width, back.width)
    const height = Math.min(front.height, back.height)
    const forceRedraw = Boolean(options?.forceFullRedraw)

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const backCell = back.get(x, y)
            if (!backCell) continue

            // Continuation cell of a preceding wide character: terminal cursor already advanced
            if (backCell.width === 0) {
                continue
            }

            const frontCell = front.get(x, y)

            // Skip cell if unchanged
            if (!forceRedraw && frontCell && areCellsEqual(frontCell, backCell)) {
                continue
            }

            // Move cursor to (x, y) if not already at the expected column on this row
            if (cursorX !== x || cursorY !== y) {
                body += `\x1b[${y + 1};${x + 1}H`
                cursorX = x
                cursorY = y
            }

            // Transition style if cell attributes or colors differ from active style
            const targetStyle = extractStyle(backCell)
            if (!areStylesEqual(activeStyle, targetStyle)) {
                const sgr = computeSgrTransition(activeStyle, targetStyle)
                if (sgr) {
                    body += sgr
                }
                activeStyle = targetStyle
            }

            // Emit character
            const char = backCell.char || ' '
            body += char

            // Advance virtual cursor position
            const cellWidth = backCell.width ?? 1
            cursorX += cellWidth

            // If cursor reached right boundary, invalidate so next row jumps explicitly
            if (cursorX >= width) {
                cursorX = -1
                cursorY = -1
            }
        }
    }

    // Reset style at end of frame if any active styles were applied
    if (hasActiveStyle(activeStyle)) {
        body += '\x1b[0m'
    }

    // Position cursor and set visibility if specified
    if (options?.cursor) {
        const cx = Math.max(0, Math.min(width - 1, options.cursor.x))
        const cy = Math.max(0, Math.min(height - 1, options.cursor.y))
        body += `\x1b[${cy + 1};${cx + 1}H`
        if (options.cursor.visible !== undefined) {
            body += options.cursor.visible ? '\x1b[?25h' : '\x1b[?25l'
        }
    }

    if (body.length === 0) {
        return ''
    }

    if (options?.synchronized) {
        return `\x1b[?2025h${body}\x1b[?2025l`
    }

    return body
}
