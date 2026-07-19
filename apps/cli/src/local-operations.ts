import { exec } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'

import { PlatformAdapter } from '@december/agent'
import { createLocalBashOperations } from '@december/tools'
import fg from 'fast-glob'

import { taskManager } from './task-manager'

const execAsync = promisify(exec)
const localBashOps = createLocalBashOperations()

export const localOperations: PlatformAdapter = {
    bash: {
        exec: async (command, cwd, options) => {
            return localBashOps.exec(command, cwd, options)
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
