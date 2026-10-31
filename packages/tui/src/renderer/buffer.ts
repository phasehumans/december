import { cloneCell, createCell, EMPTY_CELL, getCharWidth } from './cell'

import type { Cell, CellStyle } from './types'

export class ScreenBuffer {
    readonly width: number
    readonly height: number
    private cells: Cell[]

    constructor(width: number, height: number) {
        this.width = Math.max(1, Math.floor(width))
        this.height = Math.max(1, Math.floor(height))
        this.cells = new Array<Cell>(this.width * this.height)
        this.clear()
    }

    private getIndex(x: number, y: number): number {
        return y * this.width + x
    }

    isInBounds(x: number, y: number): boolean {
        return x >= 0 && x < this.width && y >= 0 && y < this.height
    }

    get(x: number, y: number): Cell | undefined {
        if (!this.isInBounds(x, y)) {
            return undefined
        }
        return this.cells[this.getIndex(x, y)]
    }

    set(x: number, y: number, cell: Cell): void {
        if (!this.isInBounds(x, y)) {
            return
        }
        this.cells[this.getIndex(x, y)] = cloneCell(cell)
    }

    setChar(x: number, y: number, char: string, style?: CellStyle): void {
        if (!this.isInBounds(x, y)) {
            return
        }
        this.cells[this.getIndex(x, y)] = createCell(char, style)
    }

    write(
        startX: number,
        startY: number,
        text: string,
        style?: CellStyle
    ): { x: number; y: number } {
        let x = startX
        let y = startY

        // Handle string iterating over codepoints/graphemes cleanly
        for (const char of text) {
            if (char === '\r') {
                continue
            }
            if (char === '\n') {
                y += 1
                x = startX
                continue
            }

            if (y >= this.height) {
                break
            }

            const w = getCharWidth(char)
            if (w === 0) {
                // Zero-width combining mark: attach to previous cell if exists
                if (x > 0 && this.isInBounds(x - 1, y)) {
                    const prev = this.get(x - 1, y)
                    if (prev) {
                        prev.char += char
                    }
                }
                continue
            }

            if (w === 2) {
                // If wide character cannot fit in current line, wrap or stop
                if (x + 1 >= this.width) {
                    y += 1
                    x = startX
                    if (y >= this.height) break
                }
                if (this.isInBounds(x, y)) {
                    this.cells[this.getIndex(x, y)] = {
                        char,
                        width: 2,
                        fg: style?.fg,
                        bg: style?.bg,
                        bold: style?.bold,
                        dim: style?.dim,
                        italic: style?.italic,
                        underline: style?.underline,
                        inverse: style?.inverse,
                        strikethrough: style?.strikethrough,
                    }
                    if (this.isInBounds(x + 1, y)) {
                        this.cells[this.getIndex(x + 1, y)] = {
                            char: '',
                            width: 0,
                            fg: style?.fg,
                            bg: style?.bg,
                        }
                    }
                }
                x += 2
            } else {
                if (x >= this.width) {
                    y += 1
                    x = startX
                    if (y >= this.height) break
                }
                if (this.isInBounds(x, y)) {
                    this.cells[this.getIndex(x, y)] = {
                        char,
                        width: 1,
                        fg: style?.fg,
                        bg: style?.bg,
                        bold: style?.bold,
                        dim: style?.dim,
                        italic: style?.italic,
                        underline: style?.underline,
                        inverse: style?.inverse,
                        strikethrough: style?.strikethrough,
                    }
                }
                x += 1
            }
        }

        return { x, y }
    }

    fill(cell?: Cell): void {
        const fillCell = cell ? cloneCell(cell) : cloneCell(EMPTY_CELL as Cell)
        for (let i = 0; i < this.cells.length; i++) {
            this.cells[i] = cloneCell(fillCell)
        }
    }

    clear(style?: CellStyle): void {
        const cell = style ? createCell(' ', style) : cloneCell(EMPTY_CELL as Cell)
        for (let i = 0; i < this.cells.length; i++) {
            this.cells[i] = cloneCell(cell)
        }
    }

    clone(): ScreenBuffer {
        const copy = new ScreenBuffer(this.width, this.height)
        copy.copyFrom(this)
        return copy
    }

    copyFrom(source: ScreenBuffer): void {
        const copyWidth = Math.min(this.width, source.width)
        const copyHeight = Math.min(this.height, source.height)

        for (let y = 0; y < copyHeight; y++) {
            for (let x = 0; x < copyWidth; x++) {
                const cell = source.get(x, y)
                if (cell) {
                    this.cells[this.getIndex(x, y)] = cloneCell(cell)
                }
            }
        }
    }

    resize(newWidth: number, newHeight: number): ScreenBuffer {
        const target = new ScreenBuffer(newWidth, newHeight)
        target.copyFrom(this)
        return target
    }

    getLine(y: number): string {
        if (y < 0 || y >= this.height) return ''
        let line = ''
        for (let x = 0; x < this.width; x++) {
            const cell = this.get(x, y)
            if (cell) {
                line += cell.char
            }
        }
        return line
    }
}
