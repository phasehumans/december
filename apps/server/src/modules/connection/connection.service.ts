import { checkMcpUrl } from '@december/shared'

import { AppError } from '../../shared/appError'

import { connectionRepository } from './connection.repository'
import { mergeHeaders, toPublicMcpServer } from './connection.utils'

import type {
    DeleteByName,
    SaveMcpServer,
    SaveSkill,
    SetSkillEnabled,
    UpdateMcpServer,
    UserRef,
} from './connection.types'

const MAX_SKILLS = 100
const MAX_MCP_SERVERS = 20

const toPublicSkill = (skill: {
    name: string
    description: string
    body: string
    runs: string
    enabled: boolean
    updatedAt: Date
}) => ({
    name: skill.name,
    description: skill.description,
    body: skill.body,
    runs: skill.runs,
    enabled: skill.enabled,
    updatedAt: skill.updatedAt,
})

const listSkills = async (data: UserRef) => {
    const { userId } = data
    const skills = await connectionRepository.findSkills(userId)
    return { skills: skills.map(toPublicSkill) }
}

/** creates the skill, or saves it under its current name (a rename keeps one row) */
const saveSkill = async (data: SaveSkill) => {
    const { userId, currentName, name, description, body, runs, enabled } = data
    const existing = await connectionRepository.findSkill(userId, currentName)
    if (name !== currentName && (await connectionRepository.findSkill(userId, name))) {
        throw new AppError(`A skill named ${name} already exists.`, 409)
    }
    if (!existing) {
        const all = await connectionRepository.findSkills(userId)
        if (all.length >= MAX_SKILLS) {
            throw new AppError(`You can save up to ${MAX_SKILLS} skills.`, 409)
        }
    }
    const skill = await connectionRepository.upsertSkill(userId, currentName, {
        name,
        description,
        body,
        runs,
        enabled,
    })
    return { skill: toPublicSkill(skill) }
}

const setSkillEnabled = async (data: SetSkillEnabled) => {
    const { userId, name, enabled } = data
    const existing = await connectionRepository.findSkill(userId, name)
    if (!existing) throw new AppError('Skill not found', 404)
    const skill = await connectionRepository.updateSkill(existing.id, { enabled })
    return { skill: toPublicSkill(skill) }
}

const deleteSkill = async (data: DeleteByName) => {
    const { userId, name } = data
    const result = await connectionRepository.deleteSkill(userId, name)
    if (result.count === 0) throw new AppError('Skill not found', 404)
    return { deleted: true }
}

const listMcpServers = async (data: UserRef) => {
    const { userId } = data
    const servers = await connectionRepository.findMcpServers(userId)
    return { mcps: servers.map(toPublicMcpServer) }
}

/** creates the server or saves it; a new url or header waits for the next run to be checked */
const saveMcpServer = async (data: SaveMcpServer) => {
    const { userId, currentName, name, url, transport, auth, headers, enabled, disabledTools } =
        data

    const check = checkMcpUrl(url)
    if (!check.ok) throw new AppError(`This mcp server cannot be used: ${check.reason}.`, 400)
    if (auth === 'header' && headers.length === 0) {
        throw new AppError('Add the header that signs in to the server.', 400)
    }

    const existing = await connectionRepository.findMcpServer(userId, currentName)
    if (name !== currentName && (await connectionRepository.findMcpServer(userId, name))) {
        throw new AppError(`An mcp server named ${name} already exists.`, 409)
    }
    const { encryptedHeaders, headerKeys } = mergeHeaders(
        auth === 'header' ? headers : [],
        existing?.encryptedHeaders ?? null
    )
    const changedTarget =
        !existing ||
        existing.url !== url ||
        existing.transport !== transport ||
        headers.some((header) => header.value)

    const fields = {
        name,
        url,
        transport,
        auth,
        encryptedHeaders,
        headerKeys,
        enabled,
        disabledTools,
        // a new address or key is unknown until a run connects to it
        ...(changedTarget ? { status: 'unknown', lastError: null, checkedAt: null } : {}),
    }

    if (existing) {
        const server = await connectionRepository.updateMcpServer(existing.id, fields)
        return { mcp: toPublicMcpServer(server) }
    }
    const all = await connectionRepository.findMcpServers(userId)
    if (all.length >= MAX_MCP_SERVERS) {
        throw new AppError(`You can save up to ${MAX_MCP_SERVERS} mcp servers.`, 409)
    }
    const server = await connectionRepository.createMcpServer({ ...fields, userId })
    return { mcp: toPublicMcpServer(server) }
}

const updateMcpServer = async (data: UpdateMcpServer) => {
    const { userId, name, enabled, disabledTools } = data
    const existing = await connectionRepository.findMcpServer(userId, name)
    if (!existing) throw new AppError('MCP server not found', 404)
    const server = await connectionRepository.updateMcpServer(existing.id, {
        ...(enabled !== undefined ? { enabled } : {}),
        ...(disabledTools !== undefined ? { disabledTools } : {}),
    })
    return { mcp: toPublicMcpServer(server) }
}

const deleteMcpServer = async (data: DeleteByName) => {
    const { userId, name } = data
    const result = await connectionRepository.deleteMcpServer(userId, name)
    if (result.count === 0) throw new AppError('MCP server not found', 404)
    return { deleted: true }
}

/** what the prompt box lists: skills to pick with /name, plugins and mcp servers to switch off */
const getPromptBoxLists = async (data: UserRef) => {
    const { userId } = data
    const [skills, servers] = await Promise.all([
        connectionRepository.findSkills(userId),
        connectionRepository.findMcpServers(userId),
    ])
    return {
        skills: skills
            .filter((skill) => skill.enabled)
            .map((skill) => ({ name: skill.name, description: skill.description, plugin: null })),
        // installing plugins is not built yet, so there are none
        plugins: [] as Array<{ name: string; enabled: boolean }>,
        mcps: servers.map((server) => ({
            name: server.name,
            enabled: server.enabled,
            status: server.status,
            lastError: server.lastError,
        })),
    }
}

export const connectionService = {
    listSkills,
    saveSkill,
    setSkillEnabled,
    deleteSkill,
    listMcpServers,
    saveMcpServer,
    updateMcpServer,
    deleteMcpServer,
    getPromptBoxLists,
}
