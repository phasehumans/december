import { RULE_FILE_NAMES, checkMcpUrl, splitRepoFullName } from '@december/shared'
import {
    RULE_MAX_BYTES,
    RULES_PER_USER_MAX,
    RULES_TOTAL_MAX_BYTES,
    utf8Bytes,
} from '@december/shared/agent-context'
import { getGitProvider } from '@december/shared/git'

import { AppError } from '../../shared/appError'
import { platformService } from '../platform/platform.service'
import { pluginRepository } from '../plugin/plugin.repository'
import { ruleRepository } from '../rule/rule.repository'

import { connectionRepository } from './connection.repository'
import {
    isMissingOnHost,
    mapInBatches,
    mergeHeaders,
    toFoundMcps,
    toFoundRule,
    toFoundSkill,
    toPreviewMcp,
    toPreviewRule,
    toPreviewSkill,
    toPublicMcpServer,
    toRepoReadError,
} from './connection.utils'

import type {
    DeleteByName,
    FoundSetup,
    FoundSkill,
    ImportSetup,
    ImportSkipped,
    RepoSetupRef,
    SaveMcpServer,
    SaveSkill,
    SetSkillEnabled,
    UpdateMcpServer,
    UserRef,
} from './connection.types'

const MAX_SKILLS = 100
const MAX_MCP_SERVERS = 20

// import setup (#637 section 6)
const MAX_IMPORT_SKILL_FILES = 50
const MAX_IMPORT_FILE_BYTES = 64 * 1024
const IMPORT_READS_AT_ONCE = 8
// the folders the cli reads skills from in a workspace. the cli lets a later folder win,
// so the folder that wins is first here
const SKILL_ROOTS = ['.december', '.agents', '.agent', '.claude']
const SKILL_FILE_NAMES = ['SKILL.md', 'skill.md']
const MCP_CONFIG_DIR = '.december'
const MCP_CONFIG_PATH = `${MCP_CONFIG_DIR}/mcp.json`

/** true for the error prisma throws when a unique name is taken by a save at the same time */
const isNameTaken = (error: unknown) =>
    Boolean(error && typeof error === 'object' && (error as { code?: string }).code === 'P2002')

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
    try {
        const skill = await connectionRepository.upsertSkill(userId, currentName, {
            name,
            description,
            body,
            runs,
            enabled,
        })
        return { skill: toPublicSkill(skill) }
    } catch (error) {
        // two saves of the same new name at once: the second one loses
        if (isNameTaken(error)) throw new AppError(`A skill named ${name} already exists.`, 409)
        throw error
    }
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

    const existing = await connectionRepository.findMcpServer(userId, currentName)
    if (name !== currentName && (await connectionRepository.findMcpServer(userId, name))) {
        throw new AppError(`An mcp server named ${name} already exists.`, 409)
    }
    const { encryptedHeaders, headerKeys } = mergeHeaders(
        auth === 'header' ? headers : [],
        existing?.encryptedHeaders ?? null
    )
    // a header sent empty with no saved value is no header
    if (auth === 'header' && headerKeys.length === 0) {
        throw new AppError('Add the header that signs in to the server.', 400)
    }
    const sameHeaderNames =
        !!existing &&
        existing.headerKeys.length === headerKeys.length &&
        headerKeys.every((key) => existing.headerKeys.includes(key))
    const changedTarget =
        !existing ||
        existing.url !== url ||
        existing.transport !== transport ||
        !sameHeaderNames ||
        (auth === 'header' && headers.some((header) => header.value))

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
    try {
        const server = await connectionRepository.createMcpServer({ ...fields, userId })
        return { mcp: toPublicMcpServer(server) }
    } catch (error) {
        if (isNameTaken(error)) {
            throw new AppError(`An mcp server named ${name} already exists.`, 409)
        }
        throw error
    }
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
    const [skills, servers, plugins] = await Promise.all([
        connectionRepository.findSkills(userId),
        connectionRepository.findMcpServers(userId),
        pluginRepository.findPlugins(userId),
    ])
    const ownNames = new Set(skills.map((skill) => skill.name))
    // the skills of plugins that are on; a saved skill of the same name wins, like in a run
    const pluginSkills = plugins
        .filter((plugin) => plugin.enabled)
        .flatMap((plugin) =>
            (Array.isArray(plugin.skills) ? plugin.skills : []).map((skill) => {
                const row = (skill ?? {}) as { name?: unknown; description?: unknown }
                return {
                    name: String(row.name ?? ''),
                    description: String(row.description ?? ''),
                    plugin: plugin.name as string | null,
                }
            })
        )
        .filter((skill) => skill.name && !ownNames.has(skill.name))
    return {
        skills: [
            ...skills
                .filter((skill) => skill.enabled)
                .map((skill) => ({
                    name: skill.name,
                    description: skill.description,
                    plugin: null as string | null,
                })),
            ...pluginSkills,
        ],
        plugins: plugins.map((plugin) => ({ name: plugin.name, enabled: plugin.enabled })),
        mcps: servers.map((server) => ({
            name: server.name,
            enabled: server.enabled,
            status: server.status,
            lastError: server.lastError,
        })),
    }
}

/**
 * Reads the default branch of a repository with the user's own git token: the skill
 * folders the cli knows, the mcp config file and the rules files at the root.
 */
const readRepoSetup = async (data: RepoSetupRef): Promise<FoundSetup> => {
    const { userId, repoFullName, provider } = data
    const owner = splitRepoFullName(repoFullName)?.owner ?? ''
    const token = await platformService
        .resolveRepoToken({ userId, gitProvider: provider, owner })
        .catch((error) => {
            // 401 is for the december sign-in: a git host that is not connected is a 400
            if (error instanceof AppError && error.statusCode === 401) {
                throw new AppError(error.message, 400)
            }
            throw error
        })
    const host = getGitProvider(provider)
    const repo = { token, repoPath: repoFullName }

    // below the root a folder or file that is not there is an empty answer
    const orNull = <T>(read: Promise<T>): Promise<T | null> =>
        read.catch((error) => {
            if (isMissingOnHost(error)) return null
            throw error
        })

    try {
        // the root answers 404 when the user cannot read the repository
        const root = await host.listDir({ ...repo, path: '' })
        const rootDirs = new Set(root.filter((e) => e.type === 'dir').map((e) => e.name))
        const rootFiles = new Set(root.filter((e) => e.type === 'file').map((e) => e.name))

        const listings = await Promise.all(
            SKILL_ROOTS.filter((dir) => rootDirs.has(dir)).map((dir) =>
                orNull(host.listDir({ ...repo, path: `${dir}/skills` }))
            )
        )
        const folders = listings.flatMap((entries) =>
            (entries ?? [])
                .filter((entry) => entry.type === 'dir')
                .sort((a, b) => a.name.localeCompare(b.name))
        )

        const read = await mapInBatches(
            folders.slice(0, MAX_IMPORT_SKILL_FILES),
            IMPORT_READS_AT_ONCE,
            async (folder) => {
                for (const fileName of SKILL_FILE_NAMES) {
                    const path = `${folder.path}/${fileName}`
                    const file = await orNull(
                        host.readTextFile({ ...repo, path, maxBytes: MAX_IMPORT_FILE_BYTES })
                    )
                    if (file) return toFoundSkill(folder.name, path, file)
                }
                return null
            }
        )
        const skills = new Map<string, FoundSkill>()
        for (const skill of read) {
            if (!skill) continue
            const first = skills.get(skill.name)
            // a file that cannot be imported does not hide one that can
            if (!first || (!first.importable && skill.importable)) skills.set(skill.name, skill)
        }

        const mcpFile = rootDirs.has(MCP_CONFIG_DIR)
            ? await orNull(
                  host.readTextFile({
                      ...repo,
                      path: MCP_CONFIG_PATH,
                      maxBytes: MAX_IMPORT_FILE_BYTES,
                  })
              )
            : null

        // the rule files at the root become account rules
        const rules = await Promise.all(
            RULE_FILE_NAMES.filter((name) => rootFiles.has(name)).map(async (path) =>
                toFoundRule(
                    repoFullName,
                    path,
                    await orNull(host.readTextFile({ ...repo, path, maxBytes: RULE_MAX_BYTES }))
                )
            )
        )

        return {
            skills: [...skills.values()].sort((a, b) => a.name.localeCompare(b.name)),
            mcps: mcpFile?.content ? toFoundMcps(mcpFile.content) : [],
            rules,
            truncated: folders.length > MAX_IMPORT_SKILL_FILES,
        }
    } catch (error) {
        throw toRepoReadError(error)
    }
}

/** what a repository has to import, and which names the account has already */
const previewImport = async (data: RepoSetupRef) => {
    const { userId, repoFullName, provider } = data
    const [found, savedSkills, savedServers, savedRules] = await Promise.all([
        readRepoSetup({ userId, repoFullName, provider }),
        connectionRepository.findSkills(userId),
        connectionRepository.findMcpServers(userId),
        ruleRepository.findRules(userId),
    ])
    const skillNames = new Set(savedSkills.map((skill) => skill.name))
    const serverNames = new Set(savedServers.map((server) => server.name))
    const ruleNames = new Set(savedRules.map((rule) => rule.name))
    return {
        repoFullName,
        provider,
        skills: found.skills.map((skill) => toPreviewSkill(skill, skillNames.has(skill.name))),
        mcps: found.mcps.map((server) => toPreviewMcp(server, serverNames.has(server.name))),
        rules: found.rules.map((rule) => toPreviewRule(rule, ruleNames.has(rule.name))),
        truncated: found.truncated,
    }
}

/**
 * Imports the ticked names and rule files. The repository is read again here: nothing the browser sends
 * is saved. A name the account has already is skipped unless `overwrite` is set.
 */
const importSetup = async (data: ImportSetup) => {
    const { userId, repoFullName, provider, skills, mcps, rules, overwrite } = data
    const [found, savedSkills, savedServers, savedRules] = await Promise.all([
        readRepoSetup({ userId, repoFullName, provider }),
        connectionRepository.findSkills(userId),
        connectionRepository.findMcpServers(userId),
        ruleRepository.findRules(userId),
    ])

    const imported = { skills: [] as string[], mcps: [] as string[], rules: [] as string[] }
    const skipped: ImportSkipped[] = []

    let skillCount = savedSkills.length
    for (const name of new Set(skills)) {
        const skip = (reason: string) => skipped.push({ kind: 'skill', name, reason })
        const skill = found.skills.find((row) => row.name === name)
        const saved = savedSkills.find((row) => row.name === name)

        if (!skill) {
            skip('It is not in the repository.')
        } else if (!skill.importable || skill.body === null) {
            skip(skill.reason ?? 'It cannot be imported.')
        } else if (saved && !overwrite) {
            skip('A skill with this name exists already.')
        } else if (saved) {
            await connectionRepository.updateSkill(saved.id, {
                description: skill.description,
                body: skill.body,
            })
            imported.skills.push(name)
        } else if (skillCount >= MAX_SKILLS) {
            skip(`You can save up to ${MAX_SKILLS} skills.`)
        } else {
            await connectionRepository.upsertSkill(userId, name, {
                name,
                description: skill.description,
                body: skill.body,
                runs: 'agent',
                enabled: true,
            })
            skillCount++
            imported.skills.push(name)
        }
    }

    let serverCount = savedServers.length
    for (const name of new Set(mcps)) {
        const skip = (reason: string) => skipped.push({ kind: 'mcp', name, reason })
        const server = found.mcps.find((row) => row.name === name)
        const saved = savedServers.find((row) => row.name === name)

        if (!server) {
            skip('It is not in the repository.')
        } else if (!server.importable || server.url === null || server.transport === 'stdio') {
            skip(server.reason ?? 'It cannot be imported.')
        } else if (saved && !overwrite) {
            skip('An mcp server with this name exists already.')
        } else if (saved) {
            const sameUrl = saved.url === server.url
            await connectionRepository.updateMcpServer(saved.id, {
                url: server.url,
                transport: server.transport,
                // saved header values are never sent to a new address
                ...(sameUrl ? {} : { auth: 'none', encryptedHeaders: null, headerKeys: [] }),
                ...(sameUrl && saved.transport === server.transport
                    ? {}
                    : { status: 'unknown', lastError: null, checkedAt: null }),
            })
            imported.mcps.push(name)
        } else if (serverCount >= MAX_MCP_SERVERS) {
            skip(`You can save up to ${MAX_MCP_SERVERS} mcp servers.`)
        } else {
            // no header values: the user adds them, and a run sets the status
            await connectionRepository.createMcpServer({
                userId,
                name,
                url: server.url,
                transport: server.transport,
                auth: 'none',
                encryptedHeaders: null,
                headerKeys: [],
                enabled: true,
                disabledTools: [],
                status: 'unknown',
            })
            serverCount++
            imported.mcps.push(name)
        }
    }

    // a rule file becomes the account rule named after the repository and the file
    const ruleBytes = new Map(savedRules.map((rule) => [rule.name, utf8Bytes(rule.body)]))
    const totalRuleBytes = () => [...ruleBytes.values()].reduce((sum, size) => sum + size, 0)
    for (const path of new Set(rules)) {
        const rule = found.rules.find((row) => row.path === path)
        const skip = (reason: string) =>
            skipped.push({ kind: 'rule', name: rule?.name ?? path, reason })
        const saved = rule ? savedRules.find((row) => row.name === rule.name) : undefined
        const size = rule?.body ? utf8Bytes(rule.body) : 0

        if (!rule) {
            skip('It is not in the repository.')
        } else if (!rule.importable || rule.body === null) {
            skip(rule.reason ?? 'It cannot be imported.')
        } else if (saved && !overwrite) {
            skip('A rule with this name exists already.')
        } else if (!saved && ruleBytes.size >= RULES_PER_USER_MAX) {
            skip(`You can save up to ${RULES_PER_USER_MAX} rules.`)
        } else if (
            totalRuleBytes() - (ruleBytes.get(rule.name) ?? 0) + size >
            RULES_TOTAL_MAX_BYTES
        ) {
            skip('All rules together can be up to 32 KiB.')
        } else {
            if (saved) {
                await ruleRepository.updateRule(saved.id, { body: rule.body })
            } else {
                await ruleRepository.createRule({ userId, name: rule.name, body: rule.body })
            }
            ruleBytes.set(rule.name, size)
            imported.rules.push(rule.name)
        }
    }

    return { imported, skipped }
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
    previewImport,
    importSetup,
}
