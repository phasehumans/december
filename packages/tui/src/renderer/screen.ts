import { ScreenBuffer } from './buffer'
import { computeDiff } from './diff'
import { TerminalController } from './terminal'

import type { CellStyle, CursorPosition, DiffOptions, DifferentialScreenOptions } from './types'

export class DifferentialScreen {
    readonly terminal: TerminalController
    frontBuffer: ScreenBuffer
    backBuffer: ScreenBuffer
    private width: number
    private height: number
    private readonly synchronized: boolean
    private cursor?: CursorPosition
    private forceFullRedraw = false
    private isRunning = false
    private unsubscribeResize?: () => void
    private readonly resizeListeners = new Set<(cols: number, rows: number) => void>()

    constructor(options?: DifferentialScreenOptions) {
        this.terminal = options?.terminal ?? new TerminalController()
        this.width = options?.width ?? this.terminal.columns
        this.height = options?.height ?? this.terminal.rows
        this.synchronized = options?.synchronized ?? true

        this.frontBuffer = new ScreenBuffer(this.width, this.height)
        this.backBuffer = new ScreenBuffer(this.width, this.height)
    }

    get columns(): number {
        return this.width
    }

    get rows(): number {
        return this.height
    }

    start(): void {
        if (this.isRunning) return
        this.isRunning = true

        this.terminal.enterAlternateScreen()
        this.terminal.hideCursor()
        this.terminal.enableRawMode()

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

        if (clampedWidth === this.width && clampedHeight === this.height) {
            return
        }

        this.width = clampedWidth
        this.height = clampedHeight

        // Dynamically resize buffers
        this.backBuffer = this.backBuffer.resize(clampedWidth, clampedHeight)
        this.frontBuffer = new ScreenBuffer(clampedWidth, clampedHeight)

        // Window dimension change necessitates a full frame redraw to eliminate visual corruption
        this.forceFullRedraw = true

        for (const listener of this.resizeListeners) {
            listener(this.width, this.height)
        }
    }

    setCursor(x: number, y: number, visible = false): void {
        this.cursor = { x, y, visible }
    }

    clear(style?: CellStyle): void {
        this.backBuffer.clear(style)
    }

    write(x: number, y: number, text: string, style?: CellStyle): { x: number; y: number } {
        return this.backBuffer.write(x, y, text, style)
    }

    render(options?: DiffOptions): string {
        const diffOptions: DiffOptions = {
            forceFullRedraw: options?.forceFullRedraw ?? this.forceFullRedraw,
            synchronized: options?.synchronized ?? this.synchronized,
            cursor: options?.cursor ?? this.cursor,
        }

        const delta = computeDiff(this.frontBuffer, this.backBuffer, diffOptions)

        if (delta.length > 0) {
            this.terminal.write(delta)
        }

        // Synchronize front buffer to back buffer
        this.frontBuffer.copyFrom(this.backBuffer)
        this.forceFullRedraw = false

        return delta
    }
}
