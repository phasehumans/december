import { PlatformAdapter } from '@december/agent'

import { executeCommand } from './runtime'

export class RemotePlatformAdapter implements PlatformAdapter {
    constructor(private vmId: string) {}

    bash = {
        exec: async (command: string, onData?: (chunk: string) => void) => {
            let output = ''
            const exitCode = await executeCommand(this.vmId, command, (chunk) => {
                output += chunk
                if (onData) onData(chunk)
            })
            return { exitCode, output }
        },
        getTaskStatus: async () => ({ status: 'completed', output: 'Not implemented in remote' }),
        killTask: async () => false,
    }

    fs = {
        readFile: async (filepath: string) => {
            const { exitCode, output } = await this.bash.exec(`cat "${filepath}"`)
            if (exitCode !== 0) throw new Error(`Failed to read file: ${output}`)
            return output
        },
        writeFile: async (filepath: string, content: string) => {
            const base64Content = Buffer.from(content).toString('base64')
            await this.bash.exec(`mkdir -p "$(dirname "${filepath}")"`)
            const { exitCode, output } = await this.bash.exec(
                `echo "${base64Content}" | base64 -d > "${filepath}"`
            )
            if (exitCode !== 0) throw new Error(`Failed to write file: ${output}`)
        },
        readdir: async (dirPath: string) => {
            const { exitCode, output } = await this.bash.exec(`ls -1p "${dirPath}"`)
            if (exitCode !== 0) throw new Error(`Failed to read dir: ${output}`)
            return output
                .split('\n')
                .filter(Boolean)
                .map((line) => {
                    const isDir = line.endsWith('/')
                    return `[${isDir ? 'DIR ' : 'FILE'}] ${line.replace(/\/$/, '')}`
                })
        },
        mkdir: async (dirPath: string, options?: { recursive?: boolean }) => {
            const flag = options?.recursive ? '-p ' : ''
            const { exitCode, output } = await this.bash.exec(`mkdir ${flag}"${dirPath}"`)
            if (exitCode !== 0) throw new Error(`Failed to mkdir: ${output}`)
        },
        exists: async (filepath: string) => {
            const { exitCode } = await this.bash.exec(`test -e "${filepath}"`)
            return exitCode === 0
        },
    }

    search = {
        find: async (dirPath: string, query: string) => {
            const { output } = await this.bash.exec(`find "${dirPath}" -name "${query}"`)
            return output
        },
        grep: async (dirPath: string, query: string) => {
            const { output } = await this.bash.exec(`grep -rnI "${query}" "${dirPath}"`)
            return output
        },
    }

    env = {
        cwd: () => '/root',
        get: (key: string) => undefined,
    }

    ui = {
        askQuestion: async () => {
            throw new Error('Not implemented here')
        },
        requestPermission: async () => {
            return { block: false }
        },
    }
}
