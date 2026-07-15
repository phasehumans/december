import { Tool, ToolExecuteContext, truncateOutput } from '@december/shared'

import { Type, Static } from '@sinclair/typebox'

const lsSchema = Type.Object({
    dirPath: Type.Optional(
        Type.String({
            description: 'Optional directory path. Defaults to the current working directory.',
        })
    ),
})

export type LsInput = Static<typeof lsSchema>

export const LsTool: Tool<LsInput> = {
    name: 'list_dir',
    description: 'Lists the contents of a directory to see available files and folders.',
    inputSchema: lsSchema,
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
