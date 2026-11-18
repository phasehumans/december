import fs from 'fs/promises'
import os from 'os'
import path from 'path'

import type { PluginComponentSummary, PluginItem } from './types'

async function safeReadJson(filePath: string): Promise<any | null> {
    try {
        const raw = await fs.readFile(filePath, 'utf8')
        return JSON.parse(raw)
    } catch {
        // Intentionally swallowed: file does not exist or invalid json
        return null
    }
}

async function inspectPluginComponents(pluginDir: string): Promise<PluginComponentSummary> {
    const summary: PluginComponentSummary = {
        skills: [],
        rules: [],
        mcpServers: [],
    }

    // 1. Inspect MCP servers in mcp_config.json or mcp.json
    const mcpData =
        (await safeReadJson(path.join(pluginDir, 'mcp_config.json'))) ||
        (await safeReadJson(path.join(pluginDir, 'mcp.json')))

    const serversMap = mcpData?.mcpServers || mcpData || {}
    if (typeof serversMap === 'object' && !Array.isArray(serversMap)) {
        for (const [sName, sCfg] of Object.entries(serversMap)) {
            if (!sCfg || typeof sCfg !== 'object') continue
            const cfg = sCfg as any
            const isStdio = Boolean(cfg.command)
            const cmdOrUrl = isStdio
                ? `${cfg.command}${cfg.args ? ' ' + cfg.args.join(' ') : ''}`
                : cfg.url || cfg.endpoint || ''

            summary.mcpServers.push({
                name: sName,
                commandOrUrl: cmdOrUrl,
                transport: isStdio ? 'stdio' : 'http',
                config: cfg,
            })
        }
    }

    // 2. Inspect Skills in skills/ directory
    const skillsDir = path.join(pluginDir, 'skills')
    try {
        const skillEntries = await fs.readdir(skillsDir, { withFileTypes: true })
        for (const entry of skillEntries) {
            if (entry.isDirectory()) {
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
        }
    } catch {
        // Intentionally swallowed: no skills directory
    }

    // 3. Inspect Rules in rules/ directory or root rules
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

export async function discoverPluginsInDirectory(
    baseDir: string,
    scope: 'workspace' | 'global' | 'built-in',
    enabledPrefs: Record<string, boolean> = {}
): Promise<PluginItem[]> {
    const results: PluginItem[] = []

    try {
        const entries = await fs.readdir(baseDir, { withFileTypes: true })
        for (const entry of entries) {
            if (entry.isDirectory()) {
                const pluginDir = path.join(baseDir, entry.name)
                const manifest = await safeReadJson(path.join(pluginDir, 'plugin.json'))
                if (manifest && typeof manifest === 'object') {
                    const id = entry.name
                    const name = manifest.name || entry.name
                    const description = manifest.description || ''
                    const version = manifest.version
                    const author =
                        typeof manifest.author === 'string'
                            ? manifest.author
                            : manifest.author?.name
                    const isExplicitlyDisabled = manifest.disabled === true
                    const userPref = enabledPrefs[id]
                    const enabled = userPref !== undefined ? userPref : !isExplicitlyDisabled

                    const components = await inspectPluginComponents(pluginDir)

                    results.push({
                        id,
                        name,
                        description,
                        version,
                        author,
                        scope,
                        dirPath: pluginDir,
                        enabled,
                        manifest,
                        components,
                    })
                }
            }
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
    const home = options?.globalDir || process.env.HOME || process.env.USERPROFILE || os.homedir()

    // Read enabled preferences from global config
    const globalConfigPath = path.join(home, '.december', 'config.json')
    const configData = await safeReadJson(globalConfigPath)
    const enabledPrefs: Record<string, boolean> = {}
    if (configData?.plugins && typeof configData.plugins === 'object') {
        for (const [k, v] of Object.entries(configData.plugins)) {
            if (typeof v === 'boolean') {
                enabledPrefs[k] = v
            } else if (v && typeof v === 'object' && (v as any).enabled !== undefined) {
                enabledPrefs[k] = Boolean((v as any).enabled)
            }
        }
    }

    const searchDirs: { path: string; scope: 'workspace' | 'global' | 'built-in' }[] = [
        { path: path.join(workspace, '.december', 'plugins'), scope: 'workspace' },
        { path: path.join(workspace, '.agents', 'plugins'), scope: 'workspace' },
        { path: path.join(home, '.december', 'plugins'), scope: 'global' },
        { path: path.join(home, '.gemini', 'config', 'plugins'), scope: 'built-in' },
    ]

    const discoveredMap = new Map<string, PluginItem>()

    for (const item of searchDirs) {
        const found = await discoverPluginsInDirectory(item.path, item.scope, enabledPrefs)
        for (const p of found) {
            // First one discovered (workspace over global) wins
            if (!discoveredMap.has(p.id)) {
                discoveredMap.set(p.id, p)
            }
        }
    }

    return Array.from(discoveredMap.values())
}
