import { exec } from 'node:child_process'
import fsSync from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import pkg from '../../package.json' with { type: 'json' }
import { loadConfig } from '../config'

import {
    findActivePathBinary,
    isPermissionDeniedError,
    type DecemberBinaryInfo,
} from './bin-discovery'
import { compareVersions, extractVersion } from './semver'
import { clearVersionCheckCache, fetchLatestFromNpm } from './version-check'

const PACKAGE_NAME = '@trydecember/cli'
const INSTALL_TIMEOUT_MS = 180_000

/**
 * December ships only as the npm package @trydecember/cli. Global installs of that
 * package can be managed by npm, bun, pnpm or yarn. `curl` is the retired
 * standalone binary, kept so old installs can migrate to npm.
 */
export type InstallMethod = 'npm' | 'bun' | 'pnpm' | 'yarn' | 'npx' | 'curl' | 'source'

const INSTALL_METHODS: InstallMethod[] = ['npm', 'bun', 'pnpm', 'yarn', 'npx', 'curl', 'source']

export interface UpdateCommandInfo {
    command: string
    description: string
    manualCmd: string
}

export interface InstallInfo {
    method: InstallMethod
    /** Folder that holds the package.json of the running install */
    packageRoot?: string
    /** npm global prefix that owns the running install (npm only) */
    prefix?: string
}

export interface UpdateResult {
    success: boolean
    alreadyUpToDate?: boolean
    /** The registry could not be reached, nothing was installed */
    offline?: boolean
    /** The package manager binary is not installed or not on PATH */
    toolMissing?: boolean
    method: InstallMethod
    command: string
    manualCmd: string
    currentVersion?: string
    targetVersion?: string
    installedVersion?: string
    installPath?: string
    activeVersion?: string
    activeBinaryPath?: string
    verified: boolean
    /** First `december` on PATH is a different, older install */
    shadowingBinary?: DecemberBinaryInfo
    /** Legacy standalone binary that should be removed after migrating to npm */
    legacyBinaryPath?: string
    isPermissionError?: boolean
    sudoCmd?: string
    permissionHint?: string
    error?: string
    output?: string
}

export interface DetectOptions {
    execPath?: string
    argv1?: string
    env?: Record<string, string | undefined>
    configInstallMethod?: string
}

const normalizePath = (p: string): string => p.replace(/\\/g, '/')

const resolveRealPath = (p: string): string => {
    try {
        if (p && fsSync.existsSync(p)) {
            return fsSync.realpathSync(p)
        }
    } catch {
        // Intentionally swallowed: fall back to the unresolved path
    }
    return p
}

/**
 * Walk up from the running script to the folder whose package.json is the CLI package.
 */
export function findPackageRoot(scriptPath: string): string | undefined {
    if (!scriptPath) return undefined
    let dir = path.dirname(scriptPath)
    for (let i = 0; i < 5; i++) {
        try {
            const raw = fsSync.readFileSync(path.join(dir, 'package.json'), 'utf-8')
            if (JSON.parse(raw).name === PACKAGE_NAME) {
                return dir
            }
        } catch {
            // Intentionally swallowed: no matching package.json at this level
        }
        const parent = path.dirname(dir)
        if (parent === dir) break
        dir = parent
    }
    return undefined
}

/**
 * Derive the npm global prefix from a package root.
 * POSIX: <prefix>/lib/node_modules/@trydecember/cli
 * Windows: <prefix>/node_modules/@trydecember/cli
 */
export function derivePrefixFromPackageRoot(packageRoot: string): string | undefined {
    const scopeDir = path.dirname(packageRoot)
    const nodeModules = path.dirname(scopeDir)
    if (
        path.basename(scopeDir) !== '@trydecember' ||
        path.basename(nodeModules) !== 'node_modules'
    ) {
        return undefined
    }
    const parent = path.dirname(nodeModules)
    return path.basename(parent) === 'lib' ? path.dirname(parent) : parent
}

const methodFromPackageRoot = (packageRoot: string): InstallMethod => {
    const lower = normalizePath(packageRoot).toLowerCase()
    if (lower.includes('/.bun/install/global/')) return 'bun'
    if (lower.includes('/pnpm/') || lower.includes('/.pnpm/')) return 'pnpm'
    if (
        lower.includes('/yarn/global/') ||
        lower.includes('/.yarn/') ||
        lower.includes('/yarn/data/')
    ) {
        return 'yarn'
    }
    return 'npm'
}

/**
 * Detect how the running CLI was installed by looking at the running script itself.
 */
export function detectInstall(options?: DetectOptions): InstallInfo {
    const rawArgv1 = options?.argv1 ?? (process.argv.length > 1 ? process.argv[1] : '') ?? ''
    const realArgv1 = resolveRealPath(rawArgv1)
    const execPath = normalizePath(options?.execPath ?? process.execPath ?? '').toLowerCase()
    const combined = `${normalizePath(rawArgv1)} ${normalizePath(realArgv1)}`.toLowerCase()
    const env = options?.env ?? process.env

    const packageRoot = findPackageRoot(realArgv1)
    const configMethod = options?.configInstallMethod
    if (configMethod && INSTALL_METHODS.includes(configMethod as InstallMethod)) {
        const method = configMethod as InstallMethod
        return {
            method,
            packageRoot,
            prefix:
                method === 'npm' && packageRoot
                    ? derivePrefixFromPackageRoot(packageRoot)
                    : undefined,
        }
    }

    // 1. Local source repository or linked dev build
    if (
        combined.includes('/apps/cli/src') ||
        combined.includes('/apps/cli/dist') ||
        combined.includes('december/apps/cli')
    ) {
        return { method: 'source', packageRoot }
    }

    // 2. npx / bunx ephemeral execution
    if (
        combined.includes('/_npx/') ||
        combined.includes('/.bunx/') ||
        combined.includes('/bunx-') ||
        env.npm_config_user_agent?.includes('npx')
    ) {
        return { method: 'npx', packageRoot }
    }

    // 3. Retired standalone binary (compiled executable, no package.json)
    if (
        !packageRoot &&
        (combined.includes('.december/bin') ||
            execPath.includes('.december/bin') ||
            execPath.endsWith('/december') ||
            execPath.endsWith('/december.exe'))
    ) {
        return { method: 'curl' }
    }

    // 4. Global install of the npm package, owned by npm, bun, pnpm or yarn
    if (packageRoot) {
        const method = methodFromPackageRoot(packageRoot)
        return {
            method,
            packageRoot,
            prefix: method === 'npm' ? derivePrefixFromPackageRoot(packageRoot) : undefined,
        }
    }

    // 5. Fallback heuristics when the package root cannot be found
    if (combined.includes('/.bun/')) return { method: 'bun' }
    if (combined.includes('pnpm')) return { method: 'pnpm' }
    if (combined.includes('/.yarn/') || combined.includes('/yarn/')) return { method: 'yarn' }
    return { method: 'npm' }
}

/**
 * Backwards compatible wrapper returning only the method.
 */
export function detectInstallMethod(options?: DetectOptions): InstallMethod {
    return detectInstall(options).method
}

const quote = (p: string): string => `"${p}"`

export function getUpdateCommand(
    method: InstallMethod,
    options?: { version?: string; prefix?: string }
): UpdateCommandInfo {
    const spec = `${PACKAGE_NAME}@${options?.version ?? 'latest'}`
    switch (method) {
        case 'bun': {
            const command = `bun add -g ${spec}`
            return { command, manualCmd: command, description: 'bun global package' }
        }
        case 'pnpm': {
            const command = `pnpm add -g ${spec}`
            return { command, manualCmd: command, description: 'pnpm global package' }
        }
        case 'yarn': {
            const command = `yarn global add ${spec}`
            return { command, manualCmd: command, description: 'yarn global package' }
        }
        case 'npx': {
            const command = `npx ${PACKAGE_NAME}@latest`
            return { command, manualCmd: command, description: 'npx (always latest)' }
        }
        case 'source': {
            const command = 'git pull && bun install && bun --cwd apps/cli run build'
            return { command, manualCmd: command, description: 'local source repository' }
        }
        case 'curl': {
            const command = `npm install -g ${spec}`
            return {
                command,
                manualCmd: command,
                description: 'npm global package (standalone binary retired)',
            }
        }
        case 'npm':
        default: {
            const prefixFlag = options?.prefix ? ` --prefix ${quote(options.prefix)}` : ''
            const command = `npm install -g ${spec}${prefixFlag}`
            return { command, manualCmd: command, description: 'npm global package' }
        }
    }
}

const toolForMethod = (method: InstallMethod): string =>
    method === 'curl' || method === 'npx' || method === 'source' ? 'npm' : method

const isToolMissingError = (errMsg: string, tool: string): boolean => {
    const lower = errMsg.toLowerCase()
    // Shell messages for a missing executable, not npm's "404 Not Found" registry errors:
    //   bash: npm: command not found | sh: 1: npm: not found | zsh: command not found: npm
    //   'npm' is not recognized as an internal or external command | spawn npm ENOENT
    return (
        lower.includes('command not found') ||
        new RegExp(`(^|\\s)${tool}: not found`, 'm').test(lower) ||
        lower.includes('is not recognized as an internal or external command') ||
        lower.includes(`spawn ${tool} enoent`)
    )
}

const isUnderHome = (p: string, homeDir: string): boolean => {
    const rel = path.relative(homeDir, p)
    return Boolean(rel) && !rel.startsWith('..') && !path.isAbsolute(rel)
}

const samePath = (a: string, b: string): boolean => {
    const norm = (p: string) => normalizePath(path.resolve(p)).replace(/\/+$/, '')
    return process.platform === 'win32'
        ? norm(a).toLowerCase() === norm(b).toLowerCase()
        : norm(a) === norm(b)
}

const isInside = (child: string, parent: string): boolean => {
    const rel = path.relative(parent, child)
    return !rel.startsWith('..') && !path.isAbsolute(rel)
}

export interface PerformUpdateOptions {
    currentVersion?: string
    force?: boolean
    /** Only report current and latest versions, never install */
    checkOnly?: boolean
    fetchLatestFn?: () => Promise<string | null>
    onProgress?: (message: string) => void
    onResolvedVersion?: (info: {
        currentVersion: string
        targetVersion?: string
        method: InstallMethod
        description: string
        installPath?: string
    }) => void
    onSuccess?: () => Promise<void> | void
    onError?: (error: string, manualCmd: string) => void
    execFn?: typeof exec
    configInstallMethod?: string
    skipVerification?: boolean
    argv1?: string
    homeDir?: string
    /** Reads the version of the package at a package root, used for verification */
    readInstalledVersionFn?: (packageRoot: string) => Promise<string | undefined>
    /** Resolves the first `december` on PATH, used for verification */
    resolvePathBinaryFn?: () => Promise<DecemberBinaryInfo | null>
}

const runCommand = (
    execFn: typeof exec,
    command: string,
    timeout: number
): Promise<{ error: Error | null; stdout: string; stderr: string }> =>
    new Promise((resolve) => {
        execFn(command, { timeout, maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
            resolve({ error, stdout: String(stdout ?? ''), stderr: String(stderr ?? '') })
        })
    })

/**
 * Latest published version. Tries the registry over HTTPS first, then falls back to
 * `npm view`, which honors .npmrc registries, auth and proxy settings.
 */
export async function fetchLatestVersion(execFn: typeof exec = exec): Promise<string | null> {
    const direct = await fetchLatestFromNpm()
    if (direct) return direct
    const { error, stdout } = await runCommand(
        execFn,
        `npm view ${PACKAGE_NAME}@latest version`,
        15_000
    )
    if (error) return null
    return extractVersion(stdout.trim()) ?? null
}

const readPackageVersion = async (packageRoot: string): Promise<string | undefined> => {
    try {
        const raw = await fsSync.promises.readFile(path.join(packageRoot, 'package.json'), 'utf-8')
        const parsed = JSON.parse(raw)
        return typeof parsed.version === 'string' ? parsed.version : undefined
    } catch {
        return undefined
    }
}

export async function performCliUpdate(options?: PerformUpdateOptions): Promise<UpdateResult> {
    let configInstallMethod = options?.configInstallMethod
    if (!configInstallMethod) {
        try {
            const config = await loadConfig()
            configInstallMethod = config.installMethod
        } catch {
            // Intentionally swallowed: fall back to auto-detecting install method
        }
    }

    const execFn = options?.execFn ?? exec
    const install = detectInstall({ configInstallMethod, argv1: options?.argv1 })
    const { method } = install
    const currentVersion = options?.currentVersion ?? pkg.version

    if (method === 'source' || method === 'npx') {
        const { command, manualCmd } = getUpdateCommand(method)
        const msg =
            method === 'source'
                ? 'Running December CLI from local source development directory.'
                : 'Running December CLI via npx/bunx. Each invocation automatically uses the latest version.'
        options?.onProgress?.(msg)
        return {
            success: true,
            method,
            command,
            manualCmd,
            currentVersion,
            verified: true,
            output: msg,
        }
    }

    // 1. Resolve the latest published version. Without it there is nothing safe to install.
    let targetVersion: string | undefined
    try {
        const fetchFn = options?.fetchLatestFn ?? (() => fetchLatestVersion(execFn))
        targetVersion = (await fetchFn()) ?? undefined
    } catch {
        // Intentionally swallowed: handled as offline below
    }

    // 2. Install into the prefix that owns the running install. With nvm or several
    // Node versions, the `npm` on PATH can point at a different global prefix.
    let prefixFlag: string | undefined
    if (method === 'npm' && install.prefix && targetVersion && !options?.checkOnly) {
        const { error, stdout } = await runCommand(execFn, 'npm prefix -g', 10_000)
        const defaultPrefix = stdout.trim()
        if (error || !defaultPrefix || !samePath(defaultPrefix, install.prefix)) {
            prefixFlag = install.prefix
        }
    }

    const { command, manualCmd, description } = getUpdateCommand(method, {
        version: targetVersion,
        prefix: prefixFlag,
    })

    options?.onResolvedVersion?.({
        currentVersion,
        targetVersion,
        method,
        description,
        installPath: install.packageRoot,
    })

    const base = {
        method,
        command,
        manualCmd,
        currentVersion,
        targetVersion,
        installPath: install.packageRoot,
    }

    if (!targetVersion) {
        const error =
            'Could not reach the npm registry to check for the latest version. Check your network or registry settings and try again.'
        options?.onError?.(error, manualCmd)
        return { ...base, success: false, offline: true, verified: false, error }
    }

    const isUpToDate = compareVersions(currentVersion, targetVersion) >= 0

    if (options?.checkOnly || (isUpToDate && !options?.force)) {
        return {
            ...base,
            success: true,
            alreadyUpToDate: isUpToDate,
            installedVersion: currentVersion,
            verified: true,
            output: isUpToDate
                ? `December CLI is already up to date (v${currentVersion}).`
                : `December CLI v${targetVersion} is available (current v${currentVersion}).`,
        }
    }

    // 3. Install
    options?.onProgress?.(`Installing v${targetVersion} via ${description}...`)
    const { error, stdout, stderr } = await runCommand(execFn, command, INSTALL_TIMEOUT_MS)

    if (error) {
        const errMessage = (stderr || error.message || 'Unknown update failure').trim()
        const tool = toolForMethod(method)

        if (isToolMissingError(errMessage, tool)) {
            const msg =
                method === 'curl'
                    ? 'The standalone installer is retired and npm was not found. Install Node.js (which includes npm), then run the command below.'
                    : `${tool} was not found on your PATH.`
            options?.onError?.(msg, manualCmd)
            return { ...base, success: false, toolMissing: true, verified: false, error: msg }
        }

        const isPerm = isPermissionDeniedError(errMessage)
        let sudoCmd: string | undefined
        let permissionHint: string | undefined
        if (isPerm) {
            const homeDir = options?.homeDir ?? os.homedir()
            if (tool === 'npm') {
                let prefix = install.prefix
                if (!prefix) {
                    const res = await runCommand(execFn, 'npm prefix -g', 10_000)
                    prefix = res.error ? undefined : res.stdout.trim() || undefined
                }
                if (prefix && isUnderHome(prefix, homeDir)) {
                    // A prefix inside the home folder should be user owned. sudo would
                    // make it worse, so point at the ownership problem instead.
                    permissionHint = `npm cannot write to ${prefix}, which is inside your home folder. Fix the ownership with: sudo chown -R "$(whoami)" "${prefix}"`
                } else {
                    sudoCmd = `sudo ${manualCmd}`
                }
            } else {
                permissionHint = `${tool} installs global packages inside your home folder, so do not use sudo. Check that you own the ${tool} global folder, then run the command again.`
            }
        }

        options?.onError?.(errMessage, sudoCmd || manualCmd)
        return {
            ...base,
            success: false,
            verified: false,
            isPermissionError: isPerm,
            sudoCmd,
            permissionHint,
            error: errMessage,
        }
    }

    try {
        await clearVersionCheckCache()
    } catch {
        // Intentionally swallowed: a stale cache only delays the update notice
    }

    // 4. Verify: read the version from the install we just updated, then check that
    // the shell resolves `december` to it. Nothing on disk is deleted or relinked.
    let installedVersion: string | undefined = targetVersion
    let verified = true
    let activeVersion: string | undefined
    let activeBinaryPath: string | undefined
    let shadowingBinary: DecemberBinaryInfo | undefined
    let legacyBinaryPath: string | undefined
    let verificationError: string | undefined

    if (!options?.skipVerification) {
        if (install.packageRoot) {
            const readVersion = options?.readInstalledVersionFn ?? readPackageVersion
            const onDisk = await readVersion(install.packageRoot)
            if (onDisk) {
                installedVersion = onDisk
                if (compareVersions(onDisk, targetVersion) < 0) {
                    verified = false
                    verificationError = `The install command finished, but ${install.packageRoot} still has v${onDisk}.`
                }
            }
        }

        try {
            options?.onProgress?.('Checking which december your shell runs...')
            const resolveActive = options?.resolvePathBinaryFn ?? (() => findActivePathBinary())
            const active = await resolveActive()
            if (active) {
                activeVersion = active.version
                activeBinaryPath = active.path
                const isOurs = install.packageRoot
                    ? isInside(active.realPath, install.packageRoot)
                    : false
                if (
                    verified &&
                    !isOurs &&
                    active.version &&
                    compareVersions(active.version, targetVersion) < 0
                ) {
                    verified = false
                    shadowingBinary = active
                    if (method === 'curl' || active.manager === 'curl') {
                        legacyBinaryPath = active.path
                    }
                    verificationError = `December v${installedVersion} is installed, but your shell runs v${active.version} from ${active.path}.`
                }
            }
        } catch {
            // Intentionally swallowed: PATH check is advisory and must not fail the update
        }
    }

    if (verified && options?.onSuccess) {
        try {
            await options.onSuccess()
        } catch {
            // Intentionally swallowed: optional success hook failure ignored
        }
    }

    return {
        ...base,
        success: verified,
        installedVersion,
        activeVersion,
        activeBinaryPath,
        verified,
        shadowingBinary,
        legacyBinaryPath,
        error: verificationError,
        output: (stdout || 'Update completed successfully.').trim(),
    }
}
