import { Tool, ToolExecuteContext } from '@december/shared'

let mcpServersConfig: Record<string, any> = {}

export function configureMCP(config: Record<string, any>) {
    mcpServersConfig = config
}

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
        const { server, tool, args } = input
        if (!mcpServersConfig || !mcpServersConfig[server]) {
            return `Error: MCP server '${server}' not found in configuration.`
        }
        return `MCPTool is currently a stub. The server '${server}' is configured but MCP stdio protocol execution is not fully implemented yet.`
    },
}
