import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { describe, it, expect, beforeEach, afterEach } from 'bun:test'

import { parseCliArgs, getHelpText } from '../../src/args'
import { handleMcpCommand } from '../../src/commands'

describe('CLI MCP Integration (Unit)', () => {
    let tempDir: string
    let originalCwd: string
    let originalHome: string | undefined

    beforeEach(async () => {
        tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'december-cli-mcp-'))
        originalCwd = process.cwd()
        originalHome = process.env.HOME
        process.chdir(tempDir)
        process.env.HOME = tempDir
    })

    afterEach(async () => {
        process.chdir(originalCwd)
        if (originalHome) {
            process.env.HOME = originalHome
        }
        try {
            await fs.rm(tempDir, { recursive: true, force: true })
        } catch {
            // Intentionally swallowed
        }
    })

    it('should parse mcp command and arguments correctly', () => {
        const args1 = parseCliArgs(['mcp'])
        expect(args1.command).toBe('mcp')

        const args2 = parseCliArgs(['mcp', 'status'])
        expect(args2.command).toBe('mcp')
        expect(args2.positionals).toEqual(['mcp', 'status'])

        const args3 = parseCliArgs(['mcp', 'list'])
        expect(args3.command).toBe('mcp')
        expect(args3.positionals).toEqual(['mcp', 'list'])
    })

    it('should include mcp command in help text', () => {
        const help = getHelpText('1.0.0')
        expect(help).toContain('december mcp [status|list]')
    })

    it('should display configured MCP servers in help text when options provided', () => {
        const help = getHelpText('1.0.0', {
            mcpServers: {
                postgres: {
                    command: 'npx',
                    args: ['-y', '@modelcontextprotocol/server-postgres'],
                },
                remoteSse: {
                    url: 'http://localhost:8000/sse',
                    disabled: true,
                },
            },
        })

        expect(help).toContain('Configured MCP Servers:')
        expect(help).toContain('postgres (stdio): npx -y @modelcontextprotocol/server-postgres')
        expect(help).toContain('remoteSse (sse) (disabled): http://localhost:8000/sse')
    })

    it('should show setup guidance when running handleMcpCommand without configured servers', async () => {
        const logged: string[] = []
        const originalLog = console.log
        console.log = (...args: any[]) => {
            logged.push(args.join(' '))
        }

        try {
            await handleMcpCommand()
            const fullOutput = logged.join('\n')
            expect(fullOutput).toContain('No MCP servers configured')
            expect(fullOutput).toContain('.december/mcp.json')
            expect(fullOutput).toContain('~/.december/config.json')
        } finally {
            console.log = originalLog
        }
    })

    it('should display servers and report status when servers are configured', async () => {
        const projDir = path.join(tempDir, '.december')
        await fs.mkdir(projDir, { recursive: true })
        await fs.writeFile(
            path.join(projDir, 'mcp.json'),
            JSON.stringify({
                mcpServers: {
                    disabledServer: {
                        command: 'test-cmd',
                        disabled: true,
                    },
                },
            }),
            'utf8'
        )

        const logged: string[] = []
        const originalLog = console.log
        console.log = (...args: any[]) => {
            logged.push(args.join(' '))
        }

        try {
            await handleMcpCommand()
            const fullOutput = logged.join('\n')
            expect(fullOutput).toContain('Model Context Protocol (MCP) Servers (1 configured)')
            expect(fullOutput).toContain('disabledServer')
            expect(fullOutput).toContain('DISCONNECTED')
        } finally {
            console.log = originalLog
        }
    })

    it('should parse mcp add flags (-e, -H, --scope, --eager)', () => {
        const parsed = parseCliArgs([
            'mcp',
            'add',
            'my-api',
            'https://api.example.com/mcp',
            '-H',
            'Authorization: Bearer token123',
            '-e',
            'FOO=bar',
            '--eager',
            '--scope',
            'project',
        ])
        expect(parsed.command).toBe('mcp')
        expect(parsed.positionals).toEqual(['mcp', 'add', 'my-api', 'https://api.example.com/mcp'])
        expect(parsed.header).toEqual(['Authorization: Bearer token123'])
        expect(parsed.env).toEqual(['FOO=bar'])
        expect(parsed.eager).toBe(true)
        expect(parsed.scope).toBe('project')
    })

    it('should handle mcp add, get, and remove actions', async () => {
        const logged: string[] = []
        const originalLog = console.log
        console.log = (...args: any[]) => {
            logged.push(args.join(' '))
        }

        try {
            // 1. Add server
            await handleMcpCommand({
                action: 'add',
                name: 'test-cli-srv',
                target: 'node',
                args: ['server.js'],
                env: ['KEY=VAL'],
            })
            expect(logged.join('\n')).toContain('Added MCP server "test-cli-srv"')

            logged.length = 0
            // 2. Get server details
            await handleMcpCommand({
                action: 'get',
                name: 'test-cli-srv',
            })
            expect(logged.join('\n')).toContain('MCP Server: test-cli-srv')
            expect(logged.join('\n')).toContain('global')

            logged.length = 0
            // 3. Remove server
            await handleMcpCommand({
                action: 'remove',
                name: 'test-cli-srv',
            })
            expect(logged.join('\n')).toContain('Removed MCP server "test-cli-srv"')
        } finally {
            console.log = originalLog
        }
    })

    it('should correctly parse target command with quoted arguments', () => {
        const cmdStr =
            'npx -y @modelcontextprotocol/server-postgres "postgresql://localhost/my test db"'
        const regex = /[^\s"']+|"([^"]*)"|'([^']*)'/g
        const parts: string[] = []
        let match
        while ((match = regex.exec(cmdStr)) !== null) {
            parts.push(match[1] || match[2] || match[0])
        }

        expect(parts[0]).toBe('npx')
        expect(parts[1]).toBe('-y')
        expect(parts[2]).toBe('@modelcontextprotocol/server-postgres')
        expect(parts[3]).toBe('postgresql://localhost/my test db')
    })
})
