import { exec } from 'node:child_process'
import fsSync from 'node:fs'

import pkg from '../../package.json' with { type: 'json' }
import { loadConfig } from '../config'

import {
    compareVersions,
    diagnoseBinaryCollisions,
    resolveAndCleanStaleBinaries,
    type BinaryCollisionDiagnosis,
    type DecemberBinaryInfo,
    type FailedStaleBinary,
    type ResolveCleanResult,
} from './bin-discovery'
import { clearVersionCheckCache, fetchLatestFromNpm } from './version-check'

function isPermissionDeniedError(errMsg: string): boolean {
    const lower = errMsg.toLowerCase()
    return (
        lower.includes('eacces') ||
        lower.includes('eperm') ||
        lower.includes('permission denied') ||
        lower.includes('missing write access') ||
        lower.includes('operation not permitted')
    )
}

export type InstallMethod = 'npm' | 'bun' | 'pnpm' | 'npx' | 'curl' | 'source'

export interface UpdateCommandInfo {
    command: string
    description: string
    manualCmd: string
}

export interface UpdateResult {
    success: boolean
    alreadyUpToDate?: boolean
    method: InstallMethod
    command: string
    manualCmd: string
    targetVersion?: string
    installedVersion?: string
    activeVersion?: string
    activeBinaryPath?: string
    verified: boolean
    collisionFixed?: boolean
    cleanedBinaries?: string[]
    failedBinaries?: FailedStaleBinary[]
    shadowingBinary?: DecemberBinaryInfo
    shellHashNotice?: boolean
    isPermissionError?: boolean
    sudoCmd?: string
    error?: string
    output?: string
}

export interface DetectOptions {
    execPath?: string
    argv1?: string
    env?: Record<string, string | undefined>
    configInstallMethod?: string
}

export function detectInstallMethod(options?: DetectOptions): InstallMethod {
    const configMethod = options?.configInstallMethod
    const validMethods: InstallMethod[] = ['npm', 'bun', 'pnpm', 'npx', 'curl', 'source']
    if (configMethod && validMethods.includes(configMethod as InstallMethod)) {
        return configMethod as InstallMethod
    }

    const execPath = (options?.execPath ?? process.execPath ?? '').replace(/\\/g, '/')
    const rawArgv1 = options?.argv1 ?? (process.argv.length > 1 ? process.argv[1] : '') ?? ''
    let realArgv1 = rawArgv1
    try {
        if (rawArgv1 && fsSync.existsSync(rawArgv1)) {
            realArgv1 = fsSync.realpathSync(rawArgv1)
        }
    } catch {
        // Intentionally swallowed: fallback to unresolved path
    }

    const argv1 = rawArgv1.replace(/\\/g, '/')
    const realArgv1Norm = realArgv1.replace(/\\/g, '/')
    const combined = `${argv1} ${realArgv1Norm}`.toLowerCase()
    const env = options?.env ?? process.env

    // 1. Local source repository or symlinked dev build
    if (
        combined.includes('/apps/cli/src') ||
        combined.includes('/apps/cli/dist') ||
        combined.includes('december/apps/cli')
    ) {
        return 'source'
    }

    // 2. NPX / Bunx ephemeral execution
    if (
        combined.includes('/_npx/') ||
        combined.includes('\\_npx\\') ||
        combined.includes('/.bunx/') ||
        env.npm_config_user_agent?.includes('npx')
    ) {
        return 'npx'
    }

    // 3. Standalone binary / curl installer
    // e.g. ~/.december/bin/december, ~/.local/bin/december or running binary directly outside node/bun runtime
    if (
        execPath.includes('.december/bin') ||
        combined.includes('.december/bin') ||
        execPath.includes('.local/bin/december') ||
        combined.includes('.local/bin/december') ||
        (execPath.endsWith('/december') &&
            !execPath.includes('node_modules') &&
            !execPath.includes('.bun') &&
            !execPath.includes('/node'))
    ) {
        return 'curl'
    }

    // 4. Bun global
    if (
        combined.includes('.bun/bin') ||
        combined.includes('/.bun/') ||
        (execPath.includes('/bun') && !execPath.endsWith('/node'))
    ) {
        return 'bun'
    }

    // 5. PNPM global
    if (
        combined.includes('pnpm') ||
        combined.includes('.pnpm') ||
        (env.PNPM_HOME && combined.includes(env.PNPM_HOME.replace(/\\/g, '/').toLowerCase()))
    ) {
        return 'pnpm'
    }

    // 6. NPM global (default)
    return 'npm'
}

export function getUpdateCommand(
    method: InstallMethod,
    _platform: string = process.platform
): UpdateCommandInfo {
    switch (method) {
        case 'curl': {
            return {
                command: 'curl -fsSL https://trydecember.com/install.sh | bash',
                manualCmd: 'curl -fsSL https://trydecember.com/install.sh | bash',
                description: 'Standalone binary via curl installer',
            }
        }
        case 'bun': {
            return {
                command: 'bun add -g @trydecember/cli@latest',
                manualCmd: 'bun add -g @trydecember/cli@latest',
                description: 'Bun global package',
            }
        }
        case 'pnpm': {
            return {
                command: 'pnpm add -g @trydecember/cli@latest',
                manualCmd: 'pnpm add -g @trydecember/cli@latest',
                description: 'PNPM global package',
            }
        }
        case 'npx': {
            return {
                command: 'npx @trydecember/cli@latest',
                manualCmd: 'npx @trydecember/cli@latest',
                description: 'NPX execution (always latest)',
            }
        }
        case 'source': {
            return {
                command: 'git pull && bun install && bun --cwd apps/cli run build',
                manualCmd: 'git pull && bun install && bun --cwd apps/cli run build',
                description: 'Local source repository',
            }
        }
        case 'npm':
        default: {
            return {
                command: 'npm install -g @trydecember/cli@latest',
                manualCmd: 'npm install -g @trydecember/cli@latest',
                description: 'NPM global package',
            }
        }
    }
}

export interface PerformUpdateOptions {
    currentVersion?: string
    force?: boolean
    fetchLatestFn?: () => Promise<string | null>
    onProgress?: (message: string) => void
    onResolvedVersion?: (info: {
        currentVersion: string
        targetVersion?: string
        method: InstallMethod
        description: string
        activeBinaryPath?: string
    }) => void
    onSuccess?: () => Promise<void> | void
    onError?: (error: string, manualCmd: string) => void
    execFn?: typeof exec
    configInstallMethod?: string
    platform?: string
    skipVerification?: boolean
    argv1?: string
    diagnoseFn?: (options?: any) => Promise<BinaryCollisionDiagnosis>
    cleanFn?: (
        targetPrimaryBinary: DecemberBinaryInfo,
        allBinaries: DecemberBinaryInfo[]
    ) => Promise<ResolveCleanResult>
}

export async function performCliUpdate(options?: PerformUpdateOptions): Promise<UpdateResult> {
    let configInstallMethod = options?.configInstallMethod
    if (!configInstallMethod) {
        try {
            const config = await loadConfig()
            configInstallMethod = config.installMethod
        } catch {
            // Intentionally swallowed: fallback to auto-detecting install method
        }
    }

    const platform = options?.platform ?? process.platform
    const diagnose = options?.diagnoseFn ?? diagnoseBinaryCollisions
    const cleanStale = options?.cleanFn ?? resolveAndCleanStaleBinaries

    // Preliminary check to see if an active binary exists in PATH
    let preDiagnosis: BinaryCollisionDiagnosis | null = null
    try {
        preDiagnosis = await diagnose({
            argv1: options?.argv1 ?? (process.argv.length > 1 ? process.argv[1] : undefined),
        })
    } catch {
        // Intentionally swallowed: preliminary diagnosis fallback
    }

    let detectedMethod = detectInstallMethod({
        configInstallMethod,
        argv1: options?.argv1,
    })

    // If config was not explicitly set in options, prioritize the manager of the active binary in PATH
    if (!options?.configInstallMethod && preDiagnosis?.activeBinary?.manager) {
        const activeMgr = preDiagnosis.activeBinary.manager
        if (
            activeMgr === 'bun' ||
            activeMgr === 'npm' ||
            activeMgr === 'pnpm' ||
            activeMgr === 'curl' ||
            activeMgr === 'source'
        ) {
            detectedMethod = activeMgr
        }
    }

    const method = detectedMethod
    const { command, manualCmd, description } = getUpdateCommand(method, platform)

    if (method === 'source') {
        const msg = 'Running December CLI from local source development directory.'
        options?.onProgress?.(msg)
        return {
            success: true,
            method: 'source',
            command,
            manualCmd,
            verified: true,
            output: msg,
        }
    }

    if (method === 'npx') {
        const msg =
            'Running December CLI via npx/bunx. Each invocation automatically uses the latest version.'
        options?.onProgress?.(msg)
        return {
            success: true,
            method: 'npx',
            command,
            manualCmd,
            verified: true,
            output: msg,
        }
    }

    // 1. Pre-flight check: clear cached check and query latest target version
    let targetVersion: string | undefined
    try {
        await clearVersionCheckCache()
        const fetchFn = options?.fetchLatestFn ?? fetchLatestFromNpm
        const remoteVersion = await fetchFn()
        if (remoteVersion) {
            targetVersion = remoteVersion
        }
    } catch {
        // Intentionally swallowed: offline or network timeout during version query
    }

    const currentVersion = options?.currentVersion ?? pkg.version
    const activeBinaryPath = preDiagnosis?.activeBinary?.path

    options?.onResolvedVersion?.({
        currentVersion,
        targetVersion,
        method,
        description,
        activeBinaryPath,
    })

    // Fast-path: already on latest version
    if (
        !options?.force &&
        targetVersion &&
        currentVersion &&
        compareVersions(currentVersion, targetVersion) >= 0
    ) {
        return {
            success: true,
            alreadyUpToDate: true,
            method,
            command,
            manualCmd,
            targetVersion,
            installedVersion: currentVersion,
            activeVersion: currentVersion,
            activeBinaryPath,
            verified: true,
            output: `December CLI is already up to date (v${currentVersion}).`,
        }
    }

    options?.onProgress?.(
        `Updating December CLI${targetVersion ? ` to v${targetVersion}` : ''} via ${description}...`
    )

    const execCommand = options?.execFn ?? exec

    return new Promise<UpdateResult>((resolve) => {
        execCommand(command, { timeout: 120_000 }, async (error, stdout, stderr) => {
            if (error) {
                const errMessage = (stderr || error.message || 'Unknown update failure').trim()
                const isPerm = isPermissionDeniedError(errMessage)
                const sudoCmd =
                    isPerm && (method === 'npm' || method === 'bun' || method === 'pnpm')
                        ? `sudo ${manualCmd}`
                        : undefined

                options?.onError?.(errMessage, sudoCmd || manualCmd)
                resolve({
                    success: false,
                    method,
                    command,
                    manualCmd,
                    targetVersion,
                    verified: false,
                    isPermissionError: isPerm,
                    sudoCmd,
                    error: errMessage,
                })
                return
            }

            try {
                await clearVersionCheckCache()
            } catch {
                // Intentionally swallowed: version check cache clearing failure should not block success
            }

            let verified = true
            let installedVersion = targetVersion
            let activeVersion = targetVersion
            let activeBinaryPath: string | undefined
            let collisionFixed = false
            let cleanedBinaries: string[] = []
            let failedBinaries: FailedStaleBinary[] = []
            let shadowingBinary: DecemberBinaryInfo | undefined
            let shellHashNotice = false
            let verificationError: string | undefined

            // 2. Post-Update Verification & Collision Resolution
            if (!options?.skipVerification) {
                try {
                    options?.onProgress?.('Verifying updated binary and PATH resolution...')
                    const postDiagnosis = await diagnose()
                    const allFound = postDiagnosis.allBinaries

                    // Find the binary with the highest version
                    let highestVersionBin = allFound[0]
                    for (const b of allFound) {
                        if (
                            b.version &&
                            (!highestVersionBin?.version ||
                                compareVersions(b.version, highestVersionBin.version) > 0)
                        ) {
                            highestVersionBin = b
                        }
                    }

                    if (highestVersionBin?.version) {
                        installedVersion = highestVersionBin.version
                    }

                    // Check if multiple binaries exist or if active binary is shadowed/stale
                    if (allFound.length > 1 && highestVersionBin) {
                        options?.onProgress?.(
                            'Resolving multiple installation paths to ensure active terminal uses latest version...'
                        )
                        const cleanRes = await cleanStale(highestVersionBin, allFound)
                        cleanedBinaries = cleanRes.cleanedOrForwarded
                        failedBinaries = cleanRes.failedBinaries
                        if (cleanedBinaries.length > 0) {
                            collisionFixed = true
                            shellHashNotice = true
                        }
                    }

                    // Re-check authoritative active binary after cleanup
                    const reCheck = await diagnose()
                    if (reCheck.activeBinary) {
                        activeVersion = reCheck.activeBinary.version
                        activeBinaryPath = reCheck.activeBinary.path
                    }

                    if (
                        targetVersion &&
                        reCheck.activeBinary?.version &&
                        compareVersions(reCheck.activeBinary.version, targetVersion) < 0
                    ) {
                        verified = false
                        shadowingBinary = reCheck.activeBinary
                        verificationError = `December CLI was updated to v${installedVersion}, but your active terminal still starts an older version (runs v${reCheck.activeBinary.version} from ${reCheck.activeBinary.path}).`
                    }
                } catch {
                    // Intentionally swallowed: verification fallback should not fail the overall update
                }
            }

            const overallSuccess = verified

            if (overallSuccess && options?.onSuccess) {
                try {
                    await options.onSuccess()
                } catch {
                    // Intentionally swallowed: optional success hook failure ignored
                }
            }

            resolve({
                success: overallSuccess,
                method,
                command,
                manualCmd,
                targetVersion,
                installedVersion,
                activeVersion,
                activeBinaryPath,
                verified,
                collisionFixed,
                cleanedBinaries,
                failedBinaries: failedBinaries.length > 0 ? failedBinaries : undefined,
                shadowingBinary,
                shellHashNotice,
                error: verificationError,
                output: (stdout || 'Update completed successfully.').trim(),
            })
        })
    })
}
