import { Tool, ToolExecuteContext } from '@december/shared'

export const BrowserTool: Tool<any> = {
    name: 'browser',
    description:
        'Use a headless browser to navigate pages, click elements, or extract information.',
    inputSchema: {
        type: 'object',
        properties: {
            action: { type: 'string', description: 'Action to perform (e.g. goto, click, read)' },
            url: { type: 'string' },
        },
        required: ['action'],
    },
    execute: async (input, context: ToolExecuteContext) => {
        return 'BrowserTool is currently a stub and not fully implemented yet.'
    },
}
