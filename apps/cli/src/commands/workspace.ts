import fs from 'node:fs'
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

export interface HandleMcpCommandOptions {
    action?: string
    name?: string
    target?: string
    args?: string[]
    scope?: string
    isGlobal?: boolean
    env?: string[]
    headers?: string[]
    eager?: boolean
}

function parseEnvList(envList?: string[]): Record<string, string> | undefined {
    if (!envList || envList.length === 0) return undefined
    const env: Record<string, string> = {}
    for (const item of envList) {
        const idx = item.indexOf('=')
        if (idx > 0) {
            const k = item.slice(0, idx).trim()
            const v = item.slice(idx + 1).trim()
            if (k) env[k] = v
        }
    }
    return Object.keys(env).length > 0 ? env : undefined
}

function parseHeaderList(headerList?: string[]): Record<string, string> | undefined {
    if (!headerList || headerList.length === 0) return undefined
    const headers: Record<string, string> = {}
    for (const item of headerList) {
        const separatorIdx = item.includes(':') ? item.indexOf(':') : item.indexOf('=')
        if (separatorIdx > 0) {
            const k = item.slice(0, separatorIdx).trim()
            const v = item.slice(separatorIdx + 1).trim()
            if (k) headers[k] = v
        }
    }
    return Object.keys(headers).length > 0 ? headers : undefined
}

export async function handleMcpCommand(options?: HandleMcpCommandOptions): Promise<void> {
    const {
        loadMcpConfig,
        McpClientManager,
        addMcpServerConfig,
        removeMcpServerConfig,
        getMcpServerConfig,
        listMcpServersWithScope,
    } = await import('@december/tools')

    const action = (options?.action || 'list').toLowerCase().trim()
    const name = options?.name?.trim()
    const target = options?.target?.trim()
    const rawScope = (options?.scope || '').toLowerCase().trim()
    const scope: 'global' | 'project' =
        rawScope === 'project' || rawScope === 'local' ? 'project' : 'global'

    const BOLD = '\x1b[1m'
    const RESET = '\x1b[0m'
    const GREEN = '\x1b[32m'
    const RED = '\x1b[31m'
    const GRAY = '\x1b[90m'
    const BLUE = '\x1b[34m'
    const CYAN = '\x1b[36m'

    switch (action) {
        case 'add': {
            if (!name || !target) {
                console.error(
                    `\n${RED}Error:${RESET} Please specify server name and target (command or URL).`
                )
                console.log('Usage: december mcp add <name> <commandOrUrl> [args...] [options]\n')
                return
            }

            const isUrl = target.startsWith('http://') || target.startsWith('https://')
            const eager = Boolean(options?.eager)
            const env = parseEnvList(options?.env)
            const headers = parseHeaderList(options?.headers)

            const serverConfig = isUrl
                ? {
                      url: target,
                      ...(headers ? { headers } : {}),
                      ...(eager ? { eager: true } : {}),
                  }
                : {
                      command: target,
                      ...(options?.args && options.args.length > 0 ? { args: options.args } : {}),
                      ...(env ? { env } : {}),
                      ...(eager ? { eager: true } : {}),
                  }

            await addMcpServerConfig(name, serverConfig as any, { scope })
            console.log(`\n${GREEN}✓${RESET} Added MCP server "${name}" (${scope} scope).`)
            console.log(`  Target: ${GRAY}${target}${RESET}\n`)
            return
        }

        case 'remove': {
            if (!name) {
                console.error(
                    `\n${RED}Error:${RESET} Please specify the MCP server name to remove.`
                )
                console.log('Usage: december mcp remove <name> [--scope global|project]\n')
                return
            }

            const removed = await removeMcpServerConfig(name, {
                scope: options?.scope ? scope : undefined,
            })
            if (removed) {
                console.log(`\n${GREEN}✓${RESET} Removed MCP server "${name}".\n`)
            } else {
                console.log(`\n${RED}✗${RESET} MCP server "${name}" not found.\n`)
            }
            return
        }

        case 'get': {
            if (!name) {
                console.error(`\n${RED}Error:${RESET} Please specify the MCP server name to get.`)
                console.log('Usage: december mcp get <name>\n')
                return
            }

            const found = await getMcpServerConfig(name)
            if (!found) {
                console.log(`\n${RED}✗${RESET} MCP Server: ${BOLD}${name}${RESET} not found.\n`)
                return
            }

            console.log(`\n${BOLD}MCP Server: ${name}${RESET}`)
            console.log(`  Scope: ${CYAN}[${found.scope}]${RESET}`)
            const stdioCfg =
                'command' in found.config && found.config.command ? (found.config as any) : null
            console.log(`  Transport: ${stdioCfg ? 'stdio' : 'sse/http'}`)
            console.log(
                `  Target: ${stdioCfg ? stdioCfg.command : (found.config as any).url || ''}`
            )
            if (found.config.eager) {
                console.log(`  Eager: true (injected in turn-1 prompt)`)
            }
            console.log('')
            return
        }

        case 'list':
        case 'status':
        default: {
            const allServers = await listMcpServersWithScope({ workspaceDir: process.cwd() })

            if (allServers.length === 0) {
                console.log(`\n${BOLD}No MCP servers configured.${RESET}\n`)
                console.log('To configure an MCP server, add an "mcpServers" entry in either:')
                console.log(`  • Global: ${GRAY}~/.december/config.json${RESET}`)
                console.log(`  • Project: ${GRAY}.december/mcp.json${RESET}\n`)
                console.log('Or use the CLI:')
                console.log(
                    `  december mcp add github npx -y @modelcontextprotocol/server-github -e GITHUB_TOKEN=xxx\n`
                )
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
                `\n${BOLD}Model Context Protocol (MCP) Servers (${allServers.length} configured)${RESET}\n`
            )

            const configMap: Record<string, any> = {}
            for (const s of allServers) {
                configMap[s.name] = s.config
            }

            const manager = new McpClientManager({ workspaceDir: process.cwd() })
            const results = await manager.connectAll(configMap)

            for (const item of allServers) {
                const info = results[item.name]
                const typeStr =
                    item.config && 'command' in item.config && item.config.command
                        ? 'stdio'
                        : 'sse/http'
                const statusColor =
                    info?.status === 'connected' ? GREEN : info?.status === 'error' ? RED : GRAY
                const statusTag = `${statusColor}● ${(info?.status || 'disconnected').toUpperCase()}${RESET}`
                const scopeBadge = `${CYAN}[${item.scope}]${RESET}`

                const target =
                    'command' in item.config && item.config.command
                        ? `${item.config.command}${item.config.args ? ' ' + item.config.args.join(' ') : ''}`
                        : (item.config as any)?.url || (item.config as any)?.endpoint || ''

                console.log(
                    `  ${scopeBadge} ${BOLD}${item.name}${RESET} [${typeStr}] - ${statusTag}`
                )
                console.log(`    Target: ${GRAY}${target}${RESET}`)

                if (info?.error) {
                    console.log(`    ${RED}Error: ${info.error}${RESET}`)
                }

                if (info?.tools && info.tools.length > 0) {
                    console.log(`    Tools (${info.tools.length}):`)
                    for (const tool of info.tools) {
                        const desc = tool.description
                            ? ` - ${GRAY}${tool.description.split('\n')[0]}${RESET}`
                            : ''
                        console.log(`      • ${BLUE}${tool.name}${RESET}${desc}`)
                    }
                } else if (info?.status === 'connected') {
                    console.log(`    ${GRAY}(No tools exported by this server)${RESET}`)
                }

                console.log('')
            }

            await manager.disconnectAll().catch(() => {
                // Intentionally swallowed: cleanup error
            })
            return
        }
    }
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
        if (result.failedFiles.length > 0) {
            console.log(
                `  ${YELLOW}Could not restore ${result.failedFiles.length} file(s):${RESET}`
            )
            for (const f of result.failedFiles) {
                console.log(`    • ${YELLOW}${f}${RESET}`)
            }
            process.exitCode = 1
        }
        console.log('')
    } catch (e: any) {
        console.error(`\n${RED}Failed to rewind:${RESET} ${e.message}\n`)
    }
}
