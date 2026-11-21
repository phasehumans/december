import fs from 'node:fs'
import path from 'node:path'

import pkg from '../../package.json' with { type: 'json' }

/**
 * Health checks shared by `december doctor` (printed) and `/check` (tui overlay).
 */

export type DoctorStatus = 'ok' | 'warn' | 'fail'

export interface DoctorCheck {
    group: string
    label: string
    status: DoctorStatus
    detail?: string
    /** what to run or change to fix a warn / fail */
    fix?: string
}

export interface DoctorMcpServerStatus {
    name: string
    scope: string
    status: 'connected' | 'connecting' | 'disconnected' | 'error'
    error?: string
}

export interface DoctorCheckOptions {
    workspaceDir: string
    /** status of running MCP servers (tui). The shell doctor does not start servers. */
    mcpServers?: DoctorMcpServerStatus[]
    /** include install and binary checks (the shell doctor prints these itself) */
    includeInstall?: boolean
}

/** a rule file above this size is sent with every request and costs a lot of tokens */
export const AGENTS_MD_WARN_CHARS = 40_000

/** checks that a JSON file parses. A missing file is fine. */
export function checkJsonFile(group: string, label: string, filePath: string): DoctorCheck {
    const shown = toDisplayPath(filePath)
    if (!fs.existsSync(filePath)) {
        return { group, label, status: 'ok', detail: `${shown} (not created)` }
    }
    try {
        JSON.parse(fs.readFileSync(filePath, 'utf-8'))
        return { group, label, status: 'ok', detail: shown }
    } catch (err: any) {
        return {
            group,
            label,
            status: 'fail',
            detail: `${shown}: ${err?.message || String(err)}`,
            fix: `Fix the JSON in ${shown}`,
        }
    }
}

export function toDisplayPath(p: string): string {
    // inside the working folder: a relative path; elsewhere under home: ~/...
    const relative = path.relative(process.cwd(), p)
    if (relative && !relative.startsWith('..') && !path.isAbsolute(relative)) return relative
    const home = process.env.HOME || process.env.USERPROFILE || ''
    if (home && p.startsWith(home + path.sep)) return '~' + p.slice(home.length)
    return p
}

export async function runDoctorChecks(options: DoctorCheckOptions): Promise<DoctorCheck[]> {
    const checks: DoctorCheck[] = []
    const workspaceDir = path.resolve(options.workspaceDir)

    // 1. Install
    if (options.includeInstall) {
        const runtimeName = process.versions.bun ? 'Bun' : 'Node.js'
        const runtimeVer = process.versions.bun || process.versions.node
        checks.push({
            group: 'Install',
            label: 'December',
            status: 'ok',
            detail: `v${pkg.version} on ${runtimeName} v${runtimeVer} (${process.platform}-${process.arch})`,
        })
        try {
            const { diagnoseBinaryCollisions } = await import('./bin-discovery')
            const diagnosis = await diagnoseBinaryCollisions({ argv1: process.argv[1] })
            checks.push(
                diagnosis.hasCollision
                    ? {
                          group: 'Install',
                          label: 'Binaries',
                          status: 'warn',
                          detail: `${diagnosis.allBinaries.length} installs found on PATH`,
                          fix: 'Run `december doctor --fix` in your terminal',
                      }
                    : {
                          group: 'Install',
                          label: 'Binaries',
                          status: 'ok',
                          detail: 'single install',
                      }
            )
        } catch (err: any) {
            checks.push({
                group: 'Install',
                label: 'Binaries',
                status: 'warn',
                detail: `could not check: ${err?.message || String(err)}`,
            })
        }
    }

    // 2. Auth
    try {
        const { getProviderConfig } = await import('../config')
        const provider = await getProviderConfig()
        if (provider && (provider.apiKey || provider.subscription || provider.authMethod)) {
            checks.push({
                group: 'Auth',
                label: 'Active provider',
                status: 'ok',
                detail: `${provider.provider}${provider.model ? ` · ${provider.model}` : ''}${provider.authMethod ? ` (${provider.authMethod})` : ''}`,
            })
        } else {
            checks.push({
                group: 'Auth',
                label: 'Active provider',
                status: 'fail',
                detail: 'no API key or login found',
                fix: 'Run /login (or `december login`)',
            })
        }
    } catch (err: any) {
        checks.push({
            group: 'Auth',
            label: 'Active provider',
            status: 'fail',
            detail: err?.message || String(err),
            fix: 'Run /login (or `december login`)',
        })
    }

    // 3. Settings files
    const { getConfigDir, getConfigFile } = await import('../config')
    const configDir = getConfigDir()
    checks.push(checkJsonFile('Settings', 'Global config', getConfigFile()))
    checks.push(
        checkJsonFile(
            'Settings',
            'Project settings',
            path.join(workspaceDir, '.december', 'settings.json')
        )
    )
    checks.push(checkJsonFile('Settings', 'Global hooks', path.join(configDir, 'hooks.json')))
    checks.push(
        checkJsonFile(
            'Settings',
            'Project hooks',
            path.join(workspaceDir, '.december', 'hooks.json')
        )
    )
    try {
        const { validateUserHooksFile } = await import('@december/shared')
        for (const file of [
            path.join(configDir, 'hooks.json'),
            path.join(workspaceDir, '.december', 'hooks.json'),
        ]) {
            for (const problem of validateUserHooksFile(file)) {
                checks.push({
                    group: 'Settings',
                    label: 'Hooks',
                    status: 'warn',
                    detail: `${toDisplayPath(file)}: ${problem}`,
                })
            }
        }
    } catch (err: any) {
        checks.push({
            group: 'Settings',
            label: 'Hooks',
            status: 'warn',
            detail: `could not check: ${err?.message || String(err)}`,
        })
    }
    const keybindingsPath = path.join(configDir, 'keybindings.json')
    checks.push(checkJsonFile('Settings', 'Keybindings', keybindingsPath))
    try {
        const { validateKeybindingsFile } = await import('@december/tui')
        for (const problem of validateKeybindingsFile(keybindingsPath)) {
            checks.push({
                group: 'Settings',
                label: 'Keybindings',
                status: 'warn',
                detail: problem,
                fix: 'Run /keybindings to edit the file',
            })
        }
    } catch (err: any) {
        checks.push({
            group: 'Settings',
            label: 'Keybindings',
            status: 'warn',
            detail: `could not check: ${err?.message || String(err)}`,
        })
    }

    // 4. MCP servers
    checks.push(
        checkJsonFile('MCP', 'Project MCP config', path.join(workspaceDir, '.december', 'mcp.json'))
    )
    if (options.mcpServers) {
        if (options.mcpServers.length === 0) {
            checks.push({ group: 'MCP', label: 'Servers', status: 'ok', detail: 'none configured' })
        }
        for (const server of options.mcpServers) {
            if (server.status === 'connected') {
                checks.push({
                    group: 'MCP',
                    label: server.name,
                    status: 'ok',
                    detail: `connected (${server.scope})`,
                })
            } else if (server.status === 'error') {
                checks.push({
                    group: 'MCP',
                    label: server.name,
                    status: 'fail',
                    detail: server.error || 'failed to start',
                    fix: 'Open /mcp to see the error and restart the server',
                })
            } else {
                checks.push({
                    group: 'MCP',
                    label: server.name,
                    status: 'warn',
                    detail: `${server.status} (${server.scope})`,
                    fix: 'Open /mcp to start it',
                })
            }
        }
    } else {
        try {
            const { listMcpServersWithScope } = await import('@december/tools')
            const servers = await listMcpServersWithScope({ workspaceDir })
            checks.push({
                group: 'MCP',
                label: 'Servers',
                status: 'ok',
                detail:
                    servers.length === 0
                        ? 'none configured'
                        : `${servers.length} configured: ${servers.map((s) => s.name).join(', ')} (run /check in the tui to see if they start)`,
            })
        } catch (err: any) {
            checks.push({
                group: 'MCP',
                label: 'Servers',
                status: 'warn',
                detail: `could not read MCP config: ${err?.message || String(err)}`,
            })
        }
    }

    // 5. Skills
    try {
        const { SkillDiscoveryEngine } = await import('@december/shared')
        const engine = new SkillDiscoveryEngine({ workspaceDir })
        const skills = engine.discoverAllSkills()
        const errors = engine.getErrors()
        checks.push({
            group: 'Skills',
            label: 'Skills',
            status: 'ok',
            detail: `${skills.length} loaded`,
        })
        for (const e of errors) {
            checks.push({
                group: 'Skills',
                label: toDisplayPath(e.path),
                status: 'fail',
                detail: e.message,
                fix: 'Fix the frontmatter (name and description are required)',
            })
        }
    } catch (err: any) {
        checks.push({
            group: 'Skills',
            label: 'Skills',
            status: 'warn',
            detail: `could not scan: ${err?.message || String(err)}`,
        })
    }

    // 6. Rules
    try {
        const { discoverProjectRules } = await import('@december/shared')
        const files = discoverProjectRules(workspaceDir)
        if (files.length === 0) {
            checks.push({
                group: 'Rules',
                label: 'AGENTS.md',
                status: 'ok',
                detail: 'none found (optional, run /memory to create one)',
            })
        }
        for (const file of files) {
            const chars = file.content.length
            const tokens = Math.ceil(chars / 4)
            const size = `${chars.toLocaleString('en-US')} chars, ~${tokens.toLocaleString('en-US')} tokens`
            checks.push(
                chars > AGENTS_MD_WARN_CHARS
                    ? {
                          group: 'Rules',
                          label: toDisplayPath(file.path),
                          status: 'warn',
                          detail: `${size}. It is sent with every request.`,
                          fix: `Keep it under ${AGENTS_MD_WARN_CHARS.toLocaleString('en-US')} chars, move details into skills`,
                      }
                    : {
                          group: 'Rules',
                          label: toDisplayPath(file.path),
                          status: 'ok',
                          detail: size,
                      }
            )
        }
    } catch (err: any) {
        checks.push({
            group: 'Rules',
            label: 'AGENTS.md',
            status: 'warn',
            detail: `could not read: ${err?.message || String(err)}`,
        })
    }

    return checks
}

/** prints checks for the shell doctor, grouped, with colours */
export function printDoctorChecks(checks: DoctorCheck[]): void {
    const GREEN = '\x1b[38;2;110;231;183m'
    const YELLOW = '\x1b[38;2;253;224;71m'
    const RED = '\x1b[38;2;252;165;165m'
    const WHITE = '\x1b[38;2;244;244;245m'
    const GRAY = '\x1b[38;2;161;161;170m'
    const RESET = '\x1b[0m'

    const groups: string[] = []
    for (const c of checks) if (!groups.includes(c.group)) groups.push(c.group)

    for (const group of groups) {
        console.log(`${WHITE}${group}:${RESET}`)
        for (const c of checks.filter((x) => x.group === group)) {
            const mark =
                c.status === 'ok'
                    ? `${GREEN}✓${RESET}`
                    : c.status === 'warn'
                      ? `${YELLOW}!${RESET}`
                      : `${RED}✗${RESET}`
            console.log(`  ${mark} ${c.label}${c.detail ? `  ${GRAY}${c.detail}${RESET}` : ''}`)
            if (c.fix && c.status !== 'ok') {
                console.log(`    ${GRAY}↳ ${c.fix}${RESET}`)
            }
        }
        console.log('')
    }
}
