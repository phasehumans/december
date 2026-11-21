import { THEME } from '../../theme'
import { drawHighlightedText, drawText } from '../ui'

import type { ScreenBuffer } from '../buffer'

/**
 * Shared drawing for menus and panels (menus spec, section G). Every panel starts with its
 * title row (no divider line above, G1), keeps today's brightness (G4) and footer (G8), and
 * draws confirms inline on the row (G10).
 */

let requestedCursor: { x: number; y: number } | null = null

/**
 * G11: a panel asks for the real terminal cursor at (x, y) while the user types in it.
 * The app places it after drawing the panel, so no panel draws a fake cursor.
 */
export function requestPanelCursor(x: number, y: number): void {
    requestedCursor = { x, y }
}

/** Returns and clears the cursor a panel asked for during this frame */
export function takePanelCursor(): { x: number; y: number } | null {
    const cursor = requestedCursor
    requestedCursor = null
    return cursor
}

/** G2: the title in bold text color, then meta in muted on the same row */
export function drawPanelTitle(
    buffer: ScreenBuffer,
    opts: { x: number; y: number; title: string; meta?: string; width?: number }
): void {
    drawText(buffer, opts.title, {
        x: opts.x,
        y: opts.y,
        maxWidth: opts.width,
        style: { fg: THEME.colors.text, bold: true },
    })
    if (opts.meta) {
        const metaX = opts.x + opts.title.length + 2
        drawText(buffer, opts.meta, {
            x: metaX,
            y: opts.y,
            maxWidth:
                opts.width !== undefined ? Math.max(0, opts.width - (metaX - opts.x)) : undefined,
            style: { fg: THEME.colors.muted },
        })
    }
}

export interface ListRowOptions {
    x: number
    y: number
    width: number
    selected: boolean
    label: string
    /** Column where the description starts, relative to x; defaults to right after the label */
    descColumn?: number
    desc?: string
    /** Right-aligned meta, ending at x + width */
    meta?: string
    metaColor?: string
    /** A word after the label, such as "current" (G5) */
    tag?: string
    /** A one-cell mark before the label, such as ✓ or ● */
    mark?: { char: string; color: string }
    labelColor?: string
}

/** G3, G4: the selected row is ❭ and label in brand blue; other labels in text color, side text muted */
export function drawListRow(buffer: ScreenBuffer, o: ListRowOptions): void {
    let cx = o.x
    drawText(buffer, o.selected ? `${THEME.glyphs.selector} ` : '  ', {
        x: cx,
        y: o.y,
        style: { fg: THEME.colors.brand },
    })
    cx += 2
    if (o.mark) {
        drawText(buffer, `${o.mark.char} `, { x: cx, y: o.y, style: { fg: o.mark.color } })
        cx += 2
    }
    const metaWidth = o.meta ? o.meta.length + 2 : 0
    const labelRoom = Math.max(4, o.width - (cx - o.x) - metaWidth)
    const label = o.label.length > labelRoom ? `${o.label.slice(0, labelRoom - 1)}…` : o.label
    drawText(buffer, label, {
        x: cx,
        y: o.y,
        style: { fg: o.selected ? THEME.colors.brand : (o.labelColor ?? THEME.colors.text) },
    })
    let after = cx + label.length
    if (o.tag) {
        drawText(buffer, `  ${o.tag}`, { x: after, y: o.y, style: { fg: THEME.colors.muted } })
        after += o.tag.length + 2
    }
    if (o.desc) {
        const descX =
            o.descColumn !== undefined ? Math.max(after + 2, o.x + o.descColumn) : after + 2
        const room = Math.max(0, o.x + o.width - descX - metaWidth)
        if (room > 3) {
            drawText(buffer, o.desc.length > room ? `${o.desc.slice(0, room - 1)}…` : o.desc, {
                x: descX,
                y: o.y,
                style: { fg: THEME.colors.muted },
            })
        }
    }
    if (o.meta) {
        drawText(buffer, o.meta, {
            x: Math.max(after + 2, o.x + o.width - o.meta.length),
            y: o.y,
            style: { fg: o.metaColor ?? THEME.colors.muted },
        })
    }
}

/** G6: ✓ in accent for on, ○ dim for off */
export function toggleMark(on: boolean): { char: string; color: string } {
    return on ? { char: '✓', color: THEME.colors.brand } : { char: '○', color: THEME.colors.dim }
}

/** G7: running is a steady accent dot, done dim, failed red, connected green. No blinking. */
export function statusMark(status: 'running' | 'done' | 'failed' | 'connected' | 'off'): {
    char: string
    color: string
} {
    const color =
        status === 'running'
            ? THEME.colors.brand
            : status === 'failed'
              ? THEME.colors.error
              : status === 'connected'
                ? THEME.colors.success
                : THEME.colors.dim
    return { char: THEME.glyphs.status, color }
}

/** G13: "↓ N more" in dim, lined up with the labels */
export function drawOverflow(buffer: ScreenBuffer, x: number, y: number, count: number): void {
    if (count <= 0) return
    drawText(buffer, `↓ ${count} more`, { x: x + 2, y, style: { fg: THEME.colors.dim } })
}

/**
 * G11: today's filter row ("Search: [/ to filter]", "Filter: [/ to search]"), with no bold.
 * While typing, the query is in brand blue. Returns where the terminal cursor goes.
 */
export function drawFilterRow(
    buffer: ScreenBuffer,
    o: {
        x: number
        y: number
        label: string
        hint: string
        query: string
        active: boolean
        width: number
    }
): { cursorX: number } {
    drawText(buffer, o.label, {
        x: o.x,
        y: o.y,
        style: { fg: o.active ? THEME.colors.brand : THEME.colors.muted },
    })
    const qx = o.x + o.label.length
    if (o.active || o.query) {
        drawText(buffer, o.query, {
            x: qx,
            y: o.y,
            maxWidth: Math.max(0, o.width - o.label.length - 1),
            style: { fg: THEME.colors.brand },
        })
        return { cursorX: qx + o.query.length }
    }
    drawText(buffer, o.hint, { x: qx, y: o.y, style: { fg: THEME.colors.dim } })
    return { cursorX: qx }
}

/** G10: an inline yes/no confirm after the row, as today, with no bold */
export function drawInlineConfirm(
    buffer: ScreenBuffer,
    o: { x: number; y: number; text: string; tone: 'danger' | 'warning' }
): void {
    drawText(buffer, o.text, {
        x: o.x,
        y: o.y,
        style: { fg: o.tone === 'danger' ? THEME.colors.error : THEME.colors.warning },
    })
}

/** G12: one sentence in dim for loading and empty states, with a one-cell ellipsis */
export function drawEmpty(
    buffer: ScreenBuffer,
    x: number,
    y: number,
    text: string,
    width?: number
): void {
    drawText(buffer, text, { x, y, maxWidth: width, style: { fg: THEME.colors.dim } })
}

/** G17: label in muted, value in text color, values lined up in one column */
export function drawLabelValue(
    buffer: ScreenBuffer,
    o: {
        x: number
        y: number
        label: string
        value: string
        labelWidth: number
        width?: number
        valueColor?: string
    }
): void {
    drawText(buffer, o.label, { x: o.x, y: o.y, style: { fg: THEME.colors.muted } })
    drawText(buffer, o.value, {
        x: o.x + o.labelWidth,
        y: o.y,
        maxWidth: o.width !== undefined ? Math.max(0, o.width - o.labelWidth) : undefined,
        style: { fg: o.valueColor ?? THEME.colors.text },
    })
}

/** G14: the active tab in brand blue, other tabs in muted, 3 spaces apart, no bold */
export function drawTabs(
    buffer: ScreenBuffer,
    o: { x: number; y: number; tabs: string[]; active: number }
): number {
    let cx = o.x
    o.tabs.forEach((tab, i) => {
        if (i > 0) cx += 3
        drawText(buffer, tab, {
            x: cx,
            y: o.y,
            style: { fg: i === o.active ? THEME.colors.brand : THEME.colors.muted },
        })
        cx += tab.length
    })
    return cx
}

/** "2m 03s", the chat's duration format */
export function formatPanelDuration(ms: number): string {
    const s = Math.max(0, Math.floor(ms / 1000))
    if (s < 60) return `${s}s`
    if (s < 3600) return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`
    return `${Math.floor(s / 3600)}h ${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}m`
}

export interface MetaPart {
    text: string
    color: string
}

/** total width of a right-hand meta made of parts */
export function metaPartsWidth(parts: MetaPart[]): number {
    return parts.reduce((n, p) => n + p.text.length, 0)
}

/**
 * G5: a right-aligned meta made of colored parts that ends at column `right`, such as a red
 * fault word followed by muted words. Returns the column where the meta starts.
 */
export function drawMetaParts(
    buffer: ScreenBuffer,
    o: { right: number; y: number; parts: MetaPart[]; minX?: number }
): number {
    const start = Math.max(o.minX ?? 0, o.right - metaPartsWidth(o.parts))
    let cx = start
    for (const part of o.parts) {
        if (cx >= o.right) break
        drawText(buffer, part.text, {
            x: cx,
            y: o.y,
            maxWidth: Math.max(0, o.right - cx),
            style: { fg: part.color },
        })
        cx += part.text.length
    }
    return start
}

/**
 * M1, M3: one slash command row. The name column is `nameWidth` cells wide. The name is in
 * text color (brand on the selected row), the argument hint in muted after it, and the
 * description in muted (text color on the selected row). No bold.
 */
export function drawCommandRow(
    buffer: ScreenBuffer,
    o: {
        x: number
        y: number
        width: number
        selected: boolean
        name: string
        args?: string
        desc: string
        nameWidth?: number
    }
): void {
    const nameWidth = o.nameWidth ?? 22
    drawText(buffer, o.selected ? `${THEME.glyphs.selector} ` : '  ', {
        x: o.x,
        y: o.y,
        style: { fg: THEME.colors.brand },
    })
    const nameX = o.x + 2
    const room = nameWidth - 1
    const name = o.name.length > room ? `${o.name.slice(0, Math.max(1, room - 1))}…` : o.name
    drawText(buffer, name, {
        x: nameX,
        y: o.y,
        style: { fg: o.selected ? THEME.colors.brand : THEME.colors.text },
    })
    if (o.args && name.length + 1 < room) {
        const argRoom = room - name.length - 1
        const args =
            o.args.length > argRoom ? `${o.args.slice(0, Math.max(1, argRoom - 1))}…` : o.args
        drawText(buffer, args, {
            x: nameX + name.length + 1,
            y: o.y,
            style: { fg: THEME.colors.muted },
        })
    }
    const descX = nameX + nameWidth
    const descRoom = o.x + o.width - descX
    if (descRoom > 3 && o.desc) {
        drawText(buffer, o.desc, {
            x: descX,
            y: o.y,
            maxWidth: descRoom,
            ellipsis: true,
            style: { fg: o.selected ? THEME.colors.text : THEME.colors.muted },
        })
    }
}

/** "↑ N more · ↓ N more" for a scrolled window, in dim, lined up with the labels */
export function drawWindowOverflow(
    buffer: ScreenBuffer,
    x: number,
    y: number,
    above: number,
    below: number
): void {
    const parts: string[] = []
    if (above > 0) parts.push(`↑ ${above} more`)
    if (below > 0) parts.push(`↓ ${below} more`)
    if (parts.length === 0) return
    drawText(buffer, parts.join(' · '), { x: x + 2, y, style: { fg: THEME.colors.dim } })
}

/**
 * G15: one pager row for file view, /memory and /skills. The cursor row has a surface band and
 * the line number in brand blue, all in regular weight. Code stays in text color; matches of
 * `query` are in brand blue.
 */
export function drawPagerRow(
    buffer: ScreenBuffer,
    o: {
        x: number
        y: number
        /** Row width from x; the cursor band covers it */
        width: number
        lineNo: number
        gutterWidth: number
        text: string
        cursor: boolean
        query?: string
    }
): void {
    const bg = o.cursor ? THEME.colors.surface : undefined
    if (bg) {
        for (let c = 0; c < o.width; c++) buffer.setChar(o.x + c, o.y, ' ', { bg })
    }
    if (o.cursor) {
        drawText(buffer, `${THEME.glyphs.selector} `, {
            x: o.x,
            y: o.y,
            style: { fg: THEME.colors.brand, bg },
        })
    }
    drawText(buffer, `${String(o.lineNo).padStart(o.gutterWidth, ' ')} `, {
        x: o.x + 2,
        y: o.y,
        style: { fg: o.cursor ? THEME.colors.brand : THEME.colors.dim, bg },
    })
    const codeX = o.x + 2 + o.gutterWidth + 1
    const maxWidth = Math.max(1, o.width - (codeX - o.x) - 1)
    if (!o.text) return
    if (o.query && o.query.trim()) {
        drawHighlightedText(buffer, o.text, o.query, {
            x: codeX,
            y: o.y,
            maxWidth,
            normalStyle: { fg: THEME.colors.text, bg },
            highlightStyle: { fg: THEME.colors.brand, bg },
        })
        return
    }
    drawText(buffer, o.text, { x: codeX, y: o.y, maxWidth, style: { fg: THEME.colors.text, bg } })
}

/** A pager title row (G2, M19.4): bold title, muted meta, and a muted position at the right end */
export function drawPagerTitle(
    buffer: ScreenBuffer,
    o: { x: number; y: number; width: number; title: string; meta?: string; right?: string }
): void {
    const rightRoom = o.right ? o.right.length + 2 : 0
    const room = Math.max(4, o.width - rightRoom)
    const title = o.title.length > room ? `${o.title.slice(0, room - 1)}…` : o.title
    drawPanelTitle(buffer, { x: o.x, y: o.y, title, meta: o.meta, width: room })
    if (o.right) {
        drawText(buffer, o.right, {
            x: Math.max(o.x + title.length + 2, o.x + o.width - o.right.length),
            y: o.y,
            style: { fg: THEME.colors.muted },
        })
    }
}
