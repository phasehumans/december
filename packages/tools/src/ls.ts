import { Tool, ToolExecuteContext, truncateOutput } from '@december/agent'

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
    execute: async ({ dirPath = '.' }, context: ToolExecuteContext) => {
        try {
            const result = await context.operations.fs.readdir(dirPath)
            return truncateOutput(result.length > 0 ? result.join('\n') : 'Directory is empty.')
                .text
        } catch (e: any) {
            return `Failed to list directory: ${e.message}`
        }
    },
}
