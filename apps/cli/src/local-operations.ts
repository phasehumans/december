import { exec, spawn, spawnSync } from 'node:child_process'
import nodeFs from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'
import readline from 'node:readline'
import { promisify } from 'node:util'

import { PlatformAdapter, BashExecOptions, LspClient } from '@december/agent'
import { getWorkspaceIgnores, isPathIgnored } from '@december/shared'
import { createLocalBashOperations, killProcessGroup } from '@december/tools'
import fg from 'fast-glob'

import { taskManager } from './task-manager'
import { browserRunner } from './utils/browser'

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

let ripgrepAvailable: boolean | undefined

export function isRipgrepAvailable(): boolean {
    if (ripgrepAvailable !== undefined) {
        return ripgrepAvailable
    }
    try {
        const { status } = spawnSync('rg', ['--version'], { stdio: 'ignore' })
        ripgrepAvailable = status === 0
    } catch {
        // Intentionally swallowed: fallback when rg is not available in PATH
        ripgrepAvailable = false
    }
    return Boolean(ripgrepAvailable)
}

const MAX_STREAMED_SEARCH_LINES = 1000

function streamRipgrepFind(
    targetDir: string,
    query: string,
    ignores: string[],
    root: string
): Promise<string> {
    return new Promise((resolve, reject) => {
        const args = ['--files', '--hidden']
        if (query) {
            args.push('-g', query)
            if (!query.endsWith('/') && !query.endsWith('*')) {
                args.push('-g', `${query}/**`)
            }
        }
        for (const ig of ignores) {
            if (ig.includes('!')) continue
            args.push('-g', `!${ig}`)
        }
        args.push(targetDir)

        let child: ReturnType<typeof spawn>
        try {
            child = spawn('rg', args, {
                cwd: root,
                stdio: ['ignore', 'pipe', 'pipe'],
            })
        } catch (err) {
            return reject(err)
        }

        const rl = readline.createInterface({
            input: child.stdout,
            crlfDelay: Infinity,
        })

        const results: string[] = []
        let closed = false

        ;(rl as any).on('line', (line: string) => {
            const trimmed = line.trim()
            if (!trimmed) return
            const relPath = path.isAbsolute(trimmed) ? path.relative(root, trimmed) : trimmed
            results.push(relPath)
            if (results.length >= MAX_STREAMED_SEARCH_LINES && !closed) {
                closed = true
                child.kill()
                resolve(results.join('\n'))
            }
        })

        let stderr = ''
        child.stderr?.on('data', (chunk) => {
            stderr += chunk.toString()
        })
        ;(child as any).on('error', (err: any) => {
            if (!closed) {
                closed = true
                reject(err)
            }
        })
        ;(child as any).on('close', (code: number | null) => {
            if (!closed) {
                closed = true
                if (code === 0 || code === 1) {
                    resolve(results.join('\n'))
                } else {
                    reject(new Error(stderr.trim() || `rg exited with code ${code}`))
                }
            }
        })
    })
}

function streamRipgrepGrep(
    targetDir: string,
    query: string,
    ignores: string[],
    root: string
): Promise<string> {
    return new Promise((resolve, reject) => {
        const args = ['-n', '-H', '--no-heading', '--color=never', '--hidden']
        for (const ig of ignores) {
            if (ig.includes('!')) continue
            args.push('-g', `!${ig}`)
        }
        args.push('-e', query, targetDir)

        let child: ReturnType<typeof spawn>
        try {
            child = spawn('rg', args, {
                cwd: root,
                stdio: ['ignore', 'pipe', 'pipe'],
            })
        } catch (err) {
            return reject(err)
        }

        const rl = readline.createInterface({
            input: child.stdout,
            crlfDelay: Infinity,
        })

        const results: string[] = []
        let closed = false

        ;(rl as any).on('line', (line: string) => {
            const trimmed = line.trim()
            if (!trimmed) return
            const colonIdx = trimmed.indexOf(':')
            if (colonIdx !== -1) {
                const rawPath = trimmed.slice(0, colonIdx)
                const rest = trimmed.slice(colonIdx)
                const relPath = path.isAbsolute(rawPath) ? path.relative(root, rawPath) : rawPath
                results.push(relPath + rest)
            } else {
                results.push(trimmed)
            }
            if (results.length >= MAX_STREAMED_SEARCH_LINES && !closed) {
                closed = true
                child.kill()
                resolve(results.join('\n'))
            }
        })

        let stderr = ''
        child.stderr?.on('data', (chunk) => {
            stderr += chunk.toString()
        })
        ;(child as any).on('error', (err: any) => {
            if (!closed) {
                closed = true
                reject(err)
            }
        })
        ;(child as any).on('close', (code: number | null) => {
            if (!closed) {
                closed = true
                if (code === 0 || code === 1) {
                    resolve(results.join('\n'))
                } else {
                    reject(new Error(stderr.trim() || `grep exited with code ${code}`))
                }
            }
        })
    })
}

function streamFallbackGrep(
    targetDir: string,
    query: string,
    ignores: string[],
    root: string
): Promise<string> {
    return new Promise((resolve, reject) => {
        const child = spawn('git', ['grep', '-nI', query, '--', targetDir], {
            cwd: root,
            stdio: ['ignore', 'pipe', 'pipe'],
        })

        const rl = readline.createInterface({
            input: child.stdout,
            crlfDelay: Infinity,
        })

        const results: string[] = []
        let closed = false

        ;(rl as any).on('line', (line: string) => {
            const trimmed = line.trim()
            if (!trimmed) return
            const rawPath = trimmed.split(':')[0]
            const relPath = path.isAbsolute(rawPath) ? path.relative(root, rawPath) : rawPath
            if (!isPathIgnored(relPath, ignores)) {
                results.push(trimmed)
                if (results.length >= MAX_STREAMED_SEARCH_LINES && !closed) {
                    closed = true
                    child.kill()
                    resolve(results.join('\n'))
                }
            }
        })
        ;(child as any).on('error', (err: any) => {
            if (!closed) {
                closed = true
                reject(err)
            }
        })
        ;(child as any).on('close', (code: number | null) => {
            if (!closed) {
                closed = true
                if (code === 0 || code === 1) {
                    resolve(results.join('\n'))
                } else {
                    try {
                        const fallback = spawn(
                            'grep',
                            [
                                '-rnI',
                                '--exclude-dir=node_modules',
                                '--exclude-dir=.git',
                                query,
                                targetDir,
                            ],
                            { stdio: ['ignore', 'pipe', 'pipe'] }
                        )
                        const fResults: string[] = []
                        const fRl = readline.createInterface({
                            input: fallback.stdout,
                            crlfDelay: Infinity,
                        })
                        let fClosed = false
                        ;(fRl as any).on('line', (fLine: string) => {
                            const trimmed = fLine.trim()
                            if (!trimmed) return
                            fResults.push(trimmed)
                            if (fResults.length >= MAX_STREAMED_SEARCH_LINES && !fClosed) {
                                fClosed = true
                                fallback.kill()
                                resolve(fResults.join('\n'))
                            }
                        })
                        ;(fallback as any).on('close', (fCode: number | null) => {
                            if (!fClosed) {
                                fClosed = true
                                if (fCode === 0 || fCode === 1) {
                                    resolve(fResults.join('\n'))
                                } else {
                                    reject(new Error(`grep exited with code ${fCode}`))
                                }
                            }
                        })
                        ;(fallback as any).on('error', (fErr: any) => {
                            if (!fClosed) {
                                fClosed = true
                                reject(fErr)
                            }
                        })
                    } catch (fallbackErr) {
                        reject(fallbackErr)
                    }
                }
            }
        })
    })
}

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
            if (isRipgrepAvailable()) {
                try {
                    return await streamRipgrepFind(targetDir, query, ignores, root)
                } catch (err: any) {
                    if (err.code === 'ENOENT') throw err
                    // Intentionally swallowed: fallback to fast-glob on unexpected ripgrep error
                }
            }
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
            if (isRipgrepAvailable()) {
                return await streamRipgrepGrep(targetDir, query, ignores, root)
            }
            return await streamFallbackGrep(targetDir, query, ignores, root)
        },
    },
    env: {
        cwd: () => getScopedCwd(),
        get: (key) => process.env[key],
        setCwd: (dir: string) => {
            if (dir === process.cwd()) {
                setActiveScopeDir(undefined)
            } else {
                setActiveScopeDir(dir)
            }
        },
    },
    ui: {
        askQuestion: async () => {
            throw new Error('Not implemented here')
        },
        reviewArtifact: async () => {
            return { action: 'proceed' }
        },
        // will be monkey-patched by use-agent-session.tsx
        requestPermission: async () => {
            return { block: false }
        },
    },
    browser: {
        navigate: async (url: string) => browserRunner.navigate(url),
        action: async (params: any) => browserRunner.action(params),
        close: async () => browserRunner.close(),
    },
    diagnostics: {
        getDiagnostics: async (filePath?: string) => {
            const client = await getOrLaunchLspClient()
            if (!client) return []
            return client.getDiagnostics(filePath)
        },
    },
    lsp: {
        getDefinition: async (filePath: string, line: number, column: number) => {
            const client = await getOrLaunchLspClient()
            if (!client) return []
            return client.getDefinition(filePath, line, column)
        },
        getReferences: async (filePath: string, line: number, column: number) => {
            const client = await getOrLaunchLspClient()
            if (!client) return []
            return client.getReferences(filePath, line, column)
        },
        getOutline: async (filePath: string) => {
            const client = await getOrLaunchLspClient()
            if (!client) return []
            return client.getOutline(filePath)
        },
        getDiagnostics: async (filePath?: string) => {
            const client = await getOrLaunchLspClient()
            if (!client) return []
            return client.getDiagnostics(filePath)
        },
        shutdown: async () => {
            if (activeLspClient) {
                await activeLspClient.shutdown()
                activeLspClient = null
                activeLspWorkspace = null
            }
        },
    },
    subagentTracker: {
        registerSubagentTask: (opts) => taskManager.addSubagentTask(opts),
        appendOutput: (id, chunk) => taskManager.appendOutput(id, chunk),
        markCompleted: (id, code) => taskManager.markCompleted(id, code),
        getTask: (id) => taskManager.getTask(id),
        killTask: (id) => taskManager.killTask(id),
    },
}

let activeLspClient: LspClient | null = null
let activeLspWorkspace: string | null = null

export function isTypeScriptProject(workspaceDir: string): boolean {
    return (
        nodeFs.existsSync(path.join(workspaceDir, 'tsconfig.json')) ||
        nodeFs.existsSync(path.join(workspaceDir, 'package.json'))
    )
}

export async function getOrLaunchLspClient(customWorkspaceDir?: string): Promise<LspClient | null> {
    const workspaceDir = customWorkspaceDir || getScopedCwd()

    if (activeLspClient && activeLspWorkspace === workspaceDir) {
        return activeLspClient
    }

    if (!isTypeScriptProject(workspaceDir)) {
        return null
    }

    if (activeLspClient) {
        try {
            await activeLspClient.shutdown()
        } catch {
            // Intentionally swallowed: previous client shutdown fallback
        }
        activeLspClient = null
        activeLspWorkspace = null
    }

    const client = new LspClient({ workspaceRoot: workspaceDir })
    activeLspClient = client
    activeLspWorkspace = workspaceDir

    try {
        await client.start()
    } catch {
        // Intentionally swallowed: LSP client start failure fallback
        activeLspClient = null
        activeLspWorkspace = null
        return null
    }

    return activeLspClient
}

process.on('exit', () => {
    if (activeLspClient) {
        try {
            activeLspClient.shutdown()
        } catch {
            // Intentionally swallowed: process exit shutdown fallback
        }
    }
})
