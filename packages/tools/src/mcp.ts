import { Tool, ToolExecuteContext } from '@december/shared'

export const MCPTool: Tool<any> = {
    name: 'mcp',
    description:
        'Model Context Protocol (MCP) tool integration. Call custom tools provided by MCP servers.',
    inputSchema: {
        type: 'object',
        properties: {
            server: { type: 'string' },
            tool: { type: 'string' },
            args: { type: 'object' },
        },
        required: ['server', 'tool'],
    },
    execute: async (input, context: ToolExecuteContext) => {
        return 'MCPTool is currently a stub and not fully implemented yet.'
    },
}
