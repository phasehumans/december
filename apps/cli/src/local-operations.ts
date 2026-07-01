import { AgentOperations } from '@december/agent'
import { spawn, exec } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import fg from 'fast-glob'
import { promisify } from 'node:util'

const execAsync = promisify(exec)

export const localOperations: AgentOperations = {
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

                child.stdout?.on('data', (data) => {
                    const chunk = data.toString()
                    stdout += chunk
                    onData(chunk)
                })

                child.stderr?.on('data', (data) => {
                    const chunk = data.toString()
                    stderr += chunk
                    onData(chunk)
                })

                let isFinished = false

                child.on('close', (code) => {
                    if (isFinished) return
                    isFinished = true
                    resolve({ exitCode: code, output: stdout + '\n' + stderr })
                })

                child.on('error', (err) => {
                    if (isFinished) return
                    isFinished = true
                    resolve({ exitCode: 1, output: `Failed to start command: ${err.message}` })
                })

                // Auto-detach logic
                setTimeout(() => {
                    if (isFinished) return
                    isFinished = true

                    child.unref()
                    child.stdout?.unref()
                    child.stderr?.unref()

                    resolve({ exitCode: null, output: stdout + '\n' + stderr })
                }, 3000)
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
}
