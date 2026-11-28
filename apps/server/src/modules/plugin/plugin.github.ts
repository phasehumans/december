/**
 * Reads a plugin from a public GitHub repository, safely (connections page, plugins).
 *
 * - The url is never taken from the user: the user gives owner/repo (or a github.com link),
 *   each part is checked, and the server builds one fixed https url on codeload.github.com.
 * - The host name is resolved first and refused when an address is not public, and a
 *   redirect is an error, so the request cannot reach an address inside the network.
 * - The download has a time limit and a size limit, the archive has an entry limit, and the
 *   unzipped size is capped. Nothing in the archive is run: it is read as data only.
 */
import { lookup } from 'node:dns/promises'
import { gunzipSync } from 'node:zlib'

import { isInternalAddress } from '@december/shared'

import { AppError } from '../../shared/appError'

import type { GithubPluginSource, RepoArchive, RepoArchiveEntry } from './plugin.types'

export const ARCHIVE_HOST = 'codeload.github.com'
/** the largest archive the server downloads */
export const MAX_ARCHIVE_BYTES = 20 * 1024 * 1024
/** the largest unzipped archive the server reads */
export const MAX_UNZIPPED_BYTES = 80 * 1024 * 1024
export const MAX_ARCHIVE_ENTRIES = 20_000
export const ARCHIVE_TIMEOUT_MS = 30_000

const OWNER = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/
const REPO = /^[A-Za-z0-9._-]{1,100}$/
const REF = /^[A-Za-z0-9._/-]{1,200}$/
const PATH_PART = /^[A-Za-z0-9._ @+-]{1,100}$/

const SOURCE_HELP = 'Use owner/repo or a github.com link.'

const isSafeRef = (ref: string) =>
    REF.test(ref) &&
    !ref.includes('..') &&
    !ref.startsWith('/') &&
    !ref.endsWith('/') &&
    !ref.startsWith('-') &&
    !ref.includes('//')

const isSafeRepo = (repo: string) => REPO.test(repo) && repo !== '.' && repo !== '..'

/** a folder in the repository: plain parts, no "..", no empty part */
export const normalizeRepoPath = (value: string): string | null => {
    const parts = value.split('/').filter((part) => part.length > 0)
    if (parts.length === 0) return ''
    if (parts.length > 20) return null
    for (const part of parts) {
        if (part === '.' || part === '..' || !PATH_PART.test(part)) return null
    }
    return parts.join('/')
}

const toSource = (data: {
    owner: string
    repo: string
    ref?: string
    path?: string
}): GithubPluginSource => {
    const { owner, path } = data
    const repo = data.repo.replace(/\.git$/, '')
    const ref = data.ref?.trim() || undefined
    if (!OWNER.test(owner) || !isSafeRepo(repo)) throw new AppError(SOURCE_HELP, 400)
    if (ref !== undefined && !isSafeRef(ref))
        throw new AppError('The branch name is not valid.', 400)
    const folder = path === undefined ? '' : normalizeRepoPath(path)
    if (folder === null) throw new AppError('The folder name is not valid.', 400)
    return {
        kind: 'github',
        owner,
        repo,
        ...(ref ? { ref } : {}),
        ...(folder ? { path: folder } : {}),
    }
}

/**
 * What a person typed, as a github source. The same forms as `december plugin install`
 * for GitHub: owner/repo, github:owner/repo, owner/repo#ref, and https://github.com links
 * (with .git, or /tree/<ref>/<folder>). Every other host, scheme or local path is refused.
 */
export const parseGithubSource = (input: string): GithubPluginSource => {
    const trimmed = input.trim()
    const value = /^(www\.)?github\.com\//i.test(trimmed) ? `https://${trimmed}` : trimmed
    if (!value || value.length > 300 || /\s/.test(value)) throw new AppError(SOURCE_HELP, 400)

    const shorthand = /^(?:github:)?([^/:@#]+)\/([^/:@#]+)(?:#(.+))?$/.exec(value)
    if (shorthand && !value.includes('://')) {
        const [, owner = '', repo = '', ref] = shorthand
        return toSource({ owner, repo, ref })
    }

    let url: URL
    try {
        url = new URL(value)
    } catch {
        // Intentionally swallowed: anything that is not a link or owner/repo is refused below
        throw new AppError(SOURCE_HELP, 400)
    }
    const host = url.hostname.toLowerCase()
    if (
        url.protocol !== 'https:' ||
        (host !== 'github.com' && host !== 'www.github.com') ||
        url.port ||
        url.username ||
        url.password ||
        url.search
    ) {
        throw new AppError(`Only public GitHub repositories can be installed. ${SOURCE_HELP}`, 400)
    }
    const parts = url.pathname.split('/').filter(Boolean)
    const [owner = '', repo = '', kind, ref, ...rest] = parts
    const hashRef = url.hash ? decodeURIComponent(url.hash.slice(1)) : undefined
    if (parts.length === 2) return toSource({ owner, repo, ref: hashRef })
    if (kind === 'tree' && ref && !hashRef) {
        return toSource({ owner, repo, ref, path: rest.join('/') })
    }
    throw new AppError(SOURCE_HELP, 400)
}

/** the one url the archive is read from; the ref goes in as a path, one part at a time */
export const archiveUrl = (source: GithubPluginSource): string => {
    const ref = (source.ref ?? 'HEAD').split('/').map(encodeURIComponent).join('/')
    return `https://${ARCHIVE_HOST}/${source.owner}/${source.repo}/tar.gz/${ref}`
}

export type AddressResolver = (hostname: string) => Promise<string[]>

const resolveWithSystem: AddressResolver = async (hostname) => {
    const answers = await lookup(hostname, { all: true, verbatim: true })
    return answers.map((answer) => answer.address)
}

/** refuses a host name with no answer, or with any answer that is not a public address */
export const checkPublicHost = async (
    hostname: string,
    resolve: AddressResolver = resolveWithSystem
): Promise<void> => {
    let addresses: string[]
    try {
        addresses = await resolve(hostname)
    } catch {
        // Intentionally swallowed: a name with no answer is refused with a fixed reason
        addresses = []
    }
    if (addresses.length === 0) throw new AppError('GitHub could not be reached.', 502)
    if (addresses.some((address) => isInternalAddress(address))) {
        throw new AppError('GitHub could not be reached.', 502)
    }
}

/** reads a body up to `limit` bytes, and stops the download past it */
const readCapped = async (response: Response, limit: number): Promise<Buffer> => {
    const declared = Number(response.headers.get('content-length') ?? '0')
    if (declared > limit) {
        await response.body?.cancel().catch(() => {
            // Intentionally swallowed: the answer is dropped anyway
        })
        throw new AppError('The repository is too big to install.', 413)
    }
    if (!response.body) return Buffer.alloc(0)
    const reader = response.body.getReader()
    const chunks: Uint8Array[] = []
    let total = 0
    for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        total += value.byteLength
        if (total > limit) {
            await reader.cancel().catch(() => {
                // Intentionally swallowed: the download stops here
            })
            throw new AppError('The repository is too big to install.', 413)
        }
        chunks.push(value)
    }
    return Buffer.concat(chunks)
}

export interface DownloadOptions {
    fetchImpl?: typeof fetch
    resolve?: AddressResolver
    timeoutMs?: number
    maxBytes?: number
}

/** downloads the .tar.gz of a public repository at a branch, a tag or the default branch */
export const downloadArchive = async (
    source: GithubPluginSource,
    options: DownloadOptions = {}
): Promise<Buffer> => {
    const {
        fetchImpl = fetch,
        resolve = resolveWithSystem,
        timeoutMs = ARCHIVE_TIMEOUT_MS,
        maxBytes = MAX_ARCHIVE_BYTES,
    } = options
    const url = archiveUrl(source)
    await checkPublicHost(new URL(url).hostname, resolve)

    let response: Response
    try {
        response = await fetchImpl(url, {
            redirect: 'manual',
            signal: AbortSignal.timeout(timeoutMs),
            headers: { 'user-agent': 'december-plugins', accept: 'application/x-gzip' },
        })
    } catch (error) {
        const timedOut = error instanceof Error && error.name === 'TimeoutError'
        throw new AppError(
            timedOut
                ? 'GitHub took too long to answer. Try again.'
                : 'GitHub could not be reached.',
            502
        )
    }
    if (response.status >= 300 && response.status < 400) {
        await response.body?.cancel().catch(() => {
            // Intentionally swallowed: a redirect is refused
        })
        throw new AppError('GitHub answered with a redirect.', 502)
    }
    if (response.status === 404) {
        await response.body?.cancel().catch(() => {
            // Intentionally swallowed: the answer is dropped
        })
        throw new AppError(
            'Repository or branch not found. Only public repositories can be installed.',
            404
        )
    }
    if (!response.ok) {
        await response.body?.cancel().catch(() => {
            // Intentionally swallowed: the answer is dropped
        })
        throw new AppError('GitHub could not send the repository. Try again.', 502)
    }
    try {
        return await readCapped(response, maxBytes)
    } catch (error) {
        if (error instanceof AppError) throw error
        const timedOut = error instanceof Error && error.name === 'TimeoutError'
        throw new AppError(
            timedOut
                ? 'GitHub took too long to send the repository. Try again.'
                : 'GitHub could not send the repository. Try again.',
            502
        )
    }
}

const readString = (block: Buffer, start: number, length: number) => {
    const raw = block.subarray(start, start + length)
    const end = raw.indexOf(0)
    return raw.subarray(0, end === -1 ? raw.length : end).toString('utf8')
}

const readOctal = (block: Buffer, start: number, length: number) => {
    const text = readString(block, start, length).trim()
    return text ? parseInt(text, 8) : 0
}

/** the records of a pax header: "<length> <key>=<value>\n" */
const readPax = (data: Buffer): Record<string, string> => {
    const records: Record<string, string> = {}
    let offset = 0
    while (offset < data.length) {
        const space = data.indexOf(0x20, offset)
        if (space === -1) break
        const length = parseInt(data.subarray(offset, space).toString('utf8'), 10)
        if (!Number.isFinite(length) || length <= 0) break
        const record = data.subarray(space + 1, offset + length - 1).toString('utf8')
        const equals = record.indexOf('=')
        if (equals > 0) records[record.slice(0, equals)] = record.slice(equals + 1)
        offset += length
    }
    return records
}

/** a path in the archive without its top folder (repo-<ref>/), or null when it is not safe */
const stripTopFolder = (name: string): string | null => {
    const parts = name.split('/').filter((part) => part.length > 0 && part !== '.')
    if (parts.length < 2) return null
    if (parts.some((part) => part === '..' || part.includes('\\') || part.includes('\0'))) {
        return null
    }
    return parts.slice(1).join('/')
}

/**
 * Reads a GitHub .tar.gz: the regular files with their paths (the top folder taken off)
 * and the commit sha that GitHub writes in the pax header. Links, devices and paths that
 * leave the folder are skipped.
 */
export const readArchive = (
    archive: Buffer,
    options: { maxUnzippedBytes?: number; maxEntries?: number } = {}
): RepoArchive => {
    const { maxUnzippedBytes = MAX_UNZIPPED_BYTES, maxEntries = MAX_ARCHIVE_ENTRIES } = options
    let tar: Buffer
    try {
        tar = gunzipSync(archive, { maxOutputLength: maxUnzippedBytes })
    } catch (error) {
        if (
            error instanceof RangeError ||
            (error as { code?: string })?.code === 'ERR_BUFFER_TOO_LARGE'
        ) {
            throw new AppError('The repository is too big to install.', 413)
        }
        throw new AppError('The repository archive could not be read.', 422)
    }

    const entries: RepoArchiveEntry[] = []
    let commitSha: string | null = null
    let longName: string | null = null
    let paxPath: string | null = null
    let offset = 0
    let count = 0

    while (offset + 512 <= tar.length) {
        const header = tar.subarray(offset, offset + 512)
        if (header.every((byte) => byte === 0)) break
        count += 1
        if (count > maxEntries) throw new AppError('The repository has too many files.', 413)

        const size = readOctal(header, 124, 12)
        const type = String.fromCharCode(header[156] ?? 0)
        const dataStart = offset + 512
        const dataEnd = dataStart + size
        if (dataEnd > tar.length)
            throw new AppError('The repository archive could not be read.', 422)
        const data = tar.subarray(dataStart, dataEnd)
        offset = dataStart + Math.ceil(size / 512) * 512

        if (type === 'g') {
            const comment = readPax(data).comment
            if (comment && /^[0-9a-f]{40}$/.test(comment)) commitSha = comment
            continue
        }
        if (type === 'x') {
            paxPath = readPax(data).path ?? null
            continue
        }
        if (type === 'L') {
            longName = readString(data, 0, data.length)
            continue
        }

        const prefix = readString(header, 345, 155)
        const shortName = readString(header, 0, 100)
        const name = paxPath ?? longName ?? (prefix ? `${prefix}/${shortName}` : shortName)
        paxPath = null
        longName = null

        // regular files only: no links, folders or devices
        if (type !== '0' && type !== '\0') continue
        const path = stripTopFolder(name)
        if (!path) continue
        entries.push({ path, mode: readOctal(header, 100, 8), data: Buffer.from(data) })
    }

    return { commitSha, entries }
}

export const pluginGithub = {
    parseGithubSource,
    downloadArchive,
    readArchive,
}
