import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { describe, it, expect, beforeEach, afterEach } from 'bun:test'

import { loadMcpConfig, normalizeMcpServerConfig } from '../../src/mcp/config'

describe('MCP Config Loader (Unit)', () => {
    let tempDir: string
    let homeDir: string
    let workspaceDir: string

    beforeEach(async () => {
        tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'december-mcp-test-'))
        homeDir = path.join(tempDir, 'home')
        workspaceDir = path.join(tempDir, 'workspace')
        await fs.mkdir(homeDir, { recursive: true })
        await fs.mkdir(workspaceDir, { recursive: true })
    })

    afterEach(async () => {
        try {
            await fs.rm(tempDir, { recursive: true, force: true })
        } catch {
            // Intentionally swallowed: cleanup error
        }
    })

    it('should return empty object if no config files exist', async () => {
        const config = await loadMcpConfig({ homeDir, workspaceDir })
        expect(config).toEqual({})
    })

    it('should load global mcpServers from ~/.december/config.json', async () => {
        const globalDir = path.join(homeDir, '.december')
        await fs.mkdir(globalDir, { recursive: true })
        await fs.writeFile(
            path.join(globalDir, 'config.json'),
            JSON.stringify({
                mcpServers: {
                    postgres: {
                        command: 'npx',
                        args: ['-y', '@modelcontextprotocol/server-postgres'],
                        env: { DB_URL: 'postgres://localhost/test' },
                    },
                    remoteSse: {
                        url: 'http://localhost:8080/sse',
                    },
                },
            }),
            'utf8'
        )

        const config = await loadMcpConfig({ homeDir, workspaceDir })
        expect(Object.keys(config)).toHaveLength(2)
        expect(config.postgres).toEqual({
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-postgres'],
            env: { DB_URL: 'postgres://localhost/test' },
        })
        expect(config.remoteSse).toEqual({
            url: 'http://localhost:8080/sse',
        })
    })

    it('should load project config from .december/mcp.json (mcpServers format)', async () => {
        const projDir = path.join(workspaceDir, '.december')
        await fs.mkdir(projDir, { recursive: true })
        await fs.writeFile(
            path.join(projDir, 'mcp.json'),
            JSON.stringify({
                mcpServers: {
                    sqlite: {
                        command: 'uvx',
                        args: ['mcp-server-sqlite', '--db-path', 'app.db'],
                    },
                },
            }),
            'utf8'
        )

        const config = await loadMcpConfig({ homeDir, workspaceDir })
        expect(config.sqlite).toEqual({
            command: 'uvx',
            args: ['mcp-server-sqlite', '--db-path', 'app.db'],
        })
    })

    it('should load project config from .december/mcp.json (direct server map format)', async () => {
        const projDir = path.join(workspaceDir, '.december')
        await fs.mkdir(projDir, { recursive: true })
        await fs.writeFile(
            path.join(projDir, 'mcp.json'),
            JSON.stringify({
                github: {
                    command: 'npx',
                    args: ['-y', '@modelcontextprotocol/server-github'],
                    env: { GITHUB_TOKEN: 'ghp_xyz' },
                },
                customEndpoint: {
                    endpoint: 'https://mcp.internal.net/sse',
                },
            }),
            'utf8'
        )

        const config = await loadMcpConfig({ homeDir, workspaceDir })
        expect(config.github).toBeDefined()
        expect(config.github.command).toBe('npx')
        expect(config.customEndpoint).toBeDefined()
        expect(config.customEndpoint.url).toBe('https://mcp.internal.net/sse')
    })

    it('should merge project config over global config', async () => {
        // Global config
        const globalDir = path.join(homeDir, '.december')
        await fs.mkdir(globalDir, { recursive: true })
        await fs.writeFile(
            path.join(globalDir, 'config.json'),
            JSON.stringify({
                mcpServers: {
                    sharedTool: {
                        command: 'global-cmd',
                    },
                    globalOnly: {
                        command: 'only-global',
                    },
                },
            }),
            'utf8'
        )

        // Project config
        const projDir = path.join(workspaceDir, '.december')
        await fs.mkdir(projDir, { recursive: true })
        await fs.writeFile(
            path.join(projDir, 'mcp.json'),
            JSON.stringify({
                mcpServers: {
                    sharedTool: {
                        command: 'project-override-cmd',
                    },
                    projectOnly: {
                        command: 'only-project',
                    },
                },
            }),
            'utf8'
        )

        const config = await loadMcpConfig({ homeDir, workspaceDir })
        expect(config.globalOnly.command).toBe('only-global')
        expect(config.projectOnly.command).toBe('only-project')
        expect(config.sharedTool.command).toBe('project-override-cmd')
    })

    it('should normalize server config correctly', () => {
        expect(
            normalizeMcpServerConfig('valid-stdio', { command: 'node', args: ['index.js'] })
        ).toEqual({
            command: 'node',
            args: ['index.js'],
        })

        expect(normalizeMcpServerConfig('valid-sse', { url: 'http://localhost/sse' })).toEqual({
            url: 'http://localhost/sse',
        })

        expect(
            normalizeMcpServerConfig('valid-endpoint', { endpoint: 'http://localhost/sse' })
        ).toEqual({
            url: 'http://localhost/sse',
        })

        expect(normalizeMcpServerConfig('valid-sse-key', { sse: 'http://localhost/sse' })).toEqual({
            url: 'http://localhost/sse',
        })

        // Missing command and url should return null
        expect(normalizeMcpServerConfig('invalid', { args: ['foo'] })).toBeNull()
        expect(normalizeMcpServerConfig('invalid-empty', {})).toBeNull()
        expect(normalizeMcpServerConfig('invalid-null', null)).toBeNull()
    })

    it('should tolerate malformed json without throwing', async () => {
        const projDir = path.join(workspaceDir, '.december')
        await fs.mkdir(projDir, { recursive: true })
        await fs.writeFile(path.join(projDir, 'mcp.json'), 'not-valid-json{[[', 'utf8')

        const config = await loadMcpConfig({ homeDir, workspaceDir })
        expect(config).toEqual({})
    })
})
