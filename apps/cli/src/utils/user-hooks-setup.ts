import path from 'node:path'

import {
    describeHookFailure,
    findBlockingResult,
    loadUserHooks,
    runUserHooks,
    type HookRunResult,
    type UserHook,
    type UserHookEvent,
} from '@december/shared'

import { getConfigDir, loadConfig } from '../config'

import { isWorkspaceTrusted, resolveWorkspaceRoot } from './workspace-trust'

import type { Agent } from '@december/agent'

/** a Stop hook can keep a turn going at most this many times in a row */
export const MAX_STOP_HOOK_CONTINUES = 3

export interface UserHooksController {
    /** runs UserPromptSubmit hooks. `block` stops the prompt; `context` is added to it. */
    runPromptSubmit(prompt: string): Promise<{ block?: string; context?: string }>
    /** runs SessionStart hooks; their output is added to the next prompt */
    runSessionStart(source: 'startup' | 'resume'): Promise<void>
    /** #617: runs Notification hooks when December waits for the user or a long turn finishes */
    runNotification(reason: string, message: string): Promise<void>
    /** the hooks that run now (project hooks only when the workspace is trusted) */
    listHooks(): UserHook[]
    projectHooksSkipped(): boolean
}

export function getUserHookPaths(workspaceDir: string): {
    globalPath: string
    projectPath: string
} {
    return {
        globalPath: path.join(getConfigDir(), 'hooks.json'),
        projectPath: path.join(path.resolve(workspaceDir), '.december', 'hooks.json'),
    }
}

/**
 * Connects hooks.json to the agent. Hook files are read again on every event, so
 * edits apply without a restart. Project hooks run only in a trusted workspace.
 */
export async function setupUserHooks(
    agent: Agent,
    options: {
        workspaceDir: string
        /** shown to the user when a hook fails or blocks something */
        onNotice?: (message: string, tone: 'info' | 'error') => void
    }
): Promise<UserHooksController> {
    const workspaceDir = path.resolve(options.workspaceDir)
    const paths = getUserHookPaths(workspaceDir)
    let trusted = false
    try {
        trusted = isWorkspaceTrusted(resolveWorkspaceRoot(workspaceDir), await loadConfig())
    } catch {
        // Intentionally swallowed: an unknown trust state means project hooks do not run
        trusted = false
    }

    const listHooks = () => loadUserHooks({ ...paths, includeProject: trusted })

    let pendingContext: string[] = []
    let stopContinues = 0

    const run = async (
        event: UserHookEvent,
        payload: Record<string, unknown>,
        toolName?: string
    ): Promise<HookRunResult[]> => {
        const hooks = listHooks()
        if (!hooks.some((h) => h.event === event)) return []
        const results = await runUserHooks(hooks, event, payload, {
            cwd: workspaceDir,
            toolName,
        })
        for (const r of results) {
            const failed = r.timedOut || r.error || (r.exitCode !== 0 && r.exitCode !== 2)
            if (failed) {
                options.onNotice?.(
                    `${event} hook failed (${r.hook.command}): ${describeHookFailure(r)}`,
                    'error'
                )
            }
        }
        return results
    }

    const previous = agent.hooks || {}
    agent.hooks = {
        ...previous,
        beforeToolCall: async (toolCall) => {
            const prev = await previous.beforeToolCall?.(toolCall)
            if (prev && (prev as any).block) return prev
            const results = await run(
                'PreToolUse',
                { tool_name: toolCall.name, tool_input: toolCall.input },
                toolCall.name
            )
            const blocking = findBlockingResult(results)
            if (blocking) {
                const reason = blocking.stderr || `blocked by hook: ${blocking.hook.command}`
                options.onNotice?.(`PreToolUse hook blocked ${toolCall.name}: ${reason}`, 'info')
                return { block: true, reason }
            }
            return prev
        },
        afterToolCall: async (toolCall, result) => {
            const prev = (await previous.afterToolCall?.(toolCall, result)) || undefined
            const results = await run(
                'PostToolUse',
                {
                    tool_name: toolCall.name,
                    tool_input: toolCall.input,
                    tool_response: {
                        result: prev?.result ?? result.result,
                        error: prev?.error ?? result.error,
                    },
                },
                toolCall.name
            )
            const blocking = findBlockingResult(results)
            if (!blocking?.stderr) return prev
            // exit code 2 sends stderr back to the agent with the tool result
            const base = prev?.result ?? result.result ?? ''
            return {
                ...prev,
                result: `${base}\n\n[PostToolUse hook feedback]\n${blocking.stderr}`,
            }
        },
        beforeStop: async () => {
            const prev = await previous.beforeStop?.()
            if (prev && (prev as any).continue) return prev
            if (stopContinues >= MAX_STOP_HOOK_CONTINUES) return prev
            const results = await run('Stop', { stop_hook_active: stopContinues > 0 })
            const blocking = findBlockingResult(results)
            if (!blocking) return prev
            stopContinues += 1
            const reason = blocking.stderr || 'A Stop hook asked you to continue.'
            options.onNotice?.(
                `Stop hook asked the agent to continue (${stopContinues}/${MAX_STOP_HOOK_CONTINUES})`,
                'info'
            )
            return { continue: true, message: `[Stop hook] ${reason}` }
        },
    }

    return {
        listHooks,
        projectHooksSkipped: () => !trusted,
        async runSessionStart(source) {
            const results = await run('SessionStart', { source })
            for (const r of results) {
                if (r.exitCode === 0 && r.stdout) pendingContext.push(r.stdout)
            }
        },
        async runNotification(reason, message) {
            await run('Notification', { reason, message })
        },
        async runPromptSubmit(prompt) {
            stopContinues = 0
            const results = await run('UserPromptSubmit', { prompt })
            const blocking = findBlockingResult(results)
            if (blocking) {
                return { block: blocking.stderr || `blocked by hook: ${blocking.hook.command}` }
            }
            const context = [
                ...pendingContext,
                ...results.filter((r) => r.exitCode === 0 && r.stdout).map((r) => r.stdout),
            ]
            pendingContext = []
            return context.length > 0 ? { context: context.join('\n\n') } : {}
        },
    }
}

/** wraps hook output that is added to a prompt */
export function appendHookContext(prompt: string, context?: string): string {
    if (!context) return prompt
    return `${prompt}\n\n<hook_context>\n${context}\n</hook_context>`
}
