/**
 * The user's saved skills and remote mcp servers in a cloud run (#632 section 2).
 * Skills the agent may run go into the user rules, skills picked for a message go into
 * the turn prompt, and each mcp server that is on is connected for the run.
 */
import { prisma } from '@december/database'
import { checkMcpUrl } from '@december/shared'
import { decryptText } from '@december/shared/crypto'
import { createGuardedMcpFetch, MCP_REFUSAL_REASONS } from '@december/tools'

import { resolveSecretsEncKey } from './llm-source'

export type SkillRow = {
    name: string
    description: string
    body: string
    /** agent: the agent may run it by itself; user: only when the user picks it */
    runs: string
    enabled: boolean
}

/** skills are written in full up to this many characters, then by name and description */
export const SKILL_RULES_LIMIT = 8000
/** past this the section stops, so 100 skills with long descriptions stay bounded */
export const SKILL_RULES_HARD_LIMIT = 16_000

const SKILL_RULES_HEADING = [
    '## Skills',
    'The user saved these skills. When a task matches a skill, follow its steps.',
].join('\n')

const oneLine = (text: string) => text.replace(/\s+/g, ' ').trim()

/** a list of names from job data: anything that is not a list of strings is no names */
export const readNameList = (value: unknown): string[] =>
    Array.isArray(value)
        ? value.filter((item): item is string => typeof item === 'string' && item.length > 0)
        : []

/**
 * The "skills" section of the user rules: every skill that is on and that the agent
 * may run by itself. A skill goes in full while the section stays under the limit.
 * A skill that does not fit is listed with its name and description only.
 */
export const buildSkillRules = (skills: SkillRow[]): string => {
    const usable = skills.filter((skill) => skill.enabled && skill.runs === 'agent')
    if (usable.length === 0) return ''

    const full: string[] = []
    const short: string[] = []
    let used = SKILL_RULES_HEADING.length
    for (const skill of usable) {
        const block = `### ${skill.name}\n${oneLine(skill.description)}\n\n${skill.body.trim()}`
        if (used + block.length + 2 <= SKILL_RULES_LIMIT) {
            full.push(block)
            used += block.length + 2
        } else {
            short.push(`- ${skill.name}: ${oneLine(skill.description)}`)
        }
    }

    const parts = [SKILL_RULES_HEADING, ...full]
    if (short.length > 0) {
        const listed: string[] = []
        for (const line of short) {
            if (used + line.length + 1 > SKILL_RULES_HARD_LIMIT) break
            listed.push(line)
            used += line.length + 1
        }
        const left = short.length - listed.length
        parts.push(
            [
                'These skills did not fit here. Each one is sent in full when the user picks it with /name:',
                ...listed,
                ...(left > 0 ? [`and ${left} more.`] : []),
            ].join('\n')
        )
    }
    return parts.join('\n\n')
}

/**
 * The skills the user picked with /name for this message: saved skills that are on.
 * A name with no saved skill, or with a skill turned off, is skipped.
 */
export const pickTurnSkills = (data: { skills: SkillRow[]; names: string[] }): SkillRow[] => {
    const { skills, names } = data
    const picked: SkillRow[] = []
    for (const name of new Set(names)) {
        const skill = skills.find((item) => item.name === name && item.enabled)
        if (skill) picked.push(skill)
    }
    return picked
}

/** the picked skills of one message take at most this many characters in the prompt */
export const PICKED_SKILLS_LIMIT = 30_000
const CUT_NOTE = '[cut: the picked skills are over the size limit of one message]'

/**
 * The picked skills in full, after what the user typed. All of them together stay under
 * `PICKED_SKILLS_LIMIT`: the skill that crosses the limit is cut with a note, and the
 * skills after it are listed by name only.
 */
export const withPickedSkills = (
    prompt: string,
    skills: Array<Pick<SkillRow, 'name' | 'description' | 'body'>>
): string => {
    if (skills.length === 0) return prompt
    const blocks: string[] = []
    const leftOut: string[] = []
    let left = PICKED_SKILLS_LIMIT
    for (const skill of skills) {
        if (left <= 0) {
            leftOut.push(skill.name)
            continue
        }
        const text = `${oneLine(skill.description)}\n\n${skill.body.trim()}`
        const fits = text.length <= left
        blocks.push(
            `<skill name="${skill.name}">\n${fits ? text : `${text.slice(0, left)}\n${CUT_NOTE}`}\n</skill>`
        )
        left = fits ? left - text.length : 0
    }
    if (leftOut.length > 0) {
        blocks.push(`Not sent, the size limit was reached: ${leftOut.join(', ')}.`)
    }
    return `${prompt}

<picked-skills>
The user picked these skills for this message. Follow their steps.

${blocks.join('\n\n')}
</picked-skills>`
}

export type McpServerRow = {
    id: string
    name: string
    url: string
    /** http (streamable http) or sse */
    transport: string
    /** none or header */
    auth: string
    encryptedHeaders: string | null
    enabled: boolean
    disabledTools: string[]
}

/** what the agent gets for one server; the shape of an mcp server config in @december/tools */
export type McpRunConfig = {
    url: string
    transport: 'http' | 'sse'
    headers?: Record<string, string>
    disabledTools: string[]
    eager: true
}

/** what a run found about a server; saved on its row */
export type McpCheck =
    | { status: 'connected'; lastError: null; tools: string[] }
    | { status: 'error'; lastError: string }

type McpRefusal = { server: McpServerRow; check: McpCheck }
type McpConnection = { server: McpServerRow; config: McpRunConfig }

const UNREADABLE_HEADERS = 'the saved headers cannot be read, save the server again'

/**
 * The servers this run connects to: every saved server that is on and not turned off
 * for the session. The url is checked again here, because the worker connects from
 * inside december's network. The address behind the name is checked at connect time
 * by the guarded fetch (`createGuardedMcpFetch` in @december/tools). A server with a bad url or with headers that cannot be
 * read is not connected and gets an error status.
 */
export const buildMcpConfigs = (data: {
    servers: McpServerRow[]
    disabledMcps: string[]
    readHeaders: (encrypted: string) => Record<string, string>
}): { connect: McpConnection[]; refused: McpRefusal[] } => {
    const { servers, disabledMcps, readHeaders } = data
    const off = new Set(disabledMcps)
    const connect: McpConnection[] = []
    const refused: McpRefusal[] = []

    for (const server of servers) {
        if (!server.enabled || off.has(server.name)) continue

        const url = checkMcpUrl(server.url)
        // "=== false": the worker compiles without strict null checks, so "!url.ok" does not narrow
        if (url.ok === false) {
            refused.push({ server, check: { status: 'error', lastError: url.reason } })
            continue
        }

        let headers: Record<string, string> | undefined
        if (server.auth === 'header') {
            try {
                headers = server.encryptedHeaders ? readHeaders(server.encryptedHeaders) : {}
            } catch {
                // Intentionally swallowed: reported as the error status of the server below
                headers = {}
            }
            if (Object.keys(headers).length === 0) {
                refused.push({
                    server,
                    check: { status: 'error', lastError: UNREADABLE_HEADERS },
                })
                continue
            }
        }

        connect.push({
            server,
            config: {
                url: server.url,
                transport: server.transport === 'sse' ? 'sse' : 'http',
                ...(headers ? { headers } : {}),
                disabledTools: server.disabledTools,
                eager: true,
            },
        })
    }
    return { connect, refused }
}

const NOT_CONNECTED = 'the server did not connect'

/** a fixed reason for an http status; the text of the answer is never used */
const statusReason = (status: number): string => {
    if (status === 401 || status === 403) return 'the server refused the sign-in'
    if (status === 404) return 'the server was not found at this url'
    if (status === 429) return 'the server got too many requests'
    if (status >= 300 && status < 400) return 'the server answered with a redirect'
    if (status >= 500) return 'the server failed'
    return 'the server refused the request'
}

/**
 * The error text of a server that did not connect: the http status and a short fixed
 * reason only. The server chooses the text of its answer, and that text could be a page
 * from inside the network, so no part of it is saved or shown (review A2).
 */
const mcpErrorText = (info: { error?: string; errorStatus?: number; errorReason?: string }) => {
    if (info.errorReason && MCP_REFUSAL_REASONS.includes(info.errorReason)) return info.errorReason
    const fromText = /^HTTP (\d{3})\b/.exec(info.error ?? '')?.[1]
    const status = info.errorStatus ?? (fromText ? Number(fromText) : undefined)
    if (status && status >= 300 && status <= 599) return `HTTP ${status}: ${statusReason(status)}`
    return NOT_CONNECTED
}

/** the status a run saves for a server, from what the mcp client reports about it */
export const toMcpCheck = (
    info:
        | {
              status: string
              error?: string
              errorStatus?: number
              errorReason?: string
              availableTools?: string[]
              tools: Array<{ name: string }>
          }
        | undefined
): McpCheck => {
    if (info?.status === 'connected') {
        return { status: 'connected', lastError: null, tools: info.availableTools ?? [] }
    }
    return { status: 'error', lastError: mcpErrorText(info ?? {}) }
}

type McpClientInfo = Parameters<typeof toMcpCheck>[0]

/** about 20 seconds for one server to connect and list its tools */
export const MCP_CONNECT_TIMEOUT_MS = 20_000
const TIMED_OUT = Symbol('timed out')

/**
 * Connects the user's mcp servers for one run, all at the same time, and saves what
 * each one answered. A server that fails, or that takes too long, gets an error status:
 * it never fails the run or the other servers. Header values are never logged.
 */
export const connectUserMcpServers = async (data: {
    servers: McpServerRow[]
    disabledMcps: string[]
    readHeaders: (encrypted: string) => Record<string, string>
    /** connects one server for the agent and returns what the mcp client reports */
    connect: (name: string, config: McpRunConfig) => Promise<McpClientInfo>
    /** removes a server that connected after its time was up */
    drop?: (name: string) => unknown
    save: (id: string, check: McpCheck & { checkedAt: Date }) => Promise<unknown>
    timeoutMs?: number
    now?: () => Date
}): Promise<Array<{ name: string; status: McpCheck['status'] }>> => {
    const {
        servers,
        disabledMcps,
        readHeaders,
        connect,
        drop,
        save,
        timeoutMs = MCP_CONNECT_TIMEOUT_MS,
        now = () => new Date(),
    } = data
    const plan = buildMcpConfigs({ servers, disabledMcps, readHeaders })

    const connectOne = async ({ server, config }: McpConnection): Promise<McpCheck> => {
        let timer: ReturnType<typeof setTimeout> | undefined
        const attempt = Promise.resolve().then(() => connect(server.name, config))
        const timeout = new Promise<typeof TIMED_OUT>((resolve) => {
            timer = setTimeout(() => resolve(TIMED_OUT), timeoutMs)
        })
        try {
            const info = await Promise.race([attempt, timeout])
            if (info === TIMED_OUT) {
                const dropServer = () =>
                    Promise.resolve()
                        .then(() => drop?.(server.name))
                        .catch(() => {
                            // Intentionally swallowed: the server already has its error status
                        })
                // the connection that still hangs is closed now
                await dropServer()
                // and a late answer must not add tools in the middle of the run
                attempt.then(dropServer, dropServer)
                return { status: 'error', lastError: 'the server did not answer in time' }
            }
            return toMcpCheck(info)
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error)
            return toMcpCheck({ status: 'error', error: message, tools: [] })
        } finally {
            clearTimeout(timer)
        }
    }

    const checks = await Promise.all([
        ...plan.refused,
        ...plan.connect.map(async (item) => ({
            server: item.server,
            check: await connectOne(item),
        })),
    ])

    return Promise.all(
        checks
            .sort((a, b) => servers.indexOf(a.server) - servers.indexOf(b.server))
            .map(async ({ server, check }) => {
                console.log(
                    check.status === 'connected'
                        ? `[WORKER] mcp server '${server.name}' connected (${check.tools.length} tools)`
                        : `[WORKER] mcp server '${server.name}' not connected: ${check.lastError}`
                )
                await save(server.id, { ...check, checkedAt: now() }).catch((error: unknown) => {
                    console.warn(
                        `[WORKER] could not save the status of mcp server '${server.name}':`,
                        error
                    )
                })
                return { name: server.name, status: check.status }
            })
    )
}

const NO_CONNECTIONS = { skills: [] as SkillRow[], mcpServers: [] as McpServerRow[] }

/**
 * The user's saved skills and mcp servers that are on. A run with no user, or a read
 * that fails, has none: the run goes on without them.
 */
export const loadUserConnections = async (userId: string | undefined) => {
    if (!userId) return NO_CONNECTIONS
    try {
        const [skills, mcpServers] = await Promise.all([
            prisma.userSkill.findMany({
                where: { userId, enabled: true },
                orderBy: { name: 'asc' },
                select: { name: true, description: true, body: true, runs: true, enabled: true },
            }),
            prisma.userMcpServer.findMany({
                where: { userId, enabled: true },
                orderBy: { name: 'asc' },
                select: {
                    id: true,
                    name: true,
                    url: true,
                    transport: true,
                    auth: true,
                    encryptedHeaders: true,
                    enabled: true,
                    disabledTools: true,
                },
            }),
        ])
        return { skills, mcpServers }
    } catch (error) {
        console.warn('[WORKER] could not load the saved skills and mcp servers:', error)
        return NO_CONNECTIONS
    }
}

/** the saved headers of a server; throws when they cannot be read */
export const readMcpHeaders = (encrypted: string): Record<string, string> => {
    const keyHex = resolveSecretsEncKey()
    if (!keyHex) throw new Error('SECRETS_ENC_KEY is not set')
    const parsed: unknown = JSON.parse(decryptText({ encryptedText: encrypted, keyHex }))
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    const headers: Record<string, string> = {}
    for (const [key, value] of Object.entries(parsed)) {
        if (typeof value === 'string' && value) headers[key] = value
    }
    return headers
}

/** saves what the run found; a server deleted in the meantime is left alone */
export const saveMcpCheck = (id: string, check: McpCheck & { checkedAt: Date }) =>
    prisma.userMcpServer.updateMany({ where: { id }, data: check })

/** the parts of the agent the mcp servers of a run need */
type McpAgent = {
    initMcpServers: (
        configs: Record<string, McpRunConfig>,
        options?: { remoteFetch?: ReturnType<typeof createGuardedMcpFetch> }
    ) => Promise<void>
    unregisterMcpServerTools: (serverName: string) => void
    mcpClientManager?: {
        getServer: (name: string) => McpClientInfo
        removeServer: (name: string) => Promise<void>
        disconnectAll: () => Promise<void>
    }
}

const guardedMcpFetch = createGuardedMcpFetch()

/** connects the user's mcp servers to the agent of this run and saves their status */
export const connectAgentMcpServers = (data: {
    agent: McpAgent
    servers: McpServerRow[]
    disabledMcps: string[]
}) => {
    const { agent, servers, disabledMcps } = data
    return connectUserMcpServers({
        servers,
        disabledMcps,
        readHeaders: readMcpHeaders,
        connect: async (name, config) => {
            // every request resolves the name, refuses internal addresses and redirects
            await agent.initMcpServers({ [name]: config }, { remoteFetch: guardedMcpFetch })
            return agent.mcpClientManager?.getServer(name)
        },
        drop: (name) => {
            agent.unregisterMcpServerTools(name)
            return agent.mcpClientManager?.removeServer(name)
        },
        save: saveMcpCheck,
    })
}

/** closes the mcp connections of a run that ended; a new run connects again */
export const disconnectAgentMcpServers = async (agent: McpAgent) => {
    await agent.mcpClientManager?.disconnectAll().catch((error: unknown) => {
        console.warn('[WORKER] could not close the mcp connections of the run:', error)
    })
}
