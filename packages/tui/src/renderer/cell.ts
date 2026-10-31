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

    if (from.bold && !to.bold) deltaCodes.push('22')
    if (!from.bold && to.bold) deltaCodes.push('1')

    if (from.dim && !to.dim && !to.bold) deltaCodes.push('22')
    if (!from.dim && to.dim) deltaCodes.push('2')

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
        (code >= 0x20000 && code <= 0x3ffff)
    ) {
        return 2
    }

    return 1
}
