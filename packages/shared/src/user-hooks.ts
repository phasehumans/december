import { spawn } from 'node:child_process'
import fs from 'node:fs'

/**
 * User hooks: shell commands that run on agent events, read from
 * ~/.december/hooks.json (global) and <workspace>/.december/hooks.json (project).
 *
 * The file uses the Claude Code event names and JSON shape, so existing hook
 * configs can be copied over:
 *
 * {
 *   "hooks": {
 *     "PreToolUse": [
 *       { "matcher": "bash|edit_file", "hooks": [{ "type": "command", "command": "./check.sh", "timeout": 60 }] }
 *     ]
 *   }
 * }
 *
 * Each command gets the event as JSON on stdin. Exit code 2 blocks (PreToolUse,
 * UserPromptSubmit) or asks the agent to keep going (Stop); stderr is the reason.
 * Notification runs when December waits for the user or a long turn finishes; its JSON
 * has a `reason` and a `message`, and its exit code does nothing.
 */

export const USER_HOOK_EVENTS = [
    'PreToolUse',
    'PostToolUse',
    'UserPromptSubmit',
    'Stop',
    'SessionStart',
    'Notification',
] as const

export type UserHookEvent = (typeof USER_HOOK_EVENTS)[number]

/** events that match on the tool name */
const TOOL_EVENTS = new Set<UserHookEvent>(['PreToolUse', 'PostToolUse'])

export const DEFAULT_HOOK_TIMEOUT_SECONDS = 60

/** limits of the hooks saved on a web account; a cloud session runs them in the sandbox */
export const MAX_ACCOUNT_HOOKS = 50
export const MAX_HOOK_TIMEOUT_SECONDS = 600
export const MAX_HOOK_COMMAND_LENGTH = 2000
export const MAX_HOOK_MATCHER_LENGTH = 200

/**
 * A matcher runs as a regex on every tool call. A web account may save a matcher only when it
 * is a valid regex with no repeated group that holds a repeat ("(a+)+"), which can take very
 * long on some names. Empty and "*" match every tool.
 */
export const isSafeHookMatcher = (matcher: string): boolean => {
    if (!matcher || matcher === '*') return true
    if (matcher.length > MAX_HOOK_MATCHER_LENGTH) return false
    try {
        new RegExp(matcher)
    } catch {
        // Intentionally swallowed: a matcher that is not a regex is not safe
        return false
    }
    return !/\([^)]*[+*}][^)]*\)\s*[+*{?]/.test(matcher)
}

/** true for the events that match on the tool name */
export const isToolHookEvent = (event: UserHookEvent): boolean => TOOL_EVENTS.has(event)

/** runs one hook command; the cli spawns it here, a cloud session runs it in the sandbox */
export type HookCommandRunner = (
    hook: UserHook,
    payload: Record<string, unknown>,
    cwd: string
) => Promise<HookRunResult>

export interface UserHook {
    event: UserHookEvent
    /** regex on the tool name for tool events; empty or "*" matches every tool */
    matcher: string
    command: string
    timeoutSeconds: number
    /** a cloud session gives the hooks saved on the web account as global */
    source: 'global' | 'project'
    sourcePath: string
}

export interface HookRunResult {
    hook: UserHook
    exitCode: number | null
    stdout: string
    stderr: string
    timedOut: boolean
    error?: string
}

function readHooksJson(filePath: string): { data?: any; error?: string } {
    if (!fs.existsSync(filePath)) return {}
    try {
        return { data: JSON.parse(fs.readFileSync(filePath, 'utf-8')) }
    } catch (err: any) {
        return { error: `invalid JSON: ${err?.message || String(err)}` }
    }
}

/** parses one hooks.json; returns the hooks and a list of problems */
export function parseUserHooksFile(
    filePath: string,
    source: 'global' | 'project'
): { hooks: UserHook[]; problems: string[] } {
    const { data, error } = readHooksJson(filePath)
    if (error) return { hooks: [], problems: [error] }
    if (data === undefined) return { hooks: [], problems: [] }
    return parseUserHooksData(data, source, filePath)
}

/**
 * Parses the JSON of a hooks.json that is already read. The web reads a pasted file with
 * this, so a file means the same in the cli and in a cloud session.
 */
export function parseUserHooksData(
    data: unknown,
    source: UserHook['source'],
    sourcePath: string
): { hooks: UserHook[]; problems: string[] } {
    const hooks: UserHook[] = []
    const problems: string[] = []
    const root = (data as { hooks?: unknown } | null)?.hooks
    if (!root || typeof root !== 'object' || Array.isArray(root)) {
        return { hooks, problems: ['missing a "hooks" object'] }
    }

    for (const [event, groups] of Object.entries(root)) {
        if (!(USER_HOOK_EVENTS as readonly string[]).includes(event)) {
            problems.push(`unknown event "${event}" (use ${USER_HOOK_EVENTS.join(', ')})`)
            continue
        }
        if (!Array.isArray(groups)) {
            problems.push(`"${event}" must be a list`)
            continue
        }
        for (const group of groups as any[]) {
            const matcher = typeof group?.matcher === 'string' ? group.matcher : ''
            if (matcher && matcher !== '*') {
                try {
                    new RegExp(matcher)
                } catch {
                    problems.push(`"${event}" matcher "${matcher}" is not a valid regex`)
                    continue
                }
            }
            const entries = Array.isArray(group?.hooks) ? group.hooks : []
            if (entries.length === 0) {
                problems.push(`"${event}" entry has no "hooks" list`)
            }
            for (const entry of entries) {
                if (entry?.type !== undefined && entry.type !== 'command') {
                    problems.push(
                        `"${event}" hook type "${entry.type}" is not supported (use "command")`
                    )
                    continue
                }
                if (typeof entry?.command !== 'string' || !entry.command.trim()) {
                    problems.push(`"${event}" hook has no "command"`)
                    continue
                }
                const timeout =
                    typeof entry.timeout === 'number' && entry.timeout > 0
                        ? entry.timeout
                        : DEFAULT_HOOK_TIMEOUT_SECONDS
                hooks.push({
                    event: event as UserHookEvent,
                    matcher,
                    command: entry.command,
                    timeoutSeconds: timeout,
                    source,
                    sourcePath,
                })
            }
        }
    }
    return { hooks, problems }
}

/** problems in a hooks.json, for /check. A missing file has none. */
export function validateUserHooksFile(filePath: string): string[] {
    return parseUserHooksFile(filePath, 'global').problems.filter(
        (p) => !p.startsWith('invalid JSON') // the JSON check is reported separately
    )
}

/**
 * Loads global hooks, and project hooks when `includeProject` is true. Callers pass
 * false for an untrusted workspace: a cloned repo must not run commands on its own.
 */
export function loadUserHooks(options: {
    globalPath: string
    projectPath: string
    includeProject: boolean
}): UserHook[] {
    const hooks = parseUserHooksFile(options.globalPath, 'global').hooks
    if (options.includeProject && options.projectPath !== options.globalPath) {
        hooks.push(...parseUserHooksFile(options.projectPath, 'project').hooks)
    }
    return hooks
}

export function hookMatches(hook: UserHook, event: UserHookEvent, toolName?: string): boolean {
    if (hook.event !== event) return false
    if (!TOOL_EVENTS.has(event)) return true
    if (!hook.matcher || hook.matcher === '*') return true
    try {
        return new RegExp(`^(?:${hook.matcher})$`).test(toolName || '')
    } catch {
        // Intentionally swallowed: an invalid matcher matches nothing (reported by /check)
        return false
    }
}

/** runs one hook command with the payload as JSON on stdin */
export function runHookCommand(
    hook: UserHook,
    payload: Record<string, unknown>,
    cwd: string
): Promise<HookRunResult> {
    return new Promise((resolve) => {
        const isWindows = process.platform === 'win32'
        const child = spawn(
            isWindows ? 'cmd' : 'sh',
            isWindows ? ['/c', hook.command] : ['-c', hook.command],
            {
                cwd,
                env: { ...process.env, DECEMBER_PROJECT_DIR: cwd, DECEMBER_HOOK_EVENT: hook.event },
                stdio: ['pipe', 'pipe', 'pipe'],
                // own process group, so a timeout can stop the commands the hook started
                detached: !isWindows,
            }
        )
        let stdout = ''
        let stderr = ''
        let timedOut = false
        let settled = false
        const finish = (exitCode: number | null, error?: string) => {
            if (settled) return
            settled = true
            clearTimeout(timer)
            resolve({
                hook,
                exitCode,
                stdout: stdout.trim(),
                stderr: stderr.trim(),
                timedOut,
                error,
            })
        }
        const timer = setTimeout(() => {
            timedOut = true
            try {
                if (!isWindows && child.pid) process.kill(-child.pid, 'SIGKILL')
                else child.kill('SIGKILL')
            } catch {
                // Intentionally swallowed: the process group already exited
                child.kill('SIGKILL')
            }
            // do not wait for 'close': a grandchild can keep the pipes open
            finish(null)
        }, hook.timeoutSeconds * 1000)

        child.stdout.on('data', (d) => {
            if (stdout.length < 64_000) stdout += d.toString()
        })
        child.stderr.on('data', (d) => {
            if (stderr.length < 64_000) stderr += d.toString()
        })
        // ChildProcess event typings are missing under @types/bun (same cast as tools/bash-operations)
        ;(child as any).on('error', (err: Error) => finish(null, err.message))
        ;(child as any).on('close', (code: number | null) => finish(timedOut ? null : code))
        child.stdin.on('error', () => {
            // Intentionally swallowed: the hook may exit without reading stdin
        })
        child.stdin.end(JSON.stringify(payload))
    })
}

/** runs every hook that matches the event, one after another, in file order */
export async function runUserHooks(
    hooks: UserHook[],
    event: UserHookEvent,
    payload: Record<string, unknown>,
    options: { cwd: string; toolName?: string; runCommand?: HookCommandRunner }
): Promise<HookRunResult[]> {
    const results: HookRunResult[] = []
    const run = options.runCommand ?? runHookCommand
    for (const hook of hooks) {
        if (!hookMatches(hook, event, options.toolName)) continue
        results.push(
            await run(hook, { hook_event_name: event, cwd: options.cwd, ...payload }, options.cwd)
        )
    }
    return results
}

/** the first result that asks to block (exit code 2), with its reason */
export function findBlockingResult(results: HookRunResult[]): HookRunResult | undefined {
    return results.find((r) => r.exitCode === 2)
}

export function describeHookFailure(result: HookRunResult): string {
    if (result.timedOut) return `timed out after ${result.hook.timeoutSeconds}s`
    if (result.error) return result.error
    return result.stderr || `exit code ${result.exitCode}`
}
