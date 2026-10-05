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
 * Checks whether a workspace root is trusted according to the December configuration.
 * Exact matches are trusted. Child directories of a trusted folder inherit trust,
 * unless the trusted folder is the home directory or system root.
 */
export function isWorkspaceTrusted(workspaceRoot: string, config: DecemberConfig): boolean {
    const canonicalRoot = path.resolve(workspaceRoot)
    const homeDir = path.resolve(os.homedir())
    const trustedList = (config.trustedWorkspaces || []).map((p) => path.resolve(p))

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
    const canonical = path.resolve(workspaceRoot)
    const existing = (config.trustedWorkspaces || []).map((p) => path.resolve(p))
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

    const BRAND = '\x1b[38;2;137;180;248m'
    const TEXT = '\x1b[38;2;244;244;245m'
    const MUTED = '\x1b[38;2;170;170;170m'
    const GRAY = '\x1b[38;2;119;119;119m'
    const YELLOW = '\x1b[38;2;253;214;99m'
    const BOLD = '\x1b[1m'
    const RESET = '\x1b[0m'

    const options = isHomeOrRoot
        ? [
              { label: 'No, exit', value: false },
              { label: 'Yes, trust folder anyway', value: true },
          ]
        : [
              { label: 'Yes, trust folder', value: true },
              { label: 'No, exit', value: false },
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
            lines.push(`  ${BOLD}${TEXT}Trust workspace?${RESET}`)
            lines.push('')
            lines.push(`  ${GRAY}Directory${RESET}   ${BOLD}${BRAND}${workspaceRoot}${RESET}`)

            if (isHomeOrRoot) {
                lines.push(
                    `  ${YELLOW}Warning${RESET}     ${YELLOW}Home or system root directory. Gives access to all personal files.${RESET}`
                )
            } else {
                lines.push(
                    `  ${GRAY}Permission${RESET}  ${TEXT}Read, edit, and run commands${RESET}`
                )
            }

            lines.push('')

            for (let i = 0; i < options.length; i++) {
                const opt = options[i]
                if (i === selectedIndex) {
                    lines.push(`  ${BRAND}❭${RESET} ${BOLD}${TEXT}${opt.label}${RESET}`)
                } else {
                    lines.push(`    ${MUTED}${opt.label}${RESET}`)
                }
            }

            lines.push('')
            lines.push(
                `  ${BRAND}Enter${RESET} ${MUTED}confirm${RESET} ${MUTED}·${RESET} ${BRAND}Esc${RESET} ${MUTED}cancel${RESET} ${MUTED}·${RESET} ${BRAND}↑↓${RESET} ${MUTED}navigate${RESET}`
            )
            lines.push('')

            renderedLineCount = lines.length
            process.stdout.write(lines.join('\n'))
        }

        const onKeypress = (str: string, key: readline.Key) => {
            if (!key && !str) return

            const lowerStr = (str || '').toLowerCase()
            const keyName = key?.name

            if (lowerStr === 'y' || keyName === 'y') {
                cleanup()
                clearRenderedLines()
                resolve(true)
                return
            }

            if (lowerStr === 'n' || keyName === 'n') {
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
            } else if (keyName === 'return' || keyName === 'enter') {
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
}
