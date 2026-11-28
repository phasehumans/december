import {
    describeHookFailure,
    findBlockingResult,
    runUserHooks,
    type HookCommandRunner,
    type HookRunResult,
    type UserHook,
    type UserHookEvent,
} from './user-hooks'

/**
 * Connects user hooks to an agent: PreToolUse, PostToolUse and Stop through the agent
 * hooks, and UserPromptSubmit, SessionStart and Notification through the controller. The
 * cli runs the commands on the computer of the user; a cloud session gives a runner that
 * runs them in its sandbox. Both get the same rules from here.
 */

/** a Stop hook can keep a turn going at most this many times in a row */
export const MAX_STOP_HOOK_CONTINUES = 3

type ToolCallLike = { id?: string; name: string; input: unknown }
type ToolResultLike = { result?: unknown; error?: unknown }

/** the parts of an agent that hooks use; the agent package has the full types */
export interface HookableAgent {
    hooks?: {
        beforeToolCall?: (toolCall: any) => Promise<any> | any
        afterToolCall?: (toolCall: any, result: any) => Promise<any> | any
        beforeStop?: () => Promise<any> | any
    }
}

export interface UserHooksAgentController {
    /** runs UserPromptSubmit hooks. `block` stops the prompt; `context` is added to it. */
    runPromptSubmit(prompt: string): Promise<{ block?: string; context?: string }>
    /** runs SessionStart hooks; their output is added to the next prompt */
    runSessionStart(source: 'startup' | 'resume'): Promise<void>
    /** runs Notification hooks when the agent waits for the user or a turn finishes */
    runNotification(reason: string, message: string): Promise<void>
}

export interface AttachUserHooksOptions {
    /** the hooks to run now; read again on every event */
    listHooks: () => UserHook[]
    cwd: string
    /** runs one command; the default spawns it on this computer */
    runCommand?: HookCommandRunner
    /** shown to the user when a hook fails or blocks something */
    onNotice?: (message: string, tone: 'info' | 'error') => void
}

export function attachUserHooks(
    agent: HookableAgent,
    options: AttachUserHooksOptions
): UserHooksAgentController {
    const { listHooks, cwd, runCommand, onNotice } = options
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
            cwd,
            toolName,
            ...(runCommand ? { runCommand } : {}),
        })
        for (const r of results) {
            const failed = r.timedOut || r.error || (r.exitCode !== 0 && r.exitCode !== 2)
            if (failed) {
                onNotice?.(
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
        beforeToolCall: async (toolCall: ToolCallLike) => {
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
                onNotice?.(`PreToolUse hook blocked ${toolCall.name}: ${reason}`, 'info')
                return { block: true, reason }
            }
            return prev
        },
        afterToolCall: async (toolCall: ToolCallLike, result: ToolResultLike) => {
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
            onNotice?.(
                `Stop hook asked the agent to continue (${stopContinues}/${MAX_STOP_HOOK_CONTINUES})`,
                'info'
            )
            return { continue: true, message: `[Stop hook] ${reason}` }
        },
    }

    return {
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
