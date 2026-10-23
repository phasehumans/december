import { PlatformAdapter } from '@december/agent'

import { BROWSER_RUNNER_SCRIPT } from './browser-runner-script'
import { executeCommand } from './runtime'

import type {
    BrowserActionInput,
    BrowserActionResult,
    BrowserNavigateResult,
    BrowserOperations,
    DiagnosticItem,
    DiagnosticsOperations,
    LocationItem,
    LspOperations,
    OutlineItem,
} from '@december/shared'

const escapeShellArg = (arg: string): string => {
    return `'${arg.replace(/'/g, "'\\''")}'`
}

const extractWordAtPosition = (lineContent: string, column: number): string | null => {
    if (!lineContent || column < 1) return null
    const colIdx = column - 1
    const isWordChar = (c: string) => /[a-zA-Z0-9_$]/.test(c)

    let start = colIdx
    if (start >= lineContent.length) start = lineContent.length - 1
    if (!isWordChar(lineContent[start])) {
        if (start > 0 && isWordChar(lineContent[start - 1])) {
            start--
        } else {
            return null
        }
    }

    while (start > 0 && isWordChar(lineContent[start - 1])) {
        start--
    }

    let end = colIdx
    while (end < lineContent.length && isWordChar(lineContent[end])) {
        end++
    }

    const word = lineContent.slice(start, end).trim()
    return word || null
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

    diagnostics: DiagnosticsOperations = {
        getDiagnostics: async (filePath?: string): Promise<DiagnosticItem[] | string> => {
            return this.lsp.getDiagnostics!(filePath)
        },
    }

    lsp: LspOperations = {
        getDefinition: async (
            filePath: string,
            line: number,
            column: number
        ): Promise<LocationItem[] | LocationItem | null> => {
            try {
                const targetPath = resolveWorkspacePath(filePath)
                let word: string | null = null
                try {
                    const content = await this.fs.readFile(targetPath)
                    const lines = content.split('\n')
                    if (lines[line - 1] !== undefined) {
                        word = extractWordAtPosition(lines[line - 1]!, column)
                    }
                } catch {
                    // Intentionally swallowed: File read fallback
                }

                if (!word) return null

                // Search for definitions across /workspace
                const queryCmd = `grep -rnI --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=.december -E "(export\\s+)?(default\\s+)?(async\\s+)?(function|class|interface|type|const|let|var)\\s+${word}\\b|${word}\\s*[:=]\\s*(function|\\([^)]*\\)\\s*=>)|${word}\\s*\\([^)]*\\)\\s*\\{" /workspace || true`
                const { output } = await this.bash.exec(queryCmd)
                const matches: LocationItem[] = []

                if (output.trim()) {
                    const lines = output.split('\n').filter(Boolean)
                    for (const l of lines) {
                        const parts = l.split(':')
                        if (parts.length >= 3) {
                            const file = parts[0]!.replace('/workspace/', '')
                            const lineNum = parseInt(parts[1]!, 10)
                            const preview = parts.slice(2).join(':').trim()
                            if (!isNaN(lineNum)) {
                                matches.push({
                                    filePath: file,
                                    line: lineNum,
                                    column: 1,
                                    preview,
                                })
                            }
                        }
                    }
                }

                if (matches.length > 0) {
                    return matches
                }

                // Fallback to broader identifier search
                const fallbackCmd = `grep -rnI --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=.december "\\b${word}\\b" /workspace || true`
                const fallbackRes = await this.bash.exec(fallbackCmd)
                if (fallbackRes.output.trim()) {
                    const fbLines = fallbackRes.output.split('\n').filter(Boolean)
                    for (const l of fbLines) {
                        if (/^\s*import\b/.test(l)) continue
                        const parts = l.split(':')
                        if (parts.length >= 3) {
                            const file = parts[0]!.replace('/workspace/', '')
                            const lineNum = parseInt(parts[1]!, 10)
                            const preview = parts.slice(2).join(':').trim()
                            if (!isNaN(lineNum)) {
                                return [
                                    {
                                        filePath: file,
                                        line: lineNum,
                                        column: 1,
                                        preview,
                                    },
                                ]
                            }
                        }
                    }
                }

                return null
            } catch {
                // Intentionally swallowed: Definition lookup fallback
                return null
            }
        },

        getReferences: async (
            filePath: string,
            line: number,
            column: number
        ): Promise<LocationItem[]> => {
            try {
                const targetPath = resolveWorkspacePath(filePath)
                let word: string | null = null
                try {
                    const content = await this.fs.readFile(targetPath)
                    const lines = content.split('\n')
                    if (lines[line - 1] !== undefined) {
                        word = extractWordAtPosition(lines[line - 1]!, column)
                    }
                } catch {
                    // Intentionally swallowed: File read fallback
                }

                if (!word) return []

                const queryCmd = `grep -rnI --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=.december "\\b${word}\\b" /workspace || true`
                const { output } = await this.bash.exec(queryCmd)
                const refs: LocationItem[] = []

                if (output.trim()) {
                    const lines = output.split('\n').filter(Boolean)
                    for (const l of lines) {
                        const parts = l.split(':')
                        if (parts.length >= 3) {
                            const file = parts[0]!.replace('/workspace/', '')
                            const lineNum = parseInt(parts[1]!, 10)
                            const preview = parts.slice(2).join(':').trim()
                            const colIdx = preview.indexOf(word)
                            const col = colIdx !== -1 ? colIdx + 1 : 1
                            if (!isNaN(lineNum)) {
                                refs.push({
                                    filePath: file,
                                    line: lineNum,
                                    column: col,
                                    preview,
                                })
                            }
                        }
                        if (refs.length >= 50) break
                    }
                }

                return refs
            } catch {
                // Intentionally swallowed: References lookup fallback
                return []
            }
        },

        getOutline: async (filePath: string): Promise<OutlineItem[]> => {
            try {
                const targetPath = resolveWorkspacePath(filePath)
                const content = await this.fs.readFile(targetPath)
                const lines = content.split('\n')
                const symbols: OutlineItem[] = []

                for (let i = 0; i < lines.length; i++) {
                    const lineText = lines[i]!
                    const lineNum = i + 1

                    // Match Class
                    const classMatch = lineText.match(
                        /(?:export\s+)?(?:default\s+)?class\s+([A-Za-z0-9_$]+)/
                    )
                    if (classMatch) {
                        symbols.push({
                            name: classMatch[1]!,
                            kind: 'class',
                            line: lineNum,
                            column: classMatch.index ? classMatch.index + 1 : 1,
                        })
                        continue
                    }

                    // Match Interface
                    const ifaceMatch = lineText.match(/(?:export\s+)?interface\s+([A-Za-z0-9_$]+)/)
                    if (ifaceMatch) {
                        symbols.push({
                            name: ifaceMatch[1]!,
                            kind: 'interface',
                            line: lineNum,
                            column: ifaceMatch.index ? ifaceMatch.index + 1 : 1,
                        })
                        continue
                    }

                    // Match Type
                    const typeMatch = lineText.match(/(?:export\s+)?type\s+([A-Za-z0-9_$]+)\s*=/)
                    if (typeMatch) {
                        symbols.push({
                            name: typeMatch[1]!,
                            kind: 'type',
                            line: lineNum,
                            column: typeMatch.index ? typeMatch.index + 1 : 1,
                        })
                        continue
                    }

                    // Match Function
                    const funcMatch = lineText.match(
                        /(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s+([A-Za-z0-9_$]+)/
                    )
                    if (funcMatch) {
                        symbols.push({
                            name: funcMatch[1]!,
                            kind: 'function',
                            line: lineNum,
                            column: funcMatch.index ? funcMatch.index + 1 : 1,
                        })
                        continue
                    }

                    // Match Variable / Arrow Function
                    const varMatch = lineText.match(
                        /(?:export\s+)?(?:const|let|var)\s+([A-Za-z0-9_$]+)\s*=/
                    )
                    if (varMatch) {
                        symbols.push({
                            name: varMatch[1]!,
                            kind: 'variable',
                            line: lineNum,
                            column: varMatch.index ? varMatch.index + 1 : 1,
                        })
                    }
                }

                return symbols
            } catch {
                // Intentionally swallowed: Outline extraction fallback
                return []
            }
        },

        getDiagnostics: async (filePath?: string): Promise<DiagnosticItem[]> => {
            try {
                const hasTsConfig = await this.fs.exists('/workspace/tsconfig.json')
                const diags: DiagnosticItem[] = []

                if (hasTsConfig) {
                    const { output } = await this.bash.exec(
                        'npx tsc --noEmit --pretty false || true'
                    )
                    if (output.trim()) {
                        const lines = output.split('\n').filter(Boolean)
                        for (const l of lines) {
                            const match = l.match(
                                /^(.+?)\((\d+),(\d+)\):\s+(error|warning)\s+(TS\d+):\s+(.+)$/
                            )
                            if (match) {
                                const relFile = match[1]!.replace('/workspace/', '').trim()
                                if (
                                    !filePath ||
                                    relFile.includes(filePath) ||
                                    filePath.includes(relFile)
                                ) {
                                    diags.push({
                                        filePath: relFile,
                                        line: parseInt(match[2]!, 10),
                                        column: parseInt(match[3]!, 10),
                                        severity: match[4] === 'warning' ? 'warning' : 'error',
                                        source: match[5],
                                        message: match[6]!,
                                    })
                                }
                            }
                        }
                    }
                }

                return diags
            } catch {
                // Intentionally swallowed: Diagnostics execution fallback
                return []
            }
        },

        shutdown: async (): Promise<void> => {},
    }
}
