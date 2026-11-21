import { areCellsEqual } from './cell'

import type { ScreenBuffer } from './buffer'
import type { Color } from './types'

/** A band of rows that moved up by `shift` rows since the last frame */
export interface ScrollMove {
    /** First screen row of the band (inclusive) */
    top: number
    /** Last screen row of the band (inclusive) */
    bottom: number
    shift: number
}

/** Largest shift tried: a frame rarely adds more lines than this while following output */
const MAX_SHIFT = 32
/** Fewer saved rows than this is not worth the extra escape sequences */
const MIN_SAVED_ROWS = 4

function mix(h: number, n: number): number {
    return Math.imul(h ^ n, 16777619)
}

function mixString(h: number, s: string): number {
    for (let i = 0; i < s.length; i++) h = mix(h, s.charCodeAt(i))
    return h
}

/** Theme colors are a small set of strings, so their hashes are computed once */
const stringColorHashes = new Map<string, number>()

function colorHash(color: Color | undefined): number {
    if (color === undefined) return 0
    if (typeof color === 'number') return mix(1, color)
    if (typeof color === 'string') {
        let h = stringColorHashes.get(color)
        if (h === undefined) {
            h = mixString(2, color)
            if (stringColorHashes.size < 4096) stringColorHashes.set(color, h)
        }
        return h
    }
    return mix(mix(mix(3, color.r), color.g), color.b)
}

/** One hash per row of the buffer: characters and styles. Equal rows hash equal. */
export function hashRows(buffer: ScreenBuffer): Int32Array {
    const hashes = new Int32Array(buffer.height)
    for (let y = 0; y < buffer.height; y++) {
        let h = 2166136261
        for (let x = 0; x < buffer.width; x++) {
            const cell = buffer.get(x, y)!
            const char = cell.char
            h = char.length === 1 ? mix(h, char.charCodeAt(0)) : mixString(h, char)
            h = mix(h, cell.width ?? 1)
            h = mix(h, colorHash(cell.fg))
            h = mix(h, colorHash(cell.bg))
            h = mix(
                h,
                (cell.bold ? 1 : 0) |
                    (cell.dim ? 2 : 0) |
                    (cell.italic ? 4 : 0) |
                    (cell.underline ? 8 : 0) |
                    (cell.inverse ? 16 : 0) |
                    (cell.strikethrough ? 32 : 0)
            )
        }
        hashes[y] = h
    }
    return hashes
}

function rowsEqual(a: ScreenBuffer, ya: number, b: ScreenBuffer, yb: number): boolean {
    for (let x = 0; x < a.width; x++) {
        if (!areCellsEqual(a.get(x, ya)!, b.get(x, yb)!)) return false
    }
    return true
}

/**
 * Finds the band of rows that scrolled up since the last frame, as when chat output grows
 * while the view follows the bottom. Moving the band with a terminal scroll, then drawing
 * only what is new, sends a few rows instead of the whole band.
 *
 * Returns null when no shift saves at least MIN_SAVED_ROWS rows of drawing.
 */
export function findScrollMove(
    front: ScreenBuffer,
    back: ScreenBuffer,
    frontHashes: Int32Array,
    backHashes: Int32Array
): ScrollMove | null {
    const height = Math.min(front.height, back.height, frontHashes.length, backHashes.length)
    if (front.width !== back.width || height < MIN_SAVED_ROWS + 1) return null

    let changed = 0
    for (let y = 0; y < height; y++) if (frontHashes[y] !== backHashes[y]) changed++
    if (changed < MIN_SAVED_ROWS) return null

    let best: { start: number; end: number; shift: number; saved: number } | null = null
    const maxShift = Math.min(MAX_SHIFT, height - 1)
    for (let shift = 1; shift <= maxShift; shift++) {
        // Longest run of back rows y with back[y] == front[y + shift], scored by the rows
        // it saves (rows that would otherwise be redrawn)
        let runStart = -1
        let saved = 0
        for (let y = 0; y <= height - shift; y++) {
            const matches = y < height - shift && backHashes[y] === frontHashes[y + shift]
            if (matches) {
                if (runStart < 0) {
                    runStart = y
                    saved = 0
                }
                if (backHashes[y] !== frontHashes[y]) saved++
            } else if (runStart >= 0) {
                if (saved > (best?.saved ?? MIN_SAVED_ROWS - 1)) {
                    best = { start: runStart, end: y - 1, shift, saved }
                }
                runStart = -1
            }
        }
    }
    if (!best) return null

    // Hashes can collide: confirm every moved row before trusting the move
    for (let y = best.start; y <= best.end; y++) {
        if (!rowsEqual(back, y, front, y + best.shift)) return null
    }
    return { top: best.start, bottom: best.end + best.shift, shift: best.shift }
}

/** Escape sequence that scrolls rows top..bottom up by `shift` and restores the full region */
export function scrollMoveSequence(move: ScrollMove): string {
    // Reset attributes first: lines scrolled in take the current background color
    return `\x1b[0m\x1b[${move.top + 1};${move.bottom + 1}r\x1b[${move.shift}S\x1b[r`
}
