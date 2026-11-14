import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
    ListResourcesRequestSchema,
    ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'
import { describe, it, expect, beforeEach, afterEach } from 'bun:test'

import { DeferredToolRegistry } from '../../src/deferred-registry'
import { McpClientManager, createReadMcpResourceTool } from '../../src/mcp'

import type { ToolExecuteContext } from '@december/shared'

describe('McpClientManager (Unit)', () => {
    let registry: DeferredToolRegistry
    let manager: McpClientManager
    let mockServer: Server
    let clientTransport: any
    let serverTransport: any

    const mockContext: ToolExecuteContext = {
        operations: {} as any,
        env: new Map(),
        onStream: () => {},
    }

    beforeEach(async () => {
        registry = new DeferredToolRegistry()
        manager = new McpClientManager({ registry })

        // Create in-memory mock MCP server
        mockServer = new Server(
            { name: 'mock-db-server', version: '1.0.0' },
            { capabilities: { tools: {}, resources: {}, logging: {} } }
        )

        mockServer.setRequestHandler(ListToolsRequestSchema, async () => {
            return {
                tools: [
                    {
                        name: 'run_query',
                        description: 'Execute SQL query against database',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                sql: { type: 'string', description: 'The SQL statement' },
                            },
                            required: ['sql'],
                        },
                    },
                ],
            }
        })

        mockServer.setRequestHandler(CallToolRequestSchema, async (request) => {
            const { name, arguments: args } = request.params
            if (name === 'run_query') {
                const sql = (args as any)?.sql || ''
                if (sql.includes('syntax_error')) {
                    return {
                        content: [{ type: 'text', text: 'Syntax error at near "syntax_error"' }],
                        isError: true,
                    }
                }
                return {
                    content: [{ type: 'text', text: `Result for: ${sql}` }],
                }
            }
            throw new Error(`Unknown tool: ${name}`)
        })

        mockServer.setRequestHandler(ListResourcesRequestSchema, async () => {
            return {
                resources: [
                    {
                        uri: 'schema://public',
                        name: 'Public Schema',
                        mimeType: 'text/plain',
                    },
                ],
            }
        })

        mockServer.setRequestHandler(ReadResourceRequestSchema, async (request) => {
            const { uri } = request.params
            if (uri === 'schema://public') {
                return {
                    contents: [
                        {
                            uri: 'schema://public',
                            mimeType: 'text/plain',
                            text: 'CREATE TABLE users (id SERIAL PRIMARY KEY, name TEXT);',
                        },
                    ],
                }
            }
            throw new Error(`Resource not found: ${uri}`)
        })

        const [cTrans, sTrans] = InMemoryTransport.createLinkedPair()
        clientTransport = cTrans
        serverTransport = sTrans
        await mockServer.connect(serverTransport)
    })

    afterEach(async () => {
        await manager.disconnectAll()
        try {
            await mockServer.close()
        } catch {
            // Intentionally swallowed: server close error
        }
    })

    it('should connect to an MCP server using custom transport, negotiate capabilities, and register tools', async () => {
        const info = await manager.connectWithTransport('db', { command: 'mock' }, clientTransport)

        expect(info.name).toBe('db')
        expect(info.status).toBe('connected')
        expect(info.serverVersion?.name).toBe('mock-db-server')
        expect(info.tools).toHaveLength(1)
        expect(info.tools[0].name).toBe('mcp_db_run_query')

        // Verify registration in DeferredToolRegistry
        expect(registry.has('mcp_db_run_query')).toBe(true)
        const retrieved = registry.get('mcp_db_run_query')
        expect(retrieved).toBeDefined()
        expect(retrieved?.name).toBe('mcp_db_run_query')

        // Verify search in DeferredToolRegistry finds the tool
        const searchMatches = registry.search('sql database query')
        expect(searchMatches.some((t) => t.name === 'mcp_db_run_query')).toBe(true)
    })

    it('should execute registered MCP tool and format results', async () => {
        await manager.connectWithTransport('db', { command: 'mock' }, clientTransport)

        const tool = registry.get('mcp_db_run_query')
        expect(tool).toBeDefined()

        const result = await tool!.execute({ sql: 'SELECT * FROM users' }, mockContext)
        expect(result).toBe('Result for: SELECT * FROM users')
    })

    it('should format tool error when MCP tool reports isError: true', async () => {
        await manager.connectWithTransport('db', { command: 'mock' }, clientTransport)

        const tool = registry.get('mcp_db_run_query')
        expect(tool).toBeDefined()

        await expect(tool!.execute({ sql: 'SELECT syntax_error' }, mockContext)).rejects.toThrow(
            'Syntax error at near "syntax_error"'
        )
    })

    it('should perform ping/pong health check', async () => {
        await manager.connectWithTransport('db', { command: 'mock' }, clientTransport)
        const isHealthy = await manager.pingServer('db')
        expect(isHealthy).toBe(true)
    })

    it('should disconnect server and unregister tools from registry', async () => {
        await manager.connectWithTransport('db', { command: 'mock' }, clientTransport)
        expect(registry.has('mcp_db_run_query')).toBe(true)

        await manager.disconnectServer('db')
        expect(registry.has('mcp_db_run_query')).toBe(false)
        expect(manager.getServer('db')?.status).toBe('disconnected')
    })

    it('should handle disabled server configs without connecting', async () => {
        const info = await manager.connectServer('disabled-srv', {
            command: 'something',
            disabled: true,
        })
        expect(info.status).toBe('disconnected')
        expect(registry.has('mcp_disabled_srv_run_query')).toBe(false)
    })

    it('should handle server connection failures gracefully without crashing', async () => {
        const info = await manager.connectServer('failing-srv', {
            command: '__non_existent_executable_12345__',
        })
        expect(info.status).toBe('error')
        expect(info.error).toBeDefined()
    })

    describe('Eager vs Deferred Tool Distribution', () => {
        it('should classify tools as eager when <= 5 tools and eager is not false', async () => {
            await manager.connectWithTransport('db', { command: 'mock' }, clientTransport)
            const eagerTools = manager.getEagerTools()
            expect(eagerTools).toHaveLength(1)
            expect(eagerTools[0].name).toBe('mcp_db_run_query')
        })

        it('should keep tools deferred when eager is explicitly set to false', async () => {
            await manager.connectWithTransport(
                'db',
                { command: 'mock', eager: false },
                clientTransport
            )
            const eagerTools = manager.getEagerTools()
            expect(eagerTools).toHaveLength(0)
            expect(registry.has('mcp_db_run_query')).toBe(true)
        })
    })

    describe('Resource Reading and ReadMcpResourceTool', () => {
        it('should read resource from MCP server via readResource', async () => {
            await manager.connectWithTransport('db', { command: 'mock' }, clientTransport)
            const content = await manager.readResource('db', 'schema://public')
            expect(content).toContain('CREATE TABLE users')
        })

        it('should execute ReadMcpResourceTool successfully', async () => {
            await manager.connectWithTransport('db', { command: 'mock' }, clientTransport)
            const resourceTool = createReadMcpResourceTool(manager)

            const result = await resourceTool.execute(
                { server: 'db', uri: 'schema://public' },
                mockContext
            )
            expect(result).toContain('CREATE TABLE users')
        })
    })

    describe('Server Lifecycle: Stop, Start, Restart, Remove', () => {
        it('should stop connected server, evict eager tools and registry, and preserve config', async () => {
            await manager.connectWithTransport('db', { command: 'mock' }, clientTransport)
            expect(manager.getEagerTools()).toHaveLength(1)
            expect(manager.getServer('db')?.status).toBe('connected')

            await manager.stopServer('db')
            expect(manager.getEagerTools()).toHaveLength(0)
            expect(registry.has('mcp_db_run_query')).toBe(false)
            expect(manager.getServer('db')?.status).toBe('disconnected')
            expect(manager.getServer('db')?.config).toBeDefined()
        })

        it('should remove server completely from manager', async () => {
            await manager.connectWithTransport('db', { command: 'mock' }, clientTransport)
            await manager.removeServer('db')
            expect(manager.getServer('db')).toBeUndefined()
            expect(manager.getEagerTools()).toHaveLength(0)
        })
    })
})
