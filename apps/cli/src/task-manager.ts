import type { ChildProcess } from 'node:child_process'

export interface BackgroundTask {
    id: string
    command: string
    status: 'running' | 'completed' | 'failed' | 'killed'
    pid?: number
    output: string
    childProcess?: ChildProcess
    createdAt: Date
}

class TaskManager {
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
        }
    }

    markCompleted(id: string, exitCode: number | null) {
        const task = this.getTask(id)
        if (task && task.status === 'running') {
            task.status = exitCode === 0 ? 'completed' : 'failed'
            delete task.childProcess
            this.cleanupHistory()
        }
    }

    killTask(id: string): boolean {
        const task = this.getTask(id)
        if (task && task.status === 'running') {
            if (task.childProcess) {
                try {
                    if (task.pid) {
                        process.kill(-task.pid, 'SIGINT')
                    } else {
                        task.childProcess.kill('SIGINT')
                    }
                } catch {
                    try {
                        task.childProcess?.kill()
                    } catch {
                        // ignore error
                    }
                }
            }
            task.status = 'killed'
            delete task.childProcess
            this.cleanupHistory()
            return true
        }
        return false
    }

    removeTask(id: string) {
        this.tasks = this.tasks.filter((t) => t.id !== id)
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
