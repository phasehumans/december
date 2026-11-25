import type { Tool } from '@december/shared'

export interface McpServerStdioConfig {
    command: string
    args?: string[]
    env?: Record<string, string>
    cwd?: string
    disabled?: boolean
    description?: string
    eager?: boolean
    scope?: 'global' | 'project'
}

export interface McpServerSseConfig {
    url?: string
    endpoint?: string
    sse?: string
    headers?: Record<string, string>
    /** sse (the default) or http: the streamable http transport of newer servers */
    transport?: 'sse' | 'http'
    /** tool names of this server the agent does not get */
    disabledTools?: string[]
    disabled?: boolean
    description?: string
    eager?: boolean
    scope?: 'global' | 'project'
}

export type McpServerConfig = McpServerStdioConfig | McpServerSseConfig

export type McpServerStatus = 'connecting' | 'connected' | 'disconnected' | 'error'

export interface McpServerInfo {
    name: string
    config: McpServerConfig
    status: McpServerStatus
    /** why it did not connect; can hold text the server answered with, so never save it */
    error?: string
    /** the http status of a failed connect, when there was one */
    errorStatus?: number
    /** a fixed reason of the guarded fetch (internal address, redirect); safe to save */
    errorReason?: string
    serverVersion?: {
        name: string
        version?: string
    }
    capabilities?: Record<string, any>
    tools: Tool[]
    /** every tool the server lists, also the ones turned off */
    availableTools?: string[]
    resources?: any[]
    prompts?: any[]
    connectedAt?: number
}

export interface LoadMcpConfigOptions {
    workspaceDir?: string
    homeDir?: string
    globalConfigPath?: string
}
