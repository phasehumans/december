import { apiRequest } from '@/shared/api/client'

// plugins installed on the account, in the cli's plugin format. server module: plugin

export type ApiPluginMcpServer = {
    name: string
    /** stdio runs a command in the sandbox; http and sse are remote servers */
    transport: 'stdio' | 'http' | 'sse'
    /** the command line, or the url */
    target: string
}

export type ApiPlugin = {
    name: string
    description: string
    version: string | null
    author: string | null
    sourceKind: 'github' | 'marketplace'
    /** owner/repo (with folder and branch), or name@marketplace */
    source: string
    commitSha: string | null
    enabled: boolean
    skills: { name: string; description: string }[]
    mcpServers: ApiPluginMcpServer[]
    /** environment values the plugin needs (add them as secrets) */
    env: string[]
    updateAvailable: boolean
    fileCount: number
    sizeBytes: number
    installedAt: string
    updatedAt: string
}

export type ApiMarketplacePlugin = {
    name: string
    description: string
    category: string
    author: string
    version: string
    env: string[]
    mcpServers: string[]
    installed: boolean
    updateAvailable: boolean
}

export type ApiMarketplace = {
    name: string
    description: string
    plugins: ApiMarketplacePlugin[]
}

const pluginPath = (name: string) => `/connections/plugins/${encodeURIComponent(name)}`

const listPlugins = async () => {
    const data = await apiRequest<{ plugins: ApiPlugin[] }>('/connections/plugins')
    return data.plugins ?? []
}

const listMarketplace = async () => {
    const data = await apiRequest<{ marketplaces: ApiMarketplace[] }>(
        '/connections/plugins/marketplace'
    )
    return data.marketplaces ?? []
}

/** a marketplace name, owner/repo or a github.com link, like `december plugin install` */
const installPlugin = async (source: string) => {
    const data = await apiRequest<{ plugin: ApiPlugin }>('/connections/plugins', {
        method: 'POST',
        body: JSON.stringify({ source }),
    })
    return data.plugin
}

const setPluginEnabled = async (name: string, enabled: boolean) => {
    const data = await apiRequest<{ plugin: ApiPlugin }>(pluginPath(name), {
        method: 'PATCH',
        body: JSON.stringify({ enabled }),
    })
    return data.plugin
}

const updatePlugin = (name: string) =>
    apiRequest<{ plugin: ApiPlugin; changed: boolean }>(`${pluginPath(name)}/update`, {
        method: 'POST',
    })

const uninstallPlugin = (name: string) =>
    apiRequest<{ deleted: boolean }>(pluginPath(name), { method: 'DELETE' })

export const pluginsAPI = {
    listPlugins,
    listMarketplace,
    installPlugin,
    setPluginEnabled,
    updatePlugin,
    uninstallPlugin,
}
