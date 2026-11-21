import { areColorsEqual, colorToSgr } from './color'

import type { Cell, CellStyle } from './types'

export const EMPTY_CELL: Readonly<Cell> = Object.freeze({
    char: ' ',
    width: 1,
})

export function createCell(char = ' ', style?: CellStyle): Cell {
    const width = getCharWidth(char)
    if (!style) {
        return { char, width }
    }

    return {
        char,
        width,
        fg: style.fg,
        bg: style.bg,
        bold: style.bold,
        dim: style.dim,
        italic: style.italic,
        underline: style.underline,
        inverse: style.inverse,
        strikethrough: style.strikethrough,
    }
}

export function cloneCell(cell: Cell): Cell {
    return {
        char: cell.char,
        width: cell.width,
        fg: cell.fg,
        bg: cell.bg,
        bold: cell.bold,
        dim: cell.dim,
        italic: cell.italic,
        underline: cell.underline,
        inverse: cell.inverse,
        strikethrough: cell.strikethrough,
    }
}

export function resetCell(target: Cell, char = ' ', style?: CellStyle): void {
    target.char = char
    target.width = getCharWidth(char)
    target.fg = style?.fg
    target.bg = style?.bg
    target.bold = style?.bold
    target.dim = style?.dim
    target.italic = style?.italic
    target.underline = style?.underline
    target.inverse = style?.inverse
    target.strikethrough = style?.strikethrough
}

export function copyCell(dest: Cell, src: Cell): void {
    dest.char = src.char
    dest.width = src.width
    dest.fg = src.fg
    dest.bg = src.bg
    dest.bold = src.bold
    dest.dim = src.dim
    dest.italic = src.italic
    dest.underline = src.underline
    dest.inverse = src.inverse
    dest.strikethrough = src.strikethrough
}

export function areCellsEqual(a: Cell, b: Cell): boolean {
    if (a === b) return true
    if (a.char !== b.char) return false
    if ((a.width ?? 1) !== (b.width ?? 1)) return false

    if (!areColorsEqual(a.fg, b.fg)) return false
    if (!areColorsEqual(a.bg, b.bg)) return false

    if (Boolean(a.bold) !== Boolean(b.bold)) return false
    if (Boolean(a.dim) !== Boolean(b.dim)) return false
    if (Boolean(a.italic) !== Boolean(b.italic)) return false
    if (Boolean(a.underline) !== Boolean(b.underline)) return false
    if (Boolean(a.inverse) !== Boolean(b.inverse)) return false
    if (Boolean(a.strikethrough) !== Boolean(b.strikethrough)) return false

    return true
}

export function areStylesEqual(a: CellStyle, b: CellStyle): boolean {
    if (a === b) return true
    if (!areColorsEqual(a.fg, b.fg)) return false
    if (!areColorsEqual(a.bg, b.bg)) return false

    if (Boolean(a.bold) !== Boolean(b.bold)) return false
    if (Boolean(a.dim) !== Boolean(b.dim)) return false
    if (Boolean(a.italic) !== Boolean(b.italic)) return false
    if (Boolean(a.underline) !== Boolean(b.underline)) return false
    if (Boolean(a.inverse) !== Boolean(b.inverse)) return false
    if (Boolean(a.strikethrough) !== Boolean(b.strikethrough)) return false

    return true
}

export function extractStyle(cell: Cell): CellStyle {
    return {
        fg: cell.fg,
        bg: cell.bg,
        bold: cell.bold,
        dim: cell.dim,
        italic: cell.italic,
        underline: cell.underline,
        inverse: cell.inverse,
        strikethrough: cell.strikethrough,
    }
}

export function hasActiveStyle(style: CellStyle): boolean {
    return Boolean(
        style.fg !== undefined ||
        style.bg !== undefined ||
        style.bold ||
        style.dim ||
        style.italic ||
        style.underline ||
        style.inverse ||
        style.strikethrough
    )
}

function getStyleCodes(style: CellStyle): string[] {
    const codes: string[] = []
    if (style.bold) codes.push('1')
    if (style.dim) codes.push('2')
    if (style.italic) codes.push('3')
    if (style.underline) codes.push('4')
    if (style.inverse) codes.push('7')
    if (style.strikethrough) codes.push('9')
    if (style.fg !== undefined) codes.push(colorToSgr(style.fg, false))
    if (style.bg !== undefined) codes.push(colorToSgr(style.bg, true))
    return codes
}

export function computeSgrTransition(from: CellStyle, to: CellStyle): string {
    if (areStylesEqual(from, to)) {
        return ''
    }

    const toActive = hasActiveStyle(to)
    const fromActive = hasActiveStyle(from)

    // Transitioning from active styles to completely clean/default style
    if (!toActive) {
        return fromActive ? '\x1b[0m' : ''
    }

    // Direct reset + enable candidate
    const fullToCodes = getStyleCodes(to)
    const resetSeq = fullToCodes.length > 0 ? `\x1b[0;${fullToCodes.join(';')}m` : '\x1b[0m'

    if (!fromActive) {
        return `\x1b[${fullToCodes.join(';')}m`
    }

    // Delta candidate: only emit modifications
    const deltaCodes: string[] = []

    const needsClearIntensity = (from.bold && !to.bold) || (from.dim && !to.dim)

    if (needsClearIntensity) {
        deltaCodes.push('22')
        if (to.bold) deltaCodes.push('1')
        if (to.dim) deltaCodes.push('2')
    } else {
        if (!from.bold && to.bold) deltaCodes.push('1')
        if (!from.dim && to.dim) deltaCodes.push('2')
    }

    if (from.italic && !to.italic) deltaCodes.push('23')
    if (!from.italic && to.italic) deltaCodes.push('3')

    if (from.underline && !to.underline) deltaCodes.push('24')
    if (!from.underline && to.underline) deltaCodes.push('4')

    if (from.inverse && !to.inverse) deltaCodes.push('27')
    if (!from.inverse && to.inverse) deltaCodes.push('7')

    if (from.strikethrough && !to.strikethrough) deltaCodes.push('29')
    if (!from.strikethrough && to.strikethrough) deltaCodes.push('9')

    if (!areColorsEqual(from.fg, to.fg)) {
        deltaCodes.push(colorToSgr(to.fg, false))
    }

    if (!areColorsEqual(from.bg, to.bg)) {
        deltaCodes.push(colorToSgr(to.bg, true))
    }

    if (deltaCodes.length === 0) {
        return ''
    }

    const deltaSeq = `\x1b[${deltaCodes.join(';')}m`

    // Pick strictly minimal sequence
    return deltaSeq.length <= resetSeq.length ? deltaSeq : resetSeq
}

export function getCharWidth(char: string): number {
    if (!char) return 0
    const code = char.codePointAt(0)
    if (code === undefined) return 0

    // Control characters
    if (code < 32 || (code >= 0x7f && code < 0xa0)) {
        return 0
    }

    // Standard ASCII
    if (code >= 32 && code <= 0x7e) {
        return 1
    }

    // Zero-width characters & combining marks
    if (
        (code >= 0x0300 && code <= 0x036f) ||
        (code >= 0x1ab0 && code <= 0x1aff) ||
        (code >= 0x1dc0 && code <= 0x1dff) ||
        (code >= 0x200b && code <= 0x200f) ||
        (code >= 0x2028 && code <= 0x202e) ||
        (code >= 0x2060 && code <= 0x206f) ||
        (code >= 0x20d0 && code <= 0x20ff) ||
        (code >= 0xfe00 && code <= 0xfe0f) ||
        (code >= 0xfe20 && code <= 0xfe2f) ||
        code === 0xfeff ||
        (code >= 0xe0100 && code <= 0xe01ef)
    ) {
        return 0
    }

    // Wide characters: CJK, fullwidth, emojis
    if (
        (code >= 0x1100 && code <= 0x115f) ||
        code === 0x2329 ||
        code === 0x232a ||
        (code >= 0x2e80 && code <= 0x303e) ||
        (code >= 0x3040 && code <= 0xa4cf) ||
        (code >= 0xac00 && code <= 0xd7a3) ||
        (code >= 0xf900 && code <= 0xfaff) ||
        (code >= 0xfe10 && code <= 0xfe19) ||
        (code >= 0xfe30 && code <= 0xfe6f) ||
        (code >= 0xff00 && code <= 0xff60) ||
        (code >= 0xffe0 && code <= 0xffe6) ||
        (code >= 0x1f300 && code <= 0x1f9ff) ||
        (code >= 0x1fa00 && code <= 0x1faff) ||
        (code >= 0x20000 && code <= 0x3ffff) ||
        isWideEmoji(code)
    ) {
        return 2
    }

    return 1
}

/** Emoji below U+1F300 that terminals draw two columns wide (Unicode East Asian Width W) */
const WIDE_EMOJI_RANGES: [number, number][] = [
    [0x231a, 0x231b],
    [0x23e9, 0x23ec],
    [0x23f0, 0x23f0],
    [0x23f3, 0x23f3],
    [0x25fd, 0x25fe],
    [0x2614, 0x2615],
    [0x2648, 0x2653],
    [0x267f, 0x267f],
    [0x2693, 0x2693],
    [0x26a1, 0x26a1],
    [0x26aa, 0x26ab],
    [0x26bd, 0x26be],
    [0x26c4, 0x26c5],
    [0x26ce, 0x26ce],
    [0x26d4, 0x26d4],
    [0x26ea, 0x26ea],
    [0x26f2, 0x26f3],
    [0x26f5, 0x26f5],
    [0x26fa, 0x26fa],
    [0x26fd, 0x26fd],
    [0x2705, 0x2705],
    [0x270a, 0x270b],
    [0x2728, 0x2728],
    [0x274c, 0x274c],
    [0x274e, 0x274e],
    [0x2753, 0x2755],
    [0x2757, 0x2757],
    [0x2795, 0x2797],
    [0x27b0, 0x27b0],
    [0x27bf, 0x27bf],
    [0x2b1b, 0x2b1c],
    [0x2b50, 0x2b50],
    [0x2b55, 0x2b55],
    [0x1f004, 0x1f004],
    [0x1f0cf, 0x1f0cf],
    [0x1f18e, 0x1f18e],
    [0x1f191, 0x1f19a],
    [0x1f200, 0x1f2ff],
]

function isWideEmoji(code: number): boolean {
    if (code < 0x231a || code > 0x1f2ff) return false
    for (const [lo, hi] of WIDE_EMOJI_RANGES) {
        if (code < lo) return false
        if (code <= hi) return true
    }
    return false
}

const ASCII_PRINTABLE = /^[\x20-\x7e]*$/

const graphemeSegmenter: Intl.Segmenter | null =
    typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function'
        ? new Intl.Segmenter(undefined, { granularity: 'grapheme' })
        : null

/**
 * The text as terminal cells' worth of clusters: one string per user-perceived character, so a
 * ZWJ emoji, a flag or a letter with combining marks stays in one cell. Printable ASCII skips
 * the segmenter.
 */
export function graphemeClusters(text: string): Iterable<string> {
    if (ASCII_PRINTABLE.test(text) || !graphemeSegmenter) return text
    return Array.from(graphemeSegmenter.segment(text), (part) => part.segment)
}

/** Columns one grapheme cluster takes in the terminal */
export function getClusterWidth(cluster: string): number {
    const code = cluster.codePointAt(0)
    if (code === undefined) return 0
    const first = getCharWidth(String.fromCodePoint(code))
    if (cluster.length <= (code > 0xffff ? 2 : 1)) return first
    // Emoji presentation selector, or a pair of regional indicators (a flag)
    if (cluster.includes('\ufe0f')) return 2
    if (code >= 0x1f1e6 && code <= 0x1f1ff) return 2
    return first
}

/** Columns `text` takes in the terminal */
export function stringWidth(text: string): number {
    if (ASCII_PRINTABLE.test(text)) return text.length
    let width = 0
    for (const cluster of graphemeClusters(text)) width += getClusterWidth(cluster)
    return width
}

/** The longest start of `text` that fits in `maxWidth` columns, never splitting a character */
export function sliceToWidth(text: string, maxWidth: number): string {
    if (maxWidth <= 0) return ''
    if (ASCII_PRINTABLE.test(text)) return text.length > maxWidth ? text.slice(0, maxWidth) : text
    let width = 0
    let end = 0
    for (const cluster of graphemeClusters(text)) {
        const w = getClusterWidth(cluster)
        if (width + w > maxWidth) break
        width += w
        end += cluster.length
    }
    return end === text.length ? text : text.slice(0, end)
}
