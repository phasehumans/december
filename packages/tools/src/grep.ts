import { Tool, ToolExecuteContext, truncateOutput } from '@december/agent'

export interface GrepSearchInput {
    query: string
    directory?: string
}

export const GrepSearchTool: Tool<GrepSearchInput> = {
    name: 'grep_search',
    description:
        'Searches for a regex query inside files using git grep or raw grep. Highly efficient.',
    inputSchema: {
        type: 'object',
        properties: {
            query: { type: 'string' },
            directory: { type: 'string', description: 'Defaults to ./' },
        },
        required: ['query'],
    },
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
