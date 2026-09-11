const isNoColor = typeof process !== 'undefined' && Boolean(process.env.NO_COLOR)

export const THEME_COLORS = {
    BLUE: isNoColor ? '' : '\x1b[38;2;135;178;244m',
    GREEN: isNoColor ? '' : '\x1b[38;2;110;231;183m',
    YELLOW: isNoColor ? '' : '\x1b[38;2;253;224;71m',
    RED: isNoColor ? '' : '\x1b[38;2;252;165;165m',
    WHITE: isNoColor ? '' : '\x1b[38;2;244;244;245m',
    GRAY: isNoColor ? '' : '\x1b[38;2;161;161;170m',
    TRUNK: isNoColor ? '' : '\x1b[38;2;63;63;70m',
    RESET: isNoColor ? '' : '\x1b[0m',
}

const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']

export class TreeReporter {
    private spinnerTimer: NodeJS.Timeout | null = null
    private spinnerIndex = 0
    private spinnerMessage = ''
    private isTTY = Boolean(
        process.stdout?.isTTY &&
        !process.env.CI &&
        process.env.TERM !== 'dumb' &&
        process.env.NODE_ENV !== 'test'
    )

    /**
     * Prints a primary step header: ✱  Headline
     */
    step(headline: string): this {
        this.stopSpinner()
        const { BLUE, WHITE, RESET } = THEME_COLORS
        console.log(`${BLUE}✱${RESET}  ${WHITE}${headline}${RESET}`)
        return this
    }

    /**
     * Prints a detail line under trunk: │  detail
     */
    tree(detail: string): this {
        this.stopSpinner()
        const { TRUNK, GRAY, RESET } = THEME_COLORS
        console.log(`${TRUNK}│${RESET}  ${GRAY}${detail}${RESET}`)
        return this
    }

    /**
     * Prints a labeled property under trunk: │  label:   value
     */
    item(label: string, value: string, pad = 18): this {
        this.stopSpinner()
        const { TRUNK, WHITE, GRAY, RESET } = THEME_COLORS
        const formattedLabel = (label + ':').padEnd(pad)
        console.log(`${TRUNK}│${RESET}  ${WHITE}${formattedLabel}${RESET} ${GRAY}${value}${RESET}`)
        return this
    }

    /**
     * Prints a success check item: │  ✔  message
     */
    success(message: string): this {
        this.stopSpinner()
        const { TRUNK, GREEN, WHITE, RESET } = THEME_COLORS
        console.log(`${TRUNK}│${RESET}  ${GREEN}✔${RESET}  ${WHITE}${message}${RESET}`)
        return this
    }

    /**
     * Prints a warning item: │  ⚠  message
     */
    warn(message: string): this {
        this.stopSpinner()
        const { TRUNK, YELLOW, WHITE, RESET } = THEME_COLORS
        console.log(`${TRUNK}│${RESET}  ${YELLOW}⚠${RESET}  ${WHITE}${message}${RESET}`)
        return this
    }

    /**
     * Prints an error item: │  ✖  message
     */
    error(message: string): this {
        this.stopSpinner()
        const { TRUNK, RED, WHITE, RESET } = THEME_COLORS
        console.log(`${TRUNK}│${RESET}  ${RED}✖${RESET}  ${WHITE}${message}${RESET}`)
        return this
    }

    /**
     * Prints an empty vertical trunk spacer: │
     */
    space(): this {
        this.stopSpinner()
        const { TRUNK, RESET } = THEME_COLORS
        console.log(`${TRUNK}│${RESET}`)
        return this
    }

    /**
     * Starts an animated inline spinner along the trunk line.
     */
    startSpinner(message: string): this {
        this.stopSpinner()
        this.spinnerMessage = message
        this.spinnerIndex = 0

        if (!this.isTTY) {
            return this
        }

        const { TRUNK, BLUE, GRAY, RESET } = THEME_COLORS
        this.spinnerTimer = setInterval(() => {
            const frame = SPINNER_FRAMES[this.spinnerIndex % SPINNER_FRAMES.length]
            this.spinnerIndex++
            process.stdout.write(
                `\r\x1b[2K${TRUNK}│${RESET}  ${BLUE}${frame}${RESET}  ${GRAY}${this.spinnerMessage}${RESET}`
            )
        }, 80)

        const frame = SPINNER_FRAMES[0]
        process.stdout.write(
            `\r\x1b[2K${TRUNK}│${RESET}  ${BLUE}${frame}${RESET}  ${GRAY}${this.spinnerMessage}${RESET}`
        )

        return this
    }

    /**
     * Updates message of current running spinner.
     */
    updateSpinner(message: string): this {
        this.spinnerMessage = message
        if (this.isTTY) {
            const { TRUNK, BLUE, GRAY, RESET } = THEME_COLORS
            const frame = SPINNER_FRAMES[this.spinnerIndex % SPINNER_FRAMES.length]
            process.stdout.write(
                `\r\x1b[2K${TRUNK}│${RESET}  ${BLUE}${frame}${RESET}  ${GRAY}${this.spinnerMessage}${RESET}`
            )
        }
        return this
    }

    /**
     * Stops the running spinner and clears the active terminal line.
     */
    stopSpinner(): this {
        if (this.spinnerTimer) {
            clearInterval(this.spinnerTimer)
            this.spinnerTimer = null
            if (this.isTTY) {
                process.stdout.write('\r\x1b[2K')
            }
        }
        return this
    }
}
