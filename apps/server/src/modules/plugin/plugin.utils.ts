import { gzipSync } from 'node:zlib'

import { BUILT_IN_MARKETPLACE, BUILT_IN_MARKETPLACE_NAME } from '@december/shared'

import { AppError } from '../../shared/appError'

import type {
    ParsedPlugin,
    PluginFile,
    PluginMcpConfig,
    PluginRecord,
    PluginSkill,
    RepoArchiveEntry,
} from './plugin.types'
import type { BuiltInMarketplaceEntry } from '@december/shared'

/** a plugin on the account takes at most this much, so a cloud session writes it quickly */
export const MAX_PLUGINS = 20
export const MAX_PLUGIN_FILES = 300
export const MAX_PLUGIN_BYTES = 3 * 1024 * 1024
export const MAX_PLUGIN_FILE_BYTES = 1024 * 1024
export const MAX_PLUGIN_SKILLS = 100
export const MAX_PLUGIN_MCP_SERVERS = 20
export const MAX_SKILL_BODY = 64 * 1024

/** the cli's rule for a plugin name (packages/tools isSafeName), with a length cap */
const SAFE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/
export const isSafePluginName = (name: string) => SAFE_NAME.test(name) && !name.includes('..')

const MCP_NAME = /^[A-Za-z0-9][A-Za-z0-9_-]{0,39}$/
const SKILL_NAME = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/
const ENV_NAME = /^[A-Za-z_][A-Za-z0-9_]{0,127}$/
const HEADER_NAME = /^[A-Za-z0-9-]{1,64}$/

/** manifest places, in the cli's order. claude code plugin folders work as they are */
const MANIFEST_FILES = ['plugin.json', '.december-plugin/plugin.json', '.claude-plugin/plugin.json']
const MARKETPLACE_FILES = [
    'marketplace.json',
    '.december-plugin/marketplace.json',
    '.claude-plugin/marketplace.json',
]
const MCP_FILES = ['mcp.json', 'mcp_config.json', '.mcp.json']
const SKILL_FILES = ['SKILL.md', 'skill.md']

const text = (value: unknown, max: number): string | null =>
    typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : null

const readJson = (files: Map<string, PluginFile>, path: string): unknown => {
    const file = files.get(path)
    if (!file) return undefined
    try {
        return JSON.parse(file.data.toString('utf8'))
    } catch {
        // Intentionally swallowed: a file that is not json counts as missing, like in the cli
        return undefined
    }
}

const isObject = (value: unknown): value is Record<string, unknown> =>
    Boolean(value) && typeof value === 'object' && !Array.isArray(value)

/**
 * The files of the plugin: the entries under `folder` (the whole repository when it is
 * empty), with the folder taken off the path. Version control data is left out, like the
 * cli's copy. The limits are checked after the cli's staging (`checkPluginLimits`).
 */
export const selectPluginFiles = (entries: RepoArchiveEntry[], folder: string): PluginFile[] => {
    const prefix = folder ? `${folder}/` : ''
    const files: PluginFile[] = []
    for (const entry of entries) {
        if (prefix && !entry.path.startsWith(prefix)) continue
        const path = entry.path.slice(prefix.length)
        if (!path || path.split('/').some((part) => part === '.git')) continue
        files.push({ path, mode: entry.mode, data: entry.data })
    }
    if (folder && files.length === 0) throw new AppError(`There is no folder ${folder}.`, 404)
    return files
}

/** refuses a plugin over the file count or size limit: a cloud session writes all of it */
export const checkPluginLimits = (files: PluginFile[]) => {
    if (files.length > MAX_PLUGIN_FILES) {
        throw new AppError(`The plugin has more than ${MAX_PLUGIN_FILES} files.`, 413)
    }
    let total = 0
    for (const file of files) {
        if (file.data.length > MAX_PLUGIN_FILE_BYTES) {
            throw new AppError(
                `${file.path.slice(0, 200)} is over 1 MB. The plugin is too big to install.`,
                413
            )
        }
        total += file.data.length
    }
    if (total > MAX_PLUGIN_BYTES) throw new AppError('The plugin is over 3 MB.', 413)
}

const jsonFile = (path: string, value: unknown): PluginFile => ({
    path,
    mode: 0o644,
    data: Buffer.from(`${JSON.stringify(value, null, 2)}\n`, 'utf8'),
})

const hasSkillFile = (paths: Set<string>, dir: string) =>
    SKILL_FILES.some((file) => paths.has(dir ? `${dir}/${file}` : file))

/**
 * The cli's install of a source (stageSourceDir in packages/tools): a folder with a
 * plugin.json is the plugin. A folder without one that holds skills becomes a plugin with
 * a plugin.json made for it: a skills/ folder is kept, skill folders at the root move into
 * skills/, and one skill at the root becomes skills/<name>. A marketplace is refused.
 */
export const stagePluginFiles = (data: {
    files: PluginFile[]
    fallbackName: string
    label: string
}): { files: PluginFile[]; manifest: Record<string, unknown> } => {
    const { files, fallbackName, label } = data
    const byPath = new Map(files.map((file) => [file.path, file]))
    for (const path of MANIFEST_FILES) {
        const manifest = readJson(byPath, path)
        if (isObject(manifest)) return { files, manifest }
    }
    if (MARKETPLACE_FILES.some((path) => byPath.has(path))) {
        throw new AppError(
            'That repository is a marketplace. Install one plugin from it with its own repository or folder link.',
            400
        )
    }

    const name = fallbackName
    const manifest = { name, description: `Skills from ${label}`, version: '1.0.0' }
    const paths = new Set(byPath.keys())
    const rootDirs = new Set(
        files.filter((file) => file.path.includes('/')).map((file) => file.path.split('/')[0] ?? '')
    )
    const rootSkills = [...rootDirs].filter((dir) => dir && hasSkillFile(paths, dir)).sort()

    let staged: PluginFile[]
    if (files.some((file) => file.path.startsWith('skills/'))) {
        staged = files
    } else if (rootSkills.length > 0) {
        staged = files
            .filter((file) => rootSkills.includes(file.path.split('/')[0] ?? ''))
            .map((file) => ({ ...file, path: `skills/${file.path}` }))
    } else if (hasSkillFile(paths, '')) {
        staged = files.map((file) => ({ ...file, path: `skills/${name}/${file.path}` }))
    } else {
        throw new AppError('No plugin.json or skills found at the root of that source.', 400)
    }
    return { files: [...staged, jsonFile('plugin.json', manifest)], manifest }
}

/** the front matter of a SKILL.md (name and description lines) and the text after it */
export const parseSkillFile = (
    content: string
): { name?: string; description?: string; body: string } => {
    const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(content)
    if (!match) return { body: content.trim() }
    const front = match[1] ?? ''
    const field = (key: string) => {
        const line = new RegExp(`^${key}:\\s*(.+)$`, 'm').exec(front)?.[1]?.trim()
        return line ? line.replace(/^(['"])(.*)\1$/, '$2').trim() : undefined
    }
    return {
        name: field('name'),
        description: field('description'),
        body: content.slice(match[0].length).trim(),
    }
}

/** the skills in skills/<folder>/SKILL.md, sorted by name. a name the cli cannot use is skipped */
export const readPluginSkills = (files: PluginFile[]): PluginSkill[] => {
    const byPath = new Map(files.map((file) => [file.path, file]))
    const folders = new Set(
        files
            .map((file) => /^skills\/([^/]+)\//.exec(file.path)?.[1])
            .filter((folder): folder is string => Boolean(folder))
    )
    const skills = new Map<string, PluginSkill>()
    for (const folder of [...folders].sort()) {
        const file = SKILL_FILES.map((name) => byPath.get(`skills/${folder}/${name}`)).find(Boolean)
        if (!file) continue
        const parsed = parseSkillFile(file.data.toString('utf8'))
        const name = parsed.name && SKILL_NAME.test(parsed.name) ? parsed.name : folder
        if (!SKILL_NAME.test(name) || skills.has(name)) continue
        skills.set(name, {
            name,
            description: (parsed.description ?? '').slice(0, 500),
            body: parsed.body.slice(0, MAX_SKILL_BODY),
            dir: folder,
        })
    }
    if (skills.size > MAX_PLUGIN_SKILLS) {
        throw new AppError(`The plugin has more than ${MAX_PLUGIN_SKILLS} skills.`, 413)
    }
    return [...skills.values()]
}

const stringRecord = (
    value: unknown,
    keyRule: RegExp,
    maxValue: number
): Record<string, string> => {
    const out: Record<string, string> = {}
    if (!isObject(value)) return out
    for (const [key, item] of Object.entries(value).slice(0, 50)) {
        if (keyRule.test(key) && typeof item === 'string' && item.length <= maxValue)
            out[key] = item
    }
    return out
}

/** one server of an mcp.json, in the shape the cli reads; null when it cannot be used */
export const toPluginMcpConfig = (raw: unknown): PluginMcpConfig | null => {
    if (!isObject(raw)) return null
    if (typeof raw.command === 'string' && raw.command.trim()) {
        if (raw.command.length > 500) return null
        const args = Array.isArray(raw.args)
            ? raw.args
                  .filter((arg): arg is string => typeof arg === 'string' && arg.length <= 1000)
                  .slice(0, 50)
            : []
        return { command: raw.command.trim(), args, env: stringRecord(raw.env, ENV_NAME, 4000) }
    }
    const url = [raw.url, raw.endpoint, raw.sse].find((item) => typeof item === 'string')
    if (typeof url !== 'string' || url.length > 500) return null
    const kind = raw.transport ?? raw.type
    return {
        url,
        // the cli's default is sse; "http" is the streamable http transport
        transport: kind === 'http' || kind === 'streamable-http' ? 'http' : 'sse',
        headers: stringRecord(raw.headers, HEADER_NAME, 4000),
    }
}

/** the mcp servers of mcp.json (or mcp_config.json, .mcp.json), like the cli reads them */
export const readPluginMcpServers = (files: PluginFile[]): Record<string, PluginMcpConfig> => {
    const byPath = new Map(files.map((file) => [file.path, file]))
    let data: unknown
    for (const path of MCP_FILES) {
        data = readJson(byPath, path)
        if (data) break
    }
    const map = isObject(data) && isObject(data.mcpServers) ? data.mcpServers : data
    const servers: Record<string, PluginMcpConfig> = {}
    if (!isObject(map)) return servers
    for (const [name, raw] of Object.entries(map)) {
        if (!MCP_NAME.test(name)) continue
        const config = toPluginMcpConfig(raw)
        if (config) servers[name] = config
        if (Object.keys(servers).length > MAX_PLUGIN_MCP_SERVERS) {
            throw new AppError(
                `The plugin has more than ${MAX_PLUGIN_MCP_SERVERS} mcp servers.`,
                413
            )
        }
    }
    return servers
}

const authorName = (value: unknown): string | null =>
    typeof value === 'string' ? text(value, 100) : isObject(value) ? text(value.name, 100) : null

/** reads a plugin from its staged files: the manifest, the skills and the mcp servers */
export const parsePluginFiles = (data: {
    files: PluginFile[]
    fallbackName: string
    label: string
}): ParsedPlugin => {
    const staged = stagePluginFiles(data)
    checkPluginLimits(staged.files)
    const name = String(staged.manifest.name ?? data.fallbackName).trim()
    if (!isSafePluginName(name)) {
        throw new AppError(
            `The plugin name "${name.slice(0, 64)}" can only use letters, numbers, ".", "_" or "-".`,
            400
        )
    }
    return {
        name,
        description: text(staged.manifest.description, 500) ?? '',
        version: text(staged.manifest.version, 50),
        author: authorName(staged.manifest.author),
        skills: readPluginSkills(staged.files),
        mcpServers: readPluginMcpServers(staged.files),
        files: staged.files,
    }
}

/** the name of a source without a plugin.json: owner-repo, or the last folder name */
export const fallbackPluginName = (data: { owner: string; repo: string; path?: string }) => {
    const { owner, repo, path } = data
    const folder = path?.split('/').pop()
    return (folder || `${owner}-${repo.replace(/\.git$/, '')}`).slice(0, 64)
}

/** the files as one gzip of json, with the data in base64; the worker writes them out */
export const encodePluginFiles = (files: PluginFile[]): Buffer =>
    gzipSync(
        Buffer.from(
            JSON.stringify(
                files.map((file) => ({
                    path: file.path,
                    // only the run bit counts: a script stays a script in the sandbox
                    mode: file.mode & 0o111 ? 0o755 : 0o644,
                    data: file.data.toString('base64'),
                }))
            ),
            'utf8'
        )
    )

export const filesSize = (files: PluginFile[]) =>
    files.reduce((sum, file) => sum + file.data.length, 0)

/** a built-in marketplace entry by "name" or "name@december-official" */
export const findCatalogEntry = (source: string): BuiltInMarketplaceEntry | null => {
    const [name = '', market] = source.trim().split('@')
    if (market !== undefined && market !== BUILT_IN_MARKETPLACE_NAME) return null
    return (
        BUILT_IN_MARKETPLACE.plugins.find(
            (entry) => entry.name.toLowerCase() === name.toLowerCase()
        ) ?? null
    )
}

/** the cli's install of a marketplace entry with inline mcp servers: plugin.json and mcp.json */
export const catalogPlugin = (entry: BuiltInMarketplaceEntry): ParsedPlugin => {
    const mcpServers: Record<string, PluginMcpConfig> = {}
    for (const [name, config] of Object.entries(entry.mcpServers)) {
        mcpServers[name] = { command: config.command, args: [...config.args], env: {} }
    }
    return {
        name: entry.name,
        description: entry.description,
        version: entry.version,
        author: entry.author,
        skills: [],
        mcpServers,
        files: [
            jsonFile('plugin.json', {
                name: entry.name,
                description: entry.description,
                version: entry.version,
                author: entry.author,
            }),
            jsonFile('mcp.json', { mcpServers: entry.mcpServers }),
        ],
    }
}

const readSkills = (value: unknown): Array<{ name: string; description: string }> =>
    Array.isArray(value)
        ? value.filter(isObject).map((skill) => ({
              name: String(skill.name ?? ''),
              description: String(skill.description ?? ''),
          }))
        : []

const readServers = (value: unknown) =>
    isObject(value)
        ? Object.entries(value).map(([name, raw]) => {
              const config = isObject(raw) ? raw : {}
              const isStdio = typeof config.command === 'string'
              const args = Array.isArray(config.args) ? config.args.join(' ') : ''
              return {
                  name,
                  transport: isStdio ? 'stdio' : config.transport === 'http' ? 'http' : 'sse',
                  target: isStdio
                      ? `${config.command}${args ? ` ${args}` : ''}`
                      : String(config.url ?? ''),
              }
          })
        : []

/** how the source reads in the list: owner/repo (with folder and branch) or name@marketplace */
export const sourceLabel = (
    plugin: Pick<PluginRecord, 'sourceKind' | 'source' | 'ref' | 'path' | 'name'>
) => {
    if (plugin.sourceKind === 'marketplace') return `${plugin.name}@${plugin.source}`
    return `${plugin.source}${plugin.path ? `/${plugin.path}` : ''}${plugin.ref ? `#${plugin.ref}` : ''}`
}

/** a plugin as the api returns it: no files and no skill text */
export const toPublicPlugin = (plugin: PluginRecord) => {
    const entry = plugin.sourceKind === 'marketplace' ? findCatalogEntry(plugin.name) : null
    return {
        name: plugin.name,
        description: plugin.description,
        version: plugin.version,
        author: plugin.author,
        sourceKind: plugin.sourceKind,
        source: sourceLabel(plugin),
        commitSha: plugin.commitSha,
        enabled: plugin.enabled,
        skills: readSkills(plugin.skills),
        mcpServers: readServers(plugin.mcpServers),
        env: entry?.env ?? [],
        updateAvailable: Boolean(entry && plugin.version && entry.version !== plugin.version),
        fileCount: plugin.fileCount,
        sizeBytes: plugin.sizeBytes,
        installedAt: plugin.createdAt,
        updatedAt: plugin.updatedAt,
    }
}

/** the built-in marketplace, with what the account has installed */
export const toMarketplaceListing = (installed: PluginRecord[]) => ({
    marketplaces: [
        {
            name: BUILT_IN_MARKETPLACE.name,
            description: BUILT_IN_MARKETPLACE.description,
            plugins: BUILT_IN_MARKETPLACE.plugins.map((entry) => {
                const match = installed.find(
                    (plugin) => plugin.sourceKind === 'marketplace' && plugin.name === entry.name
                )
                return {
                    name: entry.name,
                    description: entry.description,
                    category: entry.category,
                    author: entry.author,
                    version: entry.version,
                    env: entry.env ?? [],
                    mcpServers: Object.keys(entry.mcpServers),
                    installed: Boolean(match),
                    updateAvailable: Boolean(match?.version && match.version !== entry.version),
                }
            }),
        },
    ],
})
