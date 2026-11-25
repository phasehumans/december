import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'

import { McpConnectRefusedError, MCP_REFUSAL_REASONS } from './guarded-fetch'
import { createMcpTool, formatMcpContent } from './tool-adapter'

import type { McpServerConfig, McpServerInfo } from './types'
import type { DeferredToolRegistry } from '../deferred-registry'
import type { Tool, ToolExecuteContext } from '@december/shared'
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js'

export interface McpClientManagerOptions {
    registry?: DeferredToolRegistry
    workspaceDir?: string
    /**
     * The fetch of every url server (http and sse). A cloud run passes the guarded
     * fetch here (`createGuardedMcpFetch`); with none, the global fetch is used.
     */
    remoteFetch?: (url: string | URL, init?: RequestInit) => Promise<Response>
}

/**
 * Why a server did not connect. The http and sse transports keep the http status in
 * `code` and not in the message, so it goes in front: "HTTP 401: ...".
 */
function describeConnectError(err: any): string {
    const message = err?.message || String(err)
    const status = typeof err?.code === 'number' && err.code >= 300 && err.code <= 599
    return status && !message.includes(String(err.code)) ? `HTTP ${err.code}: ${message}` : message
}

/**
 * The parts of a connect failure that are safe to save and show: the http status and a
 * fixed reason of the guarded fetch. `error` can hold text the server answered with.
 */
function describeConnectFailure(err: any): { errorStatus?: number; errorReason?: string } {
    const message = String(err?.message || err || '')
    const errorStatus =
        typeof err?.code === 'number' && err.code >= 300 && err.code <= 599 ? err.code : undefined
    // the sse transport wraps the error of the fetch, so the reason is also found by its text
    const errorReason =
        err instanceof McpConnectRefusedError
            ? err.reason
            : MCP_REFUSAL_REASONS.find((reason) => message.includes(reason))
    return {
        ...(errorStatus !== undefined ? { errorStatus } : {}),
        ...(errorReason ? { errorReason } : {}),
    }
}

function extractKeywords(tool: { name: string; description?: string }): string[] {
    const text = `${tool.name} ${tool.description || ''}`.toLowerCase()
    const tokens = text.split(/[\s,_\-.:/()]+/).filter((t) => t.length > 2)
    return Array.from(new Set(tokens))
}

export class McpClientManager {
    private servers: Map<string, McpServerInfo> = new Map()
    private clients: Map<string, Client> = new Map()
    private transports: Map<string, Transport> = new Map()
    private eagerTools: Map<string, Tool> = new Map()
    private registry?: DeferredToolRegistry
    private workspaceDir?: string
    private remoteFetch?: McpClientManagerOptions['remoteFetch']

    constructor(options?: McpClientManagerOptions) {
        this.registry = options?.registry
        this.workspaceDir = options?.workspaceDir
        this.remoteFetch = options?.remoteFetch
    }

    public setRegistry(registry: DeferredToolRegistry): void {
        this.registry = registry
    }

    public getServer(name: string): McpServerInfo | undefined {
        return this.servers.get(name)
    }

    public getAllServers(): McpServerInfo[] {
        return Array.from(this.servers.values())
    }

    public getConnectedServers(): McpServerInfo[] {
        return Array.from(this.servers.values()).filter((s) => s.status === 'connected')
    }

    public getAllTools(): Tool[] {
        const tools: Tool[] = []
        for (const server of this.servers.values()) {
            if (server.status === 'connected') {
                tools.push(...server.tools)
            }
        }
        return tools
    }

    public getEagerTools(): Tool[] {
        return Array.from(this.eagerTools.values())
    }

    public async connectServer(name: string, config: McpServerConfig): Promise<McpServerInfo> {
        if (config.disabled) {
            const info: McpServerInfo = {
                name,
                config,
                status: 'disconnected',
                tools: [],
            }
            this.servers.set(name, info)
            return info
        }

        try {
            let transport: Transport

            if ('command' in config && config.command) {
                transport = new StdioClientTransport({
                    command: config.command,
                    args: config.args,
                    env: { ...(process.env as Record<string, string>), ...(config.env || {}) },
                    cwd: config.cwd || this.workspaceDir || process.cwd(),
                    stderr: 'pipe',
                })
            } else {
                const sseConfig = config as any
                const urlStr = sseConfig.url || sseConfig.endpoint || sseConfig.sse
                if (!urlStr) {
                    throw new Error(
                        `MCP server "${name}" has neither a command nor a URL configured`
                    )
                }
                const requestInit = sseConfig.headers ? { headers: sseConfig.headers } : undefined
                const transportOptions = {
                    requestInit,
                    ...(this.remoteFetch ? { fetch: this.remoteFetch } : {}),
                }
                transport =
                    sseConfig.transport === 'http'
                        ? new StreamableHTTPClientTransport(new URL(urlStr), transportOptions)
                        : new SSEClientTransport(new URL(urlStr), transportOptions)
            }

            return await this.connectWithTransport(name, config, transport)
        } catch (err: any) {
            const info: McpServerInfo = {
                name,
                config,
                status: 'error',
                error: describeConnectError(err),
                ...describeConnectFailure(err),
                tools: [],
            }
            this.servers.set(name, info)
            return info
        }
    }

    public async connectWithTransport(
        name: string,
        config: McpServerConfig,
        transport: Transport
    ): Promise<McpServerInfo> {
        // Disconnect existing instance if already present
        if (this.clients.has(name)) {
            await this.disconnectServer(name).catch(() => {
                // Intentionally swallowed: ignore cleanup failure
            })
        }

        const info: McpServerInfo = {
            name,
            config,
            status: 'connecting',
            tools: [],
        }
        this.servers.set(name, info)

        const client = new Client({ name: 'december', version: '0.4.13' }, { capabilities: {} })
        // kept from the start, so a server that hangs while it connects can be closed
        this.clients.set(name, client)
        this.transports.set(name, transport)

        try {
            await client.connect(transport)

            if (this.clients.get(name) !== client) {
                throw new Error(`MCP server "${name}" was closed while it connected`)
            }

            // Negotiate capabilities & fetch metadata
            const capabilities = client.getServerCapabilities()
            const serverVersion = client.getServerVersion()

            info.capabilities = capabilities
            info.serverVersion = serverVersion
            info.status = 'connected'
            info.connectedAt = Date.now()

            // Discover and register tools
            try {
                const toolResponse = await client.listTools()
                const mcpTools = toolResponse.tools || []
                const isEager =
                    config.eager === true || (config.eager !== false && mcpTools.length <= 5)

                const convertedTools: Tool[] = []
                info.availableTools = mcpTools.map((mTool) => mTool.name)
                const disabledTools = new Set(
                    'disabledTools' in config ? (config.disabledTools ?? []) : []
                )
                for (const mTool of mcpTools) {
                    if (disabledTools.has(mTool.name)) continue
                    const decTool = createMcpTool({
                        serverName: name,
                        mcpTool: mTool,
                        callTool: async (toolName, args, context) => {
                            return this.callTool(name, toolName, args, context)
                        },
                    })
                    convertedTools.push(decTool)

                    if (isEager) {
                        this.eagerTools.set(decTool.name, decTool)
                    }

                    if (this.registry) {
                        this.registry.register(decTool, {
                            category: 'mcp',
                            keywords: ['mcp', name, mTool.name, ...extractKeywords(mTool)],
                        })
                    }
                }
                info.tools = convertedTools
            } catch (toolErr: any) {
                // Server might not export tools or tool listing failed
                info.tools = []
            }

            // Discover resources if available
            try {
                const resResponse = await client.listResources()
                info.resources = resResponse.resources || []
            } catch {
                // Intentionally swallowed: resources are optional
                info.resources = []
            }

            return info
        } catch (err: any) {
            // a server that did not connect keeps no client
            if (this.clients.get(name) === client) this.clients.delete(name)
            if (this.transports.get(name) === transport) this.transports.delete(name)
            info.status = 'error'
            info.error = describeConnectError(err)
            Object.assign(info, describeConnectFailure(err))
            info.tools = []
            return info
        }
    }

    public async pingServer(name: string): Promise<boolean> {
        const client = this.clients.get(name)
        if (!client) return false

        try {
            await client.ping()
            return true
        } catch {
            return false
        }
    }

    public async callTool(
        serverName: string,
        toolName: string,
        args: any,
        context?: ToolExecuteContext
    ): Promise<any> {
        const client = this.clients.get(serverName)
        if (!client) {
            throw new Error(`MCP server "${serverName}" is not connected`)
        }

        return client.callTool(
            {
                name: toolName,
                arguments: args || {},
            },
            undefined,
            { signal: context?.signal }
        )
    }

    public async readResource(serverName: string, uri: string): Promise<string> {
        const client = this.clients.get(serverName)
        if (!client) {
            throw new Error(`MCP server "${serverName}" is not connected`)
        }

        const res = await client.readResource({ uri })
        return formatMcpContent(res.contents)
    }

    public async disconnectServer(name: string): Promise<void> {
        const info = this.servers.get(name)
        if (info) {
            for (const tool of info.tools) {
                this.eagerTools.delete(tool.name)
                if (this.registry) {
                    this.registry.unregister(tool.name)
                }
            }
        }

        const client = this.clients.get(name)
        if (client) {
            try {
                await client.close()
            } catch {
                // Intentionally swallowed: ignore client close errors
            }
            this.clients.delete(name)
        }

        const transport = this.transports.get(name)
        if (transport) {
            try {
                await transport.close()
            } catch {
                // Intentionally swallowed: ignore transport close errors
            }
            this.transports.delete(name)
        }

        if (info) {
            info.status = 'disconnected'
            info.tools = []
        }
    }

    public async stopServer(name: string): Promise<void> {
        await this.disconnectServer(name)
    }

    public async startServer(
        name: string,
        configOverride?: McpServerConfig
    ): Promise<McpServerInfo> {
        const info = this.servers.get(name)
        const config = configOverride || info?.config
        if (!config) {
            throw new Error(`No configuration found for MCP server "${name}"`)
        }
        return this.connectServer(name, config)
    }

    public async restartServer(name: string): Promise<McpServerInfo> {
        const info = this.servers.get(name)
        const config = info?.config
        if (!config) {
            throw new Error(`No configuration found for MCP server "${name}"`)
        }
        await this.disconnectServer(name)
        return this.connectServer(name, config)
    }

    public async removeServer(name: string): Promise<void> {
        await this.disconnectServer(name)
        this.servers.delete(name)
    }

    public async disconnectAll(): Promise<void> {
        const names = Array.from(this.servers.keys())
        await Promise.all(
            names.map((name) =>
                this.disconnectServer(name).catch(() => {
                    // Intentionally swallowed: cleanup error
                })
            )
        )
    }

    public async connectAll(
        configs: Record<string, McpServerConfig>
    ): Promise<Record<string, McpServerInfo>> {
        const results: Record<string, McpServerInfo> = {}
        const entries = Object.entries(configs)

        await Promise.all(
            entries.map(async ([name, cfg]) => {
                const info = await this.connectServer(name, cfg)
                results[name] = info
            })
        )

        return results
    }
}
