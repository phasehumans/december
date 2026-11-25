/**
 * Matching of allow and deny rules against tool calls, shared by the cli (rules in
 * config files) and cloud sessions (deny rules saved on the account, #632).
 *
 * A rule is an exact target or a prefix ending in `*`:
 * - shell commands: the command line, e.g. `bun test` or `bun test*`
 * - file tools: `<tool>: <path>`, e.g. `edit_file: src/index.ts`
 * - any tool by name, e.g. `web_fetch`
 */

/** shell tools. A bare allow rule for these would approve every command, so it is ignored. */
export const SHELL_TOOL_NAMES = new Set(['bash', 'run_command'])

const FILE_TARGET_KEYS = ['TargetFile', 'path', 'filePath', 'AbsolutePath'] as const

const parseInput = (input: unknown): Record<string, any> => {
    if (input && typeof input === 'object') return input as Record<string, any>
    if (typeof input === 'string' && input.trim()) {
        try {
            const parsed = JSON.parse(input)
            return parsed && typeof parsed === 'object' ? parsed : {}
        } catch {
            // Intentionally swallowed: input that is not json has no targets
            return {}
        }
    }
    return {}
}

/**
 * The string a rule is matched against: the command line for shell tools,
 * `<tool>: <path>` for file tools, otherwise the tool name.
 */
export function getPermissionTarget(toolCall: { name: string; input?: any }): string {
    const input = parseInput(toolCall.input)
    if (SHELL_TOOL_NAMES.has(toolCall.name)) {
        return String(input.CommandLine || input.command || toolCall.name).trim()
    }
    for (const key of FILE_TARGET_KEYS) {
        if (input[key]) return `${toolCall.name}: ${input[key]}`
    }
    return toolCall.name
}

export function matchesRule(pattern: string, target: string): boolean {
    const p = pattern.trim()
    if (!p) return false
    if (p === target) return true
    if (p.endsWith('*')) return target.startsWith(p.slice(0, -1))
    return false
}

/** the first rule in `patterns` that matches the tool call, if any */
export function findMatchingRule(
    patterns: string[],
    toolCall: { name: string; input?: any },
    options?: { allowBareShellName?: boolean }
): string | undefined {
    const target = getPermissionTarget(toolCall)
    const isShell = SHELL_TOOL_NAMES.has(toolCall.name)
    for (const pattern of patterns) {
        if (matchesRule(pattern, target)) return pattern
        // a rule naming the tool covers every call to it, except a bare shell tool
        // name in an allow list, which would approve any command
        if (pattern.trim() === toolCall.name && (!isShell || options?.allowBareShellName)) {
            return pattern
        }
    }
    return undefined
}
