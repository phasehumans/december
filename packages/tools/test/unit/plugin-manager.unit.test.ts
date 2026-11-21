import fs from 'fs/promises'
import os from 'os'
import path from 'path'

import { writeExtensionPreference } from '@december/shared'
import { describe, it, expect, beforeEach, afterEach } from 'bun:test'

import { listMcpServersWithScope, setMcpServerDisabled } from '../../src/mcp/config'
import { readPluginMcpServersSync } from '../../src/plugins/discovery'
import { loadPluginCatalog } from '../../src/plugins/extensions'
import { PluginManager } from '../../src/plugins/manager'
import { runGit } from '../../src/plugins/sources'

describe('PluginManager (Unit)', () => {
    let tmpDir: string
    let globalDir: string
    let workspaceDir: string
    let manager: PluginManager

    beforeEach(async () => {
        tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'december-plugin-test-'))
        globalDir = path.join(tmpDir, 'global')
        workspaceDir = path.join(tmpDir, 'workspace')

        await fs.mkdir(globalDir, { recursive: true })
        await fs.mkdir(workspaceDir, { recursive: true })

        // Create a mock plugin in workspace: plugins/github/
        const pluginDir = path.join(workspaceDir, '.december', 'plugins', 'github')
        await fs.mkdir(path.join(pluginDir, 'skills', 'pr'), { recursive: true })
        await fs.mkdir(path.join(pluginDir, 'rules'), { recursive: true })

        // 1. plugin.json
        await fs.writeFile(
            path.join(pluginDir, 'plugin.json'),
            JSON.stringify(
                {
                    name: 'github',
                    description: 'GitHub pull request and issues suite',
                    version: '1.0.0',
                    author: 'Engineering',
                },
                null,
                2
            ),
            'utf8'
        )

        // 2. mcp_config.json
        await fs.writeFile(
            path.join(pluginDir, 'mcp_config.json'),
            JSON.stringify(
                {
                    mcpServers: {
                        github_server: {
                            command: 'npx',
                            args: ['-y', '@modelcontextprotocol/server-github'],
                        },
                    },
                },
                null,
                2
            ),
            'utf8'
        )

        // 3. skills/pr/SKILL.md
        await fs.writeFile(
            path.join(pluginDir, 'skills', 'pr', 'SKILL.md'),
            '---\nname: pr\ndescription: Create pull requests\n---\n# PR Skill\n',
            'utf8'
        )

        // 4. rules/AGENTS.md
        await fs.writeFile(
            path.join(pluginDir, 'rules', 'AGENTS.md'),
            '# GitHub Rules\nDo not push directly to main.\n',
            'utf8'
        )

        manager = new PluginManager({
            globalDir,
            workspaceDir,
        })
    })

    afterEach(async () => {
        await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {
            // Intentionally swallowed: test cleanup
        })
    })

    it('should discover installed plugins and inspect bundled components', async () => {
        const plugins = await manager.getInstalledPlugins()
        expect(plugins.length).toBeGreaterThanOrEqual(1)

        const ghPlugin = plugins.find((p) => p.name === 'github')
        expect(ghPlugin).toBeDefined()
        expect(ghPlugin?.description).toBe('GitHub pull request and issues suite')
        expect(ghPlugin?.enabled).toBe(true)
        expect(ghPlugin?.components.skills).toHaveLength(1)
        expect(ghPlugin?.components.skills[0].name).toBe('pr')
        expect(ghPlugin?.components.mcpServers).toHaveLength(1)
        expect(ghPlugin?.components.mcpServers[0].name).toBe('github_server')
        expect(ghPlugin?.components.rules).toHaveLength(1)
    })

    it('should toggle plugin enable and disable state and persist preference', async () => {
        // Toggle to disabled
        const disabled = await manager.togglePlugin('github', false)
        expect(disabled.enabled).toBe(false)

        // Verify persisted
        const plugins = await manager.getInstalledPlugins()
        const gh = plugins.find((p) => p.name === 'github')
        expect(gh?.enabled).toBe(false)

        // Toggle back to enabled
        const enabled = await manager.togglePlugin('github', true)
        expect(enabled.enabled).toBe(true)
    })

    it('saves the on/off choice for a project plugin in project settings, not the user config', async () => {
        await manager.togglePlugin('github', false)
        const projectSettings = JSON.parse(
            await fs.readFile(path.join(workspaceDir, '.december', 'settings.json'), 'utf8')
        )
        expect(projectSettings.plugins.github.enabled).toBe(false)
        await expect(
            fs.readFile(path.join(globalDir, '.december', 'config.json'), 'utf8')
        ).rejects.toThrow()
    })

    it('lists the built-in marketplace and marks already-installed plugins', async () => {
        const catalog = await manager.getDiscoverablePlugins()
        const github = catalog.find((p) => p.id === 'github@december-official')
        expect(github?.installed).toBe(true)
        expect(github?.mcpServerNames).toEqual(['github'])
        expect(github?.env).toEqual(['GITHUB_PERSONAL_ACCESS_TOKEN'])
        const sqlite = catalog.find((p) => p.name === 'sqlite')
        expect(sqlite?.installed).toBe(false)
        expect(sqlite?.defaultScope).toBe('project')
    })

    it('installs a built-in entry as a real plugin folder with mcp.json and an install record', async () => {
        const plugin = await manager.installPlugin('sqlite@december-official', { scope: 'user' })
        expect(plugin.scope).toBe('global')
        expect(plugin.dirPath).toBe(path.join(globalDir, '.december', 'plugins', 'sqlite'))
        expect(plugin.components.mcpServers.map((s) => s.name)).toEqual(['sqlite'])
        expect(plugin.install?.marketplace).toBe('december-official')

        await expect(manager.installPlugin('sqlite', { scope: 'user' })).rejects.toThrow(
            'already installed'
        )
        await expect(manager.installPlugin('nope')).rejects.toThrow('No plugin named "nope"')
    })

    describe('marketplaces', () => {
        let marketDir: string

        const writeMarket = async (version: string) => {
            await fs.mkdir(path.join(marketDir, 'plugins', 'deploy', 'skills', 'ship'), {
                recursive: true,
            })
            await fs.writeFile(
                path.join(marketDir, 'marketplace.json'),
                JSON.stringify({
                    name: 'acme',
                    owner: { name: 'Acme' },
                    plugins: [
                        {
                            name: 'deploy',
                            source: './plugins/deploy',
                            description: 'Ship to staging',
                            version,
                            category: 'Development',
                        },
                        { name: '../escape', source: './plugins/deploy' },
                    ],
                })
            )
            await fs.writeFile(
                path.join(marketDir, 'plugins', 'deploy', 'plugin.json'),
                JSON.stringify({ name: 'deploy', version })
            )
            await fs.writeFile(
                path.join(marketDir, 'plugins', 'deploy', '.mcp.json'),
                JSON.stringify({
                    mcpServers: {
                        shipper: { command: 'node', args: ['${CLAUDE_PLUGIN_ROOT}/server.js'] },
                    },
                })
            )
            await fs.writeFile(
                path.join(marketDir, 'plugins', 'deploy', 'skills', 'ship', 'SKILL.md'),
                '---\nname: ship\ndescription: Ship it\n---\n# Ship\n'
            )
        }

        beforeEach(async () => {
            marketDir = path.join(tmpDir, 'acme-market')
            await writeMarket('1.0.0')
        })

        it('adds a local marketplace, installs from it, and updates when the version changes', async () => {
            const added = await manager.marketplaces.add(marketDir)
            expect(added.name).toBe('acme')
            // Entries with unsafe names are dropped
            expect(added.plugins.map((p) => p.name)).toEqual(['deploy'])
            await expect(manager.marketplaces.add(marketDir)).rejects.toThrow('already added')

            const listing = (await manager.getDiscoverablePlugins()).find(
                (p) => p.id === 'deploy@acme'
            )
            expect(listing?.skillNames).toEqual(['ship'])
            expect(listing?.mcpServerNames).toEqual(['shipper'])

            const plugin = await manager.installPlugin('deploy@acme', { scope: 'project' })
            expect(plugin.scope).toBe('workspace')
            expect(plugin.version).toBe('1.0.0')
            expect(plugin.components.skills.map((s) => s.name)).toEqual(['ship'])
            // Plugin-root variables are filled in with the installed folder
            expect((plugin.components.mcpServers[0]!.config as any).args[0]).toBe(
                path.join(plugin.dirPath, 'server.js')
            )

            await writeMarket('1.1.0')
            const stale = (await manager.getDiscoverablePlugins()).find(
                (p) => p.id === 'deploy@acme'
            )
            expect(stale?.updateAvailable).toBe(true)

            const updated = await manager.updatePlugin('deploy')
            expect(updated.version).toBe('1.1.0')
            expect(updated.dirPath).toBe(plugin.dirPath)

            await manager.marketplaces.remove('acme')
            expect((await manager.getMarketplaces()).map((m) => m.name)).toEqual([
                'december-official',
            ])
            // Removing a marketplace leaves its installed plugins alone
            expect((await manager.getInstalledPlugins()).some((p) => p.id === 'deploy')).toBe(true)
        })

        it('refuses to remove or re-add the built-in marketplace', async () => {
            await expect(manager.marketplaces.remove('december-official')).rejects.toThrow(
                'built in'
            )
        })

        it('installs from a local plugin folder and explains when the folder is a marketplace', async () => {
            const plugin = await manager.installFromSource(
                path.join(marketDir, 'plugins', 'deploy')
            )
            expect(plugin.install?.source).toBe(path.join(marketDir, 'plugins', 'deploy'))
            await expect(manager.installFromSource(marketDir)).rejects.toThrow('is a marketplace')
            await expect(manager.installFromSource('./does-not-exist')).rejects.toThrow(
                'Cannot find'
            )
        })

        it('installs a plain skills repo (no plugin.json) as a plugin', async () => {
            const pack = path.join(tmpDir, 'skill-pack')
            for (const name of ['grill-me', 'tdd']) {
                await fs.mkdir(path.join(pack, name), { recursive: true })
                await fs.writeFile(
                    path.join(pack, name, 'SKILL.md'),
                    `---\nname: ${name}\ndescription: ${name} skill\n---\n# ${name}\n`
                )
            }
            const plugin = await manager.installFromSource(pack)
            expect(plugin.name).toBe('skill-pack')
            expect(plugin.components.skills.map((s) => s.name).sort()).toEqual(['grill-me', 'tdd'])
            expect(plugin.manifest.description).toBe(`Skills from ${pack}`)

            // Update keeps the same layout
            const updated = await manager.updatePlugin('skill-pack')
            expect(updated.components.skills).toHaveLength(2)

            const empty = path.join(tmpDir, 'empty-folder')
            await fs.mkdir(empty, { recursive: true })
            await expect(manager.installFromSource(empty)).rejects.toThrow(
                'No plugin.json or skills found'
            )
        })

        it('adds a marketplace from a git url and pulls updates', async () => {
            const repo = path.join(tmpDir, 'acme-repo')
            await fs.cp(marketDir, repo, { recursive: true })
            const git = (...args: string[]) =>
                runGit(['-c', 'user.email=t@example.com', '-c', 'user.name=t', ...args], repo)
            await git('init', '-q')
            await git('add', '.')
            await git('commit', '-q', '-m', 'init')

            const added = await manager.marketplaces.add(`file://${repo}`)
            expect(added.name).toBe('acme')
            expect(added.dirPath).toBe(path.join(globalDir, '.december', 'marketplaces', 'acme'))
            expect(added.updatedAt).toBeGreaterThan(0)

            const manifest = JSON.parse(
                await fs.readFile(path.join(repo, 'marketplace.json'), 'utf8')
            )
            manifest.plugins[0].version = '2.0.0'
            await fs.writeFile(path.join(repo, 'marketplace.json'), JSON.stringify(manifest))
            await git('commit', '-q', '-am', 'bump')

            const updated = await manager.marketplaces.update('acme')
            expect(updated.plugins[0]?.version).toBe('2.0.0')
        })
    })

    describe('plugin MCP servers and catalog', () => {
        it('loads MCP servers only from turned-on plugins, and config files override them', async () => {
            let servers = readPluginMcpServersSync({ workspaceDir, homeDir: globalDir })
            expect(servers.map((s) => s.name)).toEqual(['github_server'])

            const listed = await listMcpServersWithScope({ workspaceDir, homeDir: globalDir })
            expect(listed.find((s) => s.name === 'github_server')?.plugin).toBe('github')

            await fs.writeFile(
                path.join(workspaceDir, '.december', 'mcp.json'),
                JSON.stringify({ mcpServers: { github_server: { command: 'my-own' } } })
            )
            const overridden = await listMcpServersWithScope({ workspaceDir, homeDir: globalDir })
            const own = overridden.find((s) => s.name === 'github_server')
            expect(own?.plugin).toBeUndefined()
            expect(own?.scope).toBe('project')

            await manager.togglePlugin('github', false)
            servers = readPluginMcpServersSync({ workspaceDir, homeDir: globalDir })
            expect(servers).toHaveLength(0)
        })

        it('turns a config-file MCP server off and on in its own file', async () => {
            await fs.writeFile(
                path.join(workspaceDir, '.december', 'mcp.json'),
                JSON.stringify({ mcpServers: { pg: { command: 'pg-mcp' } } })
            )
            expect(await setMcpServerDisabled('pg', true, { scope: 'project', workspaceDir })).toBe(
                true
            )
            let data = JSON.parse(
                await fs.readFile(path.join(workspaceDir, '.december', 'mcp.json'), 'utf8')
            )
            expect(data.mcpServers.pg.disabled).toBe(true)
            await setMcpServerDisabled('pg', false, { scope: 'project', workspaceDir })
            data = JSON.parse(
                await fs.readFile(path.join(workspaceDir, '.december', 'mcp.json'), 'utf8')
            )
            expect(data.mcpServers.pg.disabled).toBeUndefined()
            expect(
                await setMcpServerDisabled('missing', true, { scope: 'project', workspaceDir })
            ).toBe(false)
        })

        it('builds the Installed list with plugin parts nested and standalone skills on their own', async () => {
            const skillDir = path.join(workspaceDir, '.december', 'skills', 'grill-me')
            await fs.mkdir(skillDir, { recursive: true })
            await fs.writeFile(
                path.join(skillDir, 'SKILL.md'),
                '---\nname: grill-me\ndescription: Stress-test a plan\n---\n# Grill\n'
            )
            await writeExtensionPreference({
                kind: 'skill',
                id: 'grill-me',
                enabled: false,
                scope: 'project',
                workspaceDir,
            })

            const catalog = await loadPluginCatalog({
                workspaceDir,
                homeDir: globalDir,
                mcpStatus: (name) =>
                    name === 'github_server' ? { status: 'connected', toolCount: 4 } : undefined,
            })
            const github = catalog.installed.find((e) => e.key === 'plugin:github')
            expect(github?.meta).toBe('1 skill · 1 mcp · 1 rule')
            expect(github?.children?.map((c) => c.key)).toEqual(['skill:pr', 'mcp:github_server'])
            expect(github?.children?.find((c) => c.kind === 'mcp')?.meta).toBe('4 tools')

            const grill = catalog.installed.find((e) => e.key === 'skill:grill-me')
            expect(grill?.enabled).toBe(false)
            expect(grill?.scope).toBe('project')
            expect(grill?.source).toBe(path.join('.december', 'skills'))
            // Plugin skills are not repeated as standalone rows
            expect(catalog.installed.some((e) => e.key === 'skill:pr')).toBe(false)
            expect(catalog.marketplaces[0]?.installedCount).toBe(1)
        })
    })
})
