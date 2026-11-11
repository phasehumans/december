import { copyCell, getCharWidth, resetCell } from './cell'

import type { Cell, CellStyle } from './types'

export class ScreenBuffer {
    readonly width: number
    readonly height: number
    private cells: Cell[]

    constructor(width: number, height: number) {
        this.width = Math.max(1, Math.floor(width))
        this.height = Math.max(1, Math.floor(height))
        const total = this.width * this.height
        this.cells = new Array<Cell>(total)
        for (let i = 0; i < total; i++) {
            this.cells[i] = { char: ' ', width: 1 }
        }
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
        copyCell(this.cells[this.getIndex(x, y)]!, cell)
    }

    setChar(x: number, y: number, char: string, style?: CellStyle): void {
        if (!this.isInBounds(x, y)) {
            return
        }
        resetCell(this.cells[this.getIndex(x, y)]!, char, style)
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
                    const cell = this.cells[this.getIndex(x, y)]!
                    cell.char = char
                    cell.width = 2
                    cell.fg = style?.fg
                    cell.bg = style?.bg
                    cell.bold = style?.bold
                    cell.dim = style?.dim
                    cell.italic = style?.italic
                    cell.underline = style?.underline
                    cell.inverse = style?.inverse
                    cell.strikethrough = style?.strikethrough

                    if (this.isInBounds(x + 1, y)) {
                        const contCell = this.cells[this.getIndex(x + 1, y)]!
                        contCell.char = ''
                        contCell.width = 0
                        contCell.fg = style?.fg
                        contCell.bg = style?.bg
                        contCell.bold = undefined
                        contCell.dim = undefined
                        contCell.italic = undefined
                        contCell.underline = undefined
                        contCell.inverse = undefined
                        contCell.strikethrough = undefined
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
                    const cell = this.cells[this.getIndex(x, y)]!
                    cell.char = char
                    cell.width = 1
                    cell.fg = style?.fg
                    cell.bg = style?.bg
                    cell.bold = style?.bold
                    cell.dim = style?.dim
                    cell.italic = style?.italic
                    cell.underline = style?.underline
                    cell.inverse = style?.inverse
                    cell.strikethrough = style?.strikethrough
                }
                x += 1
            }
        }

        return { x, y }
    }

    fill(cell?: Cell): void {
        if (cell) {
            for (let i = 0; i < this.cells.length; i++) {
                copyCell(this.cells[i]!, cell)
            }
        } else {
            this.clear()
        }
    }

    clear(style?: CellStyle): void {
        for (let i = 0; i < this.cells.length; i++) {
            resetCell(this.cells[i]!, ' ', style)
        }
    }

    clearArea(
        startX: number,
        startY: number,
        width: number,
        height: number,
        style?: CellStyle
    ): void {
        for (let row = 0; row < height; row++) {
            const y = startY + row
            if (y < 0 || y >= this.height) continue
            for (let col = 0; col < width; col++) {
                const x = startX + col
                if (x < 0 || x >= this.width) continue
                resetCell(this.cells[this.getIndex(x, y)]!, ' ', style)
            }
        }
    }

    dimRegion(startX: number, startY: number, width: number, height: number): void {
        const endX = Math.min(this.width, startX + width)
        const endY = Math.min(this.height, startY + height)
        for (let y = Math.max(0, startY); y < endY; y++) {
            for (let x = Math.max(0, startX); x < endX; x++) {
                const cell = this.cells[this.getIndex(x, y)]
                if (cell && cell.char && cell.char !== ' ') {
                    cell.dim = true
                    cell.bold = false
                }
            }
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
                    copyCell(this.cells[this.getIndex(x, y)]!, cell)
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
