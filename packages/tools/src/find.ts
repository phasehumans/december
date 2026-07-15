import { Tool, ToolExecuteContext, truncateOutput } from '@december/shared'

import { Type, Static } from '@sinclair/typebox'

const findSchema = Type.Object({
    pattern: Type.String(),
})

export type FindFilesInput = Static<typeof findSchema>

export const FindFilesTool: Tool<FindFilesInput> = {
    name: 'find_files',
    description:
        'Searches for files matching a glob pattern (e.g. "src/**/*.ts"). Automatically ignores node_modules and respects .gitignore.',
    inputSchema: findSchema,
    execute: async ({ pattern }, context: ToolExecuteContext) => {
        try {
            // Find operation handles ignoring node_modules and formatting output
            const result = await context.operations.search.find('.', pattern)
            if (!result) return 'No files found matching pattern.'
            return truncateOutput(result, 10000, 100).text
        } catch (error: any) {
            return `Error finding files: ${error.message}`
        }
    },
}
