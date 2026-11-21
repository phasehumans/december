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

/** Written next to an installed plugin so December knows where it came from */
export interface PluginInstallRecord {
    marketplace?: string
    name: string
    source: string
    version?: string
    installedAt: string
}

export type PluginScope = 'built-in' | 'workspace' | 'global'
export type PluginInstallScope = 'user' | 'project'

export interface PluginItem {
    id: string
    name: string
    description: string
    version?: string
    author?: string
    scope: PluginScope
    dirPath: string
    enabled: boolean
    manifest: PluginManifest
    components: PluginComponentSummary
    install?: PluginInstallRecord
}

/**
 * Where a marketplace entry gets its files. A string is a path relative to the
 * marketplace root ("./plugins/x"), "github:owner/repo", "owner/repo", or a git url.
 */
export type MarketplacePluginSource =
    | string
    | { source: 'github'; repo: string; ref?: string }
    | { source: 'url' | 'git'; url: string; ref?: string }

export interface MarketplacePluginEntry {
    name: string
    description?: string
    version?: string
    author?: string | { name: string; email?: string; url?: string }
    category?: string
    source?: MarketplacePluginSource
    /** Inline MCP servers, used by the built-in marketplace instead of a source */
    mcpServers?: Record<string, McpServerConfig>
    /** Environment variables the plugin needs before it works */
    env?: string[]
    /** Suggested install scope */
    defaultScope?: PluginInstallScope
}

export interface MarketplaceManifest {
    name: string
    owner?: string | { name: string; email?: string }
    description?: string
    plugins: MarketplacePluginEntry[]
}

export interface MarketplaceInfo {
    name: string
    source: string
    builtIn: boolean
    /** Folder that holds marketplace.json (undefined for the built-in one) */
    dirPath?: string
    plugins: MarketplacePluginEntry[]
    updatedAt?: number
    error?: string
}

export interface DiscoverablePlugin {
    /** Unique across marketplaces: "<name>@<marketplace>" */
    id: string
    name: string
    description: string
    category?: string
    author?: string
    version?: string
    marketplace: string
    installed?: boolean
    installedVersion?: string
    updateAvailable?: boolean
    env?: string[]
    defaultScope?: PluginInstallScope
    skillNames?: string[]
    mcpServerNames?: string[]
}

export interface PluginManagerOptions {
    workspaceDir?: string
    /** Home directory that holds .december (defaults to DECEMBER_CONFIG_DIR or ~) */
    globalDir?: string
}

export interface InstallPluginOptions {
    scope?: PluginInstallScope
}
