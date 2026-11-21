import { describe, expect, it } from 'bun:test'

import { ScreenBuffer } from '../../src/renderer/buffer'
import { AuthMenuView } from '../../src/renderer/views/auth-menu-view'
import { LoginMenuView } from '../../src/renderer/views/login-menu-view'
import { McpMenuView, type McpServerMenuItem } from '../../src/renderer/views/mcp-menu-view'
import { takePanelCursor } from '../../src/renderer/views/panel'
import {
    buildPluginList,
    PluginMenuView,
    pluginSubtitle,
    type ExtensionRow,
} from '../../src/renderer/views/plugin-menu-view'
import { TasksModeMenuView, type TaskItem } from '../../src/renderer/views/tasks-mode-menu-view'
import { THEME } from '../../src/theme'

/** true when no cell on the row is bold */
function rowHasNoBold(buffer: ScreenBuffer, y: number): boolean {
    for (let x = 0; x < buffer.width; x++) {
        if (buffer.get(x, y)?.bold) return false
    }
    return true
}

/** the colour of the first cell of `text` on row y */
function fgOf(buffer: ScreenBuffer, y: number, text: string): unknown {
    const x = buffer.getLine(y).indexOf(text)
    if (x < 0) return undefined
    return buffer.get(x, y)?.fg
}

function onlyTitleIsBold(buffer: ScreenBuffer, titleRow = 0): boolean {
    for (let y = 0; y < buffer.height; y++) {
        if (y !== titleRow && !rowHasNoBold(buffer, y)) return false
    }
    return true
}

describe('menus group B: tasks, MCP, plugins, login', () => {
    describe('M9 / M10 Tasks', () => {
        const now = 1_000_000_000
        const tasks: TaskItem[] = [
            {
                id: 'a',
                command: 'bun run dev',
                type: 'shell',
                status: 'running',
                createdAt: now - 123_000,
                pid: 4123,
            },
            {
                id: 'b',
                command: 'bun test test/session',
                type: 'shell',
                status: 'completed',
                createdAt: now - 20_000,
                completedAt: now - 6_000,
                exitCode: 0,
            },
            {
                id: 'c',
                command: 'check session tests',
                role: 'reviewer',
                type: 'subagent',
                status: 'failed',
                createdAt: now - 62_000,
                completedAt: now,
                turns: 4,
            },
        ]
        const render = (confirmStop: 'one' | 'all' | null = null) => {
            const height = TasksModeMenuView.getHeight(tasks)
            const buffer = new ScreenBuffer(100, height)
            TasksModeMenuView.render(buffer, {
                y: 0,
                width: 100,
                height,
                tasks,
                selectedTaskIndex: 0,
                windowStart: 0,
                confirmStop,
                now,
            })
            return buffer
        }

        it('shows the title with the running count and no description row', () => {
            const buffer = render()
            expect(buffer.getLine(0)).toMatch(/^ {2}Tasks {2}1 running\s*$/)
            expect(buffer.getLine(1).trim()).toBe('')
            expect(buffer.getLine(2)).toMatch(/^ {2}Shells/)
            expect(buffer.get(2, 2)?.bold).toBeFalsy()
            expect(fgOf(buffer, 2, 'Shells')).toBe(THEME.colors.muted)
            expect(onlyTitleIsBold(buffer)).toBe(true)
        })

        it('uses steady status dots, "2m 03s" durations and a red "failed" word', () => {
            const buffer = render()
            expect(buffer.getLine(3)).toContain('❭ ● bun run dev')
            expect(buffer.getLine(3)).toMatch(/pid 4123 {2}2m 03s\s*$/)
            expect(buffer.get(4, 3)?.fg).toBe(THEME.colors.brand)
            expect(buffer.get(4, 4)?.fg).toBe(THEME.colors.dim)
            expect(buffer.getLine(6)).toContain('reviewer: check session tests')
            expect(buffer.get(4, 6)?.fg).toBe(THEME.colors.error)
            expect(fgOf(buffer, 6, 'failed')).toBe(THEME.colors.error)
            expect(buffer.getLine(6)).toMatch(/failed {2}1m 02s\s*$/)
            const footer = buffer.getLine(buffer.height - 1)
            for (const word of [
                'navigate',
                'log',
                'd stop',
                'D stop all',
                'copy',
                'clear done',
                'esc close',
            ]) {
                expect(footer).toContain(word)
            }
        })

        it('keeps the stop confirms inline, in yellow with no bold', () => {
            const one = render('one')
            expect(one.getLine(3)).toContain('bun run dev [Stop? y/n]')
            expect(fgOf(one, 3, '[Stop? y/n]')).toBe(THEME.colors.warning)
            expect(fgOf(one, 3, 'bun run dev')).toBe(THEME.colors.brand)
            expect(onlyTitleIsBold(one)).toBe(true)
            expect(one.getLine(one.height - 1)).toContain('y stop · n/esc cancel')

            const all = render('all')
            expect(all.getLine(1)).toContain('Stop 1 running task? [y/n]')
            expect(fgOf(all, 1, 'Stop 1')).toBe(THEME.colors.warning)
            expect(onlyTitleIsBold(all)).toBe(true)
        })
    })

    describe('M11 / M12 / M13 MCP', () => {
        const servers: McpServerMenuItem[] = [
            {
                name: 'github',
                scope: 'global',
                transport: 'stdio',
                status: 'connected',
                target: 'npx -y @modelcontextprotocol/server-github',
                eager: true,
                tools: Array.from({ length: 12 }, (_, i) => ({
                    name: i === 0 ? 'create_issue' : `tool_${i}`,
                    description: 'Does a thing',
                })),
            },
            {
                name: 'postgres',
                scope: 'project',
                transport: 'stdio',
                status: 'error',
                target: 'pg',
            },
            {
                name: 'sentry',
                scope: 'project',
                transport: 'stdio',
                status: 'disconnected',
                target: 's',
            },
        ]

        it('lists servers with ✓ / ○, meta words, red faults and the /plugin line', () => {
            const height = McpMenuView.getHeight('list', servers.length)
            const buffer = new ScreenBuffer(80, height)
            McpMenuView.render(buffer, { y: 0, width: 80, height, selectedIndex: 0, servers })
            expect(buffer.getLine(0)).toMatch(/^ {2}MCP servers {2}2 of 3 on/)
            expect(buffer.getLine(2)).toContain('❭ ✓ github')
            expect(buffer.getLine(2)).toMatch(/12 tools · stdio · user\s*$/)
            expect(fgOf(buffer, 2, '✓')).toBe(THEME.colors.brand)
            expect(buffer.getLine(3)).toMatch(/failed to start · project\s*$/)
            expect(fgOf(buffer, 3, 'failed to start')).toBe(THEME.colors.error)
            expect(buffer.getLine(4)).toContain('○ sentry')
            expect(fgOf(buffer, 4, '○')).toBe(THEME.colors.dim)
            expect(buffer.getLine(4)).toMatch(/off · project\s*$/)
            expect(buffer.getLine(6)).toContain('More servers in /plugin')
            expect(fgOf(buffer, 6, '/plugin')).toBe(THEME.colors.brand)
            expect(buffer.getLine(height - 1)).toContain(
                'space toggle · enter details · a add · d remove · esc close'
            )
            expect(onlyTitleIsBold(buffer)).toBe(true)
        })

        it('draws the remove confirm inline on the row, in red', () => {
            const height = McpMenuView.getHeight('list', servers.length)
            const buffer = new ScreenBuffer(80, height)
            McpMenuView.render(buffer, {
                y: 0,
                width: 80,
                height,
                selectedIndex: 0,
                servers,
                confirmDeleteName: 'github',
            })
            expect(buffer.getLine(2)).toContain('github [Remove? y/n]')
            expect(fgOf(buffer, 2, '[Remove? y/n]')).toBe(THEME.colors.error)
            expect(onlyTitleIsBold(buffer)).toBe(true)
            const all = Array.from({ length: height }, (_, y) => buffer.getLine(y)).join('\n')
            expect(all).not.toContain('Confirm remove')
        })

        it('shows details as label / value rows with a lowercase status', () => {
            const buffer = new ScreenBuffer(80, 16)
            McpMenuView.render(buffer, {
                y: 0,
                width: 80,
                height: 16,
                selectedIndex: 0,
                servers,
                mode: 'detail',
            })
            expect(buffer.getLine(0)).toMatch(/^ {2}github {2}MCP server · user/)
            expect(buffer.getLine(2)).toMatch(/^ {2}Status {5}● connected/)
            expect(fgOf(buffer, 2, '●')).toBe(THEME.colors.success)
            expect(buffer.getLine(3)).toMatch(/^ {2}Transport {2}stdio/)
            expect(buffer.getLine(4)).toContain(
                'Command    npx -y @modelcontextprotocol/server-github'
            )
            expect(buffer.getLine(5)).toContain('Tools load at start, in the first prompt')
            expect(buffer.getLine(7)).toMatch(/^ {2}Tools {6}12/)
            expect(buffer.getLine(8)).toMatch(/^ {4}create_issue {10}Does a thing/)
            expect(buffer.getLine(8)).not.toContain('•')
            expect(fgOf(buffer, 8, 'create_issue')).toBe(THEME.colors.text)
            expect(buffer.getLine(13)).toContain('↓ 7 more')
            expect(onlyTitleIsBold(buffer)).toBe(true)
        })

        it('says "on demand" for a deferred server', () => {
            const buffer = new ScreenBuffer(80, 12)
            McpMenuView.render(buffer, {
                y: 0,
                width: 80,
                height: 12,
                selectedIndex: 2,
                servers,
                mode: 'detail',
            })
            expect(buffer.getLine(2)).toContain('● stopped')
            expect(buffer.getLine(5)).toContain('Tools load on demand')
        })

        it('draws the add form with one row per field and no button row', () => {
            const height = McpMenuView.getHeight('add_custom')
            const buffer = new ScreenBuffer(100, height)
            McpMenuView.render(buffer, {
                y: 0,
                width: 100,
                height,
                selectedIndex: 0,
                mode: 'add_custom',
                customName: 'github',
                customActiveField: 0,
                customScope: 'global',
                customEager: false,
            })
            expect(buffer.getLine(0)).toMatch(/^ {2}Add an MCP server\s*$/)
            expect(buffer.getLine(2)).toContain('❭ Name         github')
            expect(buffer.getLine(3)).toContain('Command/URL')
            expect(buffer.getLine(4)).toContain('Scope        user   project')
            expect(fgOf(buffer, 4, 'user')).toBe(THEME.colors.brand)
            expect(fgOf(buffer, 4, 'project')).toBe(THEME.colors.muted)
            expect(buffer.getLine(5)).toContain('Tools load   at start   on demand')
            expect(fgOf(buffer, 5, 'on demand')).toBe(THEME.colors.brand)
            expect(buffer.getLine(6)).toContain('Env')
            const all = Array.from({ length: height }, (_, y) => buffer.getLine(y)).join('\n')
            expect(all).not.toContain('*')
            expect(all).not.toContain('Global')
            expect(all).not.toContain('Save & Connect')
            expect(buffer.getLine(height - 1)).toContain(
                'tab next field · shift+tab prev · space toggle option · enter save · esc cancel'
            )
            expect(onlyTitleIsBold(buffer)).toBe(true)
        })
    })

    describe('M14 / M15 Plugins', () => {
        const installed: ExtensionRow[] = [
            {
                key: 'plugin:gh',
                kind: 'plugin',
                id: 'gh',
                name: 'github-tools',
                description: '',
                scope: 'project',
                enabled: true,
                source: 'december-official',
                meta: '2 skills',
                removable: true,
            },
            {
                key: 'skill:pdf',
                kind: 'skill',
                id: 'pdf',
                name: 'pdf',
                description: '',
                scope: 'project',
                enabled: true,
                source: 'docs',
                meta: '',
                parentPlugin: 'docs',
                updateAvailable: true,
                removable: false,
            },
            {
                key: 'mcp:broken',
                kind: 'mcp',
                id: 'broken',
                name: 'broken',
                description: '',
                scope: 'project',
                enabled: true,
                source: 'x',
                meta: '',
                status: 'error',
                removable: true,
            },
            {
                key: 'mcp:old',
                kind: 'mcp',
                id: 'old',
                name: 'old-thing',
                description: '',
                scope: 'user',
                enabled: false,
                source: 'x',
                meta: '',
                removable: true,
            },
        ]
        const catalog = { installed, discover: [], marketplaces: [] }
        const list = buildPluginList({ tab: 'installed', ...catalog })
        const render = (confirm: string | null = null) => {
            const height = PluginMenuView.getHeight({ screen: 'list', list })
            const buffer = new ScreenBuffer(100, height)
            PluginMenuView.render(buffer, {
                y: 0,
                width: 100,
                height,
                activeTab: 'installed',
                screen: 'list',
                list,
                selectedIndex: 0,
                windowStart: 0,
                subtitle: pluginSubtitle('installed', catalog),
                confirm,
                confirmVerb: 'uninstall',
            })
            return buffer
        }

        it('puts the counts in the tab row and keeps the search row', () => {
            const buffer = render()
            expect(buffer.getLine(0)).toContain('discover   installed   marketplaces')
            expect(buffer.getLine(0)).toMatch(/4 installed · 1 off\s*$/)
            expect(fgOf(buffer, 0, 'installed')).toBe(THEME.colors.brand)
            expect(fgOf(buffer, 0, 'discover')).toBe(THEME.colors.muted)
            expect(buffer.getLine(1)).toContain('Search: [/ to filter]')
            expect(buffer.getLine(1)).toMatch(/all {3}plugins {3}skills {3}mcp\s*$/)
            expect(buffer.getLine(3)).toMatch(/^ {2}Project/)
            expect(fgOf(buffer, 3, 'Project')).toBe(THEME.colors.muted)
            expect(onlyTitleIsBold(buffer, -1)).toBe(true)
        })

        it('uses ✓ / ○, a brand "update" and red fault words', () => {
            const buffer = render()
            expect(buffer.getLine(4)).toContain('❭ ✓ github-tools')
            expect(buffer.getLine(5)).toMatch(/skill · docs · update\s*$/)
            expect(fgOf(buffer, 5, 'update')).toBe(THEME.colors.brand)
            expect(buffer.getLine(6)).toMatch(/failed to load\s*$/)
            expect(fgOf(buffer, 6, 'failed to load')).toBe(THEME.colors.error)
            expect(buffer.getLine(8)).toContain('○ old-thing')
            expect(fgOf(buffer, 8, 'old-thing')).toBe(THEME.colors.text)
            const footer = buffer.getLine(buffer.height - 1)
            for (const word of [
                'navigate',
                'toggle',
                'details',
                'f filter',
                'd uninstall',
                '/ search',
            ]) {
                expect(footer).toContain(word)
            }
        })

        it('draws the uninstall confirm inline on the row, in red', () => {
            const buffer = render('Uninstall github-tools?')
            expect(buffer.getLine(4)).toContain('github-tools [Uninstall? y/n]')
            expect(fgOf(buffer, 4, '[Uninstall? y/n]')).toBe(THEME.colors.error)
            expect(buffer.getLine(buffer.height - 1)).toContain('y uninstall · n/esc cancel')
            expect(onlyTitleIsBold(buffer, -1)).toBe(true)
        })

        it('asks "Install github-tools?" with Adds / Needs rows and scope rows', () => {
            const buffer = new ScreenBuffer(80, 10)
            PluginMenuView.render(buffer, {
                y: 0,
                width: 80,
                height: 10,
                activeTab: 'discover',
                screen: 'install',
                list: { lines: [], items: [] },
                selectedIndex: 0,
                windowStart: 0,
                installRow: {
                    id: 'gh',
                    name: 'github-tools',
                    description: 'GitHub issues, PRs and Actions for December.',
                    version: '1.2.0',
                    marketplace: 'december-official',
                    skillNames: ['pr-review', 'triage'],
                    mcpServerNames: ['github'],
                },
                installScope: 'user',
                installPaths: { user: '~/.december/plugins', project: './.december/plugins' },
                missingEnv: ['GITHUB_TOKEN'],
            })
            expect(buffer.getLine(0)).toMatch(
                /^ {2}Install github-tools\? {2}1\.2\.0 · december-official/
            )
            expect(buffer.get(2, 0)?.bold).toBe(true)
            expect(buffer.getLine(1)).toContain('GitHub issues, PRs and Actions for December.')
            expect(buffer.getLine(3)).toContain(
                'Adds   2 skills (pr-review, triage), 1 MCP server (github)'
            )
            expect(buffer.getLine(4)).toContain('Needs  GITHUB_TOKEN is not set')
            expect(fgOf(buffer, 4, 'GITHUB_TOKEN')).toBe(THEME.colors.warning)
            expect(buffer.getLine(6)).toContain(
                '❭ For you        ~/.december/plugins, all your projects'
            )
            expect(fgOf(buffer, 6, '~/.december')).toBe(THEME.colors.brand)
            expect(buffer.getLine(7)).toContain(
                'This project   ./.december/plugins, commit it to share'
            )
            expect(buffer.getLine(9)).toContain('↑/↓ scope · enter install · esc cancel')
            expect(onlyTitleIsBold(buffer)).toBe(true)
        })
    })

    describe('M23 / M24 Log in and API key', () => {
        it('keeps the auth menu as today with bold only on the title', () => {
            const buffer = new ScreenBuffer(100, 7)
            AuthMenuView.render(buffer, {
                y: 0,
                width: 100,
                height: 7,
                mode: 'menu',
                hasDecember: true,
                decemberEmail: 'you@example.com',
            })
            expect(buffer.getLine(0)).toMatch(/^ {2}Authentication/)
            expect(buffer.get(2, 0)?.bold).toBe(true)
            expect(buffer.getLine(2)).toContain('❭ Use your own Subscription')
            expect(fgOf(buffer, 4, '(Logged in as you@example.com)')).toBe(THEME.colors.success)
            expect(onlyTitleIsBold(buffer)).toBe(true)
        })

        it('keeps the login switch question in yellow with no bold', () => {
            const buffer = new ScreenBuffer(80, 6)
            LoginMenuView.render(buffer, {
                y: 0,
                width: 80,
                height: 6,
                selectedIndex: 0,
                confirmSwitch: true,
                decemberEmail: 'you@example.com',
            })
            expect(buffer.getLine(0)).toContain('Switch Account')
            expect(fgOf(buffer, 3, 'Do you want to switch')).toBe(THEME.colors.warning)
            expect(onlyTitleIsBold(buffer)).toBe(true)
        })

        it('titles the key screen "<Provider> API key" with the link in brand and a red error', () => {
            const buffer = new ScreenBuffer(80, 7)
            AuthMenuView.render(buffer, {
                y: 0,
                width: 80,
                height: 7,
                mode: 'byok_key',
                activeProviderName: 'OpenAI',
                providerKeyUrl: 'https://platform.openai.com/api-keys',
                apiKeyInput: 'sk-abc',
                keyError: 'API key cannot be empty',
            })
            expect(buffer.getLine(0)).toMatch(/^ {2}OpenAI API key\s*$/)
            expect(buffer.getLine(1)).toContain('Get a key at platform.openai.com/api-keys')
            expect(fgOf(buffer, 1, 'platform.openai.com')).toBe(THEME.colors.brand)
            expect(buffer.getLine(3)).toContain('❭ ••••••')
            expect(buffer.getLine(3)).not.toContain('█')
            // G11: the real terminal cursor after the masked key
            expect(takePanelCursor()?.y).toBe(3)
            expect(buffer.getLine(4)).toContain(
                'No key entered. Paste your API key, then press enter.'
            )
            expect(fgOf(buffer, 4, 'No key entered')).toBe(THEME.colors.error)
            expect(buffer.getLine(6)).toContain('enter submit · esc close')
            expect(onlyTitleIsBold(buffer)).toBe(true)
        })

        it('B11: draws "↓ N more" under the last visible provider row', () => {
            // A short panel fits 4 rows; the overflow line goes right under them, above the footer
            const buffer = new ScreenBuffer(80, 10)
            AuthMenuView.render(buffer, {
                y: 0,
                width: 80,
                height: 10,
                mode: 'byok_provider',
                providerSelectedIndex: 0,
            })
            const rows = Array.from({ length: 10 }, (_, y) => buffer.getLine(y))
            const moreRow = rows.findIndex((line) => line.includes('more'))
            expect(moreRow).toBe(7)
            expect(rows[6]).toMatch(/^ {4}\S/)
            expect(rows[8]!.trim()).toBe('')
            expect(rows[9]).toContain('esc back')
        })
    })
})
