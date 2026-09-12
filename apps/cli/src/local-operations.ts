import { exec, spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'

import { PlatformAdapter, BashExecOptions } from '@december/agent'
import { getWorkspaceIgnores, isPathIgnored } from '@december/shared'
import { createLocalBashOperations, killProcessGroup } from '@december/tools'
import fg from 'fast-glob'

import { taskManager } from './task-manager'

const execAsync = promisify(exec)
const localBashOps = createLocalBashOperations()

export let activeScopeDir: string | undefined

export function setActiveScopeDir(dir: string | undefined) {
    activeScopeDir = dir
}

export function getScopedCwd(): string {
    if (activeScopeDir) {
        return path.resolve(process.cwd(), activeScopeDir)
    }
    return process.cwd()
}

export const SERVER_READY_REGEX =
    /(?:localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]):\d+|listening on (?:port |http)|ready in \d+(?:\.\d+)?\s*(?:m?s)|ready on http|local:\s+http:\/\//i

export const DEFAULT_BG_TIMEOUT_MS = 20_000
export const DEFAULT_SERVER_READY_DELAY_MS = 2_500

export const localOperations: PlatformAdapter = {
    bash: {
        exec: async (command, cwdOrOnData, options = {}) => {
            const targetCwd = typeof cwdOrOnData === 'string' ? cwdOrOnData : getScopedCwd()
            const actualOptions: BashExecOptions =
                typeof cwdOrOnData === 'function'
                    ? { onData: cwdOrOnData, ...options }
                    : (options ?? {})
            const fallbackTimeoutMs = actualOptions.waitMsBeforeAsync ?? DEFAULT_BG_TIMEOUT_MS
            const serverDelayMs = actualOptions.serverReadyDelayMs ?? DEFAULT_SERVER_READY_DELAY_MS

            return new Promise((resolve, reject) => {
                const child = spawn(command, {
                    cwd: targetCwd,
                    detached: process.platform !== 'win32',
                    env: actualOptions.env ?? process.env,
                    shell: true,
                    stdio: ['pipe', 'pipe', 'pipe'],
                })

                let output = ''
                let resolved = false
                let isBackground = false
                let bgTaskId: string | undefined

                const promoteToBackground = () => {
                    if (resolved || isBackground) return
                    isBackground = true
                    const task = taskManager.addTask(command, child)
                    bgTaskId = task.id
                    if (output) {
                        taskManager.appendOutput(task.id, output)
                    }
                    resolved = true
                    resolve({ exitCode: null, output, taskId: task.id })
                }

                let serverReadyTimer: NodeJS.Timeout | undefined
                const checkServerReady = (text: string) => {
                    if (!isBackground && !serverReadyTimer && SERVER_READY_REGEX.test(text)) {
                        serverReadyTimer = setTimeout(() => {
                            promoteToBackground()
                        }, serverDelayMs)
                    }
                }

                const handleData = (data: Buffer | string) => {
                    const chunk = typeof data === 'string' ? data : data.toString()
                    output += chunk
                    if (isBackground && bgTaskId) {
                        taskManager.appendOutput(bgTaskId, chunk)
                    } else if (!resolved && actualOptions.onData) {
                        actualOptions.onData(chunk)
                    }
                    checkServerReady(chunk)
                }

                child.stdout?.on('data', handleData)
                child.stderr?.on('data', handleData)

                let timeoutHandle: NodeJS.Timeout | undefined
                if (actualOptions.timeout) {
                    timeoutHandle = setTimeout(() => {
                        if (child.pid) killProcessGroup(child.pid)
                        if (isBackground && bgTaskId) {
                            taskManager.killTask(bgTaskId)
                        } else {
                            try {
                                child.kill('SIGKILL')
                            } catch {
                                // Intentionally swallowed: child kill fallback
                            }
                        }
                    }, actualOptions.timeout * 1000)
                }

                const onAbort = () => {
                    if (child.pid) killProcessGroup(child.pid)
                    if (isBackground && bgTaskId) {
                        taskManager.killTask(bgTaskId)
                    } else {
                        try {
                            child.kill('SIGKILL')
                        } catch {
                            // Intentionally swallowed: child kill fallback
                        }
                    }
                }

                if (actualOptions.signal) {
                    if (actualOptions.signal.aborted) onAbort()
                    else actualOptions.signal.addEventListener('abort', onAbort, { once: true })
                }

                const bgTimeout =
                    fallbackTimeoutMs > 0 && fallbackTimeoutMs < Infinity
                        ? setTimeout(() => {
                              promoteToBackground()
                          }, fallbackTimeoutMs)
                        : undefined

                const cleanup = () => {
                    if (serverReadyTimer) clearTimeout(serverReadyTimer)
                    if (bgTimeout) clearTimeout(bgTimeout)
                    if (timeoutHandle) clearTimeout(timeoutHandle)
                    if (actualOptions.signal)
                        actualOptions.signal.removeEventListener('abort', onAbort)
                }

                const finish = (code: number | null) => {
                    cleanup()
                    if (isBackground && bgTaskId) {
                        taskManager.markCompleted(bgTaskId, code)
                    }
                    if (!resolved) {
                        resolved = true
                        resolve({ exitCode: code, output })
                    }
                }

                ;(child as any).on('close', finish)
                ;(child as any).on('exit', (code: number | null) => {
                    // Fallback in case streams remain open after process exit
                    setTimeout(() => finish(code), 50)
                })
                ;(child as any).on('error', (err: any) => {
                    cleanup()
                    if (isBackground && bgTaskId) {
                        taskManager.markCompleted(bgTaskId, 1)
                    }
                    if (!resolved) {
                        resolved = true
                        const errMsg = `\nFailed to start process: ${err?.message || err}\n`
                        output += errMsg
                        resolve({ exitCode: 1, output })
                    }
                })
            })
        },
        getTaskStatus: async (taskId) => {
            const task = taskManager.getTask(taskId)
            if (!task) return { status: 'failed', output: 'Task not found' }
            return { status: task.status, output: task.output }
        },
        killTask: async (taskId) => {
            return taskManager.killTask(taskId)
        },
    } as any,
    fs: {
        readFile: async (filepath) => {
            const root = getScopedCwd()
            const absolutePath = path.isAbsolute(filepath) ? filepath : path.resolve(root, filepath)
            return fs.readFile(absolutePath, 'utf8')
        },
        writeFile: async (filepath, content) => {
            const root = getScopedCwd()
            const absolutePath = path.isAbsolute(filepath) ? filepath : path.resolve(root, filepath)
            await fs.mkdir(path.dirname(absolutePath), { recursive: true })
            await fs.writeFile(absolutePath, content, 'utf8')
        },
        readdir: async (dirPath) => {
            const root = getScopedCwd()
            const absolutePath = path.isAbsolute(dirPath) ? dirPath : path.resolve(root, dirPath)
            const entries = await fs.readdir(absolutePath, { withFileTypes: true })
            const ignores = getWorkspaceIgnores(root)
            return entries
                .filter((entry) => !isPathIgnored(entry.name, ignores))
                .map((entry) => {
                    const type = entry.isDirectory() ? 'DIR ' : 'FILE'
                    return `[${type}] ${entry.name}`
                })
        },
        mkdir: async (dirPath, options) => {
            const root = getScopedCwd()
            const absolutePath = path.isAbsolute(dirPath) ? dirPath : path.resolve(root, dirPath)
            await fs.mkdir(absolutePath, options)
        },
        exists: async (filepath) => {
            const root = getScopedCwd()
            const absolutePath = path.isAbsolute(filepath) ? filepath : path.resolve(root, filepath)
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
            const root = getScopedCwd()
            const targetDir = path.isAbsolute(dirPath) ? dirPath : path.resolve(root, dirPath)
            const ignores = getWorkspaceIgnores(root)
            const files = await fg([query], {
                cwd: targetDir,
                ignore: ignores,
                dot: true,
            })
            return files.join('\n')
        },
        grep: async (dirPath, query) => {
            const root = getScopedCwd()
            const targetDir = path.isAbsolute(dirPath) ? dirPath : path.resolve(root, dirPath)
            const ignores = getWorkspaceIgnores(root)
            try {
                const cmd = `git grep -nI "${query}" ${targetDir} || grep -rnI --exclude-dir=node_modules --exclude-dir=.git "${query}" ${targetDir}`
                const { stdout } = await execAsync(cmd)
                if (!stdout) return ''
                const lines = stdout.split('\n')
                const filtered = lines.filter((line) => {
                    if (!line.trim()) return false
                    const filePath = line.split(':')[0]
                    return !isPathIgnored(filePath, ignores)
                })
                return filtered.join('\n')
            } catch (error: any) {
                if (error.code === 1) return '' // grep returns 1 when no matches
                throw error
            }
        },
    },
    env: {
        cwd: () => getScopedCwd(),
        get: (key) => process.env[key],
    },
    ui: {
        askQuestion: async () => {
            throw new Error('Not implemented here')
        },
        // will be monkey-patched by use-agent-session.tsx
        requestPermission: async () => {
            return { block: false }
        },
    },
    browser: {
        navigate: async (url: string) => {
            try {
                const res = await fetch(url, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (compatible; DecemberAgent/1.0)',
                    },
                })
                const html = await res.text()
                if (!res.ok) {
                    return { text: '', error: `HTTP Error (${res.status}): ${html}` }
                }

                const cleanText = html
                    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
                    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
                    .replace(/<[^>]+>/g, ' ')
                    .replace(/\s+/g, ' ')
                    .trim()

                return { text: cleanText }
            } catch (error: any) {
                return { text: '', error: error.message }
            }
        },
    },
}
