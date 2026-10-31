import type { TerminalOptions } from './types'

export class TerminalController {
    readonly stdin: NodeJS.ReadStream
    readonly stdout: NodeJS.WriteStream
    private readonly handleSignals: boolean
    private inAlternateScreen = false
    private rawModeEnabled = false
    private cursorHidden = false
    private isCleanedUp = false
    private readonly resizeListeners = new Set<(cols: number, rows: number) => void>()

    // Bound listeners for clean removal
    private readonly onSigwinchBound: () => void
    private readonly onExitBound: () => void
    private readonly onSigintBound: () => void
    private readonly onSigtermBound: () => void
    private readonly onSighupBound: () => void
    private readonly onUncaughtExceptionBound: (err: Error) => void

    constructor(options?: TerminalOptions & { handleSignals?: boolean }) {
        this.stdin = options?.stdin ?? process.stdin
        this.stdout = options?.stdout ?? process.stdout
        this.handleSignals = options?.handleSignals ?? process.env.NODE_ENV !== 'test'

        this.onSigwinchBound = this.handleSigwinch.bind(this)
        this.onExitBound = this.cleanup.bind(this)
        this.onSigintBound = () => {
            this.cleanup()
            process.exit(130)
        }
        this.onSigtermBound = () => {
            this.cleanup()
            process.exit(143)
        }
        this.onSighupBound = () => {
            this.cleanup()
            process.exit(129)
        }
        this.onUncaughtExceptionBound = (err: Error) => {
            this.cleanup()
            // Re-throw so standard exception reporting can proceed
            throw err
        }

        if (this.handleSignals && typeof process.on === 'function') {
            process.on('SIGWINCH', this.onSigwinchBound)
            process.on('exit', this.onExitBound)
            process.on('SIGINT', this.onSigintBound)
            process.on('SIGTERM', this.onSigtermBound)
            process.on('SIGHUP', this.onSighupBound)
            process.on('uncaughtException', this.onUncaughtExceptionBound)
        }
    }

    get columns(): number {
        return this.stdout.columns && this.stdout.columns > 0 ? this.stdout.columns : 80
    }

    get rows(): number {
        return this.stdout.rows && this.stdout.rows > 0 ? this.stdout.rows : 24
    }

    write(data: string): void {
        if (!data || this.isCleanedUp) return
        this.stdout.write(data)
    }

    enterAlternateScreen(): void {
        if (this.inAlternateScreen || this.isCleanedUp) return
        this.write('\x1b[?1049h')
        this.inAlternateScreen = true
    }

    exitAlternateScreen(): void {
        if (!this.inAlternateScreen) return
        this.write('\x1b[?1049l')
        this.inAlternateScreen = false
    }

    hideCursor(): void {
        if (this.cursorHidden || this.isCleanedUp) return
        this.write('\x1b[?25l')
        this.cursorHidden = true
    }

    showCursor(): void {
        if (!this.cursorHidden) return
        this.write('\x1b[?25h')
        this.cursorHidden = false
    }

    enableRawMode(): void {
        if (this.rawModeEnabled || this.isCleanedUp) return
        try {
            if (typeof this.stdin.setRawMode === 'function') {
                this.stdin.setRawMode(true)
            }
            if (typeof this.stdin.resume === 'function') {
                this.stdin.resume()
            }
            this.rawModeEnabled = true
        } catch {
            // Intentionally swallowed: stdin might not be an interactive TTY in synthetic tests or daemon pipes
        }
    }

    disableRawMode(): void {
        if (!this.rawModeEnabled) return
        try {
            if (typeof this.stdin.setRawMode === 'function') {
                this.stdin.setRawMode(false)
            }
            if (typeof this.stdin.pause === 'function') {
                this.stdin.pause()
            }
        } catch {
            // Intentionally swallowed: stdin stream might already be closed or detached
        }
        this.rawModeEnabled = false
    }

    onResize(listener: (cols: number, rows: number) => void): () => void {
        this.resizeListeners.add(listener)
        return () => {
            this.resizeListeners.delete(listener)
        }
    }

    private handleSigwinch(): void {
        const cols = this.columns
        const rws = this.rows
        for (const listener of this.resizeListeners) {
            listener(cols, rws)
        }
    }

    cleanup(): void {
        if (this.isCleanedUp) return
        this.isCleanedUp = true

        // 1. Reset text styles
        try {
            this.stdout.write('\x1b[0m')
        } catch {
            // Intentionally swallowed: stdout may be closed on sudden termination
        }

        // 2. Show hardware cursor
        if (this.cursorHidden) {
            try {
                this.stdout.write('\x1b[?25h')
                this.cursorHidden = false
            } catch {
                // Intentionally swallowed: stdout may be closed on sudden termination
            }
        }

        // 3. Return from alternate screen buffer to normal scrollback buffer
        if (this.inAlternateScreen) {
            try {
                this.stdout.write('\x1b[?1049l')
                this.inAlternateScreen = false
            } catch {
                // Intentionally swallowed: stdout may be closed on sudden termination
            }
        }

        // 4. Restore terminal input raw mode
        this.disableRawMode()

        // 5. Unregister process signal handlers
        if (this.handleSignals && typeof process.removeListener === 'function') {
            process.removeListener('SIGWINCH', this.onSigwinchBound)
            process.removeListener('exit', this.onExitBound)
            process.removeListener('SIGINT', this.onSigintBound)
            process.removeListener('SIGTERM', this.onSigtermBound)
            process.removeListener('SIGHUP', this.onSighupBound)
            process.removeListener('uncaughtException', this.onUncaughtExceptionBound)
        }

        this.resizeListeners.clear()
    }
}
