import os from 'os'
import path from 'path'

import { SkillDiscoveryEngine } from '@december/shared'

import { listMcpServersWithScope } from '../mcp/config'

import { PluginManager } from './manager'

import type { DiscoverablePlugin, MarketplaceInfo, PluginItem } from './types'
import type { McpServerWithScope } from '../mcp/config'
import type { DiscoveredSkill } from '@december/shared'

export type ExtensionKind = 'plugin' | 'skill' | 'mcp'
export type ExtensionScope = 'project' | 'user' | 'built-in'

export interface McpRuntimeStatus {
    status: 'connected' | 'connecting' | 'disconnected' | 'error'
    toolCount: number
    error?: string
}

/** One row in /plugin › Installed */
export interface ExtensionEntry {
    /** Unique across kinds: "<kind>:<id>" */
    key: string
    kind: ExtensionKind
    id: string
    name: string
    description: string
    scope: ExtensionScope
    enabled: boolean
    /** Where it came from: a marketplace, a folder, or "via <plugin>" */
    source: string
    /** Short facts for the row, e.g. "2 skills · 1 mcp" or "6 tools" */
    meta: string
    path?: string
    version?: string
    removable: boolean
    parentPlugin?: string
    entryFilePath?: string
    tokens?: number
    mcpScope?: 'global' | 'project'
    status?: McpRuntimeStatus['status']
    error?: string
    updatable?: boolean
    updateAvailable?: boolean
    latestVersion?: string
    children?: ExtensionEntry[]
}

export interface PluginCatalog {
    installed: ExtensionEntry[]
    discover: DiscoverablePlugin[]
    marketplaces: Array<MarketplaceInfo & { installedCount: number }>
}

export interface LoadPluginCatalogOptions {
    workspaceDir?: string
    homeDir?: string
    mcpStatus?: (name: string) => McpRuntimeStatus | undefined
}

function tildePath(p: string): string {
    const home = os.homedir()
    return p.startsWith(home) ? '~' + p.slice(home.length) : p
}

function displayDir(dir: string, workspaceDir: string): string {
    const relative = path.relative(workspaceDir, dir)
    return relative && !relative.startsWith('..') && !path.isAbsolute(relative)
        ? relative
        : tildePath(dir)
}

function plural(count: number, word: string): string {
    return `${count} ${word}${count === 1 ? '' : 's'}`
}

function isInside(child: string, parent: string): boolean {
    const relative = path.relative(parent, child)
    return !relative.startsWith('..') && !path.isAbsolute(relative)
}

function skillScope(skill: DiscoveredSkill, workspaceDir: string): ExtensionScope {
    switch (skill.origin) {
        case 'builtin':
            return 'built-in'
        case 'workspace':
        case 'workspace-plugin':
            return 'project'
        case 'global':
        case 'global-plugin':
            return 'user'
        default:
            return isInside(skill.directoryPath, workspaceDir) ? 'project' : 'user'
    }
}

function estimateTokens(skill: DiscoveredSkill): number {
    // What a skill costs every turn: its name and description in the skill list
    return Math.max(
        1,
        Math.ceil((skill.name.length + (skill.metadata.description || '').length) / 4)
    )
}

function skillEntry(
    skill: DiscoveredSkill,
    workspaceDir: string,
    parentPlugin?: string
): ExtensionEntry {
    const tokens = estimateTokens(skill)
    const source =
        skill.origin === 'builtin'
            ? 'built-in'
            : parentPlugin
              ? `via ${parentPlugin}`
              : displayDir(path.dirname(skill.directoryPath), workspaceDir)
    return {
        key: `skill:${skill.name}`,
        kind: 'skill',
        id: skill.name,
        name: skill.name,
        description: (skill.metadata.description || '').replace(/\s+/g, ' ').trim(),
        scope: skillScope(skill, workspaceDir),
        enabled: skill.enabled !== false,
        source,
        meta: `~${tokens} tok`,
        path: skill.directoryPath,
        removable: false,
        entryFilePath: skill.entryFilePath,
        tokens,
        ...(parentPlugin ? { parentPlugin } : {}),
    }
}

function mcpEntry(
    server: McpServerWithScope,
    workspaceDir: string,
    status: McpRuntimeStatus | undefined
): ExtensionEntry {
    const enabled = !server.config.disabled
    const cfg = server.config as any
    const target = cfg.command
        ? `${cfg.command}${cfg.args ? ' ' + cfg.args.join(' ') : ''}`
        : cfg.url || cfg.endpoint || ''
    let meta: string
    if (!enabled) meta = 'off'
    else if (status?.status === 'error') meta = 'failed'
    else if (status?.status === 'connected') meta = plural(status.toolCount, 'tool')
    else if (status?.status === 'connecting') meta = 'connecting'
    else meta = 'not running'

    const source = server.plugin
        ? `via ${server.plugin}`
        : server.scope === 'project'
          ? '.december/mcp.json'
          : tildePath(path.join(process.env.DECEMBER_CONFIG_DIR || '~/.december', 'config.json'))

    return {
        key: `mcp:${server.name}`,
        kind: 'mcp',
        id: server.name,
        name: server.name,
        description: cfg.description || target,
        scope: server.scope === 'project' ? 'project' : 'user',
        enabled,
        source,
        meta,
        removable: !server.plugin,
        mcpScope: server.scope,
        status: status?.status,
        error: status?.error,
        ...(server.plugin ? { parentPlugin: server.plugin } : {}),
        ...(server.scope === 'project'
            ? { path: path.join(workspaceDir, '.december', 'mcp.json') }
            : {}),
    }
}

function pluginEntry(
    plugin: PluginItem,
    skills: ExtensionEntry[],
    servers: ExtensionEntry[],
    discover: DiscoverablePlugin[]
): ExtensionEntry {
    const parts: string[] = []
    if (skills.length > 0) parts.push(plural(skills.length, 'skill'))
    if (servers.length > 0) parts.push(`${servers.length} mcp`)
    if (plugin.components.rules.length > 0)
        parts.push(plural(plugin.components.rules.length, 'rule'))
    if (!plugin.enabled) parts.push('off')

    const listing = plugin.install?.marketplace
        ? discover.find(
              (d) =>
                  d.marketplace === plugin.install!.marketplace && d.name === plugin.install!.name
          )
        : undefined

    return {
        key: `plugin:${plugin.id}`,
        kind: 'plugin',
        id: plugin.id,
        name: plugin.name,
        description: plugin.description,
        scope:
            plugin.scope === 'workspace'
                ? 'project'
                : plugin.scope === 'built-in'
                  ? 'built-in'
                  : 'user',
        enabled: plugin.enabled,
        source: plugin.install?.marketplace || 'local',
        meta: parts.join(' · ') || 'empty',
        path: plugin.dirPath,
        version: plugin.version,
        removable: plugin.scope !== 'built-in',
        updatable: Boolean(plugin.install),
        updateAvailable: listing?.updateAvailable,
        latestVersion: listing?.version,
        children: [...skills, ...servers],
    }
}

const SCOPE_ORDER: Record<ExtensionScope, number> = { project: 0, user: 1, 'built-in': 2 }
const KIND_ORDER: Record<ExtensionKind, number> = { plugin: 0, skill: 1, mcp: 2 }

/**
 * Everything /plugin shows, loaded in one pass: installed plugins (with their
 * skills and MCP servers nested), standalone skills, MCP servers from config
 * files, the merged Discover list, and the marketplaces.
 */
export async function loadPluginCatalog(
    options: LoadPluginCatalogOptions = {}
): Promise<PluginCatalog> {
    const workspaceDir = options.workspaceDir || process.cwd()
    const manager = new PluginManager({ workspaceDir, globalDir: options.homeDir })

    const [plugins, marketplaces, mcpServers] = await Promise.all([
        manager.getInstalledPlugins(),
        manager.getMarketplaces(),
        listMcpServersWithScope({ workspaceDir, homeDir: options.homeDir }).catch(() => []),
    ])
    const discover = await manager.getDiscoverablePlugins({ installed: plugins, marketplaces })

    const skills = new SkillDiscoveryEngine({
        workspaceDir,
        homeDir: options.homeDir,
        includeDisabled: true,
    }).discoverAllSkills()

    const pluginIds = new Set(plugins.map((p) => p.id))
    const installed: ExtensionEntry[] = []

    for (const plugin of plugins) {
        const childSkills = skills
            .filter((s) => s.pluginId === plugin.id)
            .map((s) => skillEntry(s, workspaceDir, plugin.name))
        const childServers = mcpServers
            .filter((s) => s.plugin === plugin.id)
            .map((s) => mcpEntry(s, workspaceDir, options.mcpStatus?.(s.name)))
        // A turned-off plugin has no servers in the live config; show its declared ones
        if (!plugin.enabled) {
            for (const declared of plugin.components.mcpServers) {
                childServers.push(
                    mcpEntry(
                        {
                            name: declared.name,
                            config: { ...declared.config, disabled: true },
                            scope: plugin.scope === 'workspace' ? 'project' : 'global',
                            plugin: plugin.id,
                        },
                        workspaceDir,
                        undefined
                    )
                )
            }
        }
        installed.push(pluginEntry(plugin, childSkills, childServers, discover))
    }

    for (const skill of skills) {
        if (skill.pluginId && pluginIds.has(skill.pluginId)) continue
        installed.push(skillEntry(skill, workspaceDir))
    }

    for (const server of mcpServers) {
        if (server.plugin) continue
        installed.push(mcpEntry(server, workspaceDir, options.mcpStatus?.(server.name)))
    }

    installed.sort(
        (a, b) =>
            SCOPE_ORDER[a.scope] - SCOPE_ORDER[b.scope] ||
            KIND_ORDER[a.kind] - KIND_ORDER[b.kind] ||
            a.name.localeCompare(b.name)
    )

    return {
        installed,
        discover,
        marketplaces: marketplaces.map((m) => ({
            ...m,
            installedCount: discover.filter((d) => d.marketplace === m.name && d.installed).length,
        })),
    }
}
