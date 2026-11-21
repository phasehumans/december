import { ScreenBuffer } from './buffer'
import { computeDiff } from './diff'
import { findScrollMove, hashRows, scrollMoveSequence } from './scroll'
import { TerminalController } from './terminal'

import type { CellStyle, CursorPosition, DiffOptions, DifferentialScreenOptions } from './types'

export class DifferentialScreen {
    readonly terminal: TerminalController
    frontBuffer: ScreenBuffer
    backBuffer: ScreenBuffer
    private _width: number
    private _height: number
    private readonly synchronized: boolean
    private readonly scrollRegions: boolean
    /** Row hashes of the front buffer, kept from the last frame's back buffer */
    private frontHashes: Int32Array | null = null
    private cursor?: CursorPosition
    private forceFullRedraw = false
    private isRunning = false
    private unsubscribeResize?: () => void
    private readonly resizeListeners = new Set<(cols: number, rows: number) => void>()

    constructor(options?: DifferentialScreenOptions) {
        this.terminal = options?.terminal ?? new TerminalController()
        this._width = options?.width ?? this.terminal.columns
        this._height = options?.height ?? this.terminal.rows
        this.synchronized = options?.synchronized ?? true
        this.scrollRegions =
            (options?.scrollRegions ?? true) && process.env.DECEMBER_NO_SCROLL_REGIONS !== '1'

        this.frontBuffer = new ScreenBuffer(this._width, this._height)
        this.backBuffer = new ScreenBuffer(this._width, this._height)
    }

    get columns(): number {
        return this._width
    }

    get rows(): number {
        return this._height
    }

    get width(): number {
        return this._width
    }

    get height(): number {
        return this._height
    }

    start(): void {
        if (this.isRunning) return
        this.isRunning = true

        this.terminal.enterAlternateScreen()
        this.terminal.hideCursor()
        this.terminal.enableRawMode()
        // 1000 + 1006: report wheel ticks as SGR mouse events so they never reach the
        // arrow-key handler (prompt history). Plain drag-select then needs Shift+drag.
        this.terminal.write('\x1b[?1000h\x1b[?1006h\x1b[?2004h')

        this.unsubscribeResize = this.terminal.onResize((cols, rws) => {
            this.handleResize(cols, rws)
        })

        // Initial clear and full draw
        this.forceFullRedraw = true
        this.backBuffer.clear()
        this.render()
    }

    stop(): void {
        if (!this.isRunning) return
        this.isRunning = false

        if (this.unsubscribeResize) {
            this.unsubscribeResize()
            this.unsubscribeResize = undefined
        }

        this.terminal.write('\x1b[?1006l\x1b[?1002l\x1b[?1000l\x1b[?1007l\x1b[?2004l')
        this.terminal.cleanup()
    }

    onResize(listener: (cols: number, rows: number) => void): () => void {
        this.resizeListeners.add(listener)
        return () => {
            this.resizeListeners.delete(listener)
        }
    }

    handleResize(newWidth: number, newHeight: number): void {
        const clampedWidth = Math.max(1, Math.floor(newWidth))
        const clampedHeight = Math.max(1, Math.floor(newHeight))

        if (clampedWidth === this._width && clampedHeight === this._height) {
            return
        }

        this._width = clampedWidth
        this._height = clampedHeight

        // Dynamically resize buffers
        this.backBuffer = this.backBuffer.resize(clampedWidth, clampedHeight)
        this.frontBuffer = new ScreenBuffer(clampedWidth, clampedHeight)

        // Window dimension change necessitates a full frame redraw to eliminate visual corruption
        this.forceFullRedraw = true
        this.frontHashes = null

        for (const listener of this.resizeListeners) {
            listener(this.width, this.height)
        }
    }

    setCursor(x: number, y: number, visible = false): void {
        this.cursor = { x, y, visible }
    }

    get cursorPosition(): CursorPosition | undefined {
        return this.cursor
    }

    clear(style?: CellStyle): void {
        this.backBuffer.clear(style)
    }

    write(x: number, y: number, text: string, style?: CellStyle): { x: number; y: number } {
        return this.backBuffer.write(x, y, text, style)
    }

    render(options?: DiffOptions): string {
        const forceFullRedraw = options?.forceFullRedraw ?? this.forceFullRedraw

        // A band that scrolled (chat output while following the bottom) moves with one
        // terminal scroll; the cell diff then only draws the rows that are new
        let prefix = options?.prefix ?? ''
        let backHashes: Int32Array | null = null
        if (this.scrollRegions) {
            backHashes = hashRows(this.backBuffer)
            if (!forceFullRedraw && this.frontHashes) {
                const move = findScrollMove(
                    this.frontBuffer,
                    this.backBuffer,
                    this.frontHashes,
                    backHashes
                )
                if (move) {
                    prefix += scrollMoveSequence(move)
                    this.frontBuffer.scrollRegionUp(move.top, move.bottom, move.shift)
                }
            }
        }

        const diffOptions: DiffOptions = {
            forceFullRedraw,
            synchronized: options?.synchronized ?? this.synchronized,
            cursor: options?.cursor ?? this.cursor,
            prefix,
        }

        const delta = computeDiff(this.frontBuffer, this.backBuffer, diffOptions)
        this.frontHashes = backHashes

        if (delta.length > 0) {
            this.terminal.write(delta)
        }

        // Synchronize front buffer to back buffer
        this.frontBuffer.copyFrom(this.backBuffer)
        this.forceFullRedraw = false

        return delta
    }
}
