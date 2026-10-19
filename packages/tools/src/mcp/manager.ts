import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'

import { createMcpTool } from './tool-adapter'

import type { McpServerConfig, McpServerInfo } from './types'
import type { DeferredToolRegistry } from '../deferred-registry'
import type { Tool, ToolExecuteContext } from '@december/shared'
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js'

export interface McpClientManagerOptions {
    registry?: DeferredToolRegistry
    workspaceDir?: string
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
    private registry?: DeferredToolRegistry
    private workspaceDir?: string

    constructor(options?: McpClientManagerOptions) {
        this.registry = options?.registry
        this.workspaceDir = options?.workspaceDir
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
                transport = new SSEClientTransport(new URL(urlStr), {
                    requestInit: sseConfig.headers ? { headers: sseConfig.headers } : undefined,
                })
            }

            return await this.connectWithTransport(name, config, transport)
        } catch (err: any) {
            const info: McpServerInfo = {
                name,
                config,
                status: 'error',
                error: err?.message || String(err),
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

        try {
            const client = new Client({ name: 'december', version: '0.4.13' }, { capabilities: {} })

            await client.connect(transport)

            this.clients.set(name, client)
            this.transports.set(name, transport)

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

                const convertedTools: Tool[] = []
                for (const mTool of mcpTools) {
                    const decTool = createMcpTool({
                        serverName: name,
                        mcpTool: mTool,
                        callTool: async (toolName, args, context) => {
                            return this.callTool(name, toolName, args, context)
                        },
                    })
                    convertedTools.push(decTool)

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
            info.status = 'error'
            info.error = err?.message || String(err)
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

    public async disconnectServer(name: string): Promise<void> {
        const info = this.servers.get(name)
        if (info && this.registry) {
            for (const tool of info.tools) {
                this.registry.unregister(tool.name)
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
