import fsSync from 'fs'
import fs from 'fs/promises'
import os from 'os'
import path from 'path'

import { getDecemberDir, readExtensionPreferences } from '@december/shared'

import type {
    PluginComponentSummary,
    PluginInstallRecord,
    PluginItem,
    PluginMcpServerSummary,
    PluginScope,
} from './types'
import type { McpServerConfig } from '../mcp/types'

export const PLUGIN_INSTALL_RECORD_FILE = '.december-install.json'

/** Manifest locations, in priority order. Claude Code plugin folders work as-is. */
const MANIFEST_FILES = [
    'plugin.json',
    path.join('.december-plugin', 'plugin.json'),
    path.join('.claude-plugin', 'plugin.json'),
]

const MCP_FILES = ['mcp.json', 'mcp_config.json', '.mcp.json']

export interface PluginSearchDir {
    path: string
    scope: PluginScope
}

/** Folders that hold installed plugins. Earlier folders win on a name clash. */
export function getPluginSearchDirs(workspaceDir: string, homeDir?: string): PluginSearchDir[] {
    const home = homeDir || os.homedir()
    return [
        { path: path.join(workspaceDir, '.december', 'plugins'), scope: 'workspace' },
        { path: path.join(workspaceDir, '.agents', 'plugins'), scope: 'workspace' },
        { path: path.join(getDecemberDir(homeDir), 'plugins'), scope: 'global' },
        { path: path.join(home, '.gemini', 'config', 'plugins'), scope: 'global' },
    ]
}

export function getPluginInstallDir(data: {
    scope: 'user' | 'project'
    name: string
    workspaceDir: string
    homeDir?: string
}): string {
    const { scope, name, workspaceDir, homeDir } = data
    return scope === 'project'
        ? path.join(workspaceDir, '.december', 'plugins', name)
        : path.join(getDecemberDir(homeDir), 'plugins', name)
}

function readJsonSync(filePath: string): any | null {
    try {
        return JSON.parse(fsSync.readFileSync(filePath, 'utf8'))
    } catch {
        // Intentionally swallowed: missing or malformed file
        return null
    }
}

export function readPluginManifestSync(pluginDir: string): Record<string, any> | null {
    for (const file of MANIFEST_FILES) {
        const data = readJsonSync(path.join(pluginDir, file))
        if (data && typeof data === 'object' && !Array.isArray(data)) return data
    }
    return null
}

function substitutePluginRoot(value: unknown, pluginDir: string): unknown {
    if (typeof value === 'string') {
        return value
            .replace(/\$\{DECEMBER_PLUGIN_ROOT\}/g, pluginDir)
            .replace(/\$\{CLAUDE_PLUGIN_ROOT\}/g, pluginDir)
    }
    if (Array.isArray(value)) return value.map((v) => substitutePluginRoot(v, pluginDir))
    if (value && typeof value === 'object') {
        return Object.fromEntries(
            Object.entries(value).map(([k, v]) => [k, substitutePluginRoot(v, pluginDir)])
        )
    }
    return value
}

/** MCP servers a plugin folder declares, with plugin-root variables filled in */
export function readPluginMcpServersFromDir(pluginDir: string): PluginMcpServerSummary[] {
    let data: any = null
    for (const file of MCP_FILES) {
        data = readJsonSync(path.join(pluginDir, file))
        if (data) break
    }
    const serversMap = data?.mcpServers || data || {}
    if (typeof serversMap !== 'object' || Array.isArray(serversMap)) return []

    const servers: PluginMcpServerSummary[] = []
    for (const [name, raw] of Object.entries(serversMap)) {
        if (!raw || typeof raw !== 'object') continue
        const cfg = substitutePluginRoot(raw, pluginDir) as any
        const isStdio = Boolean(cfg.command)
        if (!isStdio && !cfg.url && !cfg.endpoint && !cfg.sse) continue
        servers.push({
            name,
            commandOrUrl: isStdio
                ? `${cfg.command}${cfg.args ? ' ' + cfg.args.join(' ') : ''}`
                : cfg.url || cfg.endpoint || cfg.sse,
            transport: isStdio ? 'stdio' : 'http',
            config: cfg as McpServerConfig,
        })
    }
    return servers
}

async function inspectPluginComponents(pluginDir: string): Promise<PluginComponentSummary> {
    const summary: PluginComponentSummary = {
        skills: [],
        rules: [],
        mcpServers: readPluginMcpServersFromDir(pluginDir),
    }

    const skillsDir = path.join(pluginDir, 'skills')
    try {
        const skillEntries = await fs.readdir(skillsDir, { withFileTypes: true })
        for (const entry of skillEntries) {
            if (!entry.isDirectory()) continue
            const skillFile = path.join(skillsDir, entry.name, 'SKILL.md')
            try {
                const skillContent = await fs.readFile(skillFile, 'utf8')
                const nameMatch = skillContent.match(/name:\s*([^\n\r]+)/)
                const descMatch = skillContent.match(/description:\s*([^\n\r]+)/)
                summary.skills.push({
                    name: nameMatch && nameMatch[1] ? nameMatch[1].trim() : entry.name,
                    description: descMatch && descMatch[1] ? descMatch[1].trim() : undefined,
                    entryFilePath: skillFile,
                })
            } catch {
                // Intentionally swallowed: skill file missing or unreadable
            }
        }
    } catch {
        // Intentionally swallowed: no skills directory
    }

    const rulesDir = path.join(pluginDir, 'rules')
    try {
        const ruleFiles = await fs.readdir(rulesDir)
        for (const rFile of ruleFiles) {
            if (rFile.endsWith('.md')) {
                summary.rules.push({
                    name: rFile.replace(/\.md$/, ''),
                    path: path.join(rulesDir, rFile),
                })
            }
        }
    } catch {
        // Intentionally swallowed: no rules directory
    }

    return summary
}

function isPluginEnabled(
    id: string,
    manifest: Record<string, any>,
    prefs: Record<string, boolean>
): boolean {
    return prefs[id] !== undefined ? prefs[id] : manifest.disabled !== true
}

export async function discoverPluginsInDirectory(
    baseDir: string,
    scope: PluginScope,
    enabledPrefs: Record<string, boolean> = {}
): Promise<PluginItem[]> {
    const results: PluginItem[] = []

    try {
        const entries = await fs.readdir(baseDir, { withFileTypes: true })
        for (const entry of entries) {
            if (!entry.isDirectory()) continue
            const pluginDir = path.join(baseDir, entry.name)
            const manifest = readPluginManifestSync(pluginDir)
            if (!manifest) continue

            const id = entry.name
            const author =
                typeof manifest.author === 'string' ? manifest.author : manifest.author?.name
            const install = readJsonSync(
                path.join(pluginDir, PLUGIN_INSTALL_RECORD_FILE)
            ) as PluginInstallRecord | null

            results.push({
                id,
                name: manifest.name || entry.name,
                description: manifest.description || '',
                version: manifest.version,
                author,
                scope,
                dirPath: pluginDir,
                enabled: isPluginEnabled(id, manifest, enabledPrefs),
                manifest: { ...manifest, name: manifest.name || entry.name },
                components: await inspectPluginComponents(pluginDir),
                ...(install ? { install } : {}),
            })
        }
    } catch {
        // Intentionally swallowed: directory does not exist or unreadable
    }

    return results
}

export async function discoverAllPlugins(options?: {
    workspaceDir?: string
    globalDir?: string
}): Promise<PluginItem[]> {
    const workspace = options?.workspaceDir || process.cwd()
    const prefs = readExtensionPreferences({
        homeDir: options?.globalDir,
        workspaceDir: workspace,
    })

    const discoveredMap = new Map<string, PluginItem>()
    for (const dir of getPluginSearchDirs(workspace, options?.globalDir)) {
        const found = await discoverPluginsInDirectory(dir.path, dir.scope, prefs.plugins)
        for (const p of found) {
            // First one discovered (workspace over global) wins
            if (!discoveredMap.has(p.id)) {
                discoveredMap.set(p.id, p)
            }
        }
    }

    return Array.from(discoveredMap.values())
}

export interface PluginMcpServerEntry {
    pluginId: string
    pluginScope: PluginScope
    name: string
    config: McpServerConfig
}

/**
 * MCP servers that come from turned-on plugins. Sync so the startup config
 * loader and the help screen can use it.
 */
export function readPluginMcpServersSync(options?: {
    workspaceDir?: string
    homeDir?: string
}): PluginMcpServerEntry[] {
    const workspace = options?.workspaceDir || process.cwd()
    const prefs = readExtensionPreferences({ homeDir: options?.homeDir, workspaceDir: workspace })
    const seenPlugins = new Set<string>()
    const results: PluginMcpServerEntry[] = []

    for (const dir of getPluginSearchDirs(workspace, options?.homeDir)) {
        let entries: fsSync.Dirent[]
        try {
            entries = fsSync.readdirSync(dir.path, { withFileTypes: true })
        } catch {
            // Intentionally swallowed: plugin folder does not exist
            continue
        }
        for (const entry of entries) {
            if (!entry.isDirectory() || seenPlugins.has(entry.name)) continue
            const pluginDir = path.join(dir.path, entry.name)
            const manifest = readPluginManifestSync(pluginDir)
            if (!manifest) continue
            seenPlugins.add(entry.name)
            if (!isPluginEnabled(entry.name, manifest, prefs.plugins)) continue
            for (const server of readPluginMcpServersFromDir(pluginDir)) {
                results.push({
                    pluginId: entry.name,
                    pluginScope: dir.scope,
                    name: server.name,
                    config: server.config,
                })
            }
        }
    }

    return results
}
