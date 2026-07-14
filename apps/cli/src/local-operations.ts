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
                const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`
                const logFile = `/tmp/${taskId}.log`

                // Spawn a detached tmux session running the command, piping output to a logfile
                const tmuxCmd = `tmux new-session -d -s ${taskId} "bash -c '${command.replace(/'/g, "'\\''")} 2>&1 | tee ${logFile}'"`

                const child = spawn(tmuxCmd, { shell: true })

                child.on('close', (code) => {
                    if (code !== 0) {
                        return resolve({
                            exitCode: code,
                            output: `Failed to start tmux session for task ${taskId}`,
                        })
                    }

                    // Start tailing the log file
                    const tail = spawn(`tail -f ${logFile}`, { shell: true })

                    let stdout = ''
                    tail.stdout.on('data', (data) => {
                        const chunk = data.toString()
                        stdout += chunk
                        onData(chunk)
                    })

                    // Periodically check if tmux session is still alive
                    const interval = setInterval(() => {
                        exec(`tmux has-session -t ${taskId}`, (err) => {
                            if (err) {
                                // Session is dead, command finished
                                clearInterval(interval)
                                tail.kill()
                                // Optionally read final content
                                fs.readFile(logFile, 'utf8')
                                    .then((finalOut) => {
                                        resolve({ exitCode: null, output: finalOut, taskId })
                                    })
                                    .catch(() => {
                                        resolve({ exitCode: null, output: stdout, taskId })
                                    })
                            }
                        })
                    }, 2000)

                    // Auto detach from agent loop after 3 seconds
                    setTimeout(() => {
                        resolve({
                            exitCode: null,
                            output: `Started background task ${taskId}`,
                            taskId,
                        })
                    }, 3000)
                })
            })
        },
        getTaskStatus: async (taskId) => {
            return new Promise((resolve) => {
                exec(`tmux has-session -t ${taskId}`, (err) => {
                    const status = err ? 'completed' : 'running'
                    fs.readFile(`/tmp/${taskId}.log`, 'utf8')
                        .then((out) => {
                            resolve({ status, output: out })
                        })
                        .catch(() => {
                            resolve({ status, output: 'No output found' })
                        })
                })
            })
        },
        killTask: async (taskId) => {
            return new Promise((resolve) => {
                exec(`tmux kill-session -t ${taskId}`, (err) => {
                    resolve(!err)
                })
            })
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
