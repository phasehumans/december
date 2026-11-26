import { Sandbox } from 'e2b'

import { AppError } from '../../shared/appError'

import type { FetchRepoArchive } from './platform.types'

export interface SandboxCommandOptions {
    sandboxId?: string | null
    sessionId?: string
    command: string
    cwd?: string
    timeoutMs?: number
    envs?: Record<string, string>
}

export interface SandboxCommandResult {
    exitCode: number
    stdout: string
    stderr: string
}

let mockSandboxRunner: ((options: SandboxCommandOptions) => Promise<SandboxCommandResult>) | null =
    null

export const setMockSandboxRunner = (
    runner: ((options: SandboxCommandOptions) => Promise<SandboxCommandResult>) | null
) => {
    mockSandboxRunner = runner
}

export const executeSandboxCommand = async (
    options: SandboxCommandOptions
): Promise<SandboxCommandResult> => {
    if (mockSandboxRunner) {
        return mockSandboxRunner(options)
    }

    const { sandboxId, command, cwd = '/workspace', timeoutMs = 120000, envs } = options

    const apiKey = process.env.E2B_API_KEY
    if (!apiKey || !sandboxId || sandboxId.startsWith('mock-') || process.env.NODE_ENV === 'test') {
        return {
            exitCode: 0,
            stdout: `mock-stdout for: ${command}`,
            stderr: '',
        }
    }

    const sandbox = await Sandbox.connect(sandboxId, { apiKey })
    let stdout = ''
    let stderr = ''

    const result = await sandbox.commands.run(command, {
        cwd,
        timeoutMs,
        envs,
        onStdout: (chunk: any) => {
            stdout += typeof chunk === 'string' ? chunk : chunk?.line || String(chunk)
        },
        onStderr: (chunk: any) => {
            stderr += typeof chunk === 'string' ? chunk : chunk?.line || String(chunk)
        },
    })

    return {
        exitCode: result.exitCode ?? 0,
        stdout,
        stderr,
    }
}

export const runSandboxGitArchive = async (options: {
    sandboxId?: string | null
    cwd?: string
}): Promise<Buffer> => {
    const { sandboxId, cwd = '/workspace' } = options

    if (mockSandboxRunner) {
        return Buffer.from('PK\x03\x04mock-git-archive')
    }

    const apiKey = process.env.E2B_API_KEY
    // only tests and local mock sandboxes get the stand-in archive; a real download never does
    if (process.env.NODE_ENV === 'test' || sandboxId?.startsWith('mock-')) {
        return Buffer.from('PK\x03\x04mock-git-archive')
    }
    if (!apiKey || !sandboxId) {
        throw new AppError('the sandbox of this session is not running', 503)
    }

    const sandbox = await Sandbox.connect(sandboxId, { apiKey })
    // the work as it is now: `git stash create` makes a commit of the changed tracked files
    // without touching the workspace, and prints nothing when there are no changes
    try {
        await sandbox.commands.run(
            'git archive -o /tmp/workspace.zip "$(git stash create)" 2>/dev/null || git archive -o /tmp/workspace.zip HEAD',
            { cwd, timeoutMs: 60000 }
        )
    } catch (error) {
        // the sdk throws on a non-zero exit: no git repository, or nothing committed yet
        console.warn('[Platform] git archive failed in the sandbox', error)
        throw new AppError('could not pack the files of the sandbox', 502)
    }

    const archiveData = await sandbox.files.read('/tmp/workspace.zip')
    return Buffer.from(archiveData as any)
}

type RepoArchiveFetch = (url: string, init: RequestInit) => Promise<Response>

const defaultRepoArchiveFetch: RepoArchiveFetch = (url, init) => fetch(url, init)
let repoArchiveFetch = defaultRepoArchiveFetch

/** for tests: the request to the git host */
export const setRepoArchiveFetch = (next: RepoArchiveFetch | null) => {
    repoArchiveFetch = next ?? defaultRepoArchiveFetch
}

/** the zip of a repository branch from GitHub or GitLab, as a stream */
export const fetchRepoArchive = async (
    data: FetchRepoArchive
): Promise<ReadableStream<Uint8Array>> => {
    const { gitProvider, owner, name, ref, token } = data
    const url =
        gitProvider === 'GITLAB'
            ? `https://gitlab.com/api/v4/projects/${encodeURIComponent(`${owner}/${name}`)}/repository/archive.zip${ref ? `?sha=${encodeURIComponent(ref)}` : ''}`
            : `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/zipball${ref ? `/${ref.split('/').map(encodeURIComponent).join('/')}` : ''}`
    const res = await repoArchiveFetch(url, {
        headers: {
            Authorization: `Bearer ${token}`,
            'User-Agent': 'december',
            ...(gitProvider === 'GITHUB' ? { Accept: 'application/vnd.github+json' } : {}),
        },
        redirect: 'follow',
    })
    if (!res.ok || !res.body) {
        throw new AppError(
            res.status === 404
                ? 'the branch of this session was not found in the repository'
                : 'could not download the repository',
            res.status === 404 ? 404 : 502
        )
    }
    return res.body
}

type ZipEntry = {
    path: string
    content: string
}

const crcTable = new Uint32Array(256)

for (let index = 0; index < 256; index += 1) {
    let current = index

    for (let bit = 0; bit < 8; bit += 1) {
        current = (current & 1) === 1 ? 0xedb88320 ^ (current >>> 1) : current >>> 1
    }

    crcTable[index] = current >>> 0
}

const crc32 = (bytes: Uint8Array) => {
    let crc = 0xffffffff

    for (const value of bytes) {
        crc = crcTable[(crc ^ value) & 0xff]! ^ (crc >>> 8)
    }

    return (crc ^ 0xffffffff) >>> 0
}

const concatBuffers = (chunks: Uint8Array[]) => {
    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
    const result = new Uint8Array(totalLength)
    let offset = 0

    for (const chunk of chunks) {
        result.set(chunk, offset)
        offset += chunk.length
    }

    return result
}

export const buildProjectZip = (entries: ZipEntry[]) => {
    const encoder = new TextEncoder()
    const localChunks: Uint8Array[] = []
    const centralChunks: Uint8Array[] = []
    let offset = 0

    for (const entry of entries) {
        const normalizedPath = entry.path.replace(/\\/g, '/')
        const nameBytes = encoder.encode(normalizedPath)
        const contentBytes = encoder.encode(entry.content)
        const checksum = crc32(contentBytes)
        const utf8Flag = 0x0800

        const localHeader = new Uint8Array(30 + nameBytes.length + contentBytes.length)
        const localView = new DataView(localHeader.buffer)
        localView.setUint32(0, 0x04034b50, true)
        localView.setUint16(4, 20, true)
        localView.setUint16(6, utf8Flag, true)
        localView.setUint16(8, 0, true)
        localView.setUint16(10, 0, true)
        localView.setUint16(12, 0, true)
        localView.setUint32(14, checksum, true)
        localView.setUint32(18, contentBytes.length, true)
        localView.setUint32(22, contentBytes.length, true)
        localView.setUint16(26, nameBytes.length, true)
        localView.setUint16(28, 0, true)
        localHeader.set(nameBytes, 30)
        localHeader.set(contentBytes, 30 + nameBytes.length)
        localChunks.push(localHeader)

        const centralHeader = new Uint8Array(46 + nameBytes.length)
        const centralView = new DataView(centralHeader.buffer)
        centralView.setUint32(0, 0x02014b50, true)
        centralView.setUint16(4, 20, true)
        centralView.setUint16(6, 20, true)
        centralView.setUint16(8, utf8Flag, true)
        centralView.setUint16(10, 0, true)
        centralView.setUint16(12, 0, true)
        centralView.setUint16(14, 0, true)
        centralView.setUint32(16, checksum, true)
        centralView.setUint32(20, contentBytes.length, true)
        centralView.setUint32(24, contentBytes.length, true)
        centralView.setUint16(28, nameBytes.length, true)
        centralView.setUint16(30, 0, true)
        centralView.setUint16(32, 0, true)
        centralView.setUint16(34, 0, true)
        centralView.setUint16(36, 0, true)
        centralView.setUint32(38, 0, true)
        centralView.setUint32(42, offset, true)
        centralHeader.set(nameBytes, 46)
        centralChunks.push(centralHeader)

        offset += localHeader.length
    }

    const centralDirectory = concatBuffers(centralChunks)
    const endRecord = new Uint8Array(22)
    const endView = new DataView(endRecord.buffer)
    endView.setUint32(0, 0x06054b50, true)
    endView.setUint16(4, 0, true)
    endView.setUint16(6, 0, true)
    endView.setUint16(8, entries.length, true)
    endView.setUint16(10, entries.length, true)
    endView.setUint32(12, centralDirectory.length, true)
    endView.setUint32(16, offset, true)
    endView.setUint16(20, 0, true)

    return concatBuffers([...localChunks, centralDirectory, endRecord])
}
