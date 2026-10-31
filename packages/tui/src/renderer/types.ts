export type StandardColorName =
    | 'black'
    | 'red'
    | 'green'
    | 'yellow'
    | 'blue'
    | 'magenta'
    | 'cyan'
    | 'white'
    | 'gray'
    | 'brightBlack'
    | 'brightRed'
    | 'brightGreen'
    | 'brightYellow'
    | 'brightBlue'
    | 'brightMagenta'
    | 'brightCyan'
    | 'brightWhite'

export interface RgbColor {
    r: number
    g: number
    b: number
}

/**
 * Color can be:
 * - standard ANSI 16 color name (e.g. 'red', 'brightYellow')
 * - 256-color palette index (number 0 to 255)
 * - hex color string ('#rrggbb' or '#rgb')
 * - RGB object ({ r, g, b })
 * - undefined for default terminal color
 */
export type Color = StandardColorName | number | string | RgbColor

export interface CellStyle {
    fg?: Color
    bg?: Color
    bold?: boolean
    dim?: boolean
    italic?: boolean
    underline?: boolean
    inverse?: boolean
    strikethrough?: boolean
}

export interface Cell {
    char: string
    fg?: Color
    bg?: Color
    bold?: boolean
    dim?: boolean
    italic?: boolean
    underline?: boolean
    inverse?: boolean
    strikethrough?: boolean
    /**
     * Display width of character in terminal cells:
     * - 1: standard ASCII / latin / halfwidth character
     * - 2: wide character (CJK, fullwidth, emoji)
     * - 0: continuation cell for a wide character preceding it
     */
    width?: number
}

export interface CursorPosition {
    x: number
    y: number
    visible?: boolean
}

export interface DiffOptions {
    /** Force redrawing every cell regardless of front buffer contents */
    forceFullRedraw?: boolean
    /** Wrap output in synchronized update escape sequences (\x1b[?2025h ... \x1b[?2025l) */
    synchronized?: boolean
    /** Position and show/hide cursor at the end of the frame */
    cursor?: CursorPosition
}

export interface TerminalOptions {
    stdin?: NodeJS.ReadStream
    stdout?: NodeJS.WriteStream
    columns?: number
    rows?: number
}

export interface DifferentialScreenOptions {
    terminal?: import('./terminal').TerminalController
    width?: number
    height?: number
    synchronized?: boolean
}
