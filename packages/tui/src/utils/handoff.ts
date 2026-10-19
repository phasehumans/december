import { execFile } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

export const MAX_HANDOFF_FILE_COUNT = 20_000
export const MAX_HANDOFF_UNCOMPRESSED_SIZE_BYTES = 500 * 1024 * 1024 // 500MB
export const MAX_HANDOFF_COMPRESSED_SIZE_BYTES = 100 * 1024 * 1024 // 100MB

export const MANDATORY_HANDOFF_EXCLUDES = [
    'node_modules',
    'node_modules/**',
    '.git',
    '.git/**',
    '.git/config',
    '.december-handoff.tar.gz',
    '.env',
    '.env.*',
    '*.env',
    '*.env.*',
    '*.pem',
    '*.key',
    '*.cert',
    '*.crt',
    '*.p12',
    '*.pfx',
    'id_rsa',
    'id_rsa.*',
    'id_ed25519',
    'id_ed25519.*',
    '.netrc',
    '.docker',
    '.docker/**',
    '.docker/config.json',
    '.kube',
    '.kube/**',
    '.kube/config',
    '.gnupg',
    '.gnupg/**',
    '.azure',
    '.azure/**',
    '.gcp',
    '.gcp/**',
    '.oci',
    '.oci/**',
    '.aws',
    '.aws/**',
    '.ssh',
    '.ssh/**',
    '.npmrc',
    '.pypirc',
    '.december/config.json',
    '.december/logs',
    '.december/logs/**',
    '*.log',
    '.*_history',
    '*_history',
    '.next',
    '.next/**',
    'dist',
    'dist/**',
    'build',
    'build/**',
]

export const COMMON_SECRET_PATTERNS = [
    { name: 'OpenAI API Key', regex: /sk-[a-zA-Z0-9_-]{20,}/ },
    { name: 'GitHub Personal Access Token', regex: /(?:ghp|gho|ghu|ghs|ghr)_[a-zA-Z0-9]{36,}/ },
    { name: 'GitLab Personal Access Token', regex: /glpat-[a-zA-Z0-9_-]{20,}/ },
    { name: 'Slack Token', regex: /xox[baprs]-[0-9a-zA-Z-]{10,}/ },
    { name: 'Google API Key', regex: /AIza[0-9A-Za-z-_]{35}/ },
    {
        name: 'AWS Access Key ID',
        regex: /(?:A3T[A-Z0-9]|AKIA|AGPA|AIDA|AROA|AIPA|ANPA|ANVA|ASIA)[A-Z0-9]{16}/,
    },
    { name: 'Private Key Header', regex: /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/ },
]

export function isPathExcluded(relPath: string, excludes: string[]): boolean {
    const normalized = relPath.replace(/\\/g, '/').replace(/^\.\//, '')
    if (!normalized || normalized === '.') return false

    const basename = normalized.split('/').pop() || normalized

    for (const pattern of excludes) {
        const cleanPattern = pattern.replace(/\\/g, '/').replace(/^\.\//, '')
        if (normalized === cleanPattern) return true

        // Directory match: pattern "node_modules" matches "node_modules/..."
        if (normalized.startsWith(cleanPattern + '/')) return true

        // Wildcard "dir/**"
        if (cleanPattern.endsWith('/**')) {
            const prefix = cleanPattern.slice(0, -3)
            if (normalized === prefix || normalized.startsWith(prefix + '/')) return true
        }

        // Basename extension match: "*.pem", "*.key"
        if (cleanPattern.startsWith('*.')) {
            const ext = cleanPattern.slice(1)
            if (basename.endsWith(ext)) return true
        }

        // Hidden history match: ".*_history"
        if (cleanPattern.startsWith('.*')) {
            const suffix = cleanPattern.slice(2)
            if (basename.startsWith('.') && basename.endsWith(suffix)) return true
        }

        // Suffix match: "*_history"
        if (cleanPattern.startsWith('*_')) {
            const suffix = cleanPattern.slice(1)
            if (basename.endsWith(suffix)) return true
        }

        // Prefix match: "id_rsa.*"
        if (cleanPattern.endsWith('.*')) {
            const prefix = cleanPattern.slice(0, -2)
            if (basename === prefix || basename.startsWith(prefix + '.')) return true
        }
    }

    return false
}

export function getHandoffExcludes(baseDir: string = process.cwd()): string[] {
    const excludes = [...MANDATORY_HANDOFF_EXCLUDES]

    const readIgnoreFile = (fileName: string) => {
        const filePath = path.join(baseDir, fileName)
        try {
            if (fs.existsSync(filePath)) {
                const lines = fs.readFileSync(filePath, 'utf8').split('\n')
                for (const line of lines) {
                    const trimmed = line.trim()
                    if (trimmed && !trimmed.startsWith('#')) {
                        const cleanPattern = trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed
                        excludes.push(cleanPattern)
                    }
                }
            }
        } catch {
            // Intentionally swallowed: ignore unreadable ignore files
        }
    }

    readIgnoreFile('.gitignore')
    readIgnoreFile('.decemberignore')

    return Array.from(new Set(excludes))
}

export interface WorkspaceScanResult {
    fileCount: number
    uncompressedSizeBytes: number
    outsideSymlinks: string[]
    detectedSecrets: string[]
}

export interface ScanWorkspaceOptions {
    maxFiles?: number
    maxUncompressedBytes?: number
}

export function scanWorkspaceForHandoff(
    baseDir: string = process.cwd(),
    options: ScanWorkspaceOptions = {}
): WorkspaceScanResult {
    const maxFiles = options.maxFiles ?? MAX_HANDOFF_FILE_COUNT
    const maxUncompressedBytes = options.maxUncompressedBytes ?? MAX_HANDOFF_UNCOMPRESSED_SIZE_BYTES

    const excludes = getHandoffExcludes(baseDir)
    const resolvedBaseDir = path.resolve(baseDir)
    let fileCount = 0
    let uncompressedSizeBytes = 0
    const outsideSymlinks: string[] = []
    const detectedSecrets: string[] = []

    const walk = (currentDir: string) => {
        let entries: fs.Dirent[] = []
        try {
            entries = fs.readdirSync(currentDir, { withFileTypes: true })
        } catch {
            // Intentionally swallowed: skip unreadable directories
            return
        }

        for (const entry of entries) {
            const fullPath = path.join(currentDir, entry.name)
            const relPath = path.relative(resolvedBaseDir, fullPath).replace(/\\/g, '/')

            if (isPathExcluded(relPath, excludes)) {
                continue
            }

            let isSymlink = false
            try {
                const lstat = fs.lstatSync(fullPath)
                isSymlink = lstat.isSymbolicLink()
            } catch {
                // Intentionally swallowed: cannot stat file
                continue
            }

            if (isSymlink) {
                let targetResolved: string
                try {
                    const linkTarget = fs.readlinkSync(fullPath)
                    targetResolved = path.resolve(path.dirname(fullPath), linkTarget)
                } catch {
                    // Intentionally swallowed: unresolvable symlink treated as outside
                    outsideSymlinks.push(relPath)
                    continue
                }

                const isInside =
                    targetResolved === resolvedBaseDir ||
                    targetResolved.startsWith(resolvedBaseDir + path.sep)

                if (!isInside) {
                    outsideSymlinks.push(relPath)
                    continue
                }
            }

            let stat: fs.Stats
            try {
                stat = fs.statSync(fullPath)
            } catch {
                // Intentionally swallowed: stat failure
                continue
            }

            if (stat.isDirectory()) {
                walk(fullPath)
            } else if (stat.isFile()) {
                fileCount++
                if (fileCount > maxFiles) {
                    throw new Error(
                        `Workspace exceeds maximum limit of ${maxFiles.toLocaleString()} files (found >${fileCount}).`
                    )
                }

                uncompressedSizeBytes += stat.size
                if (uncompressedSizeBytes > maxUncompressedBytes) {
                    const sizeMb = (uncompressedSizeBytes / (1024 * 1024)).toFixed(1)
                    throw new Error(
                        `Workspace exceeds maximum uncompressed size of ${(maxUncompressedBytes / (1024 * 1024)).toFixed(0)}MB (found ${sizeMb}MB).`
                    )
                }

                // Scan text files under 512KB for common secrets
                if (stat.size <= 512 * 1024) {
                    try {
                        const content = fs.readFileSync(fullPath, 'utf8')
                        for (const secretPattern of COMMON_SECRET_PATTERNS) {
                            if (secretPattern.regex.test(content)) {
                                detectedSecrets.push(
                                    `Potential ${secretPattern.name} detected in ${relPath}`
                                )
                                break
                            }
                        }
                    } catch {
                        // Intentionally swallowed: ignore non-UTF-8 or unreadable files
                    }
                }
            }
        }
    }

    walk(resolvedBaseDir)

    return {
        fileCount,
        uncompressedSizeBytes,
        outsideSymlinks,
        detectedSecrets,
    }
}

export async function createWorkspaceArchive(
    archivePath: string = '.december-handoff.tar.gz',
    baseDir: string = process.cwd(),
    options: ScanWorkspaceOptions = {}
): Promise<WorkspaceScanResult> {
    const resolvedBaseDir = path.resolve(baseDir)
    const scanResult = scanWorkspaceForHandoff(resolvedBaseDir, options)

    const excludes = getHandoffExcludes(resolvedBaseDir)
    for (const outsideLink of scanResult.outsideSymlinks) {
        excludes.push(outsideLink)
    }

    const archiveRelPath = path.isAbsolute(archivePath)
        ? path.relative(resolvedBaseDir, archivePath).replace(/\\/g, '/')
        : archivePath.replace(/\\/g, '/')
    excludes.push(archiveRelPath)
    excludes.push(path.basename(archiveRelPath))

    const uniqueExcludes = Array.from(new Set(excludes))
    const excludeArgs = uniqueExcludes.map((ex) => `--exclude=${ex}`)
    const args = ['-czf', archivePath, ...excludeArgs, '.']

    const home = process.env.HOME || process.env.USERPROFILE || os.homedir()
    const globalArtifactsDir = path.join(home, '.december', 'artifacts')
    const localArtifactsDir = path.join(resolvedBaseDir, '.december', 'artifacts')
    let stagedLocalArtifacts = false

    if (!fs.existsSync(localArtifactsDir) && fs.existsSync(globalArtifactsDir)) {
        try {
            await fs.promises.cp(globalArtifactsDir, localArtifactsDir, { recursive: true })
            stagedLocalArtifacts = true
        } catch {
            // Intentionally swallowed: optional artifact staging for handoff
        }
    }

    try {
        await execFileAsync('tar', args, { cwd: resolvedBaseDir })
    } catch (e: any) {
        // Exit code 1 for tar indicates minor warnings (such as file changed during read)
        if (e && e.code !== 1 && e.status !== 1) {
            throw e
        }
    } finally {
        if (stagedLocalArtifacts) {
            try {
                await fs.promises.rm(localArtifactsDir, { recursive: true, force: true })
            } catch {
                // Intentionally swallowed: cleanup of staged artifacts
            }
        }
    }

    const fullArchivePath = path.resolve(resolvedBaseDir, archivePath)
    if (fs.existsSync(fullArchivePath)) {
        const compressedSize = fs.statSync(fullArchivePath).size
        if (compressedSize > MAX_HANDOFF_COMPRESSED_SIZE_BYTES) {
            try {
                fs.unlinkSync(fullArchivePath)
            } catch {
                // Intentionally swallowed: cleanup on size limit error
            }
            const sizeMb = (compressedSize / (1024 * 1024)).toFixed(1)
            throw new Error(`Compressed archive exceeds maximum size of 100MB (found ${sizeMb}MB).`)
        }
    }

    return scanResult
}
