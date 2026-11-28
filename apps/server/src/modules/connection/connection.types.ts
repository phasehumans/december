/** skills and remote mcp servers saved on the account (#632 section 2) */

export type SkillRunner = 'agent' | 'user'
export type McpTransport = 'http' | 'sse'
export type McpAuth = 'none' | 'header'

export type UserRef = {
    userId: string
}

export type SaveSkill = {
    userId: string
    /** the name in the url; the body may rename the skill */
    currentName: string
    name: string
    description: string
    body: string
    runs: SkillRunner
    enabled: boolean
}

export type SetSkillEnabled = {
    userId: string
    name: string
    enabled: boolean
}

export type DeleteByName = {
    userId: string
    name: string
}

export type McpHeader = {
    key: string
    /** an empty value keeps the saved value of that header */
    value: string
}

export type SaveMcpServer = {
    userId: string
    currentName: string
    name: string
    url: string
    transport: McpTransport
    auth: McpAuth
    headers: McpHeader[]
    enabled: boolean
    disabledTools: string[]
}

export type UpdateMcpServer = {
    userId: string
    name: string
    enabled?: boolean
    disabledTools?: string[]
}

// import setup from a repository (#637 section 6)

export type GitHost = 'GITHUB' | 'GITLAB'

export type RepoSetupRef = {
    userId: string
    /** owner/name; a gitlab namespace can hold subgroups */
    repoFullName: string
    provider: GitHost
}

export type ImportSetup = RepoSetupRef & {
    /** the names the user ticked */
    skills: string[]
    mcps: string[]
    /** the rule files the user ticked (AGENTS.md, CLAUDE.md) */
    rules: string[]
    /** without it a name that is saved already is skipped */
    overwrite: boolean
}

export type FoundSkill = {
    name: string
    description: string
    /** the skill file, from the repository root */
    path: string
    /** null when the skill cannot be imported */
    body: string | null
    importable: boolean
    reason?: string
}

export type FoundMcp = {
    name: string
    /** null for a server that runs a command */
    url: string | null
    transport: McpTransport | 'stdio'
    /** header names only: a header value is never read out of the file */
    headerNames: string[]
    importable: boolean
    reason?: string
}

/** a rule file at the root of a repository, imported as an account rule */
export type FoundRule = {
    /** AGENTS.md or CLAUDE.md */
    path: string
    /** the account rule it becomes */
    name: string
    /** null when the file cannot be imported */
    body: string | null
    importable: boolean
    reason?: string
}

export type FoundSetup = {
    skills: FoundSkill[]
    mcps: FoundMcp[]
    rules: FoundRule[]
    /** true when the repository has more skill folders than one import reads */
    truncated: boolean
}

export type ImportSkipped = {
    kind: 'skill' | 'mcp' | 'rule'
    name: string
    reason: string
}
