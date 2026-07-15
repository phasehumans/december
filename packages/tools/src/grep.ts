import { Tool, ToolExecuteContext, truncateOutput } from '@december/shared'

import { Type, Static } from '@sinclair/typebox'

const grepSchema = Type.Object({
    query: Type.String(),
    directory: Type.Optional(Type.String({ description: 'Defaults to ./' })),
})

export type GrepSearchInput = Static<typeof grepSchema>

export const GrepSearchTool: Tool<GrepSearchInput> = {
    name: 'grep_search',
    description:
        'Searches for a regex query inside files using git grep or raw grep. Highly efficient.',
    inputSchema: grepSchema,
    execute: async ({ query, directory = '.' }, context: ToolExecuteContext) => {
        try {
            const result = await context.operations.search.grep(directory, query)
            if (!result) return 'No matches found.'
            return truncateOutput(result, 10000, 100).text
        } catch (error: any) {
            return `Error running grep: ${error.message}`
        }
    },
}
