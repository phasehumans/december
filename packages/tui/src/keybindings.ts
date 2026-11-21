import fs from 'node:fs'

/**
 * User keyboard shortcuts from ~/.december/keybindings.json:
 *
 * {
 *   "bindings": {
 *     "togglePlanMode": "ctrl+g",
 *     "newline": ["alt+enter", "ctrl+j"]
 *   }
 * }
 *
 * The tui handles keys by their default sequences. A user binding is applied by
 * translating the bound key into the action's default sequence, and an action's
 * default key stops working once the action is bound to other keys.
 */

export interface KeybindingAction {
    description: string
    defaults: string[]
    /** works everywhere, not only in the input bar */
    global?: boolean
}

export const KEYBINDING_ACTIONS = {
    submit: { description: 'Send the prompt', defaults: ['enter'] },
    newline: {
        description: 'Insert a newline in the prompt',
        defaults: ['alt+enter', 'shift+enter'],
    },
    togglePlanMode: { description: 'Toggle plan mode', defaults: ['shift+tab'] },
    lineStart: { description: 'Go to start of line', defaults: ['ctrl+a'] },
    lineEnd: { description: 'Go to end of line', defaults: ['ctrl+e'] },
    killToEnd: { description: 'Delete to end of line', defaults: ['ctrl+k'] },
    killToStart: { description: 'Delete to start of line', defaults: ['ctrl+u'] },
    deleteWordBack: { description: 'Delete word backward', defaults: ['ctrl+w'] },
    historyPrev: { description: 'Previous prompt in history', defaults: ['ctrl+p'] },
    historyNext: { description: 'Next prompt in history', defaults: ['ctrl+n'] },
    commandMenu: { description: 'Toggle slash command menu', defaults: ['ctrl+l'] },
    copyLastResponse: { description: 'Copy last assistant response', defaults: ['ctrl+y'] },
    toggleToolOutput: {
        description: 'Expand / collapse tool outputs',
        defaults: ['ctrl+o'],
        global: true,
    },
    toggleTasks: { description: 'Toggle background tasks', defaults: ['ctrl+t'], global: true },
    moveToBackground: {
        description: 'Move the running command to the background',
        defaults: ['ctrl+b'],
        global: true,
    },
} as const satisfies Record<string, KeybindingAction>

export type KeybindingActionName = keyof typeof KEYBINDING_ACTIONS

const NAMED_KEYS: Record<string, string[]> = {
    enter: ['\r', '\n'],
    tab: ['\t'],
    'shift+tab': ['\x1b[Z'],
    'alt+enter': ['\x1b\r', '\x1b\n', '\x1b[13;3u', '\x1b[27;3;13~'],
    'shift+enter': ['\x1b[13;2u', '\x1b[27;2;13~', '\x1bOM'],
    'ctrl+enter': ['\x1b[13;5u', '\x1b[27;5;13~'],
    up: ['\x1b[A'],
    down: ['\x1b[B'],
    right: ['\x1b[C'],
    left: ['\x1b[D'],
    home: ['\x1b[H', '\x1b[1~'],
    end: ['\x1b[F', '\x1b[4~'],
    pageup: ['\x1b[5~'],
    pagedown: ['\x1b[6~'],
}

/** keys that cannot be bound: they keep the app usable (exit, cancel) or clash with typing */
const RESERVED = new Set(['ctrl+c', 'esc', 'ctrl+i', 'ctrl+j', 'ctrl+m', 'ctrl+h', 'ctrl+['])

/** the terminal sequences for a key name like "ctrl+k", "alt+f", or "shift+tab" */
export function keyNameToSequences(name: string): string[] | null {
    const key = name.trim().toLowerCase().replace(/\s+/g, '')
    if (RESERVED.has(key)) return null
    if (NAMED_KEYS[key]) return NAMED_KEYS[key]!
    const ctrl = key.match(/^ctrl\+([a-z])$/)
    if (ctrl) return [String.fromCharCode(ctrl[1]!.charCodeAt(0) - 96)]
    const alt = key.match(/^alt\+([a-z0-9])$/)
    if (alt) return [`\x1b${alt[1]}`]
    return null
}

export interface KeymapLoadResult {
    /** action -> key names in effect */
    bindings: Record<KeybindingActionName, string[]>
    problems: string[]
}

function defaultBindings(): Record<KeybindingActionName, string[]> {
    const out = {} as Record<KeybindingActionName, string[]>
    for (const [name, action] of Object.entries(KEYBINDING_ACTIONS)) {
        out[name as KeybindingActionName] = [...action.defaults]
    }
    return out
}

/** reads keybindings.json. Invalid entries are skipped and reported; a missing file means defaults. */
export function loadKeybindings(filePath: string): KeymapLoadResult {
    const bindings = defaultBindings()
    const problems: string[] = []
    if (!fs.existsSync(filePath)) return { bindings, problems }

    let data: any
    try {
        data = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
    } catch (err: any) {
        return {
            bindings,
            problems: [`invalid JSON, using defaults: ${err?.message || String(err)}`],
        }
    }
    const raw = data?.bindings
    if (raw === undefined) return { bindings, problems }
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        return { bindings, problems: ['"bindings" must be an object, using defaults'] }
    }

    for (const [action, value] of Object.entries(raw)) {
        if (!(action in KEYBINDING_ACTIONS)) {
            problems.push(`unknown action "${action}"`)
            continue
        }
        const names = (Array.isArray(value) ? value : [value]).filter(
            (v): v is string => typeof v === 'string'
        )
        const valid = names.filter((n) => {
            if (keyNameToSequences(n)) return true
            problems.push(`"${action}": unknown or reserved key "${n}"`)
            return false
        })
        if (valid.length > 0) bindings[action as KeybindingActionName] = valid
    }
    return { bindings, problems }
}

/** problems in keybindings.json, for /check (JSON errors are reported separately) */
export function validateKeybindingsFile(filePath: string): string[] {
    return loadKeybindings(filePath).problems.filter((p) => !p.startsWith('invalid JSON'))
}

/** translates raw key input according to the user's bindings */
export class Keymap {
    /** user key sequence -> default sequence of the bound action */
    private remap = new Map<string, { target: string; global: boolean }>()
    /** default sequences of actions the user moved to other keys */
    private disabled = new Map<string, boolean>()
    readonly bindings: Record<KeybindingActionName, string[]>
    readonly problems: string[]

    constructor(result: KeymapLoadResult = { bindings: defaultBindings(), problems: [] }) {
        this.bindings = result.bindings
        this.problems = result.problems

        for (const [name, action] of Object.entries(KEYBINDING_ACTIONS) as [
            KeybindingActionName,
            KeybindingAction,
        ][]) {
            const userKeys = this.bindings[name]
            const isDefault =
                userKeys.length === action.defaults.length &&
                userKeys.every((k, i) => k === action.defaults[i])
            if (isDefault) continue

            const target = keyNameToSequences(action.defaults[0]!)![0]!
            const global = Boolean(action.global)
            const userSeqs = new Set(userKeys.flatMap((k) => keyNameToSequences(k) || []))
            for (const def of action.defaults) {
                for (const seq of keyNameToSequences(def) || []) {
                    if (!userSeqs.has(seq)) this.disabled.set(seq, global)
                }
            }
            for (const seq of userSeqs) {
                this.remap.set(seq, { target, global })
                this.disabled.delete(seq)
            }
        }
        // a key bound by the user is never disabled, even if it was another action's default
        for (const seq of this.remap.keys()) this.disabled.delete(seq)
    }

    static fromFile(filePath: string): Keymap {
        return new Keymap(loadKeybindings(filePath))
    }

    /**
     * The key to handle instead of `key`, or null to ignore it.
     * `inInputBar` is false while an overlay is open; then only global actions change.
     */
    translate(key: string, inInputBar: boolean): string | null {
        const mapped = this.remap.get(key)
        if (mapped && (mapped.global || inInputBar)) return mapped.target
        const disabledGlobal = this.disabled.get(key)
        if (disabledGlobal !== undefined && (disabledGlobal || inInputBar)) return null
        return key
    }

    /** the key names in effect for an action, for /help */
    keysFor(action: KeybindingActionName): string[] {
        return this.bindings[action]
    }
}

/** starter file written by /keybindings */
export function defaultKeybindingsFileContent(): string {
    const bindings: Record<string, string | string[]> = {}
    for (const [name, action] of Object.entries(KEYBINDING_ACTIONS)) {
        bindings[name] = action.defaults.length === 1 ? action.defaults[0]! : [...action.defaults]
    }
    return JSON.stringify({ bindings }, null, 4) + '\n'
}
