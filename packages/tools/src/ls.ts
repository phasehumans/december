import fs from 'node:fs/promises'
import path from 'node:path'
import { Tool } from '@december/agent'

export const LsTool: Tool<{ dirPath?: string }> = {
    name: 'list_dir',
    description: 'Lists the contents of a directory to see available files and folders.',
    inputSchema: {
        type: 'object',
        properties: {
            dirPath: {
                type: 'string',
                description: 'Optional directory path. Defaults to the current working directory.',
            },
        },
    },
    execute: async ({ dirPath = '.' }) => {
        try {
            const absolutePath = path.resolve(process.cwd(), dirPath)
            const entries = await fs.readdir(absolutePath, { withFileTypes: true })
            const result = entries.map((entry) => {
                const type = entry.isDirectory() ? 'DIR ' : 'FILE'
                return `[${type}] ${entry.name}`
            })
            return result.length > 0 ? result.join('\n') : 'Directory is empty.'
        } catch (e: any) {
            return `Failed to list directory: ${e.message}`
        }
    },
}
