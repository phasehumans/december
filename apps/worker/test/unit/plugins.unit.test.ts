import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { gzipSync } from 'node:zlib'

import { describe, expect, it } from 'bun:test'

import {
    PLUGIN_MARKER_FILE,
    SANDBOX_PLUGINS_DIR,
    SandboxStdioTransport,
    activePlugins,
    connectPluginMcpServers,
    decodePluginFiles,
    fillPluginRoot,
    fillSecrets,
    installPluginsInSandbox,
    pluginMcpServers,
    pluginRoot,
    pluginSkillRows,
    stdioCommandLine,
} from '../../src/plugins'

const encode = (files: Array<{ path: string; mode?: number; data: string }>) =>
    gzipSync(
        Buffer.from(
            JSON.stringify(
                files.map((file) => ({
                    path: file.path,
                    mode: file.mode ?? 0o644,
                    data: Buffer.from(file.data).toString('base64'),
                }))
            )
        )
    )

/** a sandbox that keeps files in memory and records commands */
const fakeSandbox = () => {
    const files = new Map<string, string>()
    const commands: string[] = []
    const sandbox = {
        files: {
            read: async (file: string) => {
                if (!files.has(file)) throw new Error('not found')
                return files.get(file)
            },
            write: async (
                target: string | Array<{ path: string; data: ArrayBuffer }>,
                data?: string
            ) => {
                if (Array.isArray(target)) {
                    for (const entry of target)
                        files.set(entry.path, Buffer.from(entry.data).toString())
                } else {
                    files.set(target, String(data))
                }
            },
        },
        commands: {
            run: async (command: string) => {
                commands.push(command)
                return { exitCode: 0, stdout: '', stderr: '' }
            },
        },
    }
    return { sandbox, files, commands }
}

describe('activePlugins', () => {
    it('keeps plugins that are on, safe and not off for the session', () => {
        const plugins = [
            { name: 'a', enabled: true },
            { name: 'b', enabled: false },
            { name: 'c', enabled: true },
            { name: '../evil', enabled: true },
        ]
        expect(activePlugins({ plugins, disabledPlugins: ['c'] }).map((p) => p.name)).toEqual(['a'])
    })
})

describe('pluginSkillRows', () => {
    it('adds plugin skills after saved ones, fills the plugin root and says where the files are', () => {
        const rows = pluginSkillRows({
            plugins: [
                {
                    name: 'release',
                    skills: [
                        {
                            name: 'ship',
                            description: 'ship it',
                            body: 'run ${CLAUDE_PLUGIN_ROOT}/bin/ship.sh',
                            dir: 'ship',
                        },
                        { name: 'deploy', description: 'taken', body: 'x', dir: 'deploy' },
                        { name: '', description: 'no name', body: 'x' },
                    ],
                },
                { name: 'second', skills: [{ name: 'ship', description: 'dup', body: 'y' }] },
            ],
            ownSkills: [{ name: 'deploy' }],
        })
        expect(rows).toEqual([
            {
                name: 'ship',
                description: 'ship it',
                body: `run ${pluginRoot('release')}/bin/ship.sh\n\nThe files of this skill are in ${pluginRoot('release')}/skills/ship.`,
                runs: 'agent',
                enabled: true,
            },
        ])
    })

    it('reads no skills from a bad value', () => {
        expect(
            pluginSkillRows({ plugins: [{ name: 'a', skills: 'nope' }], ownSkills: [] })
        ).toEqual([])
    })
})

describe('decodePluginFiles', () => {
    it('decodes the saved files and keeps the run bit', () => {
        const files = decodePluginFiles(
            encode([
                { path: 'bin/x.sh', mode: 0o755, data: 'echo' },
                { path: 'a.md', data: 'a' },
            ])
        )
        expect(files.map((f) => [f.path, f.mode, f.data.toString()])).toEqual([
            ['bin/x.sh', 0o755, 'echo'],
            ['a.md', 0o644, 'a'],
        ])
    })

    it('drops paths that leave the plugin folder and the marker file', () => {
        const files = decodePluginFiles(
            encode([
                { path: '../../.bashrc', data: 'x' },
                { path: '/etc/passwd', data: 'x' },
                { path: 'a/./b', data: 'x' },
                { path: PLUGIN_MARKER_FILE, data: 'x' },
                { path: 'ok.txt', data: 'ok' },
            ])
        )
        expect(files.map((f) => f.path)).toEqual(['ok.txt'])
    })

    it('reads nothing from an empty value', () => {
        expect(decodePluginFiles(null)).toEqual([])
        expect(decodePluginFiles(new Uint8Array())).toEqual([])
    })
})

describe('installPluginsInSandbox', () => {
    const plugin = {
        id: 'p1',
        name: 'release',
        commitSha: 'abc',
        updatedAt: new Date('2026-11-28T00:00:00Z'),
    }
    const blob = encode([
        { path: 'plugin.json', data: '{"name":"release"}' },
        { path: 'bin/ship.sh', mode: 0o755, data: 'echo ship' },
    ])

    it('writes the files, makes scripts runnable and writes the marker', async () => {
        const { sandbox, files, commands } = fakeSandbox()
        const loads: string[] = []
        const ready = await installPluginsInSandbox({
            sandbox,
            plugins: [plugin],
            loadFiles: async (id) => {
                loads.push(id)
                return blob
            },
        })
        expect(ready).toEqual(['release'])
        expect(loads).toEqual(['p1'])
        expect(files.get(`${SANDBOX_PLUGINS_DIR}/release/bin/ship.sh`)).toBe('echo ship')
        expect(files.get(`${SANDBOX_PLUGINS_DIR}/release/${PLUGIN_MARKER_FILE}`)).toContain(
            '"id":"p1"'
        )
        expect(commands.some((c) => c.startsWith('chmod +x') && c.includes('bin/ship.sh'))).toBe(
            true
        )
        // the tidy step keeps the plugins of this run only
        expect(commands[0]).toContain(`case " release " in`)
    })

    it('leaves a plugin whose version is there already', async () => {
        const { sandbox } = fakeSandbox()
        await installPluginsInSandbox({ sandbox, plugins: [plugin], loadFiles: async () => blob })
        const loads: string[] = []
        const ready = await installPluginsInSandbox({
            sandbox,
            plugins: [plugin],
            loadFiles: async (id) => {
                loads.push(id)
                return blob
            },
        })
        expect(ready).toEqual(['release'])
        expect(loads).toEqual([])
    })

    it('skips a plugin that fails and goes on with the next', async () => {
        const { sandbox } = fakeSandbox()
        const ready = await installPluginsInSandbox({
            sandbox,
            plugins: [{ ...plugin, id: 'bad', name: 'broken' }, plugin],
            loadFiles: async (id) => (id === 'bad' ? Buffer.from('not gzip') : blob),
        })
        expect(ready).toEqual(['release'])
    })

    it('never writes a plugin with an unsafe name, and does nothing without a sandbox', async () => {
        const { sandbox, files } = fakeSandbox()
        await installPluginsInSandbox({
            sandbox,
            plugins: [{ ...plugin, name: '../../etc' }],
            loadFiles: async () => blob,
        })
        expect([...files.keys()]).toEqual([])
        expect(
            await installPluginsInSandbox({
                sandbox: null,
                plugins: [plugin],
                loadFiles: async () => blob,
            })
        ).toEqual([])
    })
})

describe('pluginMcpServers', () => {
    it('reads command and url servers, fills the plugin root and skips taken names', () => {
        const servers = pluginMcpServers({
            plugins: [
                {
                    name: 'release',
                    mcpServers: {
                        notes: {
                            command: 'node',
                            args: ['${CLAUDE_PLUGIN_ROOT}/server.js'],
                            env: { KEY: '${API_KEY}' },
                        },
                        docs: {
                            url: 'https://docs.example.com/mcp',
                            transport: 'http',
                            headers: { 'X-Key': 'v' },
                        },
                        linear: { command: 'npx' },
                        off: { command: 'npx' },
                        'bad name': { command: 'npx' },
                    },
                },
                { name: 'second', mcpServers: { notes: { command: 'other' } } },
            ],
            takenNames: ['linear'],
            disabledMcps: ['off'],
        })
        expect(servers).toEqual([
            {
                plugin: 'release',
                name: 'notes',
                config: {
                    command: 'node',
                    args: [`${pluginRoot('release')}/server.js`],
                    env: { KEY: '${API_KEY}' },
                },
            },
            {
                plugin: 'release',
                name: 'docs',
                config: {
                    url: 'https://docs.example.com/mcp',
                    transport: 'http',
                    headers: { 'X-Key': 'v' },
                },
            },
        ])
    })
})

describe('helpers', () => {
    it('fills the plugin root and the secrets', () => {
        expect(fillPluginRoot('${DECEMBER_PLUGIN_ROOT}/a ${CLAUDE_PLUGIN_ROOT}/b', '/p')).toBe(
            '/p/a /p/b'
        )
        expect(fillSecrets('Bearer ${TOKEN} ${MISSING}', { TOKEN: 't' })).toBe('Bearer t ')
    })

    it('quotes every part of a stdio command, so nothing runs as a second command', () => {
        expect(
            stdioCommandLine({ command: 'npx', args: ['-y', 'x; rm -rf /', "it's"], env: {} })
        ).toBe(`exec 'npx' '-y' 'x; rm -rf /' 'it'\\''s'`)
    })
})

/** a sandbox whose commands run here, so a real mcp stdio server can answer */
const localSandbox = (cwd: string) => {
    const runs: Array<{ command: string; options: any }> = []
    return {
        runs,
        sandbox: {
            commands: {
                run: async (command: string, options: any) => {
                    runs.push({ command, options })
                    const child = spawn('sh', ['-c', command], {
                        cwd,
                        env: { ...process.env, ...options.envs },
                    })
                    child.stdout.on('data', (data) => options.onStdout?.(data.toString()))
                    child.stderr.on('data', (data) => options.onStderr?.(data.toString()))
                    const exited = new Promise((resolve) => (child as any).on('close', resolve))
                    return {
                        pid: child.pid,
                        wait: () => exited,
                        kill: async () => {
                            child.kill('SIGKILL')
                        },
                        sendStdin: async (data: string) => {
                            child.stdin.write(data)
                        },
                    }
                },
            },
        },
    }
}

const MCP_SERVER = `
const readline = require('node:readline')
const rl = readline.createInterface({ input: process.stdin })
const send = (msg) => process.stdout.write(JSON.stringify(msg) + '\\n')
rl.on('line', (line) => {
    const msg = JSON.parse(line)
    if (msg.id === undefined) return
    if (msg.method === 'initialize') {
        send({ jsonrpc: '2.0', id: msg.id, result: { protocolVersion: msg.params.protocolVersion, capabilities: { tools: {} }, serverInfo: { name: 'fake', version: '1.0.0' } } })
    } else if (msg.method === 'tools/list') {
        send({ jsonrpc: '2.0', id: msg.id, result: { tools: [{ name: 'hello', description: 'says hello to ' + (process.env.WHO || 'nobody'), inputSchema: { type: 'object', properties: {} } }] } })
    } else {
        send({ jsonrpc: '2.0', id: msg.id, error: { code: -32601, message: 'no' } })
    }
})
`

describe('SandboxStdioTransport and connectPluginMcpServers', () => {
    it('connects a command server that runs in the sandbox and registers its tools', async () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'plugin-mcp-'))
        fs.writeFileSync(path.join(dir, 'server.cjs'), MCP_SERVER)
        const { sandbox, runs } = localSandbox(dir)
        const registered: string[] = []
        const agent: any = {
            registerMcpServerTools: (name: string) => registered.push(name),
            unregisterMcpServerTools: () => {},
        }
        try {
            const result = await connectPluginMcpServers({
                agent,
                sandbox,
                servers: [
                    {
                        plugin: 'release',
                        name: 'notes',
                        config: {
                            command: process.execPath,
                            args: ['server.cjs'],
                            env: { WHO: '${NAME}' },
                        },
                    },
                ],
                cwd: dir,
                secrets: { NAME: 'ada' },
            })
            expect(result).toEqual([{ name: 'notes', status: 'connected' }])
            expect(registered).toEqual(['notes'])
            const info = agent.mcpClientManager.getServer('notes')
            expect(info.availableTools).toEqual(['hello'])
            expect(runs[0]?.options).toMatchObject({
                background: true,
                stdin: true,
                timeoutMs: 0,
                cwd: dir,
            })
            expect(runs[0]?.options.envs.WHO).toBe('ada')
        } finally {
            await agent.mcpClientManager?.disconnectAll()
            fs.rmSync(dir, { recursive: true, force: true })
        }
    })

    it('reports a server that does not answer in time and drops it', async () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'plugin-mcp-'))
        const { sandbox } = localSandbox(dir)
        const agent: any = { registerMcpServerTools: () => {}, unregisterMcpServerTools: () => {} }
        try {
            const result = await connectPluginMcpServers({
                agent,
                sandbox,
                servers: [
                    {
                        plugin: 'p',
                        name: 'silent',
                        config: { command: 'sleep', args: ['5'], env: {} },
                    },
                ],
                cwd: dir,
                secrets: {},
                timeoutMs: 300,
            })
            expect(result).toEqual([{ name: 'silent', status: 'error' }])
        } finally {
            await agent.mcpClientManager?.disconnectAll()
            fs.rmSync(dir, { recursive: true, force: true })
        }
    })

    it('refuses a url server that is not public https without a request', async () => {
        const agent: any = { registerMcpServerTools: () => {}, unregisterMcpServerTools: () => {} }
        const result = await connectPluginMcpServers({
            agent,
            sandbox: null,
            servers: [
                {
                    plugin: 'p',
                    name: 'meta',
                    config: { url: 'http://169.254.169.254/', transport: 'http', headers: {} },
                },
                { plugin: 'p', name: 'cmd', config: { command: 'x', args: [], env: {} } },
            ],
            cwd: '/workspace',
            secrets: {},
        })
        expect(result).toEqual([
            { name: 'meta', status: 'error' },
            { name: 'cmd', status: 'error' },
        ])
    })

    it('does nothing with no servers', async () => {
        const agent: any = {}
        expect(
            await connectPluginMcpServers({
                agent,
                sandbox: null,
                servers: [],
                cwd: '/',
                secrets: {},
            })
        ).toEqual([])
        expect(agent.mcpClientManager).toBeUndefined()
    })

    it('splits stdout into json messages and skips lines that are not json', async () => {
        let onStdout: (chunk: string) => void = () => {}
        const sent: string[] = []
        const transport = new SandboxStdioTransport({
            sandbox: {
                commands: {
                    run: async (_command: string, options: any) => {
                        onStdout = options.onStdout
                        return {
                            pid: 1,
                            wait: () => new Promise(() => {}),
                            kill: async () => {},
                            sendStdin: async (d: string) => sent.push(d),
                        }
                    },
                },
            },
            config: { command: 'x', args: [], env: {} },
            cwd: '/',
            envs: {},
        })
        const messages: unknown[] = []
        let closed = false
        transport.onmessage = (message) => messages.push(message)
        transport.onclose = () => {
            closed = true
        }
        await transport.start()
        onStdout('{"a":1}\nnot json\n{"b":')
        onStdout('2}\r\n')
        expect(messages).toEqual([{ a: 1 }, { b: 2 }])
        await transport.send({ jsonrpc: '2.0', id: 1, method: 'ping' })
        expect(sent).toEqual(['{"jsonrpc":"2.0","id":1,"method":"ping"}\n'])
        await transport.close()
        expect(closed).toBe(true)
        await expect(transport.send({})).rejects.toThrow()
    })
})
