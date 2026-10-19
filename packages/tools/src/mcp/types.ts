import type { Tool } from '@december/shared'

export interface McpServerStdioConfig {
    command: string
    args?: string[]
    env?: Record<string, string>
    cwd?: string
    disabled?: boolean
    description?: string
}

export interface McpServerSseConfig {
    url?: string
    endpoint?: string
    sse?: string
    headers?: Record<string, string>
    disabled?: boolean
    description?: string
}

export type McpServerConfig = McpServerStdioConfig | McpServerSseConfig

export type McpServerStatus = 'connecting' | 'connected' | 'disconnected' | 'error'

export interface McpServerInfo {
    name: string
    config: McpServerConfig
    status: McpServerStatus
    error?: string
    serverVersion?: {
        name: string
        version?: string
    }
    capabilities?: Record<string, any>
    tools: Tool[]
    resources?: any[]
    prompts?: any[]
    connectedAt?: number
}

export interface LoadMcpConfigOptions {
    workspaceDir?: string
    homeDir?: string
    globalConfigPath?: string
}
