/**
 * The user's installed plugins in a cloud run (connections page, plugins). A plugin is
 * the cli's plugin format: its files go into the sandbox at
 * /home/user/.december/plugins/<name> (the same place the cli installs user plugins), its
 * skills go into the rules like saved skills, and its mcp servers connect for the run. A
 * server that runs a command runs in the sandbox, never on the worker.
 */
import { gunzipSync } from 'node:zlib'

import { checkMcpUrl } from '@december/shared'
import { McpClientManager, createGuardedMcpFetch } from '@december/tools'

import { secretEnvsOf } from './sandbox-secrets'
import { shellQuote } from './shell-quote'

import type { SkillRow } from './connections'

export const SANDBOX_PLUGINS_DIR = '/home/user/.december/plugins'
/** written next to a plugin in the sandbox, so a run knows which version is there */
export const PLUGIN_MARKER_FILE = '.december-cloud.json'
/** the files of one plugin, unzipped, are never bigger than this */
const MAX_UNZIPPED_FILES_BYTES = 16 * 1024 * 1024

const SAFE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/
const SAFE_PATH_PART = /^[^/\\\0]{1,255}$/
const MCP_NAME = /^[A-Za-z0-9][A-Za-z0-9_-]{0,39}$/

export type PluginRow = {
    id: string
    name: string
    enabled: boolean
    skills: unknown
    mcpServers: unknown
    commitSha: string | null
    updatedAt: Date
}

export type PluginFileEntry = { path: string; mode: number; data: Buffer }

export const isSafePluginName = (name: string) => SAFE_NAME.test(name) && !name.includes('..')

export const pluginRoot = (name: string) => `${SANDBOX_PLUGINS_DIR}/${name}`

/** the plugins of this run: on, with a safe name, and not turned off for the session */
export const activePlugins = <T extends Pick<PluginRow, 'name' | 'enabled'>>(data: {
    plugins: T[]
    disabledPlugins: string[]
}): T[] => {
    const { plugins, disabledPlugins } = data
    const off = new Set(disabledPlugins)
    return plugins.filter(
        (plugin) => plugin.enabled && isSafePluginName(plugin.name) && !off.has(plugin.name)
    )
}

/** ${CLAUDE_PLUGIN_ROOT} and ${DECEMBER_PLUGIN_ROOT}, like the cli fills them in */
export const fillPluginRoot = (value: string, root: string) =>
    value.replace(/\$\{(?:CLAUDE|DECEMBER)_PLUGIN_ROOT\}/g, root)

const isObject = (value: unknown): value is Record<string, unknown> =>
    Boolean(value) && typeof value === 'object' && !Array.isArray(value)

/**
 * The skills of the plugins as saved skills the agent may run. A saved skill of the same
 * name wins, and the first plugin wins over the next. Each skill says where its files are.
 */
export const pluginSkillRows = (data: {
    plugins: Array<Pick<PluginRow, 'name' | 'skills'>>
    ownSkills: Array<Pick<SkillRow, 'name'>>
}): SkillRow[] => {
    const { plugins, ownSkills } = data
    const taken = new Set(ownSkills.map((skill) => skill.name))
    const rows: SkillRow[] = []
    for (const plugin of plugins) {
        const root = pluginRoot(plugin.name)
        for (const raw of Array.isArray(plugin.skills) ? plugin.skills : []) {
            if (!isObject(raw) || typeof raw.name !== 'string' || !raw.name) continue
            if (taken.has(raw.name)) continue
            taken.add(raw.name)
            const dir = typeof raw.dir === 'string' && SAFE_PATH_PART.test(raw.dir) ? raw.dir : null
            const body = fillPluginRoot(typeof raw.body === 'string' ? raw.body : '', root)
            rows.push({
                name: raw.name,
                description: typeof raw.description === 'string' ? raw.description : '',
                body: dir
                    ? `${body}\n\nThe files of this skill are in ${root}/skills/${dir}.`
                    : body,
                runs: 'agent',
                enabled: true,
            })
        }
    }
    return rows
}

/** a path inside the plugin folder: no absolute path, no "..", no empty part */
const isSafeRelativePath = (path: string) =>
    path.length > 0 &&
    path.length <= 500 &&
    !path.startsWith('/') &&
    path.split('/').every((part) => part !== '..' && part !== '.' && SAFE_PATH_PART.test(part))

/** the saved files of a plugin; an entry with an unsafe path is dropped */
export const decodePluginFiles = (blob: Uint8Array | null | undefined): PluginFileEntry[] => {
    if (!blob || blob.length === 0) return []
    const raw: unknown = JSON.parse(
        gunzipSync(Buffer.from(blob), { maxOutputLength: MAX_UNZIPPED_FILES_BYTES }).toString(
            'utf8'
        )
    )
    if (!Array.isArray(raw)) return []
    const files: PluginFileEntry[] = []
    for (const item of raw) {
        if (!isObject(item) || typeof item.path !== 'string' || typeof item.data !== 'string')
            continue
        if (!isSafeRelativePath(item.path) || item.path === PLUGIN_MARKER_FILE) continue
        files.push({
            path: item.path,
            mode: typeof item.mode === 'number' && item.mode & 0o111 ? 0o755 : 0o644,
            data: Buffer.from(item.data, 'base64'),
        })
    }
    return files
}

const markerOf = (plugin: Pick<PluginRow, 'id' | 'commitSha' | 'updatedAt'>) =>
    JSON.stringify({
        id: plugin.id,
        commitSha: plugin.commitSha,
        updatedAt: plugin.updatedAt.toISOString(),
    })

const readText = async (sandbox: any, path: string): Promise<string | null> => {
    try {
        const value = await sandbox.files.read(path)
        return typeof value === 'string' ? value : null
    } catch {
        // Intentionally swallowed: no marker means the plugin is not in the sandbox yet
        return null
    }
}

/**
 * Writes the plugins of this run into the sandbox. A plugin whose version is there already
 * is left as it is. Plugin folders that this run does not use are removed, so a plugin
 * that was uninstalled or turned off does not stay. A plugin that fails to write is
 * skipped: it never fails the run. Returns the names that are in place.
 */
export const installPluginsInSandbox = async (data: {
    sandbox: any
    plugins: Array<Pick<PluginRow, 'id' | 'name' | 'commitSha' | 'updatedAt'>>
    loadFiles: (id: string) => Promise<Uint8Array | null>
}): Promise<string[]> => {
    const { sandbox, plugins, loadFiles } = data
    if (
        typeof sandbox?.files?.write !== 'function' ||
        typeof sandbox?.commands?.run !== 'function'
    ) {
        return []
    }
    const safe = plugins.filter((plugin) => isSafePluginName(plugin.name))
    try {
        // folders this run does not use; only folders that a cloud run wrote (with a marker).
        // the names are safe names (letters, numbers, ".", "_", "-"), so they go in as they are
        const keepList = safe.map((plugin) => plugin.name).join(' ')
        await sandbox.commands.run(
            `mkdir -p ${SANDBOX_PLUGINS_DIR} && cd ${SANDBOX_PLUGINS_DIR} && ` +
                `for d in */; do d="\${d%/}"; [ -f "$d/${PLUGIN_MARKER_FILE}" ] || continue; ` +
                `case " ${keepList} " in *" $d "*) ;; *) rm -rf -- "$d" ;; esac; done`,
            { cwd: '/home/user' }
        )
    } catch (error) {
        console.warn('[WORKER] could not tidy the plugin folders of the sandbox:', error)
    }

    const ready: string[] = []
    for (const plugin of safe) {
        const root = pluginRoot(plugin.name)
        const marker = markerOf(plugin)
        try {
            if ((await readText(sandbox, `${root}/${PLUGIN_MARKER_FILE}`)) === marker) {
                ready.push(plugin.name)
                continue
            }
            const files = decodePluginFiles(await loadFiles(plugin.id))
            await sandbox.commands.run(
                `rm -rf -- ${shellQuote(root)} && mkdir -p ${shellQuote(root)}`,
                {
                    cwd: '/home/user',
                }
            )
            if (files.length > 0) {
                await sandbox.files.write(
                    files.map((file) => ({
                        path: `${root}/${file.path}`,
                        data: new Uint8Array(file.data).buffer,
                    }))
                )
                const scripts = files.filter((file) => file.mode & 0o111)
                if (scripts.length > 0) {
                    await sandbox.commands.run(
                        `chmod +x -- ${scripts.map((file) => shellQuote(`${root}/${file.path}`)).join(' ')}`,
                        { cwd: '/home/user' }
                    )
                }
            }
            await sandbox.files.write(`${root}/${PLUGIN_MARKER_FILE}`, marker)
            ready.push(plugin.name)
        } catch (error) {
            console.warn(`[WORKER] plugin '${plugin.name}' was not written to the sandbox:`, error)
        }
    }
    return ready
}

export type StdioServerConfig = { command: string; args: string[]; env: Record<string, string> }
export type UrlServerConfig = {
    url: string
    transport: 'http' | 'sse'
    headers: Record<string, string>
}

export type PluginServer = {
    plugin: string
    name: string
    config: StdioServerConfig | UrlServerConfig
}

const stringRecord = (value: unknown): Record<string, string> => {
    const out: Record<string, string> = {}
    if (!isObject(value)) return out
    for (const [key, item] of Object.entries(value)) if (typeof item === 'string') out[key] = item
    return out
}

/** ${NAME} in a value, filled in from the run's secrets; an unknown name stays empty */
export const fillSecrets = (value: string, secrets: Record<string, string>) =>
    value.replace(/\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g, (_match, name: string) => secrets[name] ?? '')

/**
 * The mcp servers of the plugins of this run. A name that a saved server has, a name that
 * an earlier plugin has, or a name turned off for the session is skipped.
 */
export const pluginMcpServers = (data: {
    plugins: Array<Pick<PluginRow, 'name' | 'mcpServers'>>
    takenNames: string[]
    disabledMcps: string[]
}): PluginServer[] => {
    const { plugins, takenNames, disabledMcps } = data
    const taken = new Set([...takenNames, ...disabledMcps])
    const servers: PluginServer[] = []
    for (const plugin of plugins) {
        const root = pluginRoot(plugin.name)
        const map = isObject(plugin.mcpServers) ? plugin.mcpServers : {}
        for (const [name, raw] of Object.entries(map)) {
            if (!MCP_NAME.test(name) || taken.has(name) || !isObject(raw)) continue
            if (typeof raw.command === 'string' && raw.command) {
                taken.add(name)
                servers.push({
                    plugin: plugin.name,
                    name,
                    config: {
                        command: fillPluginRoot(raw.command, root),
                        args: (Array.isArray(raw.args) ? raw.args : [])
                            .filter((arg): arg is string => typeof arg === 'string')
                            .map((arg) => fillPluginRoot(arg, root)),
                        env: stringRecord(raw.env),
                    },
                })
            } else if (typeof raw.url === 'string') {
                taken.add(name)
                servers.push({
                    plugin: plugin.name,
                    name,
                    config: {
                        url: raw.url,
                        transport: raw.transport === 'http' ? 'http' : 'sse',
                        headers: stringRecord(raw.headers),
                    },
                })
            }
        }
    }
    return servers
}

/** the command line of a stdio server; every part quoted, so nothing in it is a second command */
export const stdioCommandLine = (config: StdioServerConfig) =>
    `exec ${[config.command, ...config.args].map(shellQuote).join(' ')}`

/**
 * An mcp stdio transport whose process runs in the sandbox: messages go to its stdin as
 * json lines and come back from its stdout. It has the shape of a transport of the mcp sdk.
 */
export class SandboxStdioTransport {
    onmessage?: (message: any) => void
    onclose?: () => void
    onerror?: (error: Error) => void

    private handle: any = null
    private buffer = ''
    private closed = false

    constructor(
        private readonly options: {
            sandbox: any
            config: StdioServerConfig
            cwd: string
            envs: Record<string, string>
        }
    ) {}

    async start(): Promise<void> {
        const { sandbox, config, cwd, envs } = this.options
        this.handle = await sandbox.commands.run(stdioCommandLine(config), {
            background: true,
            stdin: true,
            cwd,
            envs,
            // the server lives as long as the run; the run closes it
            timeoutMs: 0,
            onStdout: (chunk: unknown) =>
                this.receive(typeof chunk === 'string' ? chunk : String(chunk)),
            onStderr: () => {
                // Intentionally ignored: a server writes its logs to stderr
            },
        })
        Promise.resolve(this.handle?.wait?.())
            .catch(() => {
                // Intentionally swallowed: the process ended; onclose tells the client
            })
            .finally(() => this.finish())
    }

    private receive(chunk: string) {
        this.buffer += chunk
        // a server that never sends a line end must not fill the memory of the worker
        if (this.buffer.length > 4 * 1024 * 1024) {
            this.buffer = ''
            this.onerror?.(new Error('the server sent a line that is too long'))
            return
        }
        let end = this.buffer.indexOf('\n')
        while (end !== -1) {
            const line = this.buffer.slice(0, end).replace(/\r$/, '').trim()
            this.buffer = this.buffer.slice(end + 1)
            if (line) {
                try {
                    this.onmessage?.(JSON.parse(line))
                } catch {
                    // Intentionally swallowed: a line that is not json is not a message
                }
            }
            end = this.buffer.indexOf('\n')
        }
    }

    async send(message: unknown): Promise<void> {
        if (!this.handle || this.closed) throw new Error('the server is not running')
        const line = `${JSON.stringify(message)}\n`
        if (typeof this.handle.sendStdin === 'function') await this.handle.sendStdin(line)
        else await this.options.sandbox.commands.sendStdin(this.handle.pid, line)
    }

    async close(): Promise<void> {
        await Promise.resolve(this.handle?.kill?.()).catch(() => {
            // Intentionally swallowed: the process already ended
        })
        this.finish()
    }

    private finish() {
        if (this.closed) return
        this.closed = true
        this.onclose?.()
    }
}

/** the parts of the agent the plugin servers of a run need */
type PluginMcpAgent = {
    mcpClientManager?: McpClientManager
    deferredRegistry?: any
    workspaceDir?: string
    registerMcpServerTools: (serverName: string) => void
    unregisterMcpServerTools: (serverName: string) => void
}

const guardedMcpFetch = createGuardedMcpFetch()

/**
 * Connects the mcp servers of the plugins of this run, at the same time. A url server goes
 * through the guarded fetch (public https only, like a saved server); a command server
 * runs in the sandbox. A server that fails, or takes too long, is dropped and never fails
 * the run. Header values and the environment are never logged.
 */
export const connectPluginMcpServers = async (data: {
    agent: PluginMcpAgent
    sandbox: any
    servers: PluginServer[]
    cwd: string
    secrets: Record<string, string>
    timeoutMs?: number
    makeTransport?: (server: PluginServer & { config: StdioServerConfig }) => any
}): Promise<Array<{ name: string; status: 'connected' | 'error' }>> => {
    const { agent, sandbox, servers, cwd, secrets, timeoutMs = 30_000, makeTransport } = data
    if (servers.length === 0) return []
    if (!agent.mcpClientManager) {
        agent.mcpClientManager = new McpClientManager({
            registry: agent.deferredRegistry,
            workspaceDir: cwd,
            remoteFetch: guardedMcpFetch,
        })
    }
    const manager = agent.mcpClientManager

    const connectOne = async (server: PluginServer): Promise<'connected' | 'error'> => {
        const { name, config } = server
        let attempt: Promise<{ status: string }>
        if ('command' in config) {
            if (typeof sandbox?.commands?.run !== 'function') return 'error'
            const env: Record<string, string> = {}
            for (const [key, value] of Object.entries(config.env))
                env[key] = fillSecrets(value, secrets)
            const transport =
                makeTransport?.({ ...server, config }) ??
                new SandboxStdioTransport({
                    sandbox,
                    config,
                    cwd,
                    envs: { ...(secretEnvsOf(sandbox) ?? {}), ...env },
                })
            attempt = manager.connectWithTransport(
                name,
                { ...config, eager: true } as any,
                transport
            )
        } else {
            const checked = checkMcpUrl(config.url)
            if (checked.ok === false) return 'error'
            const headers: Record<string, string> = {}
            for (const [key, value] of Object.entries(config.headers))
                headers[key] = fillSecrets(value, secrets)
            attempt = manager.connectServer(name, {
                url: config.url,
                transport: config.transport,
                ...(Object.keys(headers).length > 0 ? { headers } : {}),
                eager: true,
            } as any)
        }
        let timer: ReturnType<typeof setTimeout> | undefined
        const timeout = new Promise<null>((resolve) => {
            timer = setTimeout(() => resolve(null), timeoutMs)
        })
        try {
            const info = await Promise.race([attempt, timeout])
            if (info?.status === 'connected') {
                agent.registerMcpServerTools(name)
                return 'connected'
            }
            const drop = () =>
                Promise.resolve(manager.removeServer?.(name)).catch(() => {
                    // Intentionally swallowed: the server is already reported as not connected
                })
            await drop()
            // a late answer must not add tools in the middle of the run
            attempt.then(() => {
                agent.unregisterMcpServerTools(name)
                return drop()
            }, drop)
            return 'error'
        } catch {
            // Intentionally swallowed: a server that fails is reported as not connected
            return 'error'
        } finally {
            clearTimeout(timer)
        }
    }

    return Promise.all(
        servers.map(async (server) => {
            const status = await connectOne(server)
            console.log(
                `[WORKER] plugin '${server.plugin}' mcp server '${server.name}' ${status === 'connected' ? 'connected' : 'not connected'}`
            )
            return { name: server.name, status }
        })
    )
}
