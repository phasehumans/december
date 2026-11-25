import type { McpTransport, SkillRunner } from '../types'

import { apiRequest } from '@/shared/api/client'

// skills and mcp servers saved on the account (#632 section 2). server module: connection

export type ApiSkill = {
    name: string
    description: string
    body: string
    runs: SkillRunner
    enabled: boolean
    updatedAt: string
}

export type SaveSkillInput = Omit<ApiSkill, 'updatedAt'>

/** what the last session found when it connected to the server */
export type ApiMcpStatus = 'unknown' | 'connected' | 'error'

export type ApiMcpServer = {
    name: string
    url: string
    transport: McpTransport
    auth: 'none' | 'header'
    /** header names only: the api never returns a header value */
    headerKeys: string[]
    enabled: boolean
    disabledTools: string[]
    status: ApiMcpStatus
    lastError: string | null
    tools: string[]
    checkedAt: string | null
}

export type SaveMcpServerInput = {
    name: string
    url: string
    transport: McpTransport
    auth: 'none' | 'header'
    /** an empty value keeps the saved value of that header */
    headers: { key: string; value: string }[]
    enabled: boolean
    disabledTools: string[]
}

export type UpdateMcpServerInput = {
    enabled?: boolean
    disabledTools?: string[]
}

const skillPath = (name: string) => `/connections/skills/${encodeURIComponent(name)}`
const mcpPath = (name: string) => `/connections/mcps/${encodeURIComponent(name)}`

const listSkills = async () => {
    const data = await apiRequest<{ skills: ApiSkill[] }>('/connections/skills')
    return data.skills ?? []
}

/** creates the skill or saves it. `currentName` is the saved name: the body may rename it */
const saveSkill = async (currentName: string, skill: SaveSkillInput) => {
    const data = await apiRequest<{ skill: ApiSkill }>(skillPath(currentName), {
        method: 'PUT',
        body: JSON.stringify(skill),
    })
    return data.skill
}

const setSkillEnabled = async (name: string, enabled: boolean) => {
    const data = await apiRequest<{ skill: ApiSkill }>(skillPath(name), {
        method: 'PATCH',
        body: JSON.stringify({ enabled }),
    })
    return data.skill
}

const deleteSkill = (name: string) =>
    apiRequest<{ deleted: boolean }>(skillPath(name), { method: 'DELETE' })

const listMcpServers = async () => {
    const data = await apiRequest<{ mcps: ApiMcpServer[] }>('/connections/mcps')
    return data.mcps ?? []
}

/** creates the server or saves it. `currentName` is the saved name: the body may rename it */
const saveMcpServer = async (currentName: string, server: SaveMcpServerInput) => {
    const data = await apiRequest<{ mcp: ApiMcpServer }>(mcpPath(currentName), {
        method: 'PUT',
        body: JSON.stringify(server),
    })
    return data.mcp
}

const updateMcpServer = async (name: string, patch: UpdateMcpServerInput) => {
    const data = await apiRequest<{ mcp: ApiMcpServer }>(mcpPath(name), {
        method: 'PATCH',
        body: JSON.stringify(patch),
    })
    return data.mcp
}

const deleteMcpServer = (name: string) =>
    apiRequest<{ deleted: boolean }>(mcpPath(name), { method: 'DELETE' })

// import setup from a repository (#637 section 6)

export type ImportRepo = {
    repoFullName: string
    provider: 'GITHUB' | 'GITLAB'
}

export type ImportPreviewSkill = {
    name: string
    description: string
    /** the skill file in the repository */
    path: string
    /** the account has a skill with this name */
    exists: boolean
    importable: boolean
    reason?: string
}

export type ImportPreviewMcp = {
    name: string
    /** null for a server that runs a command */
    url: string | null
    transport: McpTransport | 'stdio'
    /** header names only: the values stay in the repository */
    headerNames: string[]
    exists: boolean
    importable: boolean
    reason?: string
    note?: string
}

export type ImportPreview = ImportRepo & {
    skills: ImportPreviewSkill[]
    mcps: ImportPreviewMcp[]
    /** listed only: rules are not imported yet */
    rules: { path: string }[]
    truncated: boolean
}

export type ImportSetupInput = ImportRepo & {
    /** the ticked names. the server reads the repository again for their content */
    skills: string[]
    mcps: string[]
    /** replace the saved skill or server of the same name */
    overwrite: boolean
}

export type ImportResult = {
    imported: { skills: string[]; mcps: string[] }
    skipped: { kind: 'skill' | 'mcp'; name: string; reason: string }[]
}

const previewImport = (repo: ImportRepo) =>
    apiRequest<ImportPreview>('/connections/import/preview', {
        method: 'POST',
        body: JSON.stringify(repo),
    })

const importSetup = (input: ImportSetupInput) =>
    apiRequest<ImportResult>('/connections/import', {
        method: 'POST',
        body: JSON.stringify(input),
    })

export const connectionsAPI = {
    listSkills,
    saveSkill,
    setSkillEnabled,
    deleteSkill,
    listMcpServers,
    saveMcpServer,
    updateMcpServer,
    deleteMcpServer,
    previewImport,
    importSetup,
}
