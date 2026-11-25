import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import { describe, it, expect, beforeEach, afterEach } from 'bun:test'

import { DeferredToolRegistry } from '../../src/deferred-registry'
import { McpClientManager } from '../../src/mcp'

import type { ToolExecuteContext } from '@december/shared'

const MCP_URL = 'https://mcp.example.test/mcp'

// issue 632 section 2: a remote mcp server over streamable http. The server runs in
// this process and fetch is routed to it, so the test opens no network connection.
describe('McpClientManager over the http transport (Unit)', () => {
    const realFetch = globalThis.fetch
    let registry: DeferredToolRegistry
    let manager: McpClientManager
    let server: Server
    let seen: Array<{ method: string; authorization: string | null }>
    /** what the fake server answers before the mcp server sees the request */
    let gate: (request: Request) => Response | undefined

    const context: ToolExecuteContext = {
        operations: {} as any,
        env: new Map(),
        onStream: () => {},
    }

    beforeEach(async () => {
        registry = new DeferredToolRegistry()
        manager = new McpClientManager({ registry })
        seen = []
        gate = () => undefined

        server = new Server(
            { name: 'issues-server', version: '1.0.0' },
            { capabilities: { tools: {} } }
        )
        server.setRequestHandler(ListToolsRequestSchema, async () => ({
            tools: ['list_issues', 'create_issue', 'delete_issue'].map((name) => ({
                name,
                description: `${name} in the tracker`,
                inputSchema: { type: 'object', properties: { title: { type: 'string' } } },
            })),
        }))
        server.setRequestHandler(CallToolRequestSchema, async (request) => ({
            content: [
                {
                    type: 'text',
                    text: `${request.params.name}: ${(request.params.arguments as any)?.title}`,
                },
            ],
        }))

        const transport = new WebStandardStreamableHTTPServerTransport({
            sessionIdGenerator: () => crypto.randomUUID(),
            enableJsonResponse: true,
        })
        await server.connect(transport)

        globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
            const request = new Request(input as any, init)
            if (request.url !== MCP_URL) {
                throw new Error(`the test must not open a connection to ${request.url}`)
            }
            seen.push({
                method: request.method,
                authorization: request.headers.get('authorization'),
            })
            return gate(request) ?? transport.handleRequest(request)
        }) as typeof fetch
    })

    afterEach(async () => {
        await manager.disconnectAll()
        await server.close().catch(() => {
            // Intentionally swallowed: the server may already be closed
        })
        globalThis.fetch = realFetch
    })

    it('connects with transport http and lists every tool in availableTools', async () => {
        const info = await manager.connectServer('linear', {
            url: MCP_URL,
            transport: 'http',
            eager: true,
        })

        expect(info.status).toBe('connected')
        expect(info.serverVersion?.name).toBe('issues-server')
        expect(info.availableTools).toEqual(['list_issues', 'create_issue', 'delete_issue'])
        expect(info.tools.map((tool) => tool.name)).toEqual([
            'mcp_linear_list_issues',
            'mcp_linear_create_issue',
            'mcp_linear_delete_issue',
        ])
        expect(seen.some((request) => request.method === 'POST')).toBe(true)
    })

    it('leaves the disabledTools out of the tools of the agent, and keeps them in availableTools', async () => {
        const info = await manager.connectServer('linear', {
            url: MCP_URL,
            transport: 'http',
            disabledTools: ['delete_issue', 'not_a_tool'],
            eager: true,
        })

        expect(info.status).toBe('connected')
        expect(info.availableTools).toEqual(['list_issues', 'create_issue', 'delete_issue'])
        expect(info.tools.map((tool) => tool.name)).toEqual([
            'mcp_linear_list_issues',
            'mcp_linear_create_issue',
        ])
        expect(
            manager
                .getEagerTools()
                .map((tool) => tool.name)
                .sort()
        ).toEqual(['mcp_linear_create_issue', 'mcp_linear_list_issues'])
        expect(registry.has('mcp_linear_create_issue')).toBe(true)
        expect(registry.has('mcp_linear_delete_issue')).toBe(false)
    })

    it('sends the headers of the config with every request', async () => {
        await manager.connectServer('linear', {
            url: MCP_URL,
            transport: 'http',
            headers: { Authorization: 'Bearer test-token' },
            eager: true,
        })

        expect(seen.length).toBeGreaterThan(1)
        expect(seen.every((request) => request.authorization === 'Bearer test-token')).toBe(true)
    })

    it('runs a tool of the server over http', async () => {
        await manager.connectServer('linear', { url: MCP_URL, transport: 'http', eager: true })

        const tool = registry.get('mcp_linear_create_issue')
        expect(await tool!.execute({ title: 'fix the login' }, context)).toBe(
            'create_issue: fix the login'
        )
    })

    it('reports a server that refuses the sign-in as an error, with no tools', async () => {
        gate = () => new Response('invalid api key', { status: 401 })

        const info = await manager.connectServer('linear', {
            url: MCP_URL,
            transport: 'http',
            headers: { Authorization: 'Bearer wrong' },
            eager: true,
        })

        expect(info.status).toBe('error')
        // the status and what the server answered
        expect(info.error?.startsWith('HTTP 401: ')).toBe(true)
        expect(info.error).toContain('invalid api key')
        expect(info.tools).toEqual([])
        expect(info.availableTools).toBeUndefined()
        expect(manager.getEagerTools()).toEqual([])
    })

    it('closes a server that hangs while it connects', async () => {
        let aborted = false
        // the server takes the request and never answers; only an abort ends the wait
        globalThis.fetch = ((_input: RequestInfo | URL, init?: RequestInit) =>
            new Promise((_resolve, reject) => {
                init?.signal?.addEventListener('abort', () => {
                    aborted = true
                    reject(new DOMException('aborted', 'AbortError'))
                })
            })) as typeof fetch

        const connecting = manager.connectServer('slow', {
            url: MCP_URL,
            transport: 'http',
            eager: true,
        })
        await new Promise((resolve) => setTimeout(resolve, 20))
        expect(manager.getServer('slow')?.status).toBe('connecting')

        await manager.removeServer('slow')
        const info = await Promise.race([
            connecting,
            new Promise<'still waiting'>((resolve) =>
                setTimeout(() => resolve('still waiting'), 500)
            ),
        ])

        expect(aborted).toBe(true)
        expect(info).not.toBe('still waiting')
        expect((info as { status: string }).status).not.toBe('connected')
        expect(manager.getServer('slow')).toBeUndefined()
        expect(manager.getEagerTools()).toEqual([])
    })
})
