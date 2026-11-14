import { Type, Static } from '@sinclair/typebox'

import type { McpClientManager } from './manager'
import type { Tool, ToolExecuteContext } from '@december/shared'

const readMcpResourceSchema = Type.Object({
    server: Type.String({
        description: 'Name of the connected MCP server hosting the resource',
    }),
    uri: Type.String({
        description:
            'The MCP resource URI to read (e.g. "postgres://schema", "file:///logs/today.txt")',
    }),
})

export type ReadMcpResourceInput = Static<typeof readMcpResourceSchema>

export function createReadMcpResourceTool(manager: McpClientManager): Tool<ReadMcpResourceInput> {
    return {
        name: 'read_mcp_resource',
        description:
            'Read data from an MCP resource URI exposed by a connected MCP server (e.g. database schema, system logs, live telemetry).',
        inputSchema: readMcpResourceSchema,
        execute: async (input: ReadMcpResourceInput, _context: ToolExecuteContext) => {
            const { server, uri } = input
            try {
                const content = await manager.readResource(server, uri)
                if (!content) {
                    return `Resource "${uri}" from server "${server}" was empty.`
                }
                return content
            } catch (err: any) {
                throw new Error(
                    `Failed to read MCP resource "${uri}" from server "${server}": ${err?.message || String(err)}`
                )
            }
        },
    }
}
