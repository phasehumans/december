const GREEN = '\x1b[38;2;110;231;183m'
const RED = '\x1b[38;2;252;165;165m'
const YELLOW = '\x1b[38;2;253;224;71m'
const BRAND = '\x1b[38;2;137;180;248m'
const DIM = '\x1b[38;2;119;119;119m'
const BOLD = '\x1b[1m'
const RESET = '\x1b[0m'

export interface HandlePluginCommandOptions {
    action?: string
    target?: string
    extra?: string
    /** "user" (default) or "project" for install */
    scope?: string
    workspaceDir?: string
}

const USAGE = `
Usage: december plugin <command> [options]

Commands:
  list                          List installed plugins, skills, and MCP servers
  discover                      List plugins in your marketplaces
  info <name>                   Show a plugin or skill
  install <name|path|url>       Install from a marketplace, a folder, a git url, or owner/repo
  uninstall <name>              Uninstall a plugin
  update <name>                 Update a plugin from where it came from
  enable <name>                 Turn on a plugin or skill
  disable <name>                Turn off a plugin or skill
  marketplace [list]            List marketplaces
  marketplace add <source>      Add a marketplace (owner/repo, git url, or folder)
  marketplace update <name>     Get the latest version of a marketplace
  marketplace remove <name>     Remove a marketplace

Options:
  --scope user|project          Where install puts the plugin (default: user)
`

function fail(message: string): void {
    console.error(`${RED}Error:${RESET} ${message}\n`)
    process.exitCode = 1
}

function dot(on: boolean, failed = false): string {
    return `${failed ? RED : on ? GREEN : DIM}●${RESET}`
}

function installScope(scope?: string): 'user' | 'project' | null {
    const value = (scope || 'user').toLowerCase().trim()
    if (value === 'user' || value === 'global') return 'user'
    if (value === 'project') return 'project'
    return null
}

export async function handlePluginCommand(options: HandlePluginCommandOptions = {}): Promise<void> {
    const tools = await import('@december/tools')
    const shared = await import('@december/shared')
    const action = (options.action || 'list').toLowerCase().trim()
    const target = options.target?.trim()
    const workspaceDir = options.workspaceDir || process.cwd()
    const manager = new tools.PluginManager({ workspaceDir })

    const needTarget = (usage: string): string | null => {
        if (target) return target
        fail(`Name a plugin: december plugin ${usage}`)
        return null
    }

    try {
        switch (action) {
            case 'list': {
                const catalog = await tools.loadPluginCatalog({ workspaceDir })
                if (catalog.installed.length === 0) {
                    console.log('\nNothing installed. Run "december plugin discover".\n')
                    return
                }
                const titles = { project: 'Project', user: 'User', 'built-in': 'Built-in' }
                let scope = ''
                console.log('')
                for (const row of catalog.installed) {
                    if (row.scope !== scope) {
                        scope = row.scope
                        console.log(`${BOLD}${titles[row.scope]}${RESET}`)
                    }
                    const meta =
                        row.kind === 'mcp'
                            ? `mcp · ${row.enabled ? 'on' : 'off'}`
                            : `${row.kind} · ${row.meta}`
                    console.log(
                        `  ${dot(row.enabled)} ${row.name.padEnd(28)} ${DIM}${meta}${RESET}`
                    )
                }
                console.log(
                    `\n${DIM}Manage these in a session with /plugin, or run "december plugin info <name>".${RESET}\n`
                )
                return
            }

            case 'discover': {
                const plugins = await manager.getDiscoverablePlugins()
                let category = ''
                console.log('')
                for (const p of plugins) {
                    const group = p.category || 'Other'
                    if (group !== category) {
                        category = group
                        console.log(`${BOLD}${group}${RESET}`)
                    }
                    const state = p.updateAvailable
                        ? `${YELLOW}update${RESET}`
                        : p.installed
                          ? `${GREEN}installed${RESET}`
                          : `${DIM}${p.marketplace}${RESET}`
                    console.log(
                        `  ${p.name.padEnd(22)} ${p.description.slice(0, 60).padEnd(60)} ${state}`
                    )
                }
                console.log(`\n${DIM}Install one with "december plugin install <name>".${RESET}\n`)
                return
            }

            case 'info': {
                const name = needTarget('info <name>')
                if (!name) return
                const catalog = await tools.loadPluginCatalog({ workspaceDir })
                const all = catalog.installed.flatMap((r) => [r, ...(r.children || [])])
                const row = all.find((r) => r.name.toLowerCase() === name.toLowerCase())
                if (!row) {
                    const listing = catalog.discover.find((d) => d.name === name)
                    if (!listing) return fail(`Nothing named "${name}" is installed or listed.`)
                    console.log(`\n${BOLD}${listing.name}${RESET}  ${DIM}not installed${RESET}`)
                    console.log(listing.description)
                    console.log(`\n  From:     ${listing.marketplace}`)
                    if (listing.version) console.log(`  Version:  ${listing.version}`)
                    if (listing.env?.length) console.log(`  Needs:    ${listing.env.join(', ')}`)
                    console.log(
                        `\n${DIM}Install it with "december plugin install ${listing.name}".${RESET}\n`
                    )
                    return
                }
                console.log(`\n${BOLD}${row.name}${RESET}  ${DIM}${row.kind}${RESET}`)
                if (row.description) console.log(row.description)
                console.log('')
                if (row.version) console.log(`  Version:   ${row.version}`)
                console.log(`  Source:    ${row.source}`)
                console.log(`  Scope:     ${row.scope}`)
                console.log(
                    `  Status:    ${row.enabled ? `${GREEN}on${RESET}` : `${DIM}off${RESET}`}`
                )
                if (row.kind === 'plugin') {
                    const skills = (row.children || []).filter((c) => c.kind === 'skill')
                    const servers = (row.children || []).filter((c) => c.kind === 'mcp')
                    console.log(`  Skills:    ${skills.map((s) => s.name).join(', ') || 'none'}`)
                    console.log(`  MCP:       ${servers.map((s) => s.name).join(', ') || 'none'}`)
                }
                if (row.path) console.log(`  Location:  ${row.path}`)
                console.log('')
                return
            }

            case 'install': {
                const source = needTarget('install <name|path|url>')
                if (!source) return
                const scope = installScope(options.scope)
                if (!scope) return fail('Use --scope user or --scope project.')
                const listed = await manager.marketplaces.findPlugin(source)
                const plugin = listed
                    ? await manager.installPlugin(source, { scope })
                    : await manager.installFromSource(source, { scope })
                const parts: string[] = []
                if (plugin.components.skills.length) {
                    parts.push(`${plugin.components.skills.length} skills`)
                }
                if (plugin.components.mcpServers.length) {
                    parts.push(`${plugin.components.mcpServers.length} MCP servers`)
                }
                console.log(
                    `\n${GREEN}✓${RESET} Installed ${BOLD}${plugin.name}${RESET}${parts.length ? ` (${parts.join(', ')})` : ''}`
                )
                console.log(`${DIM}${plugin.dirPath}${RESET}\n`)
                return
            }

            case 'uninstall':
            case 'remove': {
                const name = needTarget('uninstall <name>')
                if (!name) return
                const removed = await manager.uninstallPlugin(name)
                if (!removed) return fail(`No plugin named "${name}" is installed.`)
                console.log(`\n${GREEN}✓${RESET} Uninstalled ${BOLD}${name}${RESET}\n`)
                return
            }

            case 'update': {
                const name = needTarget('update <name>')
                if (!name) return
                const plugin = await manager.updatePlugin(name)
                console.log(
                    `\n${GREEN}✓${RESET} Updated ${BOLD}${plugin.name}${RESET}${plugin.version ? ` to v${plugin.version}` : ''}\n`
                )
                return
            }

            case 'enable':
            case 'disable': {
                const name = needTarget(`${action} <name>`)
                if (!name) return
                const enabled = action === 'enable'
                const plugins = await manager.getInstalledPlugins()
                const plugin = plugins.find((p) => p.id === name || p.name === name)
                if (plugin) {
                    await manager.togglePlugin(plugin.id, enabled)
                } else {
                    const skill = new shared.SkillDiscoveryEngine({
                        workspaceDir,
                        includeDisabled: true,
                    })
                        .discoverAllSkills()
                        .find((s) => s.name === name)
                    if (!skill) return fail(`No plugin or skill named "${name}".`)
                    const projectOrigins = ['workspace', 'workspace-plugin']
                    await shared.writeExtensionPreference({
                        kind: 'skill',
                        id: skill.name,
                        enabled,
                        scope: projectOrigins.includes(skill.origin) ? 'project' : 'user',
                        workspaceDir,
                    })
                }
                console.log(
                    `\n${GREEN}✓${RESET} Turned ${enabled ? 'on' : 'off'} ${BOLD}${name}${RESET}. It applies to new sessions.\n`
                )
                return
            }

            case 'marketplace':
            case 'marketplaces': {
                const sub = (target || 'list').toLowerCase()
                const value = options.extra?.trim()
                const registry = manager.marketplaces
                if (sub === 'list') {
                    const markets = await manager.getMarketplaces()
                    console.log('')
                    for (const m of markets) {
                        const facts = m.error
                            ? `${RED}${m.error}${RESET}`
                            : `${DIM}${m.plugins.length} plugins · ${m.builtIn ? 'built in' : m.source}${RESET}`
                        console.log(
                            `  ${dot(!m.error, Boolean(m.error))} ${m.name.padEnd(24)} ${facts}`
                        )
                    }
                    console.log('')
                    return
                }
                if (!value) {
                    return fail(`Name a marketplace: december plugin marketplace ${sub} <name>`)
                }
                if (sub === 'add') {
                    const added = await registry.add(value)
                    console.log(
                        `\n${GREEN}✓${RESET} Added ${BOLD}${added.name}${RESET} with ${added.plugins.length} plugins. Run "december plugin discover".\n`
                    )
                    return
                }
                if (sub === 'update') {
                    const updated = await registry.update(value)
                    console.log(
                        `\n${GREEN}✓${RESET} Updated ${BOLD}${updated.name}${RESET} (${updated.plugins.length} plugins)\n`
                    )
                    return
                }
                if (sub === 'remove') {
                    await registry.remove(value)
                    console.log(
                        `\n${GREEN}✓${RESET} Removed ${BOLD}${value}${RESET}. Plugins you installed from it stay installed.\n`
                    )
                    return
                }
                console.log(USAGE)
                return
            }

            default:
                console.log(USAGE)
                if (action !== 'help') process.exitCode = 1
        }
    } catch (err: any) {
        fail(err?.message || String(err))
    }
}

/** december skill was folded into december plugin; point people to the new command */
export function printSkillCommandMoved(): void {
    console.error(
        `\n${BRAND}december skill${RESET} is now part of ${BRAND}december plugin${RESET}:\n` +
            '  december plugin list              list plugins, skills, and MCP servers\n' +
            '  december plugin install <repo>    install a plugin or a skills repo\n' +
            '  december plugin disable <skill>   turn a skill off\n'
    )
    process.exitCode = 1
}
