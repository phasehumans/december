import { Type, type Static } from '@december/tools'

import { defaultSubagentManager, SubagentManager } from './subagent-manager'

import type { SubagentWorkspaceMode } from './subagent-types'
import type { Tool, ToolExecuteContext } from '@december/shared'

const subagentSpecSchema = Type.Object({
    role: Type.String({
        description:
            'The specialized role for the subagent (e.g. "researcher", "test runner", "code reviewer", "debugger", "security auditor").',
    }),
    task: Type.String({
        description:
            'Actionable, detailed prompt description of the task for the subagent to accomplish.',
    }),
    model: Type.Optional(
        Type.String({
            description:
                'Optional model override for this subagent (e.g. "gemini-3.6-flash", "claude-haiku"). Defaults to parent model.',
        })
    ),
    tools: Type.Optional(
        Type.Array(Type.String(), {
            description:
                'Optional tool whitelist for the subagent. If omitted, defaults to role-based scoped tools.',
        })
    ),
    workspace: Type.Optional(
        Type.Union([Type.Literal('inherit'), Type.Literal('worktree'), Type.Literal('branch')], {
            description:
                'Workspace isolation mode: "inherit" (default) uses parent workspace, "worktree" creates an isolated git worktree branch for safe modifications.',
        })
    ),
    worktreeLifecycle: Type.Optional(
        Type.Union([Type.Literal('keep'), Type.Literal('cleanup'), Type.Literal('merge')], {
            description:
                'Lifecycle action for the worktree upon task completion: "keep" preserves branch, "cleanup" discards without trace, "merge" merges back into base branch.',
        })
    ),
    maxTurns: Type.Optional(
        Type.Number({
            description:
                'Optional turn limit for the subagent to prevent infinite loops (default 15).',
        })
    ),
    timeoutMs: Type.Optional(
        Type.Number({
            description: 'Optional execution timeout in milliseconds for this subagent.',
        })
    ),
})

const invokeSubagentSchema = Type.Object({
    role: Type.Optional(
        Type.String({
            description:
                'The specialized role for the subagent (e.g. "researcher", "test runner", "code reviewer", "debugger", "security auditor"). Required if "subagents" batch is not provided.',
        })
    ),
    task: Type.Optional(
        Type.String({
            description:
                'Actionable, detailed prompt description of the task for the subagent to accomplish. Required if "subagents" batch is not provided.',
        })
    ),
    model: Type.Optional(
        Type.String({
            description:
                'Optional model override for the subagent (e.g. "gemini-3.6-flash", "claude-haiku"). Defaults to parent model.',
        })
    ),
    tools: Type.Optional(
        Type.Array(Type.String(), {
            description:
                'Optional tool whitelist for the subagent (e.g. ["read_file", "grep", "find_files"]). If omitted, defaults to read-only tools for research/review roles, or inherits available non-subagent tools.',
        })
    ),
    workspace: Type.Optional(
        Type.Union([Type.Literal('inherit'), Type.Literal('worktree'), Type.Literal('branch')], {
            description:
                'Workspace isolation mode: "inherit" (default) uses parent workspace, "worktree" creates an isolated git worktree branch for safe modifications.',
        })
    ),
    worktreeLifecycle: Type.Optional(
        Type.Union([Type.Literal('keep'), Type.Literal('cleanup'), Type.Literal('merge')], {
            description:
                'Lifecycle action for the worktree upon task completion: "keep" preserves branch, "cleanup" discards without trace, "merge" merges back into base branch.',
        })
    ),
    maxTurns: Type.Optional(
        Type.Number({
            description: 'Optional turn limit for the subagent (default 15).',
        })
    ),
    timeoutMs: Type.Optional(
        Type.Number({
            description: 'Optional execution timeout in milliseconds.',
        })
    ),
    background: Type.Optional(
        Type.Boolean({
            description:
                'Whether to execute the subagent(s) in the background without blocking. If true, returns subagent ID(s) immediately.',
        })
    ),
    subagents: Type.Optional(
        Type.Array(subagentSpecSchema, {
            description:
                'Optional batch array of subagents to spawn concurrently in parallel. If provided, overrides top-level role/task.',
        })
    ),
})

export type InvokeSubagentInput = Static<typeof invokeSubagentSchema>

export function createInvokeSubagentTool(manager?: SubagentManager): Tool<InvokeSubagentInput> {
    const subagentManager = manager || defaultSubagentManager

    return {
        name: 'invoke_subagent',
        description:
            'Delegate a complex exploratory, research, test debugging, or specialized task to an isolated dynamic subagent (or batch of parallel subagents) with fresh context, custom role, scoped tool access, optional model override, and optional workspace branching (git worktree). Returns an executive rollup summary to keep the parent context clean.',
        inputSchema: invokeSubagentSchema,
        execute: async (input, context: ToolExecuteContext) => {
            const parentAgent = context.agent
            if (!parentAgent) {
                return 'Error: Cannot invoke subagent without active agent context.'
            }

            // Sync tracker if platform adapter provides one
            const tracker = context.operations?.subagentTracker
            if (tracker && subagentManager.getTracker() !== tracker) {
                subagentManager.setTracker(tracker)
            }

            const {
                role,
                task,
                model,
                tools,
                workspace = 'inherit',
                maxTurns,
                timeoutMs,
                background = false,
                subagents,
            } = input

            // Batch execution path
            if (subagents && subagents.length > 0) {
                if (background) {
                    const handles = subagents.map((spec) =>
                        subagentManager.spawnBackground({
                            role: spec.role,
                            task: spec.task,
                            model: spec.model,
                            tools: spec.tools,
                            workspace: (spec.workspace || 'inherit') as SubagentWorkspaceMode,
                            maxTurns: spec.maxTurns,
                            timeoutMs: spec.timeoutMs,
                            parentAgent,
                            signal: context.signal,
                            onStream: (chunk) => context.onStream?.(chunk),
                        })
                    )

                    const rows = handles.map(
                        (h) => `- [${h.id}] Role: ${h.role} | Task: ${h.task.slice(0, 50)}`
                    )
                    return [
                        `Batch subagents spawned in background (${handles.length} tasks):`,
                        ...rows,
                        '',
                        "Use 'manage_subagent' with action 'list' or 'status' to monitor progress.",
                    ].join('\n')
                }

                // Blocking parallel execution
                const results = await Promise.all(
                    subagents.map((spec) =>
                        subagentManager.spawn({
                            role: spec.role,
                            task: spec.task,
                            model: spec.model,
                            tools: spec.tools,
                            workspace: (spec.workspace || 'inherit') as SubagentWorkspaceMode,
                            maxTurns: spec.maxTurns,
                            timeoutMs: spec.timeoutMs,
                            parentAgent,
                            signal: context.signal,
                            onStream: (chunk) => context.onStream?.(chunk),
                        })
                    )
                )

                const reports = results.map((r) => r.formattedReport).join('\n\n---\n\n')
                return `### Batch Subagents Execution (${results.length} tasks)\n\n${reports}`
            }

            // Single subagent execution path
            if (!role || !task) {
                return 'Error: Either provide "role" and "task", or provide a "subagents" batch array.'
            }

            if (background) {
                const handle = subagentManager.spawnBackground({
                    role,
                    task,
                    model,
                    tools,
                    workspace: workspace as SubagentWorkspaceMode,
                    maxTurns,
                    timeoutMs,
                    parentAgent,
                    signal: context.signal,
                    onStream: (chunk) => context.onStream?.(chunk),
                })

                return [
                    `Subagent spawned in background: [${handle.id}]`,
                    `- Role: ${role}`,
                    `- Task: ${task}`,
                    `- Depth: ${handle.depth}`,
                    model ? `- Model: ${model}` : '',
                    `- Workspace: ${workspace}`,
                    `- Status: running`,
                    '',
                    `Use 'manage_subagent' with subagentId '${handle.id}' to inspect status, steer with instructions, or kill.`,
                ]
                    .filter(Boolean)
                    .join('\n')
            }

            const result = await subagentManager.spawn({
                role,
                task,
                model,
                tools,
                workspace: workspace as SubagentWorkspaceMode,
                maxTurns,
                timeoutMs,
                parentAgent,
                signal: context.signal,
                onStream: (chunk) => context.onStream?.(chunk),
            })

            return result.formattedReport
        },
    }
}

export function createSpawnSubagentTool(manager?: SubagentManager): Tool<InvokeSubagentInput> {
    const tool = createInvokeSubagentTool(manager)
    return {
        ...tool,
        name: 'spawn_subagent',
    }
}

const manageSubagentSchema = Type.Object({
    action: Type.Union(
        [
            Type.Literal('status'),
            Type.Literal('list'),
            Type.Literal('message'),
            Type.Literal('kill'),
        ],
        {
            description:
                'The action to perform on dynamic subagents: "status" (check progress and output), "list" (list all subagents), "message" (send steering instruction), or "kill" (cancel subagent).',
        }
    ),
    subagentId: Type.Optional(
        Type.String({
            description: 'The ID of the subagent to manage (required for status, message, kill).',
        })
    ),
    message: Type.Optional(
        Type.String({
            description:
                'The steering instruction or prompt to deliver to a running subagent (required for action "message").',
        })
    ),
})

export type ManageSubagentInput = Static<typeof manageSubagentSchema>

export function createManageSubagentTool(manager?: SubagentManager): Tool<ManageSubagentInput> {
    const subagentManager = manager || defaultSubagentManager

    return {
        name: 'manage_subagent',
        description:
            'Inspect, steer, list, or terminate dynamic subagents running in background or completed sessions.',
        inputSchema: manageSubagentSchema,
        execute: async ({ action, subagentId, message }, _context: ToolExecuteContext) => {
            switch (action) {
                case 'list': {
                    const list = subagentManager.list()
                    if (list.length === 0) {
                        return 'No subagents currently registered.'
                    }

                    const rows = list.map((s) => {
                        const durationSec = (s.durationMs / 1000).toFixed(1)
                        const modelStr = s.model ? ` | Model: ${s.model}` : ''
                        return `- [${s.id}] Role: ${s.role} | Depth: ${s.depth}${modelStr} | Status: ${s.status} (${durationSec}s) | Task: ${s.task.slice(0, 50)}`
                    })
                    return `### Active & Completed Subagents (${list.length})\n${rows.join('\n')}`
                }

                case 'status': {
                    if (!subagentId) {
                        return 'Error: subagentId is required for "status" action.'
                    }

                    const handle = subagentManager.get(subagentId)
                    if (!handle) {
                        return `Error: Subagent [${subagentId}] not found.`
                    }

                    const summary = handle.getSummary()
                    const output = handle.getOutput()
                    const durationSec = (
                        ((handle.completedAt?.getTime() || Date.now()) -
                            handle.startedAt.getTime()) /
                        1000
                    ).toFixed(1)

                    if (summary) {
                        return summary.formattedReport
                    }

                    return [
                        `### Subagent [${handle.id}] - ${handle.status.toUpperCase()}`,
                        `- Role: ${handle.role}`,
                        `- Task: ${handle.task}`,
                        `- Depth: ${handle.depth}`,
                        handle.model ? `- Model: ${handle.model}` : '',
                        `- Duration: ${durationSec}s`,
                        '',
                        '#### Recent Stream Output:',
                        output ? output.slice(-2000) : '(No output recorded yet)',
                    ]
                        .filter(Boolean)
                        .join('\n')
                }

                case 'message': {
                    if (!subagentId) {
                        return 'Error: subagentId is required for "message" action.'
                    }
                    if (!message) {
                        return 'Error: message is required for "message" action.'
                    }

                    const sent = subagentManager.sendMessage(subagentId, message)
                    if (sent) {
                        return `Message queued for subagent [${subagentId}]. It will be injected into its conversation on its next turn.`
                    } else {
                        return `Subagent [${subagentId}] is either not found or no longer running.`
                    }
                }

                case 'kill': {
                    if (!subagentId) {
                        return 'Error: subagentId is required for "kill" action.'
                    }

                    const killed = subagentManager.kill(subagentId)
                    if (killed) {
                        return `Successfully killed subagent [${subagentId}].`
                    } else {
                        return `Subagent [${subagentId}] is either not running or could not be killed.`
                    }
                }

                default:
                    return 'Invalid action.'
            }
        },
    }
}

export const InvokeSubagentTool = createInvokeSubagentTool()
export const SpawnSubagentTool = createSpawnSubagentTool()
export const ManageSubagentTool = createManageSubagentTool()
