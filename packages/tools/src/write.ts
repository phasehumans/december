import fs from 'node:fs/promises'
import path from 'node:path'
import { Tool } from '@december/agent'

export const WriteFileTool: Tool<{ filePath: string; content: string }> = {
    name: 'write_file',
    description:
        'Creates a new file or completely overwrites an existing file with the provided content.',
    inputSchema: {
        type: 'object',
        properties: {
            filePath: { type: 'string', description: 'The relative or absolute path to the file.' },
            content: { type: 'string', description: 'The complete file contents to write.' },
        },
        required: ['filePath', 'content'],
    },
    execute: async ({ filePath, content }) => {
        try {
            const absolutePath = path.resolve(process.cwd(), filePath)
            // Ensure parent directories exist
            await fs.mkdir(path.dirname(absolutePath), { recursive: true })
            await fs.writeFile(absolutePath, content, 'utf-8')
            return `Successfully wrote to ${filePath}`
        } catch (e: any) {
            return `Failed to write file: ${e.message}`
        }
    },
}
