/**
 * Tells the user when December needs them (#617): it waits on a prompt, or a long turn
 * finished. The terminal output (bell or desktop notification) follows the `notify`
 * setting and the window focus. The `onAttention` callback (the Notification hook) fires
 * for every event, whatever the setting.
 */

export type NotifyMode = 'off' | 'bell' | 'desktop'

export const NOTIFY_MODES: readonly NotifyMode[] = ['off', 'bell', 'desktop']

export type AttentionReason = 'tool_permission' | 'ask_question' | 'plan_approve' | 'turn_finished'

export interface AttentionEvent {
    reason: AttentionReason
    message: string
}

/** Focus state from terminal focus reporting (CSI ?1004h). `unknown` until the first report. */
export type TerminalFocus = 'focused' | 'blurred' | 'unknown'

/** A turn must run this long before "turn finished" fires, and before a prompt fires when focus is unknown */
export const ATTENTION_THRESHOLD_MS = 30_000

/** Two terminal notifications closer than this make one (a plan approval right after its turn ends) */
const TERMINAL_COOLDOWN_MS = 3_000

export const FOCUS_IN = '\x1b[I'
export const FOCUS_OUT = '\x1b[O'
export const ENABLE_FOCUS_REPORTING = '\x1b[?1004h'
export const DISABLE_FOCUS_REPORTING = '\x1b[?1004l'

const MESSAGES: Record<AttentionReason, string> = {
    tool_permission: 'December needs your approval to run a tool',
    ask_question: 'December has a question for you',
    plan_approve: 'December has a plan for you to approve',
    turn_finished: 'December finished',
}

export function attentionMessage(reason: AttentionReason): string {
    return MESSAGES[reason]
}

export function nextNotifyMode(mode: string): NotifyMode {
    const index = NOTIFY_MODES.indexOf(mode as NotifyMode)
    return NOTIFY_MODES[(index + 1) % NOTIFY_MODES.length]!
}

export function normalizeNotifyMode(value: unknown): NotifyMode {
    return NOTIFY_MODES.includes(value as NotifyMode) ? (value as NotifyMode) : 'off'
}

/** Removes control characters and `;`, which ends an OSC 777 field */
function sanitize(text: string): string {
    let out = ''
    for (const ch of text) {
        const code = ch.charCodeAt(0)
        out += code < 32 || code === 127 || ch === ';' ? ' ' : ch
    }
    return out.trim()
}

/**
 * The bytes for a desktop notification, then a bell. OSC 777 for terminals that only know
 * that form (foot, urxvt, VTE), OSC 9 for the rest (iTerm2, Ghostty, WezTerm).
 * A terminal that knows neither ignores the OSC and still rings the bell.
 */
export function desktopNotificationSequence(
    message: string,
    env: Record<string, string | undefined> = process.env
): string {
    const text = sanitize(message)
    const term = env.TERM || ''
    const useOsc777 = term.startsWith('foot') || term.startsWith('rxvt') || !!env.VTE_VERSION
    const osc = useOsc777 ? `\x1b]777;notify;December;${text}\x07` : `\x1b]9;${text}\x07`
    return `${osc}\x07`
}

export interface AttentionNotifierOptions {
    write: (data: string) => void
    onAttention?: (event: AttentionEvent) => void
    now?: () => number
    env?: Record<string, string | undefined>
}

export class AttentionNotifier {
    mode: NotifyMode = 'off'
    focus: TerminalFocus = 'unknown'
    private lastTerminalNotifyAt = -Infinity
    private readonly options: AttentionNotifierOptions

    constructor(options: AttentionNotifierOptions) {
        this.options = options
    }

    /** Records a focus report. Returns true when `key` was one, so the caller drops it. */
    handleFocusSequence(key: string): boolean {
        if (key === FOCUS_IN) {
            this.focus = 'focused'
            return true
        }
        if (key === FOCUS_OUT) {
            this.focus = 'blurred'
            return true
        }
        return false
    }

    /**
     * One event: a prompt opened, or a turn ended normally. `elapsedMs` is how long the
     * turn has run. Returns true when the terminal got a bell or notification.
     */
    notify(reason: AttentionReason, elapsedMs: number): boolean {
        // "turn finished" is only an event for long turns, for the hook too
        if (reason === 'turn_finished' && elapsedMs < ATTENTION_THRESHOLD_MS) return false
        const message = attentionMessage(reason)
        try {
            this.options.onAttention?.({ reason, message })
        } catch {
            // Intentionally swallowed: a failing hook must not stop the terminal notification
        }
        return this.notifyTerminal(message, elapsedMs)
    }

    private notifyTerminal(message: string, elapsedMs: number): boolean {
        if (this.mode === 'off') return false
        if (this.focus === 'focused') return false
        if (this.focus === 'unknown' && elapsedMs < ATTENTION_THRESHOLD_MS) return false
        const now = (this.options.now ?? Date.now)()
        if (now - this.lastTerminalNotifyAt < TERMINAL_COOLDOWN_MS) return false
        this.lastTerminalNotifyAt = now
        this.options.write(
            this.mode === 'desktop'
                ? desktopNotificationSequence(message, this.options.env)
                : '\x07'
        )
        return true
    }
}
