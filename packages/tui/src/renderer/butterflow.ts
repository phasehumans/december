/**
 * Butterflow: Adaptive Token Streaming Pacing Engine
 *
 * Smooths bursty network SSE chunks into a fluid, natural reading cadence.
 * Dynamically scales pacing so it never lags behind real-time generation
 * while eliminating jerky text pops.
 */

export interface ButterflowOptions {
    /** Target frame interval in milliseconds (default: 16ms ~60fps) */
    frameIntervalMs?: number
    /** Whether butterflow smoothing is enabled (default: true) */
    enabled?: boolean
    /** Callback fired whenever new characters are dripped */
    onDrip?: (delta: string, accumulated: string) => void
    /** Callback fired when all pending characters have been dripped */
    onDrain?: () => void
}

export class ButterflowQueue {
    private targetText = ''
    private drippedText = ''
    private timer: ReturnType<typeof setInterval> | null = null
    private readonly frameIntervalMs: number
    private _enabled: boolean
    private readonly onDrip?: (delta: string, accumulated: string) => void
    private readonly onDrain?: () => void

    constructor(options?: ButterflowOptions) {
        this.frameIntervalMs = options?.frameIntervalMs ?? 16
        this._enabled = options?.enabled ?? true
        this.onDrip = options?.onDrip
        this.onDrain = options?.onDrain
    }

    get enabled(): boolean {
        return this._enabled
    }

    set enabled(val: boolean) {
        this._enabled = val
        if (!val && this.hasPending()) {
            this.flush()
        }
    }

    /**
     * Enqueue a new streaming chunk into the buffer.
     * If butterflow is disabled, immediately drips the full chunk.
     */
    enqueue(chunk: string): void {
        if (!chunk) return

        this.targetText += chunk

        if (!this._enabled) {
            const delta = this.targetText.slice(this.drippedText.length)
            this.drippedText = this.targetText
            this.onDrip?.(delta, this.drippedText)
            this.onDrain?.()
            return
        }

        this.ensureDripping()
    }

    /**
     * Whether there is text buffered that has not yet been dripped to the screen.
     */
    hasPending(): boolean {
        return this.drippedText.length < this.targetText.length
    }

    /**
     * The total accumulated text received so far (target).
     */
    getTargetText(): string {
        return this.targetText
    }

    /**
     * The text that has been dripped to the display so far.
     */
    getDrippedText(): string {
        return this.drippedText
    }

    /**
     * Immediately advances all remaining buffered text and invokes onDrip.
     */
    flush(): string {
        this.stopTimer()
        if (this.drippedText.length < this.targetText.length) {
            const delta = this.targetText.slice(this.drippedText.length)
            this.drippedText = this.targetText
            this.onDrip?.(delta, this.drippedText)
            this.onDrain?.()
        }
        return this.drippedText
    }

    /**
     * Clears all buffered and dripped state.
     */
    reset(): void {
        this.stopTimer()
        this.targetText = ''
        this.drippedText = ''
    }

    /**
     * Destroys any active timer.
     */
    destroy(): void {
        this.stopTimer()
    }

    private ensureDripping(): void {
        if (this.timer) return

        this.timer = setInterval(() => {
            this.step()
        }, this.frameIntervalMs)
    }

    private stopTimer(): void {
        if (this.timer) {
            clearInterval(this.timer)
            this.timer = null
        }
    }

    /**
     * Advance one adaptive drip step.
     */
    private step(): void {
        const lag = this.targetText.length - this.drippedText.length
        if (lag <= 0) {
            this.stopTimer()
            this.onDrain?.()
            return
        }

        // Dynamic adaptive pacing curve:
        // - High lag (> 150 chars): catch up in ~50ms without jerky snaps
        // - Medium-high lag (61-150 chars): catch up in ~70-100ms
        // - Medium lag (26-60 chars): drip 5-15 chars per frame
        // - Low lag (11-25 chars): drip 3-5 chars per frame
        // - Tiny lag (5-10 chars): drip 2 chars per frame
        // - Typewriter baseline (1-4 chars): drip 1 char per frame (~60 chars/sec)
        let step = 1
        if (lag > 150) {
            step = Math.ceil(lag / 3)
        } else if (lag > 60) {
            step = Math.ceil(lag / 4)
        } else if (lag > 25) {
            step = Math.ceil(lag / 5)
        } else if (lag > 10) {
            step = 3
        } else if (lag > 4) {
            step = 2
        } else {
            step = 1
        }

        let targetPos = this.drippedText.length + step
        if (targetPos > this.targetText.length) {
            targetPos = this.targetText.length
        }

        // Avoid splitting UTF-16 surrogate pairs (e.g. emojis or CJK supplement)
        if (targetPos < this.targetText.length) {
            const code = this.targetText.charCodeAt(targetPos - 1)
            if (code >= 0xd800 && code <= 0xdbff) {
                targetPos++
            }
        }

        const delta = this.targetText.slice(this.drippedText.length, targetPos)
        this.drippedText = this.targetText.slice(0, targetPos)

        this.onDrip?.(delta, this.drippedText)

        if (this.drippedText.length >= this.targetText.length) {
            this.stopTimer()
            this.onDrain?.()
        }
    }
}
