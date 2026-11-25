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
