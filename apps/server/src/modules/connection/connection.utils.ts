import { checkMcpUrl, parseSkillContent } from '@december/shared'
import { RULE_MAX_BYTES, RULE_NAME_PATTERN, utf8Bytes } from '@december/shared/agent-context'
import { decryptText, encryptText } from '@december/shared/crypto'
import { GitProviderError } from '@december/shared/git'

import { env } from '../../env'
import { AppError } from '../../shared/appError'

import type { FoundMcp, FoundRule, FoundSkill, McpHeader } from './connection.types'
import type { RepoTextFile } from '@december/shared/git'

type StoredMcpServer = {
    name: string
    url: string
    transport: string
    auth: string
    headerKeys: string[]
    enabled: boolean
    disabledTools: string[]
    status: string
    lastError: string | null
    tools: string[]
    checkedAt: Date | null
}

/** an mcp server as the web sees it: header names only, never their values */
export const toPublicMcpServer = (server: StoredMcpServer) => ({
    name: server.name,
    url: server.url,
    transport: server.transport,
    auth: server.auth,
    headerKeys: server.headerKeys,
    enabled: server.enabled,
    disabledTools: server.disabledTools,
    status: server.status,
    lastError: server.lastError,
    tools: server.tools,
    checkedAt: server.checkedAt,
})

export const readHeaders = (encrypted: string | null): Record<string, string> => {
    if (!encrypted) return {}
    try {
        const parsed = JSON.parse(
            decryptText({ encryptedText: encrypted, keyHex: env.SECRETS_ENC_KEY })
        )
        return parsed && typeof parsed === 'object' ? parsed : {}
    } catch (error) {
        console.error('[Connection] saved mcp headers could not be read', error)
        return {}
    }
}

/**
 * The headers to save: an empty value keeps the saved value of that header, a header
 * left out is removed. Returns the encrypted json and the names.
 */
export const mergeHeaders = (
    headers: McpHeader[],
    savedEncrypted: string | null
): { encryptedHeaders: string | null; headerKeys: string[] } => {
    const saved = readHeaders(savedEncrypted)
    const merged: Record<string, string> = {}
    for (const header of headers) {
        const value = header.value || saved[header.key]
        if (value) merged[header.key] = value
    }
    const headerKeys = Object.keys(merged)
    if (headerKeys.length === 0) return { encryptedHeaders: null, headerKeys }
    return {
        encryptedHeaders: encryptText({
            text: JSON.stringify(merged),
            keyHex: env.SECRETS_ENC_KEY,
        }),
        headerKeys,
    }
}

// import setup (#637 section 6): what a file of a repository holds

// the same limits as the save routes (connection.schema.ts)
const SKILL_NAME = /^[a-z0-9][a-z0-9-]{0,63}$/
const MCP_NAME = /^[A-Za-z0-9][A-Za-z0-9_-]{0,39}$/
const HEADER_NAME = /^[A-Za-z0-9-]{1,64}$/
const MAX_SKILL_DESCRIPTION = 300
const MAX_SKILL_BODY = 20_000
const MAX_MCP_URL = 500

const sentence = (text: string) => `${text.charAt(0).toUpperCase()}${text.slice(1)}.`

/** a url as the answer shows it: a user name or password in it is a secret */
const withoutCredentials = (value: string) => {
    try {
        const url = new URL(value)
        if (!url.username && !url.password) return value
        url.username = ''
        url.password = ''
        return url.toString()
    } catch {
        // Intentionally swallowed: text that is not a url is shown as it is
        return value
    }
}

/**
 * A skill file of a repository as an import row. `dirName` names the row when the file
 * cannot be read. Returns null for a skill its file turns off, like the cli.
 */
export const toFoundSkill = (
    dirName: string,
    path: string,
    file: RepoTextFile
): FoundSkill | null => {
    const unusable = (name: string, description: string, reason: string): FoundSkill => ({
        name,
        description,
        path,
        body: null,
        importable: false,
        reason,
    })

    if (file.content === null) {
        return unusable(dirName.toLowerCase(), '', 'The file is larger than 64 KB.')
    }

    let parsed: ReturnType<typeof parseSkillContent>
    try {
        parsed = parseSkillContent(file.content, path)
    } catch {
        // Intentionally swallowed: the row says why the file cannot be imported
        return unusable(
            dirName.toLowerCase(),
            '',
            'The file needs a name and a description at the top.'
        )
    }

    const { metadata, body } = parsed
    if (metadata.disable) return null

    const { name } = metadata
    const description =
        metadata.description.length > MAX_SKILL_DESCRIPTION
            ? `${metadata.description.slice(0, MAX_SKILL_DESCRIPTION - 3)}...`
            : metadata.description

    if (!SKILL_NAME.test(name)) {
        return unusable(
            name,
            description,
            'A skill name has lowercase letters, numbers and dashes.'
        )
    }
    if (!body) return unusable(name, description, 'The skill has no instructions.')
    if (body.length > MAX_SKILL_BODY) {
        return unusable(name, description, 'The instructions are longer than 20,000 characters.')
    }
    return { name, description, path, body, importable: true }
}

/**
 * The servers of an mcp config file (`mcpServers`, or the servers at the top level, like
 * the cli reads it). Header names are kept, header values and env values are not.
 */
export const toFoundMcps = (text: string): FoundMcp[] => {
    let parsed: unknown
    try {
        parsed = JSON.parse(text)
    } catch {
        // Intentionally swallowed: a file that is not json has no servers
        return []
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return []

    const isRecord = (value: unknown): value is Record<string, unknown> =>
        Boolean(value) && typeof value === 'object' && !Array.isArray(value)
    const top = parsed as Record<string, unknown>
    const servers = isRecord(top.mcpServers) ? top.mcpServers : top

    const found: FoundMcp[] = []
    for (const [name, raw] of Object.entries(servers)) {
        if (!isRecord(raw)) continue

        if (typeof raw.command === 'string' && raw.command.trim()) {
            found.push({
                name,
                url: null,
                transport: 'stdio',
                headerNames: [],
                importable: false,
                reason: 'It runs a command. Only a server with a url can be imported.',
            })
            continue
        }

        const candidate = raw.url || raw.endpoint || raw.sse
        if (typeof candidate !== 'string' || !candidate.trim()) continue
        const url = withoutCredentials(candidate.trim())
        // the cli reads an entry with no transport as sse
        const transport = raw.transport === 'http' || raw.type === 'http' ? 'http' : 'sse'
        const headerNames = isRecord(raw.headers)
            ? Object.keys(raw.headers).filter((key) => HEADER_NAME.test(key))
            : []

        // the check reads the url of the file, so a url with a password is refused
        const check = checkMcpUrl(candidate.trim())
        const reason = !MCP_NAME.test(name)
            ? 'A server name has letters, numbers, dashes and underscores.'
            : url.length > MAX_MCP_URL
              ? 'The url is too long.'
              : !check.ok
                ? sentence(check.reason)
                : undefined

        found.push({
            name,
            url: url.slice(0, MAX_MCP_URL),
            transport,
            headerNames,
            importable: !reason,
            ...(reason ? { reason } : {}),
        })
    }
    return found.sort((a, b) => a.name.localeCompare(b.name))
}

/**
 * The account rule a rule file of a repository becomes: named after the repository and the
 * file ("web-agents" for AGENTS.md of acme/web), in the rule name rules.
 */
export const ruleNameFor = (repoFullName: string, path: string): string => {
    const repo = repoFullName.split('/').pop() ?? 'repo'
    const file = path.replace(/\.md$/i, '')
    const name = `${repo}-${file}`
        .toLowerCase()
        .replace(/[^a-z0-9-]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-+|-+$/g, '')
    const short = name.slice(0, 64).replace(/-+$/, '')
    return RULE_NAME_PATTERN.test(short) ? short : 'repo-rules'
}

/** a rule file of a repository as an import row */
export const toFoundRule = (
    repoFullName: string,
    path: string,
    file: RepoTextFile | null
): FoundRule => {
    const name = ruleNameFor(repoFullName, path)
    const unusable = (reason: string): FoundRule => ({
        path,
        name,
        body: null,
        importable: false,
        reason,
    })
    if (!file) return unusable('The file could not be read.')
    if (file.content === null || utf8Bytes(file.content) > RULE_MAX_BYTES) {
        return unusable('The file is larger than 16 KiB.')
    }
    const body = file.content.trim()
    if (!body) return unusable('The file is empty.')
    return { path, name, body, importable: true }
}

/** a rule row of the preview: the text stays on the server */
export const toPreviewRule = (rule: FoundRule, exists: boolean) => ({
    path: rule.path,
    name: rule.name,
    exists,
    importable: rule.importable,
    ...(rule.reason ? { reason: rule.reason } : {}),
})

/** a skill row of the preview: the instructions stay on the server */
export const toPreviewSkill = (skill: FoundSkill, exists: boolean) => ({
    name: skill.name,
    description: skill.description,
    path: skill.path,
    exists,
    importable: skill.importable,
    ...(skill.reason ? { reason: skill.reason } : {}),
})

export const toPreviewMcp = (server: FoundMcp, exists: boolean) => ({
    name: server.name,
    url: server.url,
    transport: server.transport,
    headerNames: server.headerNames,
    exists,
    importable: server.importable,
    ...(server.reason ? { reason: server.reason } : {}),
    // the values stay in the repository: the user types them in after the import
    ...(server.importable && server.headerNames.length > 0
        ? { note: 'Add the header values after the import.' }
        : {}),
})

/** true for "not there" from the git host: below the root that is an empty answer */
export const isMissingOnHost = (error: unknown) =>
    error instanceof GitProviderError && error.status === 404

/** what the user is told when the repository cannot be read */
export const toRepoReadError = (error: unknown): AppError => {
    if (error instanceof AppError) return error
    if (error instanceof GitProviderError) {
        // github answers 404 for a private repository of another account
        if (error.status === 404 || error.status === 403) {
            return new AppError('Repository not found.', 404)
        }
        if (error.status === 401) {
            return new AppError('The git connection has expired. Connect it again.', 400)
        }
    }
    console.error('[Connection] the repository could not be read', error)
    return new AppError('The repository could not be read. Try again.', 502)
}

/** runs `task` for every item, `size` at a time, and keeps the order */
export const mapInBatches = async <T, R>(
    items: T[],
    size: number,
    task: (item: T) => Promise<R>
): Promise<R[]> => {
    const results: R[] = []
    for (let start = 0; start < items.length; start += size) {
        results.push(...(await Promise.all(items.slice(start, start + size).map(task))))
    }
    return results
}
