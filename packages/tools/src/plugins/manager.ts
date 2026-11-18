import fs from 'fs/promises'
import os from 'os'
import path from 'path'

import { DISCOVERABLE_PLUGINS_CATALOG } from './catalog'
import { discoverAllPlugins } from './discovery'

import type { DiscoverablePlugin, PluginItem, PluginManagerOptions } from './types'

export class PluginManager {
    private workspaceDir: string
    private globalDir: string

    constructor(options?: PluginManagerOptions) {
        this.workspaceDir = options?.workspaceDir || process.cwd()
        this.globalDir =
            options?.globalDir ||
            process.env.DECEMBER_CONFIG_DIR ||
            process.env.HOME ||
            process.env.USERPROFILE ||
            os.homedir()
    }

    public async getInstalledPlugins(): Promise<PluginItem[]> {
        return discoverAllPlugins({
            workspaceDir: this.workspaceDir,
            globalDir: this.globalDir,
        })
    }

    public async getDiscoverablePlugins(): Promise<DiscoverablePlugin[]> {
        const installed = await this.getInstalledPlugins()
        const installedIds = new Set(installed.map((p) => p.id))

        return DISCOVERABLE_PLUGINS_CATALOG.map((item) => ({
            ...item,
            installed: installedIds.has(item.id),
        }))
    }

    public async togglePlugin(pluginId: string, enabled?: boolean): Promise<PluginItem> {
        const installed = await this.getInstalledPlugins()
        const target = installed.find((p) => p.id === pluginId || p.name === pluginId)
        if (!target) {
            throw new Error(`Plugin "${pluginId}" is not installed`)
        }

        const newEnabled = enabled !== undefined ? enabled : !target.enabled
        target.enabled = newEnabled

        // Persist preference to ~/.december/config.json
        const configPath = path.join(this.globalDir, '.december', 'config.json')
        await this.persistPluginPreference(configPath, target.id, newEnabled)

        return target
    }

    public async installPlugin(targetIdOrName: string): Promise<PluginItem> {
        const catalogItem = DISCOVERABLE_PLUGINS_CATALOG.find(
            (c) =>
                c.id === targetIdOrName.toLowerCase() ||
                c.name.toLowerCase() === targetIdOrName.toLowerCase()
        )

        const pluginName = catalogItem ? catalogItem.name : path.basename(targetIdOrName)
        const targetDir = path.join(this.workspaceDir, '.december', 'plugins', pluginName)

        await fs.mkdir(targetDir, { recursive: true })

        const manifest = {
            name: pluginName,
            description: catalogItem?.description || `Plugin for ${pluginName}`,
            version: catalogItem?.version || '1.0.0',
            author: catalogItem?.author || 'Community',
        }

        await fs.writeFile(
            path.join(targetDir, 'plugin.json'),
            JSON.stringify(manifest, null, 2) + '\n',
            'utf8'
        )

        // If catalog item defines default MCP server, scaffold mcp_config.json
        if (catalogItem?.defaultMcpServers && catalogItem.defaultMcpServers.length > 0) {
            const mcpServerName = catalogItem.defaultMcpServers[0]
            const mcpConfig = {
                mcpServers: {
                    [pluginName]: {
                        command: 'npx',
                        args: ['-y', mcpServerName],
                    },
                },
            }
            await fs.writeFile(
                path.join(targetDir, 'mcp_config.json'),
                JSON.stringify(mcpConfig, null, 2) + '\n',
                'utf8'
            )
        }

        const refreshed = await this.getInstalledPlugins()
        const installed = refreshed.find((p) => p.id === pluginName || p.name === pluginName)
        if (!installed) {
            throw new Error(`Failed to initialize installed plugin "${pluginName}"`)
        }

        return installed
    }

    public async uninstallPlugin(pluginId: string): Promise<boolean> {
        const installed = await this.getInstalledPlugins()
        const target = installed.find((p) => p.id === pluginId || p.name === pluginId)
        if (!target) return false

        try {
            await fs.rm(target.dirPath, { recursive: true, force: true })
            return true
        } catch {
            // Intentionally swallowed: cleanup error
            return false
        }
    }

    private async persistPluginPreference(
        configPath: string,
        pluginId: string,
        enabled: boolean
    ): Promise<void> {
        try {
            let data: any = {}
            try {
                const raw = await fs.readFile(configPath, 'utf8')
                data = JSON.parse(raw)
            } catch {
                // Intentionally swallowed: config does not exist or empty
            }

            if (!data || typeof data !== 'object') data = {}
            if (!data.plugins || typeof data.plugins !== 'object') data.plugins = {}

            data.plugins[pluginId] = { enabled }

            await fs.mkdir(path.dirname(configPath), { recursive: true })
            await fs.writeFile(configPath, JSON.stringify(data, null, 2) + '\n', 'utf8')
        } catch {
            // Intentionally swallowed: ignore preference write error
        }
    }
}
