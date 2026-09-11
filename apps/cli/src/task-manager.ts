import { EventEmitter } from 'node:events'

import { killProcessGroup } from '@december/tools'

import type { ChildProcess } from 'node:child_process'

export interface BackgroundTask {
    id: string
    command: string
    status: 'running' | 'completed' | 'failed' | 'killed'
    pid?: number
    output: string
    childProcess?: ChildProcess
    createdAt: Date
    completedAt?: Date
    exitCode?: number | null
}

const MAX_OUTPUT_CHARS = 2_000_000 // 2MB cap per task to prevent memory leaks

export class TaskManager extends EventEmitter {
    private tasks: BackgroundTask[] = []
    private nextId = 1

    addTask(command: string, childProcess: ChildProcess): BackgroundTask {
        const task: BackgroundTask = {
            id: `task-${this.nextId++}`,
            command,
            status: 'running',
            pid: childProcess.pid,
            output: '',
            childProcess,
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
                task.output = '[... older output truncated ...]\n' + task.output.slice(-1_500_000)
            }
            this.emit('task:output', task, chunk)
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
            this.cleanupHistory()
            this.emit('task:completed', task)
            this.emit('change')
        }
    }

    killTask(id: string): boolean {
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
            task.status = 'killed'
            task.exitCode = 130
            task.completedAt = new Date()
            delete task.childProcess
            this.cleanupHistory()
            this.emit('task:killed', task)
            this.emit('change')
            return true
        }
        return false
    }

    killAll(): number {
        let killedCount = 0
        for (const task of [...this.tasks]) {
            if (task.status === 'running') {
                if (this.killTask(task.id)) {
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

    private cleanupHistory() {
        const completed = this.tasks.filter((t) => t.status !== 'running')
        if (completed.length > 50) {
            const toRemove = completed.slice(0, completed.length - 50)
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
                taskManager.killTask(task.id)
            }
        }
    })
}
