import { EventEmitter } from 'node:events'

import { killProcessGroup } from '@december/tools'

import type { ChildProcess } from 'node:child_process'

/** why a task was stopped before it exited on its own */
export type TaskKillReason = 'user' | 'agent' | 'timeout' | 'abort' | 'exit'

export interface BackgroundTask {
    id: string
    command: string
    status: 'running' | 'completed' | 'failed' | 'killed'
    pid?: number
    /** output kept in memory; older output is dropped past MAX_OUTPUT_CHARS */
    output: string
    /** number of characters dropped from the front of `output` */
    droppedChars: number
    /** absolute character offset (including dropped chars) read by `readNewOutput` */
    lastReadOffset: number
    /** set once the agent has been told that this task finished */
    notified: boolean
    childProcess?: ChildProcess
    abortController?: AbortController
    onKill?: () => void
    type: 'process' | 'subagent'
    role?: string
    depth?: number
    /** subagents: turns started so far */
    turns?: number
    /** false for subagents the parent agent is waiting on (no completion notice needed) */
    background: boolean
    killReason?: TaskKillReason
    createdAt: Date
    completedAt?: Date
    exitCode?: number | null
}

export interface ReadOutputResult {
    output: string
    /** characters that were dropped from memory before they could be read */
    missedChars: number
}

const MAX_OUTPUT_CHARS = 2_000_000 // 2MB cap per task to prevent memory leaks
const KEEP_OUTPUT_CHARS = 1_500_000
const MAX_FINISHED_TASKS = 50

export const TRUNCATED_OUTPUT_MARKER = '[... older output truncated ...]\n'

/** task output as shown to people: a marker first when older output was dropped */
export function getDisplayOutput(task: BackgroundTask): string {
    return task.droppedChars > 0 ? TRUNCATED_OUTPUT_MARKER + task.output : task.output
}

export class TaskManager extends EventEmitter {
    private tasks: BackgroundTask[] = []
    private nextId = 1
    private foreground = new Set<() => void>()

    addTask(command: string, childProcess: ChildProcess): BackgroundTask {
        const task: BackgroundTask = {
            id: `task-${this.nextId++}`,
            command,
            status: 'running',
            pid: childProcess.pid,
            output: '',
            droppedChars: 0,
            lastReadOffset: 0,
            notified: false,
            childProcess,
            type: 'process',
            background: true,
            createdAt: new Date(),
        }
        this.tasks.push(task)
        this.emit('task:added', task)
        this.emit('change')
        return task
    }

    addSubagentTask(options: {
        id?: string
        role: string
        task: string
        depth?: number
        background?: boolean
        abortController?: AbortController
        onKill?: () => void
    }): BackgroundTask {
        const id = options.id || `task-subagent-${this.nextId++}`
        const task: BackgroundTask = {
            id,
            command: options.task,
            status: 'running',
            output: '',
            droppedChars: 0,
            lastReadOffset: 0,
            notified: false,
            type: 'subagent',
            role: options.role,
            depth: options.depth,
            background: options.background ?? true,
            abortController: options.abortController,
            onKill: options.onKill,
            createdAt: new Date(),
        }
        this.tasks.push(task)
        this.emit('task:added', task)
        this.emit('change')
        return task
    }

    getTasks(): BackgroundTask[] {
        return this.tasks
    }

    getTask(id: string): BackgroundTask | undefined {
        return this.tasks.find((t) => t.id === id)
    }

    appendOutput(id: string, chunk: string) {
        const task = this.getTask(id)
        if (task) {
            task.output += chunk
            if (task.output.length > MAX_OUTPUT_CHARS) {
                const dropped = task.output.length - KEEP_OUTPUT_CHARS
                task.output = task.output.slice(dropped)
                task.droppedChars += dropped
            }
            this.emit('task:output', task, chunk)
            this.emit('change')
        }
    }

    /**
     * output written since the last call, then marks it as read. With a filter, only
     * matching lines are returned, but the read position still moves past everything.
     */
    readNewOutput(id: string, filter?: RegExp): ReadOutputResult | undefined {
        const task = this.getTask(id)
        if (!task) return undefined

        const missedChars = Math.max(0, task.droppedChars - task.lastReadOffset)
        const start = Math.max(0, task.lastReadOffset - task.droppedChars)
        let output = task.output.slice(start)
        task.lastReadOffset = task.droppedChars + task.output.length

        if (filter) {
            output = output
                .split(/\r?\n/)
                .filter((line) => {
                    filter.lastIndex = 0
                    return filter.test(line)
                })
                .join('\n')
        }
        return { output, missedChars }
    }

    setTurns(id: string, turns: number) {
        const task = this.getTask(id)
        if (task && task.turns !== turns) {
            task.turns = turns
            this.emit('change')
        }
    }

    markCompleted(id: string, exitCode: number | null) {
        const task = this.getTask(id)
        if (task && task.status === 'running') {
            task.status = exitCode === 0 ? 'completed' : 'failed'
            task.exitCode = exitCode
            task.completedAt = new Date()
            delete task.childProcess
            delete task.abortController
            delete task.onKill
            this.cleanupHistory()
            this.emit('task:completed', task)
            this.emit('change')
        }
    }

    killTask(id: string, reason: TaskKillReason = 'agent'): boolean {
        const task = this.getTask(id)
        if (task && task.status === 'running') {
            if (task.pid) {
                killProcessGroup(task.pid)
            }
            if (task.childProcess) {
                try {
                    task.childProcess.kill('SIGKILL')
                } catch {
                    // Intentionally swallowed: fallback when childProcess kill fails
                }
            }
            if (task.abortController) {
                try {
                    task.abortController.abort()
                } catch {
                    // Intentionally swallowed: abort controller error handling
                }
            }
            if (task.onKill) {
                try {
                    task.onKill()
                } catch {
                    // Intentionally swallowed: onKill callback error handling
                }
            }
            task.status = 'killed'
            task.killReason = reason
            task.exitCode = 130
            task.completedAt = new Date()
            delete task.childProcess
            delete task.abortController
            delete task.onKill
            this.cleanupHistory()
            this.emit('task:killed', task)
            this.emit('change')
            return true
        }
        return false
    }

    killAll(reason: TaskKillReason = 'agent'): number {
        let killedCount = 0
        for (const task of [...this.tasks]) {
            if (task.status === 'running') {
                if (this.killTask(task.id, reason)) {
                    killedCount++
                }
            }
        }
        return killedCount
    }

    clearCompleted() {
        this.tasks = this.tasks.filter((t) => t.status === 'running')
        this.emit('change')
    }

    removeTask(id: string) {
        this.tasks = this.tasks.filter((t) => t.id !== id)
        this.emit('change')
    }

    /**
     * registers a command running in the foreground so Ctrl+B can move it to the
     * background. Returns a function that removes it again.
     */
    registerForeground(promote: () => void): () => void {
        this.foreground.add(promote)
        return () => {
            this.foreground.delete(promote)
        }
    }

    /** moves every foreground command to the background; returns how many moved */
    backgroundForeground(): number {
        const promotes = [...this.foreground]
        this.foreground.clear()
        for (const promote of promotes) {
            promote()
        }
        return promotes.length
    }

    hasForeground(): boolean {
        return this.foreground.size > 0
    }

    private cleanupHistory() {
        const finished = this.tasks.filter((t) => t.status !== 'running')
        if (finished.length > MAX_FINISHED_TASKS) {
            const toRemove = finished.slice(0, finished.length - MAX_FINISHED_TASKS)
            const removeIds = new Set(toRemove.map((t) => t.id))
            this.tasks = this.tasks.filter((t) => !removeIds.has(t.id))
        }
    }
}

const globalSymbols = global as any
if (!globalSymbols.__taskManager) {
    globalSymbols.__taskManager = new TaskManager()
}

export const taskManager = globalSymbols.__taskManager as TaskManager

if (!globalSymbols.__taskManagerCleanupAdded) {
    globalSymbols.__taskManagerCleanupAdded = true
    process.on('exit', () => {
        for (const task of taskManager.getTasks()) {
            if (task.status === 'running') {
                taskManager.killTask(task.id, 'exit')
            }
        }
    })
}
