import fsSync from 'fs'
import fs from 'fs/promises'
import path from 'path'

import { writeExtensionPreference } from '@december/shared'

import {
    discoverAllPlugins,
    getPluginInstallDir,
    PLUGIN_INSTALL_RECORD_FILE,
    readPluginManifestSync,
    readPluginMcpServersFromDir,
} from './discovery'
import { isSafeName, MarketplaceRegistry } from './marketplace'
import { cloneToTemp, copyPluginDir, removeTempClone, resolveSource } from './sources'

import type { ResolvedSource } from './sources'
import type {
    DiscoverablePlugin,
    InstallPluginOptions,
    MarketplaceInfo,
    MarketplacePluginEntry,
    PluginInstallRecord,
    PluginInstallScope,
    PluginItem,
    PluginManagerOptions,
} from './types'

function authorName(author: MarketplacePluginEntry['author']): string | undefined {
    return typeof author === 'string' ? author : author?.name
}

function listSkillNames(pluginDir: string): string[] {
    try {
        return fsSync
            .readdirSync(path.join(pluginDir, 'skills'), { withFileTypes: true })
            .filter((e) => e.isDirectory())
            .map((e) => e.name)
    } catch {
        // Intentionally swallowed: plugin has no skills folder
        return []
    }
}

function hasSkillFile(dir: string): boolean {
    return (
        fsSync.existsSync(path.join(dir, 'SKILL.md')) ||
        fsSync.existsSync(path.join(dir, 'skill.md'))
    )
}

/** Name for a source without plugin.json: owner-repo for git, the folder name for a path */
function fallbackPluginName(resolved: ResolvedSource): string {
    if (resolved.kind === 'local') return path.basename(resolved.path)
    const parts = resolved.url
        .replace(/\.git$/, '')
        .split(/[/:]/)
        .filter(Boolean)
    const repo = parts[parts.length - 1] || 'plugin'
    const owner = parts[parts.length - 2]
    return owner ? `${owner}-${repo}` : repo
}

/**
 * Copies a plugin source into the staging folder and returns its version. A
 * source without plugin.json that holds skills (a skills repo, or one skill)
 * becomes a plugin with a generated plugin.json.
 */
async function stageSourceDir(data: {
    srcDir: string
    staging: string
    name: string
    label: string
}): Promise<string | undefined> {
    const { srcDir, staging, name, label } = data
    const manifest = readPluginManifestSync(srcDir)
    if (manifest) {
        await copyPluginDir(srcDir, staging)
        return manifest.version
    }

    const isMarketplace =
        fsSync.existsSync(path.join(srcDir, 'marketplace.json')) ||
        fsSync.existsSync(path.join(srcDir, '.claude-plugin', 'marketplace.json'))
    if (isMarketplace) {
        throw new Error('That source is a marketplace. Add it as a marketplace instead.')
    }

    const skillsDir = path.join(srcDir, 'skills')
    const rootSkills = fsSync
        .readdirSync(srcDir, { withFileTypes: true })
        .filter(
            (e) => e.isDirectory() && e.name !== '.git' && hasSkillFile(path.join(srcDir, e.name))
        )
        .map((e) => e.name)

    if (fsSync.existsSync(skillsDir) && fsSync.statSync(skillsDir).isDirectory()) {
        await copyPluginDir(srcDir, staging)
    } else if (rootSkills.length > 0) {
        await fs.mkdir(path.join(staging, 'skills'), { recursive: true })
        for (const skill of rootSkills) {
            await copyPluginDir(path.join(srcDir, skill), path.join(staging, 'skills', skill))
        }
    } else if (hasSkillFile(srcDir)) {
        await fs.mkdir(path.join(staging, 'skills'), { recursive: true })
        await copyPluginDir(srcDir, path.join(staging, 'skills', name))
    } else {
        throw new Error('No plugin.json or skills found at the root of that source.')
    }

    await fs.writeFile(
        path.join(staging, 'plugin.json'),
        JSON.stringify({ name, description: `Skills from ${label}`, version: '1.0.0' }, null, 2) +
            '\n',
        'utf8'
    )
    return '1.0.0'
}

export class PluginManager {
    private workspaceDir: string
    private homeDir?: string
    private registry: MarketplaceRegistry

    constructor(options?: PluginManagerOptions) {
        this.workspaceDir = options?.workspaceDir || process.cwd()
        this.homeDir = options?.globalDir
        this.registry = new MarketplaceRegistry({ homeDir: this.homeDir })
    }

    get marketplaces(): MarketplaceRegistry {
        return this.registry
    }

    public async getInstalledPlugins(): Promise<PluginItem[]> {
        return discoverAllPlugins({ workspaceDir: this.workspaceDir, globalDir: this.homeDir })
    }

    public async getMarketplaces(): Promise<MarketplaceInfo[]> {
        return this.registry.list()
    }

    public async getDiscoverablePlugins(preloaded?: {
        installed?: PluginItem[]
        marketplaces?: MarketplaceInfo[]
    }): Promise<DiscoverablePlugin[]> {
        const installed = preloaded?.installed || (await this.getInstalledPlugins())
        const marketplaces = preloaded?.marketplaces || (await this.registry.list())
        const result: DiscoverablePlugin[] = []

        for (const market of marketplaces) {
            for (const entry of market.plugins) {
                const match = installed.find((p) =>
                    p.install?.marketplace
                        ? p.install.marketplace === market.name && p.install.name === entry.name
                        : p.id === entry.name
                )

                let skillNames: string[] | undefined
                let mcpServerNames = entry.mcpServers ? Object.keys(entry.mcpServers) : undefined
                if (
                    typeof entry.source === 'string' &&
                    entry.source.startsWith('.') &&
                    market.dirPath
                ) {
                    const localDir = path.resolve(market.dirPath, entry.source)
                    skillNames = listSkillNames(localDir)
                    mcpServerNames = readPluginMcpServersFromDir(localDir).map((s) => s.name)
                }

                result.push({
                    id: `${entry.name}@${market.name}`,
                    name: entry.name,
                    description: entry.description || '',
                    category: entry.category,
                    author: authorName(entry.author),
                    version: entry.version,
                    marketplace: market.name,
                    installed: Boolean(match),
                    installedVersion: match?.version,
                    updateAvailable: Boolean(
                        match && entry.version && match.version && entry.version !== match.version
                    ),
                    env: entry.env,
                    defaultScope: entry.defaultScope,
                    skillNames,
                    mcpServerNames,
                })
            }
        }
        return result
    }

    public async togglePlugin(pluginId: string, enabled?: boolean): Promise<PluginItem> {
        const installed = await this.getInstalledPlugins()
        const target = installed.find((p) => p.id === pluginId || p.name === pluginId)
        if (!target) {
            throw new Error(`Plugin "${pluginId}" is not installed`)
        }

        const newEnabled = enabled !== undefined ? enabled : !target.enabled
        await writeExtensionPreference({
            kind: 'plugin',
            id: target.id,
            enabled: newEnabled,
            scope: target.scope === 'workspace' ? 'project' : 'user',
            homeDir: this.homeDir,
            workspaceDir: this.workspaceDir,
        })
        target.enabled = newEnabled
        return target
    }

    /** Installs "<name>@<marketplace>" (or a plain name) from the added marketplaces */
    public async installPlugin(
        targetIdOrName: string,
        options?: InstallPluginOptions
    ): Promise<PluginItem> {
        const found = await this.registry.findPlugin(targetIdOrName)
        if (!found) {
            throw new Error(`No plugin named "${targetIdOrName}" in your marketplaces.`)
        }
        const { entry, marketplace } = found
        const scope = options?.scope || entry.defaultScope || 'user'
        const dest = this.installDir(scope, entry.name)
        if (fsSync.existsSync(dest)) {
            throw new Error(`"${entry.name}" is already installed. Update it from Installed.`)
        }

        await this.stageAndSwap(dest, (staging) =>
            this.materializeEntry(entry, marketplace, staging)
        )
        return this.findInstalled(entry.name)
    }

    /** Installs from a local folder, git url, or owner/repo */
    public async installFromSource(
        input: string,
        options?: InstallPluginOptions
    ): Promise<PluginItem> {
        const resolved = resolveSource(input, this.workspaceDir)
        let tempClone: string | null = null
        try {
            let srcDir: string
            if (resolved.kind === 'local') {
                srcDir = resolved.path
            } else {
                tempClone = await cloneToTemp({ url: resolved.url, ref: resolved.ref })
                srcDir = tempClone
            }

            const manifest = readPluginManifestSync(srcDir)
            const name = String(manifest?.name || fallbackPluginName(resolved))
            if (!isSafeName(name)) {
                throw new Error(
                    `Plugin name "${name}" can only use letters, numbers, ".", "_" or "-".`
                )
            }
            const dest = this.installDir(options?.scope || 'user', name)
            if (fsSync.existsSync(dest)) {
                throw new Error(`"${name}" is already installed.`)
            }

            await this.stageAndSwap(dest, async (staging) => {
                const version = await stageSourceDir({
                    srcDir,
                    staging,
                    name,
                    label: resolved.label,
                })
                await this.writeInstallRecord(staging, {
                    name,
                    source:
                        resolved.kind === 'git'
                            ? resolved.ref
                                ? `${resolved.url}#${resolved.ref}`
                                : resolved.url
                            : resolved.path,
                    version,
                    installedAt: new Date().toISOString(),
                })
            })
            return this.findInstalled(name)
        } finally {
            if (tempClone) await removeTempClone(tempClone)
        }
    }

    /** Reinstalls a plugin from where it came from, keeping its scope */
    public async updatePlugin(pluginId: string): Promise<PluginItem> {
        const plugin = (await this.getInstalledPlugins()).find((p) => p.id === pluginId)
        if (!plugin) throw new Error(`Plugin "${pluginId}" is not installed`)
        const record = plugin.install
        if (!record) {
            throw new Error(
                `"${plugin.name}" was not installed by December, so it cannot be updated here.`
            )
        }

        if (record.marketplace) {
            await this.registry.update(record.marketplace).catch(() => {
                // Intentionally swallowed: update from the cached copy when offline
            })
            const found = await this.registry.findPlugin(`${record.name}@${record.marketplace}`)
            if (!found) {
                throw new Error(`"${record.name}" is no longer in ${record.marketplace}.`)
            }
            await this.stageAndSwap(plugin.dirPath, (staging) =>
                this.materializeEntry(found.entry, found.marketplace, staging)
            )
        } else {
            const resolved = resolveSource(record.source, this.workspaceDir)
            let tempClone: string | null = null
            try {
                const srcDir =
                    resolved.kind === 'local'
                        ? resolved.path
                        : (tempClone = await cloneToTemp({ url: resolved.url, ref: resolved.ref }))
                await this.stageAndSwap(plugin.dirPath, async (staging) => {
                    const version = await stageSourceDir({
                        srcDir,
                        staging,
                        name: record.name,
                        label: resolved.label,
                    })
                    await this.writeInstallRecord(staging, {
                        ...record,
                        version,
                        installedAt: new Date().toISOString(),
                    })
                })
            } finally {
                if (tempClone) await removeTempClone(tempClone)
            }
        }
        return this.findInstalled(plugin.id)
    }

    public async uninstallPlugin(pluginId: string): Promise<boolean> {
        const installed = await this.getInstalledPlugins()
        const target = installed.find((p) => p.id === pluginId || p.name === pluginId)
        if (!target) return false

        try {
            await fs.rm(target.dirPath, { recursive: true, force: true })
            return true
        } catch {
            // Intentionally swallowed: report failure to the caller instead
            return false
        }
    }

    private installDir(scope: PluginInstallScope, name: string): string {
        return getPluginInstallDir({
            scope,
            name,
            workspaceDir: this.workspaceDir,
            homeDir: this.homeDir,
        })
    }

    private async findInstalled(id: string): Promise<PluginItem> {
        const plugin = (await this.getInstalledPlugins()).find((p) => p.id === id)
        if (!plugin) throw new Error(`Failed to load installed plugin "${id}"`)
        return plugin
    }

    /**
     * Builds the plugin in a sibling folder first, then swaps it in, so a failed
     * install or update never leaves a half-written plugin behind.
     */
    private async stageAndSwap(
        dest: string,
        build: (staging: string) => Promise<void>
    ): Promise<void> {
        const staging = `${dest}.staging-${process.pid}-${Date.now()}`
        try {
            await fs.mkdir(path.dirname(dest), { recursive: true })
            await build(staging)
            await fs.rm(dest, { recursive: true, force: true })
            await fs.rename(staging, dest)
        } finally {
            await fs.rm(staging, { recursive: true, force: true })
        }
    }

    private async materializeEntry(
        entry: MarketplacePluginEntry,
        marketplace: MarketplaceInfo,
        dest: string
    ): Promise<void> {
        let sourceLabel = `${entry.name}@${marketplace.name}`

        if (entry.source) {
            const resolved = resolveSource(entry.source, marketplace.dirPath || this.workspaceDir)
            if (resolved.kind === 'local') {
                await copyPluginDir(resolved.path, dest)
            } else {
                const tempClone = await cloneToTemp({ url: resolved.url, ref: resolved.ref })
                try {
                    await copyPluginDir(tempClone, dest)
                } finally {
                    await removeTempClone(tempClone)
                }
            }
            sourceLabel = resolved.label
        } else {
            await fs.mkdir(dest, { recursive: true })
        }

        // Entries without their own plugin.json get one from the marketplace data
        if (!readPluginManifestSync(dest)) {
            await fs.writeFile(
                path.join(dest, 'plugin.json'),
                JSON.stringify(
                    {
                        name: entry.name,
                        description: entry.description || '',
                        version: entry.version || '1.0.0',
                        author: authorName(entry.author) || marketplace.name,
                    },
                    null,
                    2
                ) + '\n',
                'utf8'
            )
        }

        if (entry.mcpServers && Object.keys(entry.mcpServers).length > 0) {
            await fs.writeFile(
                path.join(dest, 'mcp.json'),
                JSON.stringify({ mcpServers: entry.mcpServers }, null, 2) + '\n',
                'utf8'
            )
        }

        await this.writeInstallRecord(dest, {
            marketplace: marketplace.name,
            name: entry.name,
            source: sourceLabel,
            version: readPluginManifestSync(dest)?.version || entry.version,
            installedAt: new Date().toISOString(),
        })
    }

    private async writeInstallRecord(dir: string, record: PluginInstallRecord): Promise<void> {
        await fs.writeFile(
            path.join(dir, PLUGIN_INSTALL_RECORD_FILE),
            JSON.stringify(record, null, 2) + '\n',
            'utf8'
        )
    }
}
