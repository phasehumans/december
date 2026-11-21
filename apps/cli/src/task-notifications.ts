import type { BackgroundTask, TaskManager } from './task-manager'

const TAIL_LINES = 10
const TAIL_LINE_CHARS = 200
const COMMAND_CHARS = 80

export interface TaskNotification {
    /** text added to the model's context at the start of its next turn */
    modelText: string
    /** one-line notice for the transcript */
    transcriptText: string
    tone: 'success' | 'error' | 'muted'
}

export interface TaskNotificationHandlers {
    /** queues the note for the model's next turn (agent.steer) */
    steer: (text: string) => void
    /** shows the one-line notice to the user; optional in headless mode */
    notice?: (text: string, tone: TaskNotification['tone']) => void
}

function formatElapsed(ms: number): string {
    const secs = Math.floor(Math.max(0, ms) / 1000)
    if (secs < 60) return `${secs}s`
    const mins = Math.floor(secs / 60)
    if (mins < 60) return `${mins}m ${secs % 60}s`
    return `${Math.floor(mins / 60)}h ${mins % 60}m`
}

function oneLine(text: string, max: number): string {
    const flat = text.replace(/\s+/g, ' ').trim()
    return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat
}

function tail(output: string): string {
    const lines = output.replace(/\s+$/, '').split(/\r?\n/)
    return lines
        .slice(-TAIL_LINES)
        .map((line) =>
            line.length > TAIL_LINE_CHARS ? `${line.slice(0, TAIL_LINE_CHARS)}…` : line
        )
        .join('\n')
}

/**
 * whether the agent should hear about this task: background tasks that ended on their
 * own, or were stopped by their timeout. Tasks the user or the agent stopped are skipped,
 * because whoever stopped them already knows.
 */
export function shouldNotify(task: BackgroundTask): boolean {
    if (task.notified || !task.background) return false
    if (task.status === 'running') return false
    if (task.status === 'killed') return task.killReason === 'timeout'
    return true
}

export function formatTaskNotification(task: BackgroundTask): TaskNotification {
    const end = task.completedAt ? task.completedAt.getTime() : Date.now()
    const elapsed = formatElapsed(end - task.createdAt.getTime())
    const command = oneLine(task.command, COMMAND_CHARS)
    const timedOut = task.status === 'killed'

    let outcome: string
    if (timedOut) outcome = `was stopped by its timeout after ${elapsed}`
    else if (task.type === 'subagent') outcome = `${task.status} after ${elapsed}`
    else outcome = `exited with code ${task.exitCode ?? 'unknown'} after ${elapsed}`

    const lines: string[] = []
    if (task.type === 'subagent') {
        lines.push(
            `Background subagent ${task.id} (${task.role ?? 'subagent'}: ${command}) ${outcome}.`
        )
        lines.push(
            `Use manage_subagent with action "status" and subagentId "${task.id}" for its full report.`
        )
    } else {
        lines.push(`Background shell ${task.id} (${command}) ${outcome}.`)
        const out = tail(task.output)
        if (out.trim()) {
            lines.push(`Last output:\n${out}`)
        }
    }

    const tone: TaskNotification['tone'] = timedOut
        ? 'muted'
        : task.status === 'completed'
          ? 'success'
          : 'error'
    const result = timedOut
        ? 'timed out'
        : task.type === 'subagent'
          ? task.status
          : `exit ${task.exitCode ?? '?'}`
    const label = task.type === 'subagent' ? `${task.role ?? 'subagent'} · ${command}` : command

    // S14: "Task t_8f2a finished: bun dev · exit 0", failures point to /tasks
    const state = timedOut ? 'timed out' : task.status === 'completed' ? 'finished' : 'failed'
    const facts = [label]
    if (!timedOut && task.type !== 'subagent') facts.push(result)
    if (tone !== 'success') facts.push('/tasks')
    return {
        modelText: `<task-notification>\n${lines.join('\n')}\n</task-notification>`,
        transcriptText: `Task ${task.id} ${state}: ${facts.join(' · ')}`,
        tone,
    }
}

/**
 * tells the agent (and the user) when a background task finishes. The note is queued with
 * steer(), so it reaches the model at the start of its next turn; nothing starts a turn.
 * Returns a function that detaches the listeners.
 */
export function attachTaskNotifications(
    manager: TaskManager,
    handlers: TaskNotificationHandlers
): () => void {
    const onFinished = (task: BackgroundTask) => {
        if (!shouldNotify(task)) return
        task.notified = true
        const notification = formatTaskNotification(task)
        handlers.steer(notification.modelText)
        handlers.notice?.(notification.transcriptText, notification.tone)
    }
    manager.on('task:completed', onFinished)
    manager.on('task:killed', onFinished)
    return () => {
        manager.off('task:completed', onFinished)
        manager.off('task:killed', onFinished)
    }
}
