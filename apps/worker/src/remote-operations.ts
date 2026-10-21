import { PlatformAdapter } from '@december/agent'

import { executeCommand } from './runtime'

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
        ) => {
            return 'Non-interactive mode: auto-proceeding'
        },
        requestPermission: async () => {
            return { block: false }
        },
    }
}
