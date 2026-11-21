import { execFile } from 'node:child_process'
import fsSync from 'node:fs'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { compareVersions, extractVersion } from './semver'

export { compareVersions }

export type BinaryManager =
    | 'bun'
    | 'npm'
    | 'pnpm'
    | 'yarn'
    | 'brew'
    | 'curl'
    | 'standalone'
    | 'source'
    | 'unknown'

export interface DecemberBinaryInfo {
    path: string
    realPath: string
    manager: BinaryManager
    version?: string
    isSymlink: boolean
    isActive: boolean
    isShadowed: boolean
}

export interface BinaryCollisionDiagnosis {
    activeBinary: DecemberBinaryInfo | null
    allBinaries: DecemberBinaryInfo[]
    shadowedBinaries: DecemberBinaryInfo[]
    hasCollision: boolean
    hasStaleActive: boolean
    latestInstalledVersion?: string
}

export interface DiscoveryOptions {
    envPath?: string
    homeDir?: string
    execPath?: string
    argv1?: string
    env?: Record<string, string | undefined>
}

/**
 * Infer package manager type from binary and target file paths.
 */
export function inferManagerFromPath(filePath: string, realPath: string): BinaryManager {
    const normalized = (filePath + ' ' + realPath).replace(/\\/g, '/').toLowerCase()

    if (
        normalized.includes('/apps/cli/src') ||
        normalized.includes('/apps/cli/dist') ||
        normalized.includes('december/apps/cli')
    ) {
        return 'source'
    }
    // Only a real Homebrew formula counts as brew. /opt/homebrew/bin/december is
    // usually an npm global installed with Homebrew's node, so it falls through to npm.
    if (normalized.includes('/cellar/december')) {
        return 'brew'
    }
    if (normalized.includes('/.bun/bin') || normalized.includes('/.bun/')) {
        return 'bun'
    }
    if (normalized.includes('/pnpm') || normalized.includes('/.pnpm')) {
        return 'pnpm'
    }
    if (normalized.includes('/.yarn') || normalized.includes('/yarn/')) {
        return 'yarn'
    }
    if (
        normalized.includes('/.nvm/') ||
        normalized.includes('/node_modules/@trydecember/cli') ||
        normalized.includes('/.npm-global') ||
        normalized.includes('/opt/homebrew/') ||
        normalized.includes('/usr/local/') ||
        normalized.includes('/usr/bin/')
    ) {
        return 'npm'
    }
    if (
        normalized.includes('/.december/bin/december') ||
        normalized.includes('/.december/bin') ||
        normalized.includes('/.local/bin/december') ||
        normalized.includes('/.local/bin/')
    ) {
        return 'curl'
    }
    return 'unknown'
}

const readCliPackageVersion = async (candidatePkg: string): Promise<string | undefined> => {
    try {
        const content = await fs.readFile(candidatePkg, 'utf-8')
        const parsed = JSON.parse(content)
        if (parsed.name === '@trydecember/cli' && typeof parsed.version === 'string') {
            return parsed.version
        }
    } catch {
        // Intentionally swallowed: package.json missing or not matching at this location
    }
    return undefined
}

/**
 * Attempt to read the CLI package.json version for a binary.
 * Walks up from the resolved target, then checks the npm prefix layouts next to the
 * shim itself (Windows: <prefix>/node_modules, POSIX: <prefix>/lib/node_modules).
 */
async function readVersionFromPackageJson(
    targetPath: string,
    shimPath: string = targetPath
): Promise<string | undefined> {
    let dir = path.dirname(targetPath)
    for (let i = 0; i < 4; i++) {
        const version = await readCliPackageVersion(path.join(dir, 'package.json'))
        if (version) return version
        const parent = path.dirname(dir)
        if (parent === dir) break
        dir = parent
    }

    const shimDir = path.dirname(shimPath)
    const prefixCandidates = [
        path.join(shimDir, 'node_modules', '@trydecember', 'cli', 'package.json'),
        path.join(shimDir, '..', 'lib', 'node_modules', '@trydecember', 'cli', 'package.json'),
    ]
    for (const candidate of prefixCandidates) {
        const version = await readCliPackageVersion(candidate)
        if (version) return version
    }
    return undefined
}

/**
 * Check if a file path is eligible to be a global CLI binary, filtering out source files.
 */
export function isEligibleBinaryPath(filePath: string): boolean {
    const normalized = filePath.replace(/\\/g, '/').toLowerCase()
    if (
        normalized.endsWith('.ts') ||
        normalized.endsWith('.tsx') ||
        normalized.endsWith('.d.ts') ||
        normalized.endsWith('.map') ||
        normalized.includes('/src/') ||
        normalized.includes('apps/cli/src') ||
        normalized.endsWith('/index.js')
    ) {
        return false
    }

    const base = path.posix.basename(normalized)
    const validNames = ['december', 'december.cmd', 'december.exe', 'december.ps1', 'december.js']
    return validNames.includes(base)
}

/**
 * Execute a binary with --version to read its version.
 */
function readVersionFromExecution(binPath: string): Promise<string | undefined> {
    const lower = binPath.toLowerCase()
    if (lower.endsWith('.ps1')) {
        // PowerShell scripts cannot be spawned directly; rely on package.json lookup
        return Promise.resolve(undefined)
    }
    // Node refuses to spawn .cmd/.bat files without a shell (CVE-2024-27980)
    const needsShell = process.platform === 'win32' && /\.(cmd|bat)$/.test(lower)
    const file = needsShell ? `"${binPath}"` : binPath

    return new Promise((resolve) => {
        execFile(file, ['--version'], { timeout: 3000, shell: needsShell }, (error, stdout) => {
            if (error || !stdout) {
                resolve(undefined)
                return
            }
            resolve(extractVersion(stdout.trim()))
        })
    })
}

/**
 * Find all candidate December CLI binary locations on the system.
 */
export async function findAllDecemberBinaries(
    options?: DiscoveryOptions
): Promise<DecemberBinaryInfo[]> {
    const homeDir = options?.homeDir ?? os.homedir()
    const env = options?.env ?? process.env
    const rawPath = options?.envPath ?? env.PATH ?? ''
    const pathDirs = rawPath.split(path.delimiter).filter(Boolean)
    // On Linux / WSL, exclude Windows mount paths (/mnt/*) unless explicitly passed in options.envPath
    const isWslOrLinux = process.platform === 'linux'
    const searchDirs =
        isWslOrLinux && !options?.envPath
            ? pathDirs.filter((dir) => !dir.startsWith('/mnt/'))
            : pathDirs

    const candidateFiles: string[] = []

    // 1. Collect from all PATH entries
    const binNames =
        process.platform === 'win32'
            ? ['december.cmd', 'december.exe', 'december.ps1', 'december']
            : ['december']

    for (const dir of searchDirs) {
        for (const name of binNames) {
            candidateFiles.push(path.join(dir, name))
        }
    }

    // 2. Collect from well-known global locations in case not in PATH
    const knownLocations = [
        path.join(homeDir, '.december', 'bin', 'december'),
        path.join(homeDir, '.local', 'bin', 'december'),
        path.join(homeDir, '.bun', 'bin', 'december'),
        path.join(homeDir, '.local', 'share', 'pnpm', 'december'),
        path.join(homeDir, '.yarn', 'bin', 'december'),
        path.join(homeDir, '.npm-global', 'bin', 'december'),
        '/usr/local/bin/december',
        '/opt/homebrew/bin/december',
    ]

    if (env.PNPM_HOME) {
        knownLocations.push(path.join(env.PNPM_HOME, 'december'))
    }

    // Scan NVM versions if present
    const nvmDir = path.join(homeDir, '.nvm', 'versions', 'node')
    try {
        if (fsSync.existsSync(nvmDir)) {
            const versions = await fs.readdir(nvmDir)
            for (const v of versions) {
                knownLocations.push(path.join(nvmDir, v, 'bin', 'december'))
            }
        }
    } catch {
        // Intentionally swallowed: NVM directory scanning optional
    }

    candidateFiles.push(...knownLocations)

    // Also include current process.argv[1] if specified and eligible
    if (options?.argv1 && isEligibleBinaryPath(options.argv1)) {
        candidateFiles.push(options.argv1)
    }

    // 3. Inspect existing binaries in PATH order.
    // A directory holds at most one install: npm on Windows writes december,
    // december.cmd and december.ps1 side by side, and those are one shim set.
    const found: Array<{
        path: string
        realPath: string
        isSymlink: boolean
        manager: BinaryManager
    }> = []
    const seenPaths = new Set<string>()
    const seenRealPaths = new Set<string>()
    const seenDirs = new Set<string>()

    for (const candidate of candidateFiles) {
        if (!isEligibleBinaryPath(candidate)) continue

        const normalizedPath = path.normalize(candidate)
        if (seenPaths.has(normalizedPath)) continue
        seenPaths.add(normalizedPath)

        const dirKey = path.dirname(normalizedPath).toLowerCase()
        if (seenDirs.has(dirKey)) continue

        try {
            const lstat = await fs.lstat(normalizedPath)
            if (lstat.isDirectory()) continue

            let realPath = normalizedPath
            try {
                realPath = await fs.realpath(normalizedPath)
            } catch {
                // Intentionally swallowed: broken symlink or unreadable realpath, keep normalizedPath
            }

            if (seenRealPaths.has(realPath)) {
                // Same target already discovered via another alias
                continue
            }
            seenRealPaths.add(realPath)
            seenDirs.add(dirKey)

            found.push({
                path: normalizedPath,
                realPath,
                isSymlink: lstat.isSymbolicLink(),
                manager: inferManagerFromPath(normalizedPath, realPath),
            })
        } catch {
            // Intentionally swallowed: file does not exist at candidate path
        }
    }

    // 4. Read versions in parallel: execution is authoritative because dist might
    // not match package.json, package.json is the fallback.
    const versions = await Promise.all(
        found.map(async (bin) => {
            const executed = await readVersionFromExecution(bin.path)
            return executed ?? (await readVersionFromPackageJson(bin.realPath, bin.path))
        })
    )

    return found.map((bin, index) => ({
        ...bin,
        version: versions[index],
        isActive: index === 0,
        isShadowed: index !== 0,
    }))
}

/**
 * Resolve the `december` binary the shell runs first from PATH, without scanning
 * well-known locations or executing every install on the machine.
 */
export async function findActivePathBinary(
    options?: DiscoveryOptions
): Promise<DecemberBinaryInfo | null> {
    const env = options?.env ?? process.env
    const rawPath = options?.envPath ?? env.PATH ?? ''
    const pathDirs = rawPath.split(path.delimiter).filter(Boolean)
    const searchDirs =
        process.platform === 'linux' && !options?.envPath
            ? pathDirs.filter((dir) => !dir.startsWith('/mnt/'))
            : pathDirs
    const binNames =
        process.platform === 'win32'
            ? ['december.cmd', 'december.exe', 'december.ps1', 'december']
            : ['december']

    for (const dir of searchDirs) {
        for (const name of binNames) {
            const candidate = path.join(dir, name)
            try {
                const lstat = await fs.lstat(candidate)
                if (lstat.isDirectory()) continue
                let realPath = candidate
                try {
                    realPath = await fs.realpath(candidate)
                } catch {
                    // Intentionally swallowed: broken symlink, keep the PATH entry
                }
                const version =
                    (await readVersionFromExecution(candidate)) ??
                    (await readVersionFromPackageJson(realPath, candidate))
                return {
                    path: candidate,
                    realPath,
                    manager: inferManagerFromPath(candidate, realPath),
                    version,
                    isSymlink: lstat.isSymbolicLink(),
                    isActive: true,
                    isShadowed: false,
                }
            } catch {
                // Intentionally swallowed: no binary with this name in this PATH entry
            }
        }
    }
    return null
}

/**
 * Run a full diagnostic check on installed December binaries and identify collisions.
 */
export async function diagnoseBinaryCollisions(
    options?: DiscoveryOptions
): Promise<BinaryCollisionDiagnosis> {
    const allBinaries = await findAllDecemberBinaries(options)
    const activeBinary = allBinaries.find((b) => b.isActive) ?? null
    const shadowedBinaries = allBinaries.filter((b) => b.isShadowed)

    // Find the latest installed version across all discovered binaries
    let latestInstalledVersion: string | undefined
    for (const bin of allBinaries) {
        if (bin.version) {
            if (
                !latestInstalledVersion ||
                compareVersions(bin.version, latestInstalledVersion) > 0
            ) {
                latestInstalledVersion = bin.version
            }
        }
    }

    // Has collision if multiple binaries exist
    const hasCollision = allBinaries.length > 1

    // Has stale active if the currently active binary is older than another discovered binary
    const hasStaleActive = Boolean(
        activeBinary?.version &&
        latestInstalledVersion &&
        compareVersions(latestInstalledVersion, activeBinary.version) > 0
    )

    return {
        activeBinary,
        allBinaries,
        shadowedBinaries,
        hasCollision,
        hasStaleActive,
        latestInstalledVersion,
    }
}

export function isPermissionDeniedError(errMsg: string): boolean {
    const lower = errMsg.toLowerCase()
    return (
        lower.includes('eacces') ||
        lower.includes('eperm') ||
        lower.includes('permission denied') ||
        lower.includes('missing write access') ||
        lower.includes('operation not permitted')
    )
}

export interface FailedStaleBinary {
    path: string
    error: string
    needsSudo: boolean
}

export interface SkippedBinary {
    path: string
    reason: string
}

export interface ResolveCleanResult {
    cleanedOrForwarded: string[]
    failedBinaries: FailedStaleBinary[]
    skipped: SkippedBinary[]
}

/**
 * Pick the install other binaries should point at: the newest known version that
 * is not a development build. Ties keep PATH order. Returns undefined when no
 * version is known, so callers never align binaries to a guess.
 */
export function selectPrimaryBinary(
    allBinaries: DecemberBinaryInfo[]
): DecemberBinaryInfo | undefined {
    let primary: DecemberBinaryInfo | undefined
    for (const bin of allBinaries) {
        if (bin.manager === 'source' || !bin.version) continue
        if (!primary || compareVersions(bin.version, primary.version) > 0) {
            primary = bin
        }
    }
    return primary
}

/**
 * Safely forward a stale binary path to point directly to the primary target binary.
 * This prevents broken shell hash tables (`bash: ...: No such file or directory`)
 * when an old binary is replaced or superseded.
 */
export async function forwardStaleBinary(
    stalePath: string,
    targetPath: string
): Promise<{ success: boolean; error?: string; isPermissionError?: boolean }> {
    try {
        if (stalePath === targetPath) {
            return { success: true }
        }

        if (process.platform === 'win32') {
            return {
                success: false,
                error: 'Automatic cleanup is not supported on Windows. Remove this install with the package manager that created it.',
            }
        }

        // Avoid creating broken cross-OS symlinks between WSL Linux paths and Windows mounts
        if (
            process.platform === 'linux' &&
            (stalePath.startsWith('/mnt/') || targetPath.startsWith('/mnt/'))
        ) {
            return {
                success: false,
                error: 'Cannot create cross-OS symlink between WSL and Windows mount',
            }
        }

        // Ensure target exists
        await fs.access(targetPath)

        // Remove old stale binary/symlink
        try {
            await fs.unlink(stalePath)
        } catch (unlinkErr: any) {
            const errStr = unlinkErr?.message || ''
            if (isPermissionDeniedError(errStr)) {
                return {
                    success: false,
                    error: errStr,
                    isPermissionError: true,
                }
            }
            // Intentionally swallowed: unlink may fail if file was moved or on Windows locking
        }

        await fs.symlink(targetPath, stalePath)

        return { success: true }
    } catch (e: any) {
        const errMsg = e?.message ?? 'Failed to forward stale binary'
        return {
            success: false,
            error: errMsg,
            isPermissionError: isPermissionDeniedError(errMsg),
        }
    }
}

/**
 * Forward binaries that are known to be older than the primary binary.
 * Binaries with the same or a newer version, an unknown version, or a development
 * build are left alone and reported in `skipped`.
 */
export async function resolveAndCleanStaleBinaries(
    targetPrimaryBinary: DecemberBinaryInfo,
    allBinaries: DecemberBinaryInfo[]
): Promise<ResolveCleanResult> {
    const cleanedOrForwarded: string[] = []
    const failedBinaries: FailedStaleBinary[] = []
    const skipped: SkippedBinary[] = []

    const others = allBinaries.filter(
        (bin) =>
            bin.path !== targetPrimaryBinary.path && bin.realPath !== targetPrimaryBinary.realPath
    )

    if (targetPrimaryBinary.manager === 'source' || !targetPrimaryBinary.version) {
        for (const bin of others) {
            skipped.push({ path: bin.path, reason: 'primary install has no known release version' })
        }
        return { cleanedOrForwarded, failedBinaries, skipped }
    }

    for (const bin of others) {
        if (bin.manager === 'source' || !isEligibleBinaryPath(bin.path)) {
            skipped.push({ path: bin.path, reason: 'development build' })
            continue
        }
        if (!bin.version) {
            skipped.push({ path: bin.path, reason: 'unknown version' })
            continue
        }
        if (compareVersions(bin.version, targetPrimaryBinary.version) >= 0) {
            skipped.push({ path: bin.path, reason: `same or newer version (v${bin.version})` })
            continue
        }

        const forwardRes = await forwardStaleBinary(bin.path, targetPrimaryBinary.path)
        if (forwardRes.success) {
            cleanedOrForwarded.push(bin.path)
        } else {
            failedBinaries.push({
                path: bin.path,
                error: forwardRes.error || 'Failed to forward stale binary',
                needsSudo: Boolean(forwardRes.isPermissionError),
            })
        }
    }

    return { cleanedOrForwarded, failedBinaries, skipped }
}
