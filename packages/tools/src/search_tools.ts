import { Type, Static } from '@sinclair/typebox'

import { defaultDeferredRegistry, DeferredToolRegistry } from './deferred-registry'

import type { Tool, ToolExecuteContext } from '@december/shared'

const searchToolsSchema = Type.Object({
    query: Type.String({
        description:
            'The task, functionality, or intent you need tools for (e.g., "browse web", "github pull request", "manage task", "web search", "preview diff").',
    }),
    category: Type.Optional(
        Type.String({
            description:
                'Optional category to filter by (e.g., "web", "browser", "task", "git", "mcp").',
        })
    ),
})

export type SearchToolsInput = Static<typeof searchToolsSchema>

export const SearchToolsTool: Tool<SearchToolsInput> = {
    name: 'search_tools',
    description:
        'Search available deferred and MCP tools by keyword or capability and dynamically activate them into your session.',
    inputSchema: searchToolsSchema,
    execute: async ({ query, category }, context: ToolExecuteContext) => {
        const registry: DeferredToolRegistry =
            (context as any).deferredRegistry || defaultDeferredRegistry

        const matches = registry.search(query, { category, limit: 5 })

        if (matches.length === 0) {
            const allTools = registry.getAll()
            const availableNames = allTools.map((t) => t.name).join(', ')
            return `No deferred tools found matching "${query}". Available deferred tools: ${availableNames || 'none'}.`
        }

        const activated: string[] = []

        for (const tool of matches) {
            if (typeof (context as any).activateTool === 'function') {
                ;(context as any).activateTool(tool.name)
                activated.push(tool.name)
            } else if (
                (context as any).agent &&
                typeof (context as any).agent.registerTool === 'function'
            ) {
                ;(context as any).agent.registerTool(tool)
                activated.push(tool.name)
            } else {
                activated.push(tool.name)
            }
        }

        const lines = [
            `Found and activated ${matches.length} tool(s) for query "${query}":`,
            ...matches.map((t) => `- **${t.name}**: ${t.description || 'No description'}`),
            '',
            'You can now invoke these tools directly in your next steps.',
        ]

        return lines.join('\n')
    },
}
