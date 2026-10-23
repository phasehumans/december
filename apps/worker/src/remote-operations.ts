import { PlatformAdapter } from '@december/agent'

import { BROWSER_RUNNER_SCRIPT } from './browser-runner-script'
import { executeCommand } from './runtime'

import type {
    BrowserActionInput,
    BrowserActionResult,
    BrowserNavigateResult,
    BrowserOperations,
} from '@december/shared'

const escapeShellArg = (arg: string): string => {
    return `'${arg.replace(/'/g, "'\\''")}'`
}

const resolveWorkspacePath = (rawPath: string): string => {
    const trimmed = rawPath.trim()
    if (!trimmed || trimmed === '.' || trimmed === './') return '/workspace'
    if (trimmed.startsWith('/workspace')) return trimmed
    const stripped = trimmed.replace(/^\/+/, '')
    if (stripped.startsWith('workspace/')) return `/${stripped}`
    return `/workspace/${stripped}`
}

export interface RemotePlatformAdapterOptions {
    handsDaemonPath?: string
    sessionId?: string
    redisClient?: any
    timeoutMs?: number
}

export class RemotePlatformAdapter implements PlatformAdapter {
    private modifiedFiles: Record<string, string> = {}
    private activeOpIds = new Set<string>()

    constructor(
        private vmId: string,
        private options?: RemotePlatformAdapterOptions
    ) {}

    getModifiedFiles(): Record<string, string> {
        return { ...this.modifiedFiles }
    }

    clearModifiedFiles(): void {
        this.modifiedFiles = {}
    }

    getActiveOpIds(): string[] {
        return Array.from(this.activeOpIds)
    }

    async detach(opId: string): Promise<boolean> {
        this.activeOpIds.delete(opId)
        console.log(`[AGENT REMOTE TOOL] VM '${this.vmId}' detaching from opId '${opId}'`)
        return true
    }

    async detachAll(): Promise<string[]> {
        const detached = Array.from(this.activeOpIds)
        this.activeOpIds.clear()
        console.log(`[AGENT REMOTE TOOL] VM '${this.vmId}' detached all active ops:`, detached)
        return detached
    }

    async getOpStatus(opId: string): Promise<{
        status: 'done' | 'running' | 'terminated' | 'unknown'
        exitCode?: number
        output?: string
    }> {
        const statusCmd = `node /tmp/hands-daemon.mjs status ${escapeShellArg(opId)}`
        let statusOutput = ''
        try {
            const exitCode = await executeCommand(this.vmId, statusCmd, (chunk) => {
                statusOutput += chunk
            })
            if (exitCode === 0 && statusOutput.trim()) {
                const parsed = JSON.parse(statusOutput.trim())
                if (parsed.status === 'done') {
                    const readCmd = `node /tmp/hands-daemon.mjs read ${escapeShellArg(opId)} 0`
                    let logOutput = ''
                    await executeCommand(this.vmId, readCmd, (chunk) => {
                        logOutput += chunk
                    })
                    try {
                        const readParsed = JSON.parse(logOutput.trim())
                        return {
                            status: 'done',
                            exitCode: parsed.exitCode,
                            output: readParsed.data,
                        }
                    } catch {
                        // Intentionally swallowed: fallback to empty output
                        return { status: 'done', exitCode: parsed.exitCode, output: '' }
                    }
                }
                return parsed
            }
        } catch {
            // Intentionally swallowed: fallback to local in-memory status
        }

        const isRunning = this.activeOpIds.has(opId)
        return { status: isRunning ? 'running' : 'unknown' }
    }

    bash = {
        exec: async (
            command: string,
            cwdOrOnData?: string | ((chunk: string) => void),
            options?: any
        ) => {
            const onData = typeof cwdOrOnData === 'function' ? cwdOrOnData : options?.onData
            const opId =
                options?.opId ||
                options?.taskId ||
                `op_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`

            this.activeOpIds.add(opId)
            console.log(`[AGENT REMOTE TOOL] VM '${this.vmId}' executing op '${opId}': ${command}`)

            let output = ''
            try {
                const exitCode = await executeCommand(this.vmId, command, (chunk) => {
                    output += chunk
                    if (onData) onData(chunk)
                })
                return { exitCode, output, taskId: opId, opId }
            } finally {
                this.activeOpIds.delete(opId)
            }
        },
        getTaskStatus: async (taskId: string) => {
            const status = this.activeOpIds.has(taskId) ? 'running' : 'completed'
            return {
                status,
                output: `Task ${taskId} status: ${status}`,
            }
        },
        killTask: async (taskId: string) => {
            console.log(`[AGENT REMOTE TOOL] VM '${this.vmId}' terminating task: ${taskId}`)
            this.activeOpIds.delete(taskId)
            return true
        },
    }

    fs = {
        readFile: async (filepath: string) => {
            const targetPath = resolveWorkspacePath(filepath)
            console.log(`[AGENT REMOTE TOOL] VM '${this.vmId}' reading file: ${targetPath}`)
            const { exitCode, output } = await this.bash.exec(`cat ${escapeShellArg(targetPath)}`)
            if (exitCode !== 0) throw new Error(`Failed to read file ${targetPath}: ${output}`)
            return output
        },
        writeFile: async (filepath: string, content: string) => {
            const targetPath = resolveWorkspacePath(filepath)
            console.log(
                `[AGENT REMOTE TOOL] VM '${this.vmId}' writing file: ${targetPath} (${content.length} bytes)`
            )
            const base64Content = Buffer.from(content).toString('base64')
            await this.bash.exec(`mkdir -p "$(dirname ${escapeShellArg(targetPath)})"`)
            const { exitCode, output } = await this.bash.exec(
                `echo ${escapeShellArg(base64Content)} | base64 -d > ${escapeShellArg(targetPath)}`
            )
            if (exitCode !== 0) throw new Error(`Failed to write file ${targetPath}: ${output}`)

            const relPath = targetPath.startsWith('/workspace/')
                ? targetPath.replace('/workspace/', '')
                : targetPath.replace(/^\//, '')
            this.modifiedFiles[relPath] = content
        },
        readdir: async (dirPath: string) => {
            const targetPath = resolveWorkspacePath(dirPath)
            const { exitCode, output } = await this.bash.exec(
                `ls -1p ${escapeShellArg(targetPath)}`
            )
            if (exitCode !== 0) throw new Error(`Failed to read dir ${targetPath}: ${output}`)
            return output
                .split('\n')
                .filter(Boolean)
                .map((line) => {
                    const isDir = line.endsWith('/')
                    return `[${isDir ? 'DIR ' : 'FILE'}] ${line.replace(/\/$/, '')}`
                })
        },
        mkdir: async (dirPath: string, options?: { recursive?: boolean }) => {
            const targetPath = resolveWorkspacePath(dirPath)
            const flag = options?.recursive ? '-p ' : ''
            const { exitCode, output } = await this.bash.exec(
                `mkdir ${flag}${escapeShellArg(targetPath)}`
            )
            if (exitCode !== 0) throw new Error(`Failed to mkdir ${targetPath}: ${output}`)
        },
        exists: async (filepath: string) => {
            const targetPath = resolveWorkspacePath(filepath)
            const { exitCode } = await this.bash.exec(`test -e ${escapeShellArg(targetPath)}`)
            return exitCode === 0
        },
    }

    search = {
        find: async (dirPath: string, query: string) => {
            const { output } = await this.bash.exec(
                `find ${escapeShellArg(dirPath)} -name ${escapeShellArg(query)}`
            )
            return output
        },
        grep: async (dirPath: string, query: string) => {
            const { output } = await this.bash.exec(
                `grep -rnI ${escapeShellArg(query)} ${escapeShellArg(dirPath)}`
            )
            return output
        },
    }

    env = {
        cwd: () => '/workspace',
        get: (key: string) => undefined,
    }

    ui = {
        askQuestion: async (
            questions: Array<{ question: string; options: string[]; is_multi_select?: boolean }>
        ): Promise<string> => {
            const fallbackOption = questions?.[0]?.options?.[0] || 'Option A'
            const sessionId = this.options?.sessionId
            const redis = this.options?.redisClient

            if (!sessionId || !redis) {
                return fallbackOption
            }

            const questionId = `qid-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
            const promptPayload = JSON.stringify({
                type: 'AskQuestionPrompt',
                sessionId,
                questionId,
                questions,
                createdAt: Date.now(),
            })

            // Cache pending question state in Redis (10 min TTL)
            if (typeof redis.set === 'function') {
                await redis
                    .set(`session_pending_question:${sessionId}`, promptPayload, 'EX', 600)
                    .catch(() => {
                        // Intentionally swallowed: Redis set fallback
                    })
            }

            // Publish prompt event over session_events channel
            if (typeof redis.publish === 'function') {
                await redis.publish(`session_events:${sessionId}`, promptPayload).catch(() => {
                    // Intentionally swallowed: Redis publish fallback
                })
            }

            // Await answer on session_question_answer:${sessionId}
            return new Promise<string>((resolve) => {
                const sub = typeof redis.duplicate === 'function' ? redis.duplicate() : null
                const timeoutMs = this.options?.timeoutMs || 300000 // default 5m
                let settled = false

                const cleanup = async () => {
                    if (sub) {
                        try {
                            if (typeof sub.unsubscribe === 'function') {
                                await sub.unsubscribe(`session_question_answer:${sessionId}`)
                            }
                            if (typeof sub.quit === 'function') {
                                await sub.quit()
                            }
                        } catch {
                            // Intentionally swallowed: Redis cleanup fallback
                        }
                    }
                    if (typeof redis.del === 'function') {
                        await redis.del(`session_pending_question:${sessionId}`).catch(() => {
                            // Intentionally swallowed: Redis del fallback
                        })
                    }
                }

                const timer = setTimeout(async () => {
                    if (!settled) {
                        settled = true
                        await cleanup()
                        resolve(fallbackOption)
                    }
                }, timeoutMs)

                if (!sub) {
                    clearTimeout(timer)
                    resolve(fallbackOption)
                    return
                }

                if (typeof sub.on === 'function') {
                    sub.on('message', async (channel: string, message: string) => {
                        if (channel === `session_question_answer:${sessionId}` && !settled) {
                            try {
                                const parsed =
                                    typeof message === 'string' ? JSON.parse(message) : message
                                if (parsed.questionId && parsed.questionId !== questionId) {
                                    return // Answer is for a different question
                                }
                                settled = true
                                clearTimeout(timer)
                                await cleanup()

                                const answer = parsed.answer
                                const formattedAnswer = Array.isArray(answer)
                                    ? answer.join(', ')
                                    : String(answer ?? fallbackOption)
                                resolve(formattedAnswer)
                            } catch {
                                // Intentionally swallowed: Parse error ignored, waiting for valid answer
                            }
                        }
                    })
                }

                if (typeof sub.subscribe === 'function') {
                    sub.subscribe(`session_question_answer:${sessionId}`).catch(() => {
                        // Intentionally swallowed: Subscribe error fallback
                    })
                }
            })
        },
        requestPermission: async () => {
            return { block: false }
        },
    }

    private browserRunnerInstalled = false

    private async ensureBrowserRunner(): Promise<void> {
        if (this.browserRunnerInstalled) return
        try {
            const base64Script = Buffer.from(BROWSER_RUNNER_SCRIPT).toString('base64')
            await this.bash.exec(
                `echo ${escapeShellArg(base64Script)} | base64 -d > /tmp/december-browser-runner.mjs && chmod +x /tmp/december-browser-runner.mjs`
            )
            this.browserRunnerInstalled = true
        } catch {
            // Intentionally swallowed: Browser runner deployment fallback
        }
    }

    private parseBrowserResult(output: string): any {
        const marker = 'DECEMBER_BROWSER_RESULT:'
        const idx = output.indexOf(marker)
        if (idx !== -1) {
            const jsonPart = output.substring(idx + marker.length).trim()
            try {
                return JSON.parse(jsonPart)
            } catch {
                // Intentionally swallowed: JSON parse error handled
            }
        }
        return null
    }

    private async publishBrowserViewportUpdate(result: any, fallbackUrl?: string): Promise<void> {
        const sessionId = this.options?.sessionId
        const redis = this.options?.redisClient
        if (!sessionId || !redis) return

        const viewportEvent = {
            type: 'BrowserViewportUpdate',
            sessionId,
            url: result.url || fallbackUrl || 'http://localhost:3000',
            title: result.title || '',
            action: result.action || 'navigate',
            screenshot: result.screenshotBase64 || '',
            screenshotPath: result.screenshotPath || '',
            consoleErrors: result.consoleErrors || [],
            networkErrors: result.networkErrors || [],
            timestamp: Date.now(),
        }

        const serialized = JSON.stringify(viewportEvent)

        if (typeof redis.set === 'function') {
            await redis
                .set(`session_desktop_viewport:${sessionId}`, serialized, 'EX', 3600)
                .catch(() => {
                    // Intentionally swallowed: Redis set fallback
                })
        }

        if (typeof redis.publish === 'function') {
            await redis.publish(`session_events:${sessionId}`, serialized).catch(() => {
                // Intentionally swallowed: Redis publish fallback
            })
        }
    }

    browser: BrowserOperations = {
        navigate: async (url: string): Promise<BrowserNavigateResult> => {
            await this.ensureBrowserRunner()
            const payload = JSON.stringify({ action: 'navigate', url })
            const { output } = await this.bash.exec(
                `node /tmp/december-browser-runner.mjs ${escapeShellArg(payload)}`
            )

            const parsed = this.parseBrowserResult(output)
            const result = parsed || {
                success: true,
                action: 'navigate',
                url,
                text: output,
                consoleErrors: [],
                networkErrors: [],
            }

            await this.publishBrowserViewportUpdate(result, url)

            return {
                text: result.text || result.output || '',
                consoleErrors: result.consoleErrors || [],
                networkErrors: result.networkErrors || [],
                error: result.error,
            }
        },
        action: async (params: BrowserActionInput): Promise<BrowserActionResult> => {
            await this.ensureBrowserRunner()
            const payload = JSON.stringify(params)
            const { output } = await this.bash.exec(
                `node /tmp/december-browser-runner.mjs ${escapeShellArg(payload)}`
            )

            const parsed = this.parseBrowserResult(output)
            const result = parsed || {
                success: true,
                action: params.action,
                output: output || `Browser action "${params.action}" completed successfully.`,
                consoleErrors: [],
                networkErrors: [],
            }

            if (
                result.screenshotBase64 ||
                params.action === 'screenshot' ||
                params.action === 'navigate' ||
                params.action === 'click' ||
                params.action === 'type'
            ) {
                await this.publishBrowserViewportUpdate(result, params.url)
            }

            return {
                success: result.success ?? true,
                action: params.action,
                output: result.output,
                text: result.text,
                screenshotPath: result.screenshotPath,
                screenshotBase64: result.screenshotBase64,
                consoleErrors: result.consoleErrors,
                networkErrors: result.networkErrors,
                error: result.error,
            }
        },
        close: async (): Promise<void> => {
            await this.bash.exec('pkill -f "december-browser-runner" || true').catch(() => {
                // Intentionally swallowed: Browser cleanup fallback
            })
        },
    }
}
