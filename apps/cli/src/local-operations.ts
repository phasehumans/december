import { spawn, exec } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'

import { PlatformAdapter } from '@december/agent'
import fg from 'fast-glob'

import { taskManager } from './task-manager'

const execAsync = promisify(exec)

export const localOperations: PlatformAdapter = {
    bash: {
        exec: async (command, onData) => {
            return new Promise((resolve) => {
                let stdout = ''
                let stderr = ''

                const child = spawn(command, {
                    shell: true,
                    detached: true,
                    stdio: 'pipe',
                })

                const task = taskManager.addTask(command, child)

                child.stdout?.on('data', (data) => {
                    const chunk = data.toString()
                    stdout += chunk
                    taskManager.appendOutput(task.id, chunk)
                    onData(chunk)
                })

                child.stderr?.on('data', (data) => {
                    const chunk = data.toString()
                    stderr += chunk
                    taskManager.appendOutput(task.id, chunk)
                    onData(chunk)
                })

                let isFinished = false

                child.on('close', (code) => {
                    taskManager.markCompleted(task.id, code)
                    if (isFinished) return
                    isFinished = true
                    taskManager.removeTask(task.id)
                    resolve({ exitCode: code, output: stdout + '\n' + stderr })
                })

                child.on('error', (err) => {
                    taskManager.markCompleted(task.id, 1)
                    if (isFinished) return
                    isFinished = true
                    taskManager.removeTask(task.id)
                    resolve({ exitCode: 1, output: `Failed to start command: ${err.message}` })
                })

                // Auto-detach logic
                setTimeout(() => {
                    if (isFinished) return
                    isFinished = true

                    child.unref()
                    child.stdout?.unref()
                    child.stderr?.unref()

                    resolve({ exitCode: null, output: stdout + '\n' + stderr, taskId: task.id })
                }, 3000)
            })
        },
        getTaskStatus: async (taskId) => {
            const task = taskManager.getTask(taskId)
            if (!task) throw new Error('Task not found')
            return { status: task.status, output: task.output }
        },
        killTask: async (taskId) => {
            return taskManager.killTask(taskId)
        },
    },
    fs: {
        readFile: async (filepath) => {
            return fs.readFile(path.resolve(process.cwd(), filepath), 'utf8')
        },
        writeFile: async (filepath, content) => {
            const absolutePath = path.resolve(process.cwd(), filepath)
            await fs.mkdir(path.dirname(absolutePath), { recursive: true })
            await fs.writeFile(absolutePath, content, 'utf8')
        },
        readdir: async (dirPath) => {
            const absolutePath = path.resolve(process.cwd(), dirPath)
            const entries = await fs.readdir(absolutePath, { withFileTypes: true })
            return entries.map((entry) => {
                const type = entry.isDirectory() ? 'DIR ' : 'FILE'
                return `[${type}] ${entry.name}`
            })
        },
        mkdir: async (dirPath, options) => {
            const absolutePath = path.resolve(process.cwd(), dirPath)
            await fs.mkdir(absolutePath, options)
        },
        exists: async (filepath) => {
            const absolutePath = path.resolve(process.cwd(), filepath)
            try {
                await fs.access(absolutePath)
                return true
            } catch {
                return false
            }
        },
    },
    search: {
        find: async (dirPath, query) => {
            const files = await fg([query], {
                cwd: dirPath,
                ignore: ['**/node_modules/**', '**/.git/**'],
                dot: true,
            })
            return files.join('\n')
        },
        grep: async (dirPath, query) => {
            try {
                const cmd = `git grep -nI "${query}" ${dirPath} || grep -rnI --exclude-dir=node_modules --exclude-dir=.git "${query}" ${dirPath}`
                const { stdout } = await execAsync(cmd)
                return stdout
            } catch (error: any) {
                if (error.code === 1) return '' // grep returns 1 when no matches
                throw error
            }
        },
    },
    env: {
        cwd: () => process.cwd(),
        get: (key) => process.env[key],
    },
    ui: {
        askQuestion: async () => {
            throw new Error('Not implemented here')
        },
        // Will be monkey-patched by use-agent-session.tsx
        requestPermission: async () => {
            return { block: false }
        },
    },
}
