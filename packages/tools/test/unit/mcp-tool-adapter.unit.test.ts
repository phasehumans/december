import { describe, it, expect } from 'bun:test'

import {
    formatMcpToolName,
    formatMcpContent,
    formatMcpCallToolResult,
    createMcpTool,
} from '../../src/mcp/tool-adapter'

import type { ToolExecuteContext } from '@december/shared'

describe('MCP Tool Adapter (Unit)', () => {
    const mockContext: ToolExecuteContext = {
        operations: {} as any,
        env: new Map(),
        onStream: () => {},
    }

    it('should format tool names with server prefix', () => {
        expect(formatMcpToolName('postgres', 'query')).toBe('mcp_postgres_query')
        expect(formatMcpToolName('my-server', 'fetch-data')).toBe('mcp_my_server_fetch_data')
        expect(formatMcpToolName('mcp_github', 'create_issue')).toBe('mcp_github_create_issue')
    })

    it('should format MCP content blocks into text output', () => {
        const content = [
            { type: 'text', text: 'Query returned 2 rows:' },
            { type: 'text', text: '[{"id": 1}, {"id": 2}]' },
        ]
        expect(formatMcpContent(content)).toBe('Query returned 2 rows:\n\n[{"id": 1}, {"id": 2}]')
    })

    it('should format image and resource content blocks', () => {
        const content = [
            { type: 'image', mimeType: 'image/png' },
            { type: 'resource', resource: { uri: 'file:///data.csv', text: 'a,b,c\n1,2,3' } },
        ]
        const formatted = formatMcpContent(content)
        expect(formatted).toContain('[Image: mimeType=image/png]')
        expect(formatted).toContain('Resource (file:///data.csv):')
        expect(formatted).toContain('a,b,c')
    })

    it('should format successful tool execution result', () => {
        const result = {
            content: [{ type: 'text', text: 'Success' }],
            isError: false,
        }
        expect(formatMcpCallToolResult(result)).toBe('Success')
    })

    it('should throw Error when result isError is true', () => {
        const result = {
            content: [{ type: 'text', text: 'Database relation does not exist' }],
            isError: true,
        }
        expect(() => formatMcpCallToolResult(result)).toThrow('Database relation does not exist')
    })

    it('should create a valid December Tool object', async () => {
        let calledName = ''
        let calledArgs: any = null

        const tool = createMcpTool({
            serverName: 'sqlite',
            mcpTool: {
                name: 'read_query',
                description: 'Execute a SELECT query against the SQLite database',
                inputSchema: {
                    type: 'object',
                    properties: { query: { type: 'string' } },
                    required: ['query'],
                },
            },
            callTool: async (name, args) => {
                calledName = name
                calledArgs = args
                return {
                    content: [{ type: 'text', text: '1|alice\n2|bob' }],
                }
            },
        })

        expect(tool.name).toBe('mcp_sqlite_read_query')
        expect(tool.description).toContain('Execute a SELECT query')
        expect(tool.description).toContain('server "sqlite"')
        expect(tool.inputSchema.properties.query.type).toBe('string')

        const output = await tool.execute({ query: 'SELECT * FROM users' }, mockContext)
        expect(calledName).toBe('read_query')
        expect(calledArgs).toEqual({ query: 'SELECT * FROM users' })
        expect(output).toBe('1|alice\n2|bob')
    })

    it('should propagate errors from execution as rejected promises', async () => {
        const tool = createMcpTool({
            serverName: 'linear',
            mcpTool: {
                name: 'search_issues',
                inputSchema: { type: 'object' },
            },
            callTool: async () => {
                return {
                    content: [{ type: 'text', text: 'Unauthorized 401' }],
                    isError: true,
                }
            },
        })

        await expect(tool.execute({}, mockContext)).rejects.toThrow('Unauthorized 401')
    })
})
