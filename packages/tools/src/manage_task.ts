import { Tool, ToolExecuteContext, truncateOutput } from '@december/shared'
import { Type, Static } from '@sinclair/typebox'

const STATUS_TAIL_LINES = 20
const LIST_COMMAND_CHARS = 80

const manageTaskSchema = Type.Object({
    action: Type.Union(
        [
            Type.Literal('list'),
            Type.Literal('status'),
            Type.Literal('output'),
            Type.Literal('kill'),
        ],
        {
            description:
                '"list": all background tasks. "status": state and the last lines of one task. "output": only the output written since your last "output" call. "kill": stop a task.',
        }
    ),
    taskId: Type.Optional(
        Type.String({ description: 'The ID of the task. Required for every action except "list".' })
    ),
    filter: Type.Optional(
        Type.String({
            description:
                'For "output": a regular expression. Only matching lines are returned, but all new output is marked as read.',
        })
    ),
})

export type ManageTaskInput = Static<typeof manageTaskSchema>

const UNSUPPORTED = 'Error: Task management is not supported in the current environment.'

export function formatElapsed(ms: number): string {
    const secs = Math.floor(Math.max(0, ms) / 1000)
    if (secs < 60) return `${secs}s`
    const mins = Math.floor(secs / 60)
    if (mins < 60) return `${mins}m ${secs % 60}s`
    return `${Math.floor(mins / 60)}h ${mins % 60}m`
}

function describeState(info: {
    status: string
    exitCode?: number | null
    elapsedMs?: number
}): string {
    const parts: string[] = [info.status]
    if (info.status !== 'running' && info.exitCode !== undefined && info.exitCode !== null) {
        parts.push(`exit ${info.exitCode}`)
    }
    if (info.elapsedMs !== undefined) parts.push(formatElapsed(info.elapsedMs))
    return parts.join(', ')
}

function oneLine(text: string, max: number): string {
    const flat = text.replace(/\s+/g, ' ').trim()
    return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat
}

function lastLines(text: string, count: number): string {
    const lines = text.replace(/\s+$/, '').split(/\r?\n/)
    if (lines.length <= count) return lines.join('\n')
    return [`[... ${lines.length - count} earlier lines ...]`, ...lines.slice(-count)].join('\n')
}

export const ManageTaskTool: Tool<ManageTaskInput> = {
    name: 'manage_task',
    description:
        'List, inspect, read new output from, or stop background tasks (shell commands started in the background, and background subagents). You are told automatically when a task finishes, so do not poll in a loop.',
    inputSchema: manageTaskSchema,
    execute: async ({ action, taskId, filter }, context: ToolExecuteContext) => {
        const bash = context.operations.bash

        if (action === 'list') {
            if (!bash.listTasks) return UNSUPPORTED
            try {
                const tasks = await bash.listTasks()
                if (tasks.length === 0) return 'No background tasks.'
                const rows = tasks.map((t) => {
                    const who = t.type === 'subagent' ? `subagent ${t.role ?? ''}`.trim() : 'shell'
                    const turns =
                        t.type === 'subagent' && t.turns
                            ? `, ${t.turns} turn${t.turns === 1 ? '' : 's'}`
                            : ''
                    return `- [${t.id}] ${who} | ${describeState(t)}${turns} | ${oneLine(t.command, LIST_COMMAND_CHARS)}`
                })
                return `Background tasks (${tasks.length}):\n${rows.join('\n')}`
            } catch (err: any) {
                return `Error: ${err.message}`
            }
        }

        if (!taskId) {
            return `Error: "taskId" is required for action "${action}". Use action "list" to find task ids.`
        }

        if (action === 'status') {
            if (!bash.getTaskStatus) return UNSUPPORTED
            try {
                const info = await bash.getTaskStatus(taskId)
                const header = [`Task [${taskId}] is currently: ${describeState(info)}`]
                if (info.pid) header.push(`PID: ${info.pid}`)
                if (info.role) header.push(`Role: ${info.role}`)
                if (info.command) header.push(`Command: ${oneLine(info.command, 200)}`)
                const tail = info.output.trim()
                    ? lastLines(info.output, STATUS_TAIL_LINES)
                    : '(no output yet)'
                return `${header.join('\n')}\n\nLast output:\n${tail}`
            } catch (err: any) {
                return `Error: ${err.message}`
            }
        }

        if (action === 'output') {
            if (!bash.readTaskOutput) return UNSUPPORTED
            try {
                const result = await bash.readTaskOutput(taskId, filter)
                const state = describeState(result)
                const missed =
                    result.missedChars && result.missedChars > 0
                        ? `\n[${result.missedChars} characters were dropped from memory before this read]`
                        : ''
                if (!result.output.trim()) {
                    return `Task [${taskId}] is ${state}.${missed}\n(no new output${filter ? ' matching the filter' : ''})`
                }
                const body = truncateOutput(result.output).text
                return `Task [${taskId}] is ${state}.${missed}\n\nNew output:\n${body}`
            } catch (err: any) {
                return `Error: ${err.message}`
            }
        }

        if (action === 'kill') {
            if (!bash.killTask) return UNSUPPORTED
            try {
                const killed = await bash.killTask(taskId)
                if (killed) {
                    return `Successfully killed task [${taskId}].`
                }
                return `Task [${taskId}] is either not running or could not be killed.`
            } catch (err: any) {
                return `Error: ${err.message}`
            }
        }

        return 'Invalid action.'
    },
}
