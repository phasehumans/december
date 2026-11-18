import type { McpServerConfig } from '../mcp/types'

export interface PluginManifest {
    name: string
    version?: string
    description?: string
    author?: string | { name: string; url?: string }
    homepage?: string
    builtIn?: boolean
    disabled?: boolean
}

export interface PluginSkillSummary {
    name: string
    description?: string
    entryFilePath?: string
}

export interface PluginRuleSummary {
    name: string
    path: string
}

export interface PluginMcpServerSummary {
    name: string
    commandOrUrl: string
    transport: 'stdio' | 'sse' | 'http'
    config: McpServerConfig
}

export interface PluginComponentSummary {
    skills: PluginSkillSummary[]
    rules: PluginRuleSummary[]
    mcpServers: PluginMcpServerSummary[]
}

export interface PluginItem {
    id: string
    name: string
    description: string
    version?: string
    author?: string
    scope: 'built-in' | 'workspace' | 'global'
    dirPath: string
    enabled: boolean
    manifest: PluginManifest
    components: PluginComponentSummary
}

export interface DiscoverablePlugin {
    id: string
    name: string
    description: string
    category?: string
    author?: string
    version?: string
    source?: string
    installed?: boolean
    defaultSkills?: string[]
    defaultMcpServers?: string[]
}

export interface PluginManagerOptions {
    workspaceDir?: string
    globalDir?: string
}
