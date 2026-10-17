import { execSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import readline from 'node:readline'

import { loadConfig, saveConfig, type DecemberConfig } from '../config'

export interface EnsureWorkspaceTrustOptions {
    targetDir?: string
    isHeadless?: boolean
}

/**
 * Resolves the root directory of the workspace.
 * If within a git repository, resolves to the top-level repository root.
 * Otherwise, falls back to the resolved target directory.
 */
export function resolveWorkspaceRoot(targetDir: string = process.cwd()): string {
    const resolved = path.resolve(targetDir)
    try {
        const stdout = execSync('git rev-parse --show-toplevel', {
            cwd: resolved,
            stdio: ['ignore', 'pipe', 'ignore'],
            encoding: 'utf8',
        }).trim()
        if (stdout && fs.existsSync(stdout)) {
            return path.resolve(stdout)
        }
    } catch {
        // Intentionally swallowed: git command unavailable or not a git repository
    }

    // Fallback: check upwards for a .git directory
    let current = resolved
    const homeDir = path.resolve(os.homedir())
    while (true) {
        if (fs.existsSync(path.join(current, '.git'))) {
            return current
        }
        const parent = path.dirname(current)
        if (parent === current || current === homeDir) {
            break
        }
        current = parent
    }

    return resolved
}

/**
 * Formats a directory path for display by replacing the home directory with '~'.
 */
export function formatDisplayPath(targetPath: string): string {
    const home = path.resolve(os.homedir())
    const resolved = path.resolve(targetPath)
    if (resolved === home) {
        return '~'
    }
    if (resolved.startsWith(home + path.sep)) {
        return '~' + resolved.slice(home.length)
    }
    return resolved
}

/**
 * Checks whether a workspace root is trusted according to the December configuration.
 * Exact matches are trusted. Child directories of a trusted folder inherit trust,
 * unless the trusted folder is the home directory or system root.
 */
export function isWorkspaceTrusted(workspaceRoot: string, config: DecemberConfig): boolean {
    let canonicalRoot = path.resolve(workspaceRoot)
    try {
        if (fs.existsSync(canonicalRoot)) {
            canonicalRoot = fs.realpathSync(canonicalRoot)
        }
    } catch {
        // Intentionally swallowed: fallback to resolved path
    }
    const homeDir = path.resolve(os.homedir())
    const trustedList = (config.trustedWorkspaces || []).map((p) => {
        const resolved = path.resolve(p)
        try {
            return fs.existsSync(resolved) ? fs.realpathSync(resolved) : resolved
        } catch {
            return resolved
        }
    })

    for (const trustedPath of trustedList) {
        if (canonicalRoot === trustedPath) {
            return true
        }
        // Subdirectories inherit trust unless the trusted directory is root or home directory
        if (trustedPath !== '/' && trustedPath !== homeDir) {
            const rel = path.relative(trustedPath, canonicalRoot)
            if (!rel.startsWith('..') && !path.isAbsolute(rel)) {
                return true
            }
        }
    }

    return false
}

/**
 * Persists a workspace root into the trustedWorkspaces configuration list.
 */
export async function addTrustedWorkspace(workspaceRoot: string): Promise<void> {
    const config = await loadConfig()
    let canonical = path.resolve(workspaceRoot)
    try {
        if (fs.existsSync(canonical)) {
            canonical = fs.realpathSync(canonical)
        }
    } catch {
        // Intentionally swallowed: fallback to resolved path
    }
    const existing = (config.trustedWorkspaces || []).map((p) => {
        const resolved = path.resolve(p)
        try {
            return fs.existsSync(resolved) ? fs.realpathSync(resolved) : resolved
        } catch {
            return resolved
        }
    })
    if (!existing.includes(canonical)) {
        config.trustedWorkspaces = [...existing, canonical]
        await saveConfig(config)
    }
}

/**
 * Prompts the user interactively in the terminal to trust the specified workspace root.
 * Returns true if the user explicitly trusted the folder, false otherwise.
 */
export async function promptWorkspaceTrust(workspaceRoot: string): Promise<boolean> {
    if (!process.stdin.isTTY) {
        return false
    }

    const homeDir = path.resolve(os.homedir())
    const isHomeOrRoot = workspaceRoot === homeDir || workspaceRoot === '/'
    const displayPath = formatDisplayPath(workspaceRoot)

    const BLUE = '\x1b[38;2;135;178;244m'
    const WHITE = '\x1b[38;2;244;244;245m'
    const GRAY = '\x1b[38;2;161;161;170m'
    const TRUNK = '\x1b[38;2;63;63;70m'
    const YELLOW = '\x1b[38;2;253;224;71m'
    const BOLD = '\x1b[1m'
    const RESET = '\x1b[0m'

    const options = isHomeOrRoot
        ? [
              { label: 'Cancel', value: false },
              { label: 'Trust and continue anyway', value: true },
          ]
        : [
              { label: 'Trust and continue', value: true },
              { label: 'Cancel', value: false },
          ]

    return new Promise<boolean>((resolve) => {
        let selectedIndex = 0
        let renderedLineCount = 0

        const wasRaw = process.stdin.isRaw
        if (typeof process.stdin.setRawMode === 'function') {
            process.stdin.setRawMode(true)
        }
        process.stdin.resume()
        readline.emitKeypressEvents(process.stdin)

        const cleanup = () => {
            process.stdin.removeListener('keypress', onKeypress)
            if (typeof process.stdin.setRawMode === 'function' && !wasRaw) {
                process.stdin.setRawMode(false)
            }
            process.stdin.pause()
            process.stdout.write('\x1b[?25h') // show cursor
        }

        const clearRenderedLines = () => {
            if (renderedLineCount > 0) {
                readline.cursorTo(process.stdout, 0)
                readline.moveCursor(process.stdout, 0, -renderedLineCount)
                readline.clearScreenDown(process.stdout)
            }
        }

        const render = () => {
            clearRenderedLines()

            const lines: string[] = []
            lines.push('')
            lines.push(
                `${BLUE}✱${RESET}  ${BOLD}${WHITE}Trust workspace:${RESET} ${GRAY}${displayPath}${RESET}`
            )
            if (isHomeOrRoot) {
                lines.push(
                    `${TRUNK}│${RESET}  ${YELLOW}⚠  Warning: Home or root directory gives access to all personal files.${RESET}`
                )
            }
            lines.push(`${TRUNK}│${RESET}`)

            for (let i = 0; i < options.length; i++) {
                const opt = options[i]
                if (i === selectedIndex) {
                    lines.push(
                        `${TRUNK}│${RESET}  ${BLUE}❯${RESET}  ${BOLD}${WHITE}${opt.label}${RESET}`
                    )
                } else {
                    lines.push(`${TRUNK}│${RESET}     ${GRAY}${opt.label}${RESET}`)
                }
            }

            lines.push(`${TRUNK}│${RESET}`)
            lines.push(`${TRUNK}╰─${RESET} ${GRAY}Enter confirm · Esc cancel${RESET}`)

            renderedLineCount = lines.length
            process.stdout.write(lines.join('\n'))
        }

        const onKeypress = (str: string, key: readline.Key) => {
            if (!key && !str) return

            const lowerStr = (str || '').toLowerCase()
            const keyName = key?.name

            if (lowerStr === 't' || lowerStr === 'y') {
                cleanup()
                clearRenderedLines()
                resolve(true)
                return
            }

            if (lowerStr === 'c' || lowerStr === 'n') {
                cleanup()
                clearRenderedLines()
                resolve(false)
                return
            }

            if (keyName === 'up' || keyName === 'k') {
                selectedIndex = Math.max(0, selectedIndex - 1)
                render()
            } else if (keyName === 'down' || keyName === 'j' || keyName === 'tab') {
                selectedIndex = Math.min(options.length - 1, selectedIndex + 1)
                render()
            } else if (keyName === 'return' || keyName === 'enter' || keyName === 'space') {
                cleanup()
                clearRenderedLines()
                resolve(options[selectedIndex].value)
            } else if (keyName === 'escape' || (key?.ctrl && keyName === 'c')) {
                cleanup()
                clearRenderedLines()
                resolve(false)
            }
        }

        process.stdout.write('\x1b[?25l') // hide cursor
        process.stdin.on('keypress', onKeypress)
        render()
    })
}

/**
 * Ensures that the workspace is trusted before proceeding.
 * In headless or non-interactive mode, exits with an error if untrusted.
 * In interactive mode, prompts the user before entering the session.
 */
export async function ensureWorkspaceTrust(
    options: EnsureWorkspaceTrustOptions = {}
): Promise<void> {
    const workspaceRoot = resolveWorkspaceRoot(options.targetDir || process.cwd())
    const config = await loadConfig()

    if (isWorkspaceTrusted(workspaceRoot, config)) {
        return
    }

    const isNonInteractive =
        Boolean(options.isHeadless) ||
        !process.stdin.isTTY ||
        Boolean(process.env.NON_INTERACTIVE) ||
        Boolean(process.env.CI)

    if (isNonInteractive) {
        const RED = '\x1b[38;2;252;165;165m'
        const RESET = '\x1b[0m'
        console.error(`\n${RED}Error:${RESET} Workspace "${workspaceRoot}" is not trusted.`)
        console.error(
            `Please run "december" interactively first to review and trust this workspace.\n`
        )
        process.exit(1)
    }

    const trusted = await promptWorkspaceTrust(workspaceRoot)
    if (!trusted) {
        console.log('\nWorkspace untrusted. Exiting.\n')
        process.exit(0)
    }

    await addTrustedWorkspace(workspaceRoot)

    const GREEN = '\x1b[38;2;110;231;183m'
    const WHITE = '\x1b[38;2;244;244;245m'
    const GRAY = '\x1b[38;2;161;161;170m'
    const RESET = '\x1b[0m'
    console.log(
        `${GREEN}✔${RESET}  ${WHITE}Trusted workspace:${RESET} ${GRAY}${formatDisplayPath(workspaceRoot)}${RESET}`
    )
}
