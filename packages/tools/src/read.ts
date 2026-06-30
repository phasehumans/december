import fs from 'node:fs/promises'
import path from 'node:path'
import { Tool } from '@december/agent'

export const ReadFileTool: Tool<{ filePath: string }> = {
    name: 'read_file',
    description: 'Reads the complete contents of a file.',
    inputSchema: {
        type: 'object',
        properties: {
            filePath: { type: 'string', description: 'The relative or absolute path to the file.' },
        },
        required: ['filePath'],
    },
    execute: async ({ filePath }) => {
        try {
            const absolutePath = path.resolve(process.cwd(), filePath)
            const content = await fs.readFile(absolutePath, 'utf-8')
            return content
        } catch (e: any) {
            return `Failed to read file: ${e.message}`
        }
    },
}
