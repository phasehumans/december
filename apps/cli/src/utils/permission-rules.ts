import fs from 'node:fs'
import path from 'node:path'

import { getConfigFile } from '../config'

/**
 * Allow and deny rules for tool calls.
 *
 * Rules live in two files:
 * - global: `approvedTools` / `deniedTools` in ~/.december/config.json
 * - project: `approvedTools` / `deniedTools` in <workspace>/.december/settings.json
 *
 * This module reads and writes those keys straight from disk. loadConfig() merges
 * project settings into the global config, so saving rules through saveConfig()
 * would copy project rules into the global file.
 *
 * A rule is an exact target or a prefix ending in `*`:
 * - shell commands: the command line, e.g. `bun test` or `bun test*`
 * - file tools: `<tool>: <path>`, e.g. `edit_file: src/index.ts`
 * - any tool by name, e.g. `web_fetch` (bare shell tool names are ignored, see below)
 */

export type PermissionRuleKind = 'allow' | 'deny'
export type PermissionRuleScope = 'global' | 'project'

export interface PermissionRules {
    allow: Record<PermissionRuleScope, string[]>
    deny: Record<PermissionRuleScope, string[]>
}

const RULE_KEYS: Record<PermissionRuleKind, 'approvedTools' | 'deniedTools'> = {
    allow: 'approvedTools',
    deny: 'deniedTools',
}

/** shell tools. A bare allow rule for these would approve every command, so it is ignored. */
export const SHELL_TOOL_NAMES = new Set(['bash', 'run_command'])

const FILE_TARGET_KEYS = ['TargetFile', 'path', 'filePath', 'AbsolutePath'] as const

export function getRuleFilePath(scope: PermissionRuleScope, workspaceDir: string): string {
    return scope === 'global'
        ? getConfigFile()
        : path.join(path.resolve(workspaceDir), '.december', 'settings.json')
}

function readJsonObject(filePath: string): Record<string, any> {
    try {
        const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
    } catch {
        // Intentionally swallowed: a missing or unreadable file has no rules
        return {}
    }
}

function readList(obj: Record<string, any>, key: string): string[] {
    const value = obj[key]
    return Array.isArray(value)
        ? value.filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
        : []
}

export function readPermissionRules(workspaceDir: string): PermissionRules {
    const global = readJsonObject(getRuleFilePath('global', workspaceDir))
    const project = readJsonObject(getRuleFilePath('project', workspaceDir))
    return {
        allow: {
            global: readList(global, RULE_KEYS.allow),
            project: readList(project, RULE_KEYS.allow),
        },
        deny: {
            global: readList(global, RULE_KEYS.deny),
            project: readList(project, RULE_KEYS.deny),
        },
    }
}

function writeRuleList(
    kind: PermissionRuleKind,
    scope: PermissionRuleScope,
    workspaceDir: string,
    update: (list: string[]) => string[]
): void {
    const filePath = getRuleFilePath(scope, workspaceDir)
    if (fs.existsSync(filePath)) {
        // never overwrite a file we cannot parse: the user would lose their settings
        try {
            JSON.parse(fs.readFileSync(filePath, 'utf-8'))
        } catch (err: any) {
            throw new Error(
                `Cannot save the rule: ${filePath} is not valid JSON (${err?.message || err})`,
                { cause: err }
            )
        }
    }
    const obj = readJsonObject(filePath)
    const key = RULE_KEYS[kind]
    const next = update(readList(obj, key))
    if (next.length > 0) {
        obj[key] = next
    } else {
        delete obj[key]
    }
    fs.mkdirSync(path.dirname(filePath), { recursive: true })
    fs.writeFileSync(filePath, JSON.stringify(obj, null, 2) + '\n', 'utf-8')
    if (scope === 'global') {
        try {
            fs.chmodSync(filePath, 0o600)
        } catch {
            // Intentionally swallowed: chmod is not supported on every file system
        }
    }
}

export function addPermissionRule(
    kind: PermissionRuleKind,
    scope: PermissionRuleScope,
    pattern: string,
    workspaceDir: string
): void {
    const trimmed = pattern.trim()
    if (!trimmed) throw new Error('The rule is empty.')
    writeRuleList(kind, scope, workspaceDir, (list) =>
        list.includes(trimmed) ? list : [...list, trimmed]
    )
}

export function removePermissionRule(
    kind: PermissionRuleKind,
    scope: PermissionRuleScope,
    pattern: string,
    workspaceDir: string
): void {
    writeRuleList(kind, scope, workspaceDir, (list) => list.filter((p) => p !== pattern))
}

/**
 * The string a rule is matched against: the command line for shell tools,
 * `<tool>: <path>` for file tools, otherwise the tool name.
 */
export function getPermissionTarget(toolCall: { name: string; input?: any }): string {
    const input = toolCall.input || {}
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

/** the deny rule that blocks this call, if any (deny rules from both scopes apply) */
export function findDenyRule(
    toolCall: { name: string; input?: any },
    workspaceDir: string
): string | undefined {
    const rules = readPermissionRules(workspaceDir)
    return findMatchingRule([...rules.deny.project, ...rules.deny.global], toolCall, {
        allowBareShellName: true,
    })
}

/** the allow rule that approves this call, if any */
export function findAllowRule(
    toolCall: { name: string; input?: any },
    workspaceDir: string
): string | undefined {
    const rules = readPermissionRules(workspaceDir)
    return findMatchingRule([...rules.allow.project, ...rules.allow.global], toolCall)
}

/**
 * Removes allow rules that an older "always" button added by mistake: it saved the
 * bare tool name next to the exact command or file, so one approval covered every
 * later call to that tool. Removes a bare shell tool name, and a bare file tool name
 * that has a `<tool>: <path>` rule next to it. Returns the removed rules.
 */
export function cleanupLegacyAllowRules(workspaceDir: string): string[] {
    const removed: string[] = []
    for (const scope of ['global', 'project'] as const) {
        const filePath = getRuleFilePath(scope, workspaceDir)
        if (!fs.existsSync(filePath)) continue
        const list = readList(readJsonObject(filePath), RULE_KEYS.allow)
        const bad = list.filter(
            (p) => SHELL_TOOL_NAMES.has(p) || list.some((other) => other.startsWith(`${p}: `))
        )
        if (bad.length === 0) continue
        try {
            writeRuleList('allow', scope, workspaceDir, (current) =>
                current.filter((p) => !bad.includes(p))
            )
            removed.push(...bad)
        } catch {
            // Intentionally swallowed: an unparsable file is reported by /check instead
        }
    }
    return removed
}
