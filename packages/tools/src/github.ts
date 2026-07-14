import { Tool, ToolExecuteContext } from '@december/shared'

export const GitHubTool: Tool<any> = {
    name: 'github',
    description: 'Interact with GitHub API (create PRs, read issues, etc).',
    inputSchema: {
        type: 'object',
        properties: {
            action: { type: 'string' },
        },
        required: ['action'],
    },
    execute: async (input, context: ToolExecuteContext) => {
        return 'GitHubTool is currently a stub and not fully implemented yet.'
    },
}
