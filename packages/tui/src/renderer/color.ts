import type { Color, RgbColor, StandardColorName } from './types'

const STANDARD_FG: Record<StandardColorName, number> = {
    black: 30,
    red: 31,
    green: 32,
    yellow: 33,
    blue: 34,
    magenta: 35,
    cyan: 36,
    white: 37,
    gray: 90,
    brightBlack: 90,
    brightRed: 91,
    brightGreen: 92,
    brightYellow: 93,
    brightBlue: 94,
    brightMagenta: 95,
    brightCyan: 96,
    brightWhite: 97,
}

const STANDARD_BG: Record<StandardColorName, number> = {
    black: 40,
    red: 41,
    green: 42,
    yellow: 43,
    blue: 44,
    magenta: 45,
    cyan: 46,
    white: 47,
    gray: 100,
    brightBlack: 100,
    brightRed: 101,
    brightGreen: 102,
    brightYellow: 103,
    brightBlue: 104,
    brightMagenta: 105,
    brightCyan: 106,
    brightWhite: 107,
}

export function parseHexColor(hex: string): RgbColor | undefined {
    let cleanHex = hex.trim()
    if (cleanHex.startsWith('#')) {
        cleanHex = cleanHex.slice(1)
    }

    if (cleanHex.length === 3) {
        const r = Number.parseInt(cleanHex[0] + cleanHex[0], 16)
        const g = Number.parseInt(cleanHex[1] + cleanHex[1], 16)
        const b = Number.parseInt(cleanHex[2] + cleanHex[2], 16)
        if (!Number.isNaN(r) && !Number.isNaN(g) && !Number.isNaN(b)) {
            return { r, g, b }
        }
    } else if (cleanHex.length === 6) {
        const r = Number.parseInt(cleanHex.slice(0, 2), 16)
        const g = Number.parseInt(cleanHex.slice(2, 4), 16)
        const b = Number.parseInt(cleanHex.slice(4, 6), 16)
        if (!Number.isNaN(r) && !Number.isNaN(g) && !Number.isNaN(b)) {
            return { r, g, b }
        }
    }

    return undefined
}

export function areColorsEqual(c1?: Color, c2?: Color): boolean {
    if (c1 === c2) return true
    if (c1 === undefined || c2 === undefined) return false

    if (typeof c1 === 'object' && typeof c2 === 'object') {
        return c1.r === c2.r && c1.g === c2.g && c1.b === c2.b
    }

    // Check hex vs object or hex normalization
    if (typeof c1 === 'string' && typeof c2 === 'string') {
        return c1.toLowerCase() === c2.toLowerCase()
    }

    if (typeof c1 === 'string' && typeof c2 === 'object') {
        const rgb = parseHexColor(c1)
        return rgb ? rgb.r === c2.r && rgb.g === c2.g && rgb.b === c2.b : false
    }

    if (typeof c1 === 'object' && typeof c2 === 'string') {
        const rgb = parseHexColor(c2)
        return rgb ? rgb.r === c1.r && rgb.g === c1.g && rgb.b === c1.b : false
    }

    return false
}

export function colorToSgr(color: Color | undefined, isBackground: boolean): string {
    if (color === undefined) {
        return isBackground ? '49' : '39'
    }

    // Standard named color
    if (typeof color === 'string' && (color in STANDARD_FG || color in STANDARD_BG)) {
        const map = isBackground ? STANDARD_BG : STANDARD_FG
        const code = map[color as StandardColorName]
        if (code !== undefined) {
            return String(code)
        }
    }

    // 256 color index (number 0..255)
    if (typeof color === 'number') {
        const clamped = Math.max(0, Math.min(255, Math.floor(color)))
        const prefix = isBackground ? '48;5' : '38;5'
        return `${prefix};${clamped}`
    }

    // RGB object or hex string
    let rgb: RgbColor | undefined
    if (typeof color === 'object') {
        rgb = color
    } else if (
        typeof color === 'string' &&
        (color.startsWith('#') || color.length === 3 || color.length === 6)
    ) {
        rgb = parseHexColor(color)
    }

    if (rgb) {
        const r = Math.max(0, Math.min(255, Math.floor(rgb.r)))
        const g = Math.max(0, Math.min(255, Math.floor(rgb.g)))
        const b = Math.max(0, Math.min(255, Math.floor(rgb.b)))
        const prefix = isBackground ? '48;2' : '38;2'
        return `${prefix};${r};${g};${b}`
    }

    return isBackground ? '49' : '39'
}
