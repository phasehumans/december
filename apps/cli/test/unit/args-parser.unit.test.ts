import { describe, expect, it } from 'bun:test'

import { parseCliArgs, getHelpText } from '../../src/args'

describe('CLI Args Parser (Unit)', () => {
    it('parses help and version flags', () => {
        expect(parseCliArgs(['-h']).isHelp).toBe(true)
        expect(parseCliArgs(['--help']).isHelp).toBe(true)
        expect(parseCliArgs(['-v']).isVersion).toBe(true)
        expect(parseCliArgs(['--version']).isVersion).toBe(true)
    })

    it('parses model, provider, and non-interactive yes flags', () => {
        const parsed = parseCliArgs([
            '-m',
            'gemini-3.7-flash',
            '-p',
            'google',
            '-y',
            'refactor authentication',
        ])
        expect(parsed.model).toBe('gemini-3.7-flash')
        expect(parsed.provider).toBe('google')
        expect(parsed.yes).toBe(true)
        expect(parsed.prompt).toBe('refactor authentication')
    })

    it('parses standalone subcommands', () => {
        expect(parseCliArgs(['login']).command).toBe('login')
        expect(parseCliArgs(['logout']).command).toBe('logout')
        expect(parseCliArgs(['ask']).command).toBe('ask')
        expect(parseCliArgs(['update']).command).toBe('update')
        expect(parseCliArgs(['doctor']).command).toBe('doctor')
        expect(parseCliArgs(['auth']).command).toBe('auth')
        expect(parseCliArgs(['link', 'copilot']).command).toBe('link')
        expect(parseCliArgs(['key', 'openai', 'sk-test']).command).toBe('key')
        expect(parseCliArgs(['doctor', '--fix']).fix).toBe(true)
    })

    it('parses --scope and --cwd flags', () => {
        const parsed = parseCliArgs(['--scope', 'packages/agent', '--cwd', '/tmp'])
        expect(parsed.scope).toBe('packages/agent')
        expect(parsed.cwd).toBe('/tmp')
    })

    it('defaults isInline to false for permanent fullscreen mode', () => {
        expect(parseCliArgs([]).isInline).toBe(false)
    })

    it('formats help text containing version number', () => {
        const help = getHelpText('0.3.9')
        expect(help).toContain('December CLI v0.3.9')
        expect(help).toContain('december ask')
        expect(help).toContain('december login')
        expect(help).toContain('december update')
    })

    describe('mcp add', () => {
        it('passes server flags like npx -y through to the server command', () => {
            const parsed = parseCliArgs([
                'mcp',
                'add',
                'github',
                'npx',
                '-y',
                '@modelcontextprotocol/server-github',
                '-e',
                'GITHUB_TOKEN=abc',
            ])
            expect(parsed.command).toBe('mcp')
            expect(parsed.yes).toBe(false)
            expect(parsed.positionals).toEqual([
                'mcp',
                'add',
                'github',
                'npx',
                '-y',
                '@modelcontextprotocol/server-github',
            ])
            expect(parsed.env).toEqual(['GITHUB_TOKEN=abc'])
        })

        it('reads mcp add flags in any position, including --flag=value', () => {
            const parsed = parseCliArgs([
                'mcp',
                'add',
                '--scope=project',
                'remote',
                'https://example.com/sse',
                '-H',
                'Authorization: Bearer t',
                '--global',
                '--eager',
            ])
            expect(parsed.scope).toBe('project')
            expect(parsed.isGlobal).toBe(true)
            expect(parsed.eager).toBe(true)
            expect(parsed.header).toEqual(['Authorization: Bearer t'])
            expect(parsed.positionals).toEqual(['mcp', 'add', 'remote', 'https://example.com/sse'])
        })

        it('passes everything after -- through verbatim', () => {
            const parsed = parseCliArgs(['mcp', 'add', 'x', 'node', '--', 'server.js', '-e', 'raw'])
            expect(parsed.env).toBeUndefined()
            expect(parsed.positionals).toEqual([
                'mcp',
                'add',
                'x',
                'node',
                'server.js',
                '-e',
                'raw',
            ])
        })
    })
})
