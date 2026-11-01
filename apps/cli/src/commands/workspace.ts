import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

export async function handleOpenCommand(options?: { path?: string }): Promise<void> {
    const rawPath = options?.path?.trim()
    const targetPath = rawPath || '.'
    const fullPath = path.resolve(process.cwd(), targetPath)

    if (targetPath !== '.' && !fs.existsSync(fullPath)) {
        console.error(`\x1b[38;2;252;165;165mError:\x1b[0m File not found: ${rawPath}`)
        process.exitCode = 1
        return
    }

    const label = targetPath === '.' ? 'workspace' : targetPath
    console.log(`Opening ${label} in your default editor...`)

    try {
        const { openPath } = await import('../utils/open')
        await openPath(fullPath)
    } catch (e: any) {
        // Intentionally swallowed: user-facing error message printed
        console.error(
            `\x1b[38;2;252;165;165mFailed to open ${label}:\x1b[0m ${e?.message || 'Unknown error'}`
        )
    }
}

export async function handleCodeSearchCommand(options?: { query?: string }): Promise<void> {
    const query = options?.query?.trim()
    if (!query) {
        console.error(
            '\x1b[38;2;252;165;165mError:\x1b[0m Please provide a search query. (e.g. december codesearch <query>)'
        )
        process.exitCode = 1
        return
    }

    try {
        const { localOperations } = await import('../local-operations')
        const output = await localOperations.search.grep('.', query)
        if (!output || !output.trim()) {
            console.log(`No matches found for "${query}".`)
            return
        }

        const lines = output.split('\n').filter((l) => Boolean(l.trim()))
        console.log(`\n\x1b[1mCode Search Results (${lines.length}):\x1b[0m\n`)
        for (const line of lines.slice(0, 50)) {
            const firstColon = line.indexOf(':')
            const secondColon = line.indexOf(':', firstColon + 1)
            if (firstColon !== -1 && secondColon !== -1) {
                const file = line.slice(0, firstColon)
                const lineNum = line.slice(firstColon + 1, secondColon)
                const content = line.slice(secondColon + 1).trim()
                console.log(`  \x1b[38;2;135;178;244m${file}:${lineNum}\x1b[0m ${content}`)
            } else {
                console.log(`  ${line}`)
            }
        }
        if (lines.length > 50) {
            console.log(`\n  ... and ${lines.length - 50} more matches.`)
        }
        console.log('')
    } catch (e: any) {
        // Intentionally swallowed: user-facing error message printed
        console.error(
            `\x1b[38;2;252;165;165mCode search failed:\x1b[0m ${e?.message || 'Unknown error'}`
        )
    }
}

export async function handleSkillCommand(options?: {
    action?: string
    target?: string
    isGlobal?: boolean
}): Promise<void> {
    const { SkillDiscoveryEngine } = await import('@december/shared')
    const action = (options?.action || 'list').toLowerCase().trim()
    const target = options?.target?.trim()
    const homeDir = process.env.HOME || process.env.USERPROFILE || os.homedir()

    switch (action) {
        case 'list': {
            const engine = new SkillDiscoveryEngine({ workspaceDir: process.cwd(), homeDir })
            const skills = engine.discoverAllSkills()

            console.log(`\n\x1b[1mDiscovered Skills (${skills.length}):\x1b[0m\n`)
            if (skills.length === 0) {
                console.log(
                    'No skills discovered. Install skills using "december skill add <repo>".\n'
                )
                return
            }

            for (const s of skills) {
                const originLabel = `[\x1b[38;2;135;178;244m${s.origin}\x1b[0m]`
                const nameLabel = `\x1b[1m/${s.name}\x1b[0m`
                const rawDesc = s.metadata.description || ''
                const desc = rawDesc ? ` - ${rawDesc.replace(/\s+/g, ' ').slice(0, 75)}...` : ''
                console.log(`  ${originLabel} ${nameLabel}${desc}`)
            }
            console.log(
                '\nUse /<skill-name> in the December TUI or "december skill info <name>" for details.\n'
            )
            return
        }

        case 'info': {
            if (!target) {
                console.error(
                    '\x1b[31mError:\x1b[0m Please specify a skill name: december skill info <name>\n'
                )
                process.exitCode = 1
                return
            }
            const engine = new SkillDiscoveryEngine({ workspaceDir: process.cwd(), homeDir })
            const skills = engine.discoverAllSkills()
            const found = skills.find((s) => s.name.toLowerCase() === target.toLowerCase())
            if (!found) {
                console.error(`\x1b[31mError:\x1b[0m Skill "${target}" not found.\n`)
                process.exitCode = 1
                return
            }

            console.log(`\n\x1b[1mSkill: /${found.name}\x1b[0m`)
            console.log(`Origin: ${found.origin}`)
            console.log(`Path: ${found.directoryPath}`)
            if (found.metadata.argumentHint) {
                console.log(`Arguments: ${found.metadata.argumentHint}`)
            }
            console.log(`\nDescription:\n${found.metadata.description}\n`)
            return
        }

        case 'add': {
            if (!target) {
                console.error(
                    '\x1b[31mError:\x1b[0m Please specify a repository: december skill add <repo-or-url>\n'
                )
                console.error('Examples:')
                console.error('  december skill add phasehumans/skills')
                console.error('  december skill add mattpocock/skills\n')
                process.exitCode = 1
                return
            }

            const targetDir = options?.isGlobal
                ? path.join(homeDir, '.december', 'skills')
                : path.join(process.cwd(), '.december', 'skills')

            if (!fs.existsSync(targetDir)) {
                fs.mkdirSync(targetDir, { recursive: true })
            }

            let repoUrl = target
            let folderName = target.replace(/[^a-zA-Z0-9_-]/g, '-').toLowerCase()
            if (
                !target.startsWith('http://') &&
                !target.startsWith('https://') &&
                !target.startsWith('git@')
            ) {
                repoUrl = `https://github.com/${target}.git`
                const parts = target.split('/')
                folderName = (parts[parts.length - 1] || target).replace(/\.git$/, '')
            }

            const destPath = path.join(targetDir, folderName)
            if (fs.existsSync(destPath)) {
                console.log(
                    `Skill package "${folderName}" already exists at ${destPath}. Updating...`
                )
                try {
                    const { execSync } = await import('node:child_process')
                    execSync('git pull', { cwd: destPath, stdio: 'inherit' })
                    console.log(`\x1b[32mSuccessfully updated skills in ${destPath}\x1b[0m\n`)
                } catch (err: any) {
                    console.error(`Failed to update skill: ${err.message}`)
                    process.exitCode = 1
                }
                return
            }

            console.log(`Downloading skills from ${repoUrl} into ${destPath}...`)
            try {
                const { execSync } = await import('node:child_process')
                execSync(`git clone --depth 1 ${repoUrl} "${destPath}"`, { stdio: 'inherit' })
                console.log(`\n\x1b[32mSuccessfully added skills from ${target}!\x1b[0m`)
                console.log(`Installed to: ${destPath}\n`)
            } catch (err: any) {
                console.error(`Failed to add skill: ${err.message}`)
                process.exitCode = 1
            }
            return
        }

        case 'remove': {
            if (!target) {
                console.error(
                    '\x1b[31mError:\x1b[0m Please specify a skill name to remove: december skill remove <name>\n'
                )
                process.exitCode = 1
                return
            }

            const localPath = path.join(process.cwd(), '.december', 'skills', target)
            const globalPath = path.join(homeDir, '.december', 'skills', target)

            let removed = false
            if (fs.existsSync(localPath)) {
                fs.rmSync(localPath, { recursive: true, force: true })
                console.log(`Removed local skill: ${localPath}`)
                removed = true
            }
            if (fs.existsSync(globalPath)) {
                fs.rmSync(globalPath, { recursive: true, force: true })
                console.log(`Removed global skill: ${globalPath}`)
                removed = true
            }

            if (!removed) {
                console.error(
                    `Skill "${target}" was not found in local or global .december/skills.\n`
                )
                process.exitCode = 1
            } else {
                console.log(`\x1b[32mSkill "${target}" removed successfully.\x1b[0m\n`)
            }
            return
        }

        default: {
            console.log('\nUsage: december skill [list|info|add|remove] [options]')
            console.log('\nCommands:')
            console.log('  list             List all discovered skills')
            console.log('  info <name>      Display skill metadata and runbook')
            console.log(
                '  add <repo>       Add skills from GitHub (e.g. phasehumans/skills or mattpocock/skills)'
            )
            console.log('  remove <name>    Remove an installed skill package')
            console.log('\nOptions:')
            console.log(
                '  --global, -g     Install or operate on global user skills (~/.december/skills)\n'
            )
        }
    }
}

export async function handleMcpCommand(options?: { action?: string }): Promise<void> {
    const { loadMcpConfig, McpClientManager } = await import('@december/tools')
    const config = await loadMcpConfig({ workspaceDir: process.cwd() })
    const serverKeys = Object.keys(config)

    const BOLD = '\x1b[1m'
    const RESET = '\x1b[0m'
    const GREEN = '\x1b[32m'
    const RED = '\x1b[31m'
    const GRAY = '\x1b[90m'
    const BLUE = '\x1b[34m'

    if (serverKeys.length === 0) {
        console.log(`\n${BOLD}No MCP servers configured.${RESET}\n`)
        console.log('To configure an MCP server, add an "mcpServers" entry in either:')
        console.log(`  • Global: ${GRAY}~/.december/config.json${RESET}`)
        console.log(`  • Project: ${GRAY}.december/mcp.json${RESET}\n`)
        console.log('Example .december/mcp.json:')
        console.log(
            GRAY +
                JSON.stringify(
                    {
                        mcpServers: {
                            postgres: {
                                command: 'npx',
                                args: [
                                    '-y',
                                    '@modelcontextprotocol/server-postgres',
                                    'postgresql://localhost/db',
                                ],
                            },
                            remote: {
                                url: 'http://localhost:8000/sse',
                            },
                        },
                    },
                    null,
                    2
                ) +
                RESET +
                '\n'
        )
        return
    }

    console.log(
        `\n${BOLD}Model Context Protocol (MCP) Servers (${serverKeys.length} configured)${RESET}\n`
    )

    const manager = new McpClientManager({ workspaceDir: process.cwd() })
    const results = await manager.connectAll(config)

    for (const [name, info] of Object.entries(results)) {
        const typeStr =
            info.config && 'command' in info.config && info.config.command ? 'stdio' : 'sse'
        const statusColor =
            info.status === 'connected' ? GREEN : info.status === 'error' ? RED : GRAY
        const statusTag = `${statusColor}● ${info.status.toUpperCase()}${RESET}`

        const target =
            'command' in info.config && info.config.command
                ? `${info.config.command}${info.config.args ? ' ' + info.config.args.join(' ') : ''}`
                : (info.config as any)?.url || (info.config as any)?.endpoint || ''

        console.log(`  ${BOLD}${name}${RESET} [${typeStr}] - ${statusTag}`)
        console.log(`    Target: ${GRAY}${target}${RESET}`)

        if (info.error) {
            console.log(`    ${RED}Error: ${info.error}${RESET}`)
        }

        if (info.tools && info.tools.length > 0) {
            console.log(`    Tools (${info.tools.length}):`)
            for (const tool of info.tools) {
                const desc = tool.description
                    ? ` - ${GRAY}${tool.description.split('\n')[0]}${RESET}`
                    : ''
                console.log(`      • ${BLUE}${tool.name}${RESET}${desc}`)
            }
        } else if (info.status === 'connected') {
            console.log(`    ${GRAY}(No tools exported by this server)${RESET}`)
        }

        console.log('')
    }

    await manager.disconnectAll().catch(() => {
        // Intentionally swallowed: cleanup error
    })
}

export async function handleRewindCommand(options?: {
    turn?: number
    list?: boolean
}): Promise<void> {
    const BLUE = '\x1b[38;2;135;178;244m'
    const GREEN = '\x1b[38;2;110;231;183m'
    const YELLOW = '\x1b[38;2;253;224;71m'
    const RED = '\x1b[38;2;252;165;165m'
    const WHITE = '\x1b[38;2;244;244;245m'
    const GRAY = '\x1b[38;2;161;161;170m'
    const RESET = '\x1b[0m'
    const BOLD = '\x1b[1m'

    const { getSnapshotManager } = await import('@december/tools')
    const manager = getSnapshotManager(process.cwd())
    await manager.init()

    const snapshots = manager.getSnapshots()

    if (options?.list) {
        if (snapshots.length === 0) {
            console.log(`\n${GRAY}No snapshots recorded in this workspace.${RESET}\n`)
            return
        }

        console.log(`\n${BOLD}Available Turn Snapshots (${snapshots.length}):${RESET}\n`)
        for (const snap of snapshots) {
            const dateStr = new Date(snap.timestamp).toLocaleTimeString()
            const promptPreview = snap.prompt ? `"${snap.prompt.slice(0, 50)}"` : '(no prompt)'
            console.log(
                `  ${BLUE}Turn ${snap.turnIndex}${RESET} [${GRAY}${dateStr}${RESET}] - ${WHITE}${promptPreview}${RESET}`
            )
            console.log(`    Commit: ${GRAY}${snap.commitHash.slice(0, 8)}${RESET}`)
        }
        console.log(
            `\nRun ${WHITE}december rewind --turn <number>${RESET} to restore to a specific turn.\n`
        )
        return
    }

    if (snapshots.length === 0) {
        console.log(`\n${YELLOW}Warning:${RESET} No snapshots available to rewind.\n`)
        return
    }

    const targetTurn =
        options?.turn !== undefined ? options.turn : snapshots[snapshots.length - 1]?.turnIndex
    if (targetTurn === undefined) {
        console.log(`\n${RED}Error:${RESET} Invalid target turn.\n`)
        return
    }

    try {
        const result = await manager.rollbackToTurn(targetTurn)
        console.log(
            `\n${GREEN}✓ Successfully rewound workspace to Turn ${result.targetTurn}.${RESET}`
        )
        if (result.restoredFiles.length > 0) {
            console.log(`  Restored ${result.restoredFiles.length} file(s):`)
            for (const f of result.restoredFiles) {
                console.log(`    • ${BLUE}${f}${RESET}`)
            }
        }
        if (result.deletedFiles.length > 0) {
            console.log(`  Deleted ${result.deletedFiles.length} newly added file(s):`)
            for (const f of result.deletedFiles) {
                console.log(`    • ${RED}${f}${RESET}`)
            }
        }
        console.log('')
    } catch (e: any) {
        console.error(`\n${RED}Failed to rewind:${RESET} ${e.message}\n`)
    }
}
