import type { Tool, ToolExecuteContext } from '@december/shared'

export function formatMcpToolName(serverName: string, originalToolName: string): string {
    const cleanServer = serverName.replace(/[^a-zA-Z0-9_]/g, '_').replace(/^_+|_+$/g, '')
    const cleanTool = originalToolName.replace(/[^a-zA-Z0-9_]/g, '_').replace(/^_+|_+$/g, '')

    if (cleanServer.toLowerCase().startsWith('mcp_')) {
        return `${cleanServer}_${cleanTool}`
    }
    return `mcp_${cleanServer}_${cleanTool}`
}

export function formatMcpContent(content?: any[]): string {
    if (!content || !Array.isArray(content) || content.length === 0) {
        return ''
    }

    const parts: string[] = []

    for (const item of content) {
        if (!item) continue

        if (item.type === 'text' && typeof item.text === 'string') {
            parts.push(item.text)
        } else if (item.type === 'image') {
            parts.push(`[Image: mimeType=${item.mimeType || 'unknown'}]`)
        } else if (item.type === 'resource') {
            const res = item.resource
            if (res) {
                const body = res.text || (res.blob ? `[Binary blob: ${res.uri}]` : '')
                parts.push(`Resource (${res.uri}):\n${body}`)
            }
        } else if (typeof item === 'string') {
            parts.push(item)
        } else {
            parts.push(JSON.stringify(item, null, 2))
        }
    }

    return parts.join('\n\n')
}

export function formatMcpCallToolResult(result: any): string {
    if (!result) return ''

    if (result.isError) {
        const errorText = formatMcpContent(result.content) || 'MCP tool execution reported an error'
        throw new Error(errorText)
    }

    return formatMcpContent(result.content)
}

export interface CreateMcpToolOptions {
    serverName: string
    mcpTool: {
        name: string
        description?: string
        inputSchema?: any
    }
    callTool: (name: string, args: any, context: ToolExecuteContext) => Promise<any>
}

export function createMcpTool(options: {
    serverName: string
    mcpTool: {
        name: string
        description?: string
        inputSchema?: any
    }
    callTool: (name: string, args: any, context: ToolExecuteContext) => Promise<any>
}): Tool {
    const { serverName, mcpTool, callTool } = options
    const toolName = formatMcpToolName(serverName, mcpTool.name)
    const baseDescription = mcpTool.description || mcpTool.name
    const description = `${baseDescription}\n(MCP tool from server "${serverName}")`
    const inputSchema = mcpTool.inputSchema || { type: 'object', properties: {} }

    return {
        name: toolName,
        description,
        inputSchema,
        execute: async (input: any, context: ToolExecuteContext): Promise<string> => {
            const result = await callTool(mcpTool.name, input || {}, context)
            return formatMcpCallToolResult(result)
        },
    }
}
