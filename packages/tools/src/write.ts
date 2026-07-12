import { Tool, ToolExecuteContext } from '@december/shared'

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
    execute: async ({ filePath, content }, context: ToolExecuteContext) => {
        try {
            await context.operations.fs.writeFile(filePath, content)
            return `Successfully wrote to ${filePath}`
        } catch (e: any) {
            return `Failed to write file: ${e.message}`
        }
    },
}
