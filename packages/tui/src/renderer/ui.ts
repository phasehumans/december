import { getCharWidth } from './cell'

import type { ScreenBuffer } from './buffer'
import type { CellStyle } from './types'

export type BorderStyle = 'rounded' | 'single' | 'double' | 'none'

export interface BorderGlyphs {
    topLeft: string
    topRight: string
    bottomLeft: string
    bottomRight: string
    horizontal: string
    vertical: string
}

export const BORDER_STYLES: Record<Exclude<BorderStyle, 'none'>, BorderGlyphs> = {
    rounded: {
        topLeft: '╭',
        topRight: '╮',
        bottomLeft: '╰',
        bottomRight: '╯',
        horizontal: '─',
        vertical: '│',
    },
    single: {
        topLeft: '┌',
        topRight: '┐',
        bottomLeft: '└',
        bottomRight: '┘',
        horizontal: '─',
        vertical: '│',
    },
    double: {
        topLeft: '╔',
        topRight: '╗',
        bottomLeft: '╚',
        bottomRight: '╝',
        horizontal: '═',
        vertical: '║',
    },
}

export interface DrawBoxOptions {
    x: number
    y: number
    width: number
    height: number
    borderStyle?: BorderStyle
    borderColor?: string
    bg?: string
    title?: string
    titleColor?: string
}

export function drawBox(buffer: ScreenBuffer, options: DrawBoxOptions): void {
    const {
        x,
        y,
        width,
        height,
        borderStyle = 'rounded',
        borderColor,
        bg,
        title,
        titleColor,
    } = options

    if (width <= 0 || height <= 0) return

    const style: CellStyle = { fg: borderColor, bg }

    if (borderStyle === 'none') {
        if (bg) {
            for (let row = 0; row < height; row++) {
                for (let col = 0; col < width; col++) {
                    buffer.setChar(x + col, y + row, ' ', style)
                }
            }
        }
        return
    }

    const glyphs = BORDER_STYLES[borderStyle] || BORDER_STYLES.rounded

    // 1. Draw Corners
    buffer.setChar(x, y, glyphs.topLeft, style)
    buffer.setChar(x + width - 1, y, glyphs.topRight, style)
    buffer.setChar(x, y + height - 1, glyphs.bottomLeft, style)
    buffer.setChar(x + width - 1, y + height - 1, glyphs.bottomRight, style)

    // 2. Draw Top and Bottom Horizontal Borders
    for (let col = 1; col < width - 1; col++) {
        buffer.setChar(x + col, y, glyphs.horizontal, style)
        buffer.setChar(x + col, y + height - 1, glyphs.horizontal, style)
    }

    // 3. Draw Vertical Borders and Optional Background
    for (let row = 1; row < height - 1; row++) {
        buffer.setChar(x, y + row, glyphs.vertical, style)
        buffer.setChar(x + width - 1, y + row, glyphs.vertical, style)
        if (bg) {
            for (let col = 1; col < width - 1; col++) {
                buffer.setChar(x + col, y + row, ' ', { bg })
            }
        }
    }

    // 4. Draw Title if provided
    if (title && width > 4) {
        const titleFormatted = ` ${title} `
        const titleLen = titleFormatted.length
        const maxTitleLen = width - 4
        const displayTitle =
            titleLen > maxTitleLen ? titleFormatted.slice(0, maxTitleLen) : titleFormatted

        const titleStyle: CellStyle = {
            fg: titleColor || borderColor,
            bg,
            bold: true,
        }

        let currX = x + 2
        for (const ch of displayTitle) {
            if (currX >= x + width - 2) break
            buffer.setChar(currX, y, ch, titleStyle)
            currX += getCharWidth(ch)
        }
    }
}

export interface DrawTextOptions {
    x: number
    y: number
    maxWidth?: number
    style?: CellStyle
    wrap?: boolean
    ellipsis?: boolean
}

export function drawText(
    buffer: ScreenBuffer,
    text: string,
    options: DrawTextOptions
): { x: number; y: number; linesRendered: number } {
    const { x, y, maxWidth = buffer.width - x, style, wrap = false, ellipsis = false } = options

    if (maxWidth <= 0) return { x, y, linesRendered: 0 }

    if (!wrap) {
        let display = text
        if (ellipsis && display.length > maxWidth && maxWidth > 1) {
            display = display.slice(0, maxWidth - 1) + '…'
        } else if (display.length > maxWidth) {
            display = display.slice(0, maxWidth)
        }
        buffer.write(x, y, display, style)
        return { x: x + display.length, y, linesRendered: 1 }
    }

    // Wrap mode: wrap by words or characters
    const words = text.split(/(\s+)/)
    let currX = x
    let currY = y
    let linesRendered = 1

    for (const token of words) {
        if (token === '\n') {
            currY += 1
            currX = x
            linesRendered += 1
            continue
        }

        const tokenLen = token.length
        if (currX + tokenLen > x + maxWidth) {
            // Need line break if already have text on current line
            if (currX > x) {
                currY += 1
                currX = x
                linesRendered += 1
            }
            if (token.trim() === '') {
                continue
            }
        }

        if (currY >= buffer.height) {
            break
        }

        buffer.write(currX, currY, token, style)
        currX += tokenLen
    }

    return { x: currX, y: currY, linesRendered }
}

export interface DrawDividerOptions {
    x?: number
    y: number
    width: number
    char?: string
    style?: CellStyle
}

export function drawDivider(buffer: ScreenBuffer, options: DrawDividerOptions): void {
    const { x = 0, y, width, char = '─', style } = options
    for (let i = 0; i < width; i++) {
        buffer.setChar(x + i, y, char, style)
    }
}

// Declarative Component Primitives

export interface PaddingOptions {
    top?: number
    bottom?: number
    left?: number
    right?: number
}

export interface BoxComponentOptions {
    x?: number
    y?: number
    width?: number
    height?: number
    borderStyle?: BorderStyle
    borderColor?: string
    bg?: string
    title?: string
    titleColor?: string
    padding?: PaddingOptions
    flexDirection?: 'row' | 'column'
}

export interface UIComponent {
    render(buffer: ScreenBuffer, parentX?: number, parentY?: number): void
}

export function Text(
    content: string,
    options?: { color?: string; bg?: string; bold?: boolean; dim?: boolean; italic?: boolean }
): UIComponent {
    return {
        render(buffer: ScreenBuffer, parentX = 0, parentY = 0) {
            drawText(buffer, content, {
                x: parentX,
                y: parentY,
                style: {
                    fg: options?.color,
                    bg: options?.bg,
                    bold: options?.bold,
                    dim: options?.dim,
                    italic: options?.italic,
                },
            })
        },
    }
}

export function Box(
    options: BoxComponentOptions,
    children: (UIComponent | string)[] = []
): UIComponent {
    return {
        render(buffer: ScreenBuffer, parentX = 0, parentY = 0) {
            const x = options.x ?? parentX
            const y = options.y ?? parentY
            const width = options.width ?? buffer.width - x
            const height = options.height ?? buffer.height - y

            drawBox(buffer, {
                x,
                y,
                width,
                height,
                borderStyle: options.borderStyle,
                borderColor: options.borderColor,
                bg: options.bg,
                title: options.title,
                titleColor: options.titleColor,
            })

            const hasBorder = options.borderStyle && options.borderStyle !== 'none'
            const borderOffset = hasBorder ? 1 : 0
            const padLeft = (options.padding?.left ?? 0) + borderOffset
            const padTop = (options.padding?.top ?? 0) + borderOffset

            let childX = x + padLeft
            let childY = y + padTop

            for (const child of children) {
                if (typeof child === 'string') {
                    drawText(buffer, child, { x: childX, y: childY })
                    childY += 1
                } else if (child && typeof child.render === 'function') {
                    child.render(buffer, childX, childY)
                    if (options.flexDirection === 'row') {
                        // Advance X for row
                        childX += 20 // Default column spacing
                    } else {
                        // Advance Y for column
                        childY += 1
                    }
                }
            }
        },
    }
}
