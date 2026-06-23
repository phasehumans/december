import { createHash } from 'node:crypto'
import { cp, mkdir, readdir, readFile, rm, stat } from 'node:fs/promises'
import { basename, dirname, join, relative, sep } from 'node:path'

import type {
    ImportValidationFile,
    ValidatedImportProject,
    PersistentImportSourceDir,
    PersistImportSourceLocally,
    ParsedGitHubRepo,
    VerifiedGitHubRepoAccess,
    GitHubRepoApiResponse,
} from '@december/shared'

export const IMPORT_STAGING_DIR = '.december-imports'

const IGNORED_DIRS = new Set([
    '.git',
    'node_modules',
    'dist',
    'build',
    '.next',
    '.turbo',
    '.cache',
    'coverage',
    '__MACOSX',
])

const toWorkspacePath = (path: string) => path.split(sep).join('/')

export const importStagingRootDir = () => {
    const cwd = process.cwd()
    const serverRoot = basename(cwd) === 'server' ? cwd : join(cwd, 'server')

    return join(serverRoot, IMPORT_STAGING_DIR)
}

export const cleanupImportDir = async (path?: string | null) => {
    if (!path) return
    await rm(path, { recursive: true, force: true }).catch(() => undefined)
}

export const persistentImportSourceDir = (data: PersistentImportSourceDir) => {
    const { userId, importId } = data
    return join(importStagingRootDir(), userId, importId, 'source')
}

export const persistImportSourceLocally = async (data: PersistImportSourceLocally) => {
    const { userId, importId, sourceDir } = data
    const targetDir = persistentImportSourceDir({ userId, importId })

    await rm(targetDir, { recursive: true, force: true })
    await mkdir(dirname(targetDir), { recursive: true })
    await cp(sourceDir, targetDir, {
        recursive: true,
        force: true,
        errorOnExist: false,
    })

    return targetDir
}

const guessContentType = (path: string) => {
    const lower = path.toLowerCase()
    if (lower.endsWith('.tsx')) return 'text/tsx; charset=utf-8'
    if (lower.endsWith('.ts')) return 'text/typescript; charset=utf-8'
    if (lower.endsWith('.jsx') || lower.endsWith('.js')) return 'text/javascript; charset=utf-8'
    if (lower.endsWith('.json')) return 'application/json; charset=utf-8'
    if (lower.endsWith('.css')) return 'text/css; charset=utf-8'
    if (lower.endsWith('.html')) return 'text/html; charset=utf-8'
    if (lower.endsWith('.md')) return 'text/markdown; charset=utf-8'
    if (lower.endsWith('.svg')) return 'image/svg+xml'
    if (lower.endsWith('.png')) return 'image/png'
    if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg'
    if (lower.endsWith('.webp')) return 'image/webp'
    if (lower.endsWith('.gif')) return 'image/gif'
    return 'application/octet-stream'
}

const detectFramework = (packageJson: Record<string, any>) => {
    const deps = {
        ...(packageJson.dependencies ?? {}),
        ...(packageJson.devDependencies ?? {}),
    }

    if (deps.vite || String(packageJson.scripts?.dev ?? '').includes('vite')) return 'vite'
    if (deps.react) return 'react'
    return 'bun'
}

const findProjectRoot = async (rootDir: string) => {
    const packagePath = join(rootDir, 'package.json')

    if (
        await stat(packagePath)
            .then((value) => value.isFile())
            .catch(() => false)
    ) {
        return rootDir
    }

    const entries = await readdir(rootDir, { withFileTypes: true })
    const directories = entries.filter(
        (entry) => entry.isDirectory() && !IGNORED_DIRS.has(entry.name)
    )

    if (directories.length === 1) {
        const nestedRoot = join(rootDir, directories[0]!.name)
        const nestedPackagePath = join(nestedRoot, 'package.json')

        if (
            await stat(nestedPackagePath)
                .then((value) => value.isFile())
                .catch(() => false)
        ) {
            return nestedRoot
        }
    }

    return rootDir
}

const collectFiles = async (rootDir: string) => {
    const files: ImportValidationFile[] = []
    let totalBytes = 0

    const walk = async (dir: string) => {
        const entries = await readdir(dir, { withFileTypes: true })

        for (const entry of entries) {
            if (entry.name.startsWith('.') && entry.name !== '.env.example') {
                if (entry.isDirectory() && IGNORED_DIRS.has(entry.name)) continue
            }

            if (entry.isDirectory() && IGNORED_DIRS.has(entry.name)) {
                continue
            }

            const absolutePath = join(dir, entry.name)

            if (entry.isDirectory()) {
                await walk(absolutePath)
                continue
            }

            if (!entry.isFile()) {
                continue
            }

            const fileStat = await stat(absolutePath)
            const workspacePath = toWorkspacePath(relative(rootDir, absolutePath))

            if (!workspacePath || workspacePath.startsWith('..')) {
                continue
            }

            if (fileStat.size > MAX_FILE_BYTES) {
                throw new Error(`File is too large: ${workspacePath}`)
            }

            totalBytes += fileStat.size

            if (totalBytes > MAX_UNCOMPRESSED_BYTES) {
                throw new Error('Project contains too much data')
            }

            if (files.length >= MAX_FILES) {
                throw new Error('Project contains too many files')
            }

            const content = await readFile(absolutePath)

            files.push({
                absolutePath,
                path: workspacePath,
                size: fileStat.size,
                contentType: guessContentType(workspacePath),
                sha256: createHash('sha256').update(content).digest('hex'),
            })
        }
    }

    await walk(rootDir)
    return { files, totalBytes }
}

export const validateImportProject = async (
    candidateRootDir: string
): Promise<ValidatedImportProject> => {
    const rootDir = await findProjectRoot(candidateRootDir)
    const packageJsonPath = join(rootDir, 'package.json')

    const packageExists = await stat(packageJsonPath)
        .then((value) => value.isFile())
        .catch(() => false)

    let packageJson: Record<string, any> = {}

    if (packageExists) {
        try {
            packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8')) as Record<string, any>
        } catch (err: any) {
            console.warn(`Failed to parse package.json: ${err.message}`)
        }
    }

    const { files, totalBytes } = await collectFiles(rootDir)

    let isValid = true
    let validationError: string | null = null

    if (files.length === 0) {
        isValid = false
        validationError = 'Project does not contain any importable files'
    }

    return {
        rootDir,
        files,
        totalBytes,
        detection: {
            framework: detectFramework(packageJson),
            packageJson,
        },
        isValid,
        validationError,
    }
}

export function parseGitHubRepoUrl(repoUrl: string): ParsedGitHubRepo {
    const raw = repoUrl.trim()

    if (!raw) {
        return {
            ok: false,
            error: 'Repository URL is required',
            code: 'EMPTY_INPUT',
        }
    }

    const sshMatch = raw.match(/^git@github\.com:([^/]+)\/([^/]+?)(?:\.git)?$/i)
    if (sshMatch) {
        const owner = sshMatch[1] as string
        const repo = sshMatch[2] as string

        return {
            ok: true,
            owner,
            repo,
            normalizedUrl: `https://github.com/${owner}/${repo}`,
        }
    }

    let candidate = raw

    if (/^www\.github\.com\//i.test(candidate)) {
        candidate = `https://${candidate}`
    } else if (/^github\.com\//i.test(candidate)) {
        candidate = `https://${candidate}`
    }

    let url: URL

    try {
        url = new URL(candidate)
    } catch {
        return {
            ok: false,
            error: 'Invalid URL format',
            code: 'INVALID_URL',
        }
    }

    const host = url.hostname.toLowerCase()

    if (host !== 'github.com' && host !== 'www.github.com') {
        return {
            ok: false,
            error: 'URL must be a github.com repository URL',
            code: 'NOT_GITHUB',
        }
    }

    const parts = url.pathname
        .replace(/^\/+|\/+$/g, '') // trim leading/trailing slashes
        .split('/')
        .filter(Boolean)

    if (parts.length < 2) {
        return {
            ok: false,
            error: 'URL is not a repository URL',
            code: 'NOT_REPO_URL',
        }
    }

    const [owner, repoRaw] = parts

    const repo = repoRaw!.replace(/\.git$/i, '')

    if (!owner || !repo) {
        return {
            ok: false,
            error: 'URL is not a repository URL',
            code: 'NOT_REPO_URL',
        }
    }

    return {
        ok: true,
        owner,
        repo,
        normalizedUrl: `https://github.com/${owner}/${repo}`,
    }
}

export async function verifyGitHubRepoAccess(
    owner: string,
    repo: string,
    accessToken?: string
): Promise<VerifiedGitHubRepoAccess> {
    const headers: Record<string, string> = {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'december',
    }

    if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`
    }

    let response: Response

    try {
        response = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
            method: 'GET',
            headers,
        })
    } catch {
        return {
            ok: false,
            error: 'Network error while contacting GitHub',
            code: 'NETWORK_ERROR',
        }
    }

    if (response.status === 404) {
        return {
            ok: false,
            error: 'Repository not found or you do not have access',
            code: 'NOT_FOUND_OR_NO_ACCESS',
        }
    }

    if (response.status === 403) {
        const remaining = response.headers.get('x-ratelimit-remaining')

        if (remaining === '0') {
            return {
                ok: false,
                error: 'GitHub API rate limit exceeded',
                code: 'RATE_LIMITED',
            }
        }
    }

    if (!response.ok) {
        return {
            ok: false,
            error: `GitHub API error: ${response.status}`,
            code: 'GITHUB_API_ERROR',
        }
    }

    const data = (await response.json()) as GitHubRepoApiResponse

    const resolvedOwner = data.owner?.login ?? owner
    const resolvedRepo = data.name ?? repo
    const isPrivate = Boolean(data.private)

    return {
        ok: true,
        owner: resolvedOwner,
        repo: resolvedRepo,
        normalizedUrl: data.html_url ?? `https://github.com/${resolvedOwner}/${resolvedRepo}`,
        cloneUrl: data.clone_url ?? `https://github.com/${resolvedOwner}/${resolvedRepo}.git`,
        defaultBranch: data.default_branch ?? null,
        archived: Boolean(data.archived),
        disabled: Boolean(data.disabled),
        visibility: isPrivate ? 'private' : 'public',
        canAccess: true,
    }
}
