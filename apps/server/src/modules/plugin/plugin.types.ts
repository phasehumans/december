// plugins installed on the account (connections page). the format is the cli's plugin
// format: plugin.json, skills/<name>/SKILL.md and mcp.json

export interface UserRef {
    userId: string
}

export interface PluginByName {
    userId: string
    name: string
}

export interface InstallPlugin {
    userId: string
    /** a marketplace name (name or name@december-official), owner/repo or a github.com link */
    source: string
}

export interface SetPluginEnabled {
    userId: string
    name: string
    enabled: boolean
}

export interface GithubPluginSource {
    kind: 'github'
    owner: string
    repo: string
    ref?: string
    /** a folder in the repository that holds the plugin */
    path?: string
}

export interface RepoArchiveEntry {
    /** the path in the repository, without the top folder of the archive */
    path: string
    mode: number
    data: Buffer
}

export interface RepoArchive {
    commitSha: string | null
    entries: RepoArchiveEntry[]
}

export interface PluginFile {
    path: string
    mode: number
    data: Buffer
}

export interface PluginSkill {
    name: string
    description: string
    body: string
    /** the folder under skills/, where the skill's other files are */
    dir: string
}

export type PluginMcpConfig =
    | { command: string; args: string[]; env: Record<string, string> }
    | { url: string; transport: 'http' | 'sse'; headers: Record<string, string> }

/** a plugin read from its files, before it is saved */
export interface ParsedPlugin {
    name: string
    description: string
    version: string | null
    author: string | null
    skills: PluginSkill[]
    mcpServers: Record<string, PluginMcpConfig>
    files: PluginFile[]
}

/** what is saved for a plugin, without the files */
export interface PluginRecord {
    name: string
    description: string
    version: string | null
    author: string | null
    sourceKind: string
    source: string
    ref: string | null
    path: string | null
    commitSha: string | null
    enabled: boolean
    skills: unknown
    mcpServers: unknown
    fileCount: number
    sizeBytes: number
    createdAt: Date
    updatedAt: Date
}

export interface PluginSaveData {
    name: string
    description: string
    version: string | null
    author: string | null
    sourceKind: 'github' | 'marketplace'
    source: string
    ref: string | null
    path: string | null
    commitSha: string | null
    skills: PluginSkill[]
    mcpServers: Record<string, PluginMcpConfig>
    files: Buffer
    fileCount: number
    sizeBytes: number
}

/** what a parsed plugin is saved with */
export interface SaveDataInput {
    plugin: ParsedPlugin
    sourceKind: 'github' | 'marketplace'
    source: string
    ref: string | null
    path: string | null
    commitSha: string | null
    /** an update keeps the saved name */
    name?: string
}
