import fs from 'fs/promises'
import os from 'os'
import path from 'path'

import { describe, it, expect, beforeEach, afterEach } from 'bun:test'

import { PluginManager } from '../../src/plugins/manager'

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

    it('should list discoverable marketplace catalog plugins', async () => {
        const catalog = await manager.getDiscoverablePlugins()
        expect(catalog.length).toBeGreaterThan(0)

        const gmail = catalog.find((p) => p.id === 'gmail')
        expect(gmail).toBeDefined()
        expect(gmail?.description).toContain('Gmail')

        const swarm = catalog.find((p) => p.id === 'swarm')
        expect(swarm).toBeDefined()
    })
})
