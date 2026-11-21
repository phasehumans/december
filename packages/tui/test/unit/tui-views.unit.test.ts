import { describe, expect, it } from 'bun:test'

import { BYOK_PROVIDER_ITEMS } from '../../src/constants/providers'
import { ScreenBuffer } from '../../src/renderer/buffer'
import { AskQuestionMenuView } from '../../src/renderer/views/ask-question-menu-view'
import { AuthMenuView } from '../../src/renderer/views/auth-menu-view'
import { BtwOverlayView } from '../../src/renderer/views/btw-overlay-view'
import { CodeSearchMenuView } from '../../src/renderer/views/code-search-menu-view'
import { CommandMenuView } from '../../src/renderer/views/command-menu-view'
import { ContextMenuView } from '../../src/renderer/views/context-menu-view'
import { DiffViewMenuView } from '../../src/renderer/views/diff-view-menu-view'
import { EffortMenuView } from '../../src/renderer/views/effort-menu-view'
import { FileAutocompleteMenuView } from '../../src/renderer/views/file-autocomplete-menu-view'
import { FileViewMenuView } from '../../src/renderer/views/file-view-menu-view'
import { HeaderView } from '../../src/renderer/views/header-view'
import { HelpMenuView, SHORTCUTS } from '../../src/renderer/views/help-menu-view'
import {
    InputBarView,
    wrapInputText,
    getWrappedCursorPosition,
} from '../../src/renderer/views/input-bar-view'
import { LoginMenuView } from '../../src/renderer/views/login-menu-view'
import { McpMenuView } from '../../src/renderer/views/mcp-menu-view'
import { MemoryViewMenuView } from '../../src/renderer/views/memory-view-menu-view'
import { MessageListView } from '../../src/renderer/views/message-list-view'
import { ModelSelectMenuView } from '../../src/renderer/views/model-select-menu-view'
import { takePanelCursor } from '../../src/renderer/views/panel'
import { PlanApproveMenuView, planFacts } from '../../src/renderer/views/plan-approve-menu-view'
import {
    buildPluginList,
    ensureVisible,
    extensionMetaText,
    formatAge,
    kindCounts,
    marketplaceCounts,
    PluginMenuView,
    pluginSubtitle,
    type DiscoverRow,
    type ExtensionRow,
    type MarketplaceRow,
} from '../../src/renderer/views/plugin-menu-view'
import { RewindSelectMenuView } from '../../src/renderer/views/rewind-select-menu-view'
import { SessionSelectMenuView } from '../../src/renderer/views/session-select-menu-view'
import { SettingsMenuView } from '../../src/renderer/views/settings-menu-view'
import { SkillsMenuView } from '../../src/renderer/views/skills-menu-view'
import { SwitchSelectMenuView } from '../../src/renderer/views/switch-select-menu-view'
import { TasksModeMenuView, type TaskItem } from '../../src/renderer/views/tasks-mode-menu-view'
import { ToolPermissionMenuView } from '../../src/renderer/views/tool-permission-menu-view'
import {
    UsageSelectMenuView,
    buildHeatmapGrid,
    getHeatmapLayout,
    layoutStatColumns,
} from '../../src/renderer/views/usage-select-menu-view'
import { THEME } from '../../src/theme'

describe('Interactive Differential TUI Views (Renderer)', () => {
    describe('HeaderView', () => {
        it('renders brand title, cli version, user email, model billing, and git branch', () => {
            const buffer = new ScreenBuffer(60, 6)
            HeaderView.render(buffer, {
                x: 0,
                y: 0,
                width: 60,
                cliVersion: '0.4.15',
                userEmail: 'dev@december.io',
                activeModel: 'claude-3-5-sonnet',
                authMethod: 'subscription',
                cwd: '~/code/december',
                branch: 'main',
            })

            const line1 = buffer.getLine(1)
            const line2 = buffer.getLine(2)
            const line3 = buffer.getLine(3)
            const line4 = buffer.getLine(4)

            expect(line1).toContain('December')
            expect(line1).toContain('0.4.15')
            expect(line2).toContain('dev@december.io')
            expect(line3).toContain('Claude 3.5 Sonnet')
            expect(line3).toContain('Claude Subscription')
            expect(line4).toContain('~/code/december (main)')
        })

        it('renders release announcement banner with highlights bullets and changelog link', () => {
            const buffer = new ScreenBuffer(80, 12)
            HeaderView.render(buffer, {
                x: 0,
                y: 0,
                width: 80,
                cliVersion: '0.4.15',
                activeModel: 'claude-3-5-sonnet',
                authMethod: 'subscription',
                cwd: '~/code/december',
                branch: 'main',
                announcement: {
                    version: '0.4.15',
                    title: "What's New in v0.4.15",
                    bullets: [
                        'Add token login, refine device activation flow, and add context doc',
                        'Durable step checkpointing and optimistic epoch fencing',
                    ],
                    url: 'https://trydecember.com/docs/changelog',
                },
            })

            const line5 = buffer.getLine(5)
            const line6 = buffer.getLine(6)
            const line7 = buffer.getLine(7)
            const line8 = buffer.getLine(8)

            expect(line5).toContain("▎ What's New in v0.4.15")
            expect(line6).toContain('▎ Add token login, refine device activation flow')
            expect(line7).toContain('▎ Durable step checkpointing and optimistic epoch fencing')
            expect(line8).toContain(
                '▎ Check out detailed changelog on https://trydecember.com/docs/changelog'
            )
        })

        it('renders update notice with the full changelog url in brand color', () => {
            const buffer = new ScreenBuffer(100, 10)
            HeaderView.render(buffer, {
                x: 0,
                y: 0,
                width: 100,
                cliVersion: '0.4.18',
                latestVersion: '0.4.19',
                cwd: '~/code/december',
                branch: 'main',
            })

            const line6 = buffer.getLine(6)
            expect(line6).toContain(
                '▎ Run /update to upgrade · Changelog: https://trydecember.com/docs/changelog'
            )

            const urlX = line6.indexOf('https://')
            expect(buffer.get(urlX, 6)?.fg).toBe(THEME.colors.brand)
            expect(buffer.get(urlX - 2, 6)?.fg).toBe(THEME.colors.muted)
        })
    })

    describe('InputBarView', () => {
        it('renders separators, prompt glyph, and placeholder when input is empty', () => {
            const buffer = new ScreenBuffer(60, 4)
            InputBarView.render(buffer, {
                x: 0,
                y: 0,
                width: 60,
                input: '',
                cursorPos: 0,
                placeholder: 'Ask December anything...',
                modelLabel: 'Claude 3.5 Sonnet',
                contextTokens: 1420,
            })

            expect(buffer.getLine(0)).toContain('──────────')
            expect(buffer.getLine(1)).toContain('❭ ')
            expect(buffer.getLine(1)).toContain('Ask December anything...')
            expect(buffer.getLine(2)).toContain('──────────')
            expect(buffer.getLine(3)).toContain('Claude 3.5 Sonnet')
            expect(buffer.getLine(3)).toContain('1.4k tokens')
        })

        it('renders typed user input and calculates cursor position', () => {
            const buffer = new ScreenBuffer(60, 4)
            const cursor = InputBarView.render(buffer, {
                x: 0,
                y: 0,
                width: 60,
                input: 'fix the failing test',
                cursorPos: 4,
            })

            expect(buffer.getLine(1)).toContain('fix the failing test')
            expect(cursor.visible).toBe(true)
            // paddingLeft (2) + promptGlyph (2) + pos (4) = 8
            expect(cursor.x).toBe(8)
            expect(cursor.y).toBe(1)
        })

        it('renders exit confirmation prompt on Ctrl+C', () => {
            const buffer = new ScreenBuffer(60, 4)
            InputBarView.render(buffer, {
                x: 0,
                y: 0,
                width: 60,
                input: '',
                showExitConfirm: true,
            })

            expect(buffer.getLine(3)).toContain('Press Ctrl+C again to exit')
        })

        it('dynamically computes height and renders multiline prompt with continuation glyphs', () => {
            const multilineInput = 'line 1\nline 2\nline 3'
            const height = InputBarView.getHeight(multilineInput)
            expect(height).toBe(6) // 1 top sep + 3 lines + 1 bottom sep + 1 status = 6

            const buffer = new ScreenBuffer(60, height)
            const cursor = InputBarView.render(buffer, {
                x: 0,
                y: 0,
                width: 60,
                input: multilineInput,
                cursorPos: 7 + 2, // 'line 1\nli' -> line 2, col 2
            })

            expect(buffer.getLine(1)).toContain('❭ line 1')
            expect(buffer.getLine(2)).toContain('· line 2')
            expect(buffer.getLine(3)).toContain('· line 3')
            expect(cursor.y).toBe(2)
            expect(cursor.x).toBe(6) // paddingLeft(2) + glyph(2) + 2 = 6
        })

        it('renders collapsed paste token badge with highlighted styling', () => {
            const pasteInput = 'check this: [Pasted 42 lines]'
            const buffer = new ScreenBuffer(60, 4)
            InputBarView.render(buffer, {
                x: 0,
                y: 0,
                width: 60,
                input: pasteInput,
                cursorPos: pasteInput.length,
            })

            expect(buffer.getLine(1)).toContain('[Pasted 42 lines]')
        })

        it('wraps long prompt across multiple lines at word boundaries without shifting horizontally', () => {
            // Buffer width = 40. Prompt glyph + padding consumes 4 cols. maxInputWidth = 32.
            const longPrompt =
                'please refactor the auth service to use session repository and remove dead code'
            const height = InputBarView.getHeight(longPrompt, 40)
            expect(height).toBeGreaterThan(4)

            const buffer = new ScreenBuffer(40, height)
            const cursor = InputBarView.render(buffer, {
                x: 0,
                y: 0,
                width: 40,
                input: longPrompt,
                cursorPos: longPrompt.length,
            })

            // Line 1 should start with prompt glyph '❭ ' and contain first chunk without shifting
            const line1 = buffer.getLine(1)
            expect(line1).toContain('❭ please refactor the auth service')
            // Line 2 should start with continuation glyph '· ' and contain second chunk
            const line2 = buffer.getLine(2)
            expect(line2).toContain('· to use session repository and')
            // Line 3 should contain third chunk
            const line3 = buffer.getLine(3)
            expect(line3).toContain('· remove dead code')

            // Cursor should be on the last line at the end of the text
            expect(cursor.visible).toBe(true)
            expect(cursor.y).toBe(3) // y + 1 + lineIndex (2) = 3
        })

        it('wrapInputText and getWrappedCursorPosition accurately track multiline cursor coordinates', () => {
            const input = 'hello world this is a test'
            const wrapped = wrapInputText(input, 12)
            expect(wrapped.length).toBeGreaterThanOrEqual(3)

            // Index 0 -> line 0, col 0
            expect(getWrappedCursorPosition(wrapped, 0)).toEqual({ line: 0, col: 0 })
            // Index 5 ('o' in hello) -> line 0, col 5
            expect(getWrappedCursorPosition(wrapped, 5)).toEqual({ line: 0, col: 5 })
            // Index at end of input -> last line
            const lastPos = getWrappedCursorPosition(wrapped, input.length)
            expect(lastPos.line).toBe(wrapped.length - 1)
        })
    })

    describe('CommandMenuView', () => {
        it('renders filtered commands and selection indicator', () => {
            const buffer = new ScreenBuffer(60, 6)
            CommandMenuView.render(buffer, {
                x: 0,
                y: 0,
                width: 60,
                query: 'mo',
                selectedIndex: 0,
                windowStart: 0,
            })

            const line0 = buffer.getLine(0)
            expect(line0).toContain('❭')
            expect(line0).toContain('/model')
            expect(line0).toContain('Select a model')
        })

        it('renders no matching commands message when filter does not match', () => {
            const buffer = new ScreenBuffer(60, 2)
            CommandMenuView.render(buffer, {
                x: 0,
                y: 0,
                width: 60,
                query: 'unknowncommandxyz',
                selectedIndex: 0,
                windowStart: 0,
            })

            expect(buffer.getLine(0)).toContain('No matching commands')
        })
    })

    describe('HelpMenuView', () => {
        it('computes correct fixed height matching compact card overlay', () => {
            expect(HelpMenuView.getHeight()).toBe(13)
        })

        it('renders general tab with system information and tab bar', () => {
            const buffer = new ScreenBuffer(70, 13)
            HelpMenuView.render(buffer, {
                x: 0,
                y: 0,
                width: 70,
                height: 13,
                activeTab: 'general',
                cliVersion: '0.4.15',
                userEmail: 'dev@december.io',
                activeModel: 'claude-3-7-sonnet',
                modelLabel: 'Claude 3.7 Sonnet',
                cwd: '~/project',
                branch: 'feature/effort-help',
                sessionId: 'sess-xyz-789',
            })

            expect(buffer.getLine(0)).toContain('general')
            expect(buffer.getLine(0)).toContain('commands')
            expect(buffer.getLine(0)).toContain('shortcuts')
            expect(buffer.getLine(2)).toContain('December writes code')
            const rows = Array.from({ length: buffer.height }, (_, i) => buffer.getLine(i))
            expect(rows.find((r) => r.includes('Version'))).toContain('0.4.15')
            expect(rows.find((r) => r.includes('Account'))).toContain('dev@december.io')
            expect(rows.find((r) => r.includes('Model'))).toContain('Claude 3.7 Sonnet')
            expect(rows.find((r) => r.includes('Workspace'))).toContain('feature/effort-help')
            expect(rows.find((r) => r.includes('Session'))).toContain('sess-xyz-789')
            expect(rows.some((r) => r.includes('cycle tab'))).toBe(true)
            expect(buffer.getLine(12)).toContain('esc dismiss')
        })

        it('renders commands tab with windowed commands list and pagination', () => {
            const buffer = new ScreenBuffer(70, 13)
            HelpMenuView.render(buffer, {
                x: 0,
                y: 0,
                width: 70,
                height: 13,
                activeTab: 'commands',
                commands: [
                    { name: 'clear', description: 'Clear conversation history' },
                    { name: 'diff', description: 'View git diff and workspace changes' },
                    { name: 'effort', description: 'Set model reasoning depth' },
                    { name: 'help', description: 'Show interactive help menu' },
                ],
                cmdSelectedIndex: 1,
                cmdWindowStart: 0,
            })

            expect(buffer.getLine(0)).toContain('commands')
            expect(buffer.getLine(2)).toContain('/clear')
            expect(buffer.getLine(3)).toContain('❭')
            expect(buffer.getLine(3)).toContain('/diff')
            expect(buffer.getLine(3)).toContain('View git diff')
            expect(buffer.getLine(4)).toContain('/effort')
            expect(buffer.getLine(12)).toContain('navigate')
        })

        it('renders shortcuts tab with keyboard shortcuts directory', () => {
            const buffer = new ScreenBuffer(70, 13)
            HelpMenuView.render(buffer, {
                x: 0,
                y: 0,
                width: 70,
                height: 13,
                activeTab: 'shortcuts',
                shortcuts: [
                    { key: 'ctrl+c', desc: 'Exit / Graceful interrupt' },
                    { key: 'ctrl+t', desc: 'Tasks mode' },
                    { key: 'esc', desc: 'Cancel / Return to bottom' },
                ],
                shortcutSelectedIndex: 0,
                shortcutWindowStart: 0,
            })

            expect(buffer.getLine(0)).toContain('shortcuts')
            expect(buffer.getLine(2)).toContain('ctrl+c')
            expect(buffer.getLine(2)).toContain('Exit / Graceful interrupt')
            expect(buffer.getLine(3)).toContain('ctrl+t')
            expect(buffer.getLine(4)).toContain('esc')
            expect(buffer.getLine(12)).toContain('navigate')
        })

        it('includes core shortcuts like file mention, tab autocomplete, and line editing in default SHORTCUTS', () => {
            expect(SHORTCUTS.some((s) => s.key.includes('@'))).toBe(true)
            expect(SHORTCUTS.some((s) => s.key === 'tab')).toBe(true)
            expect(SHORTCUTS.some((s) => s.key.includes('alt / shift + enter'))).toBe(true)
            expect(SHORTCUTS.some((s) => s.key.includes('ctrl+a'))).toBe(true)
        })
    })

    describe('EffortMenuView', () => {
        it('renders reasoning depth options, selection indicator, active level, and footer', () => {
            const buffer = new ScreenBuffer(70, 6)
            EffortMenuView.render(buffer, {
                x: 0,
                y: 0,
                width: 70,
                height: 6,
                modelLabel: 'Claude 3.7 Sonnet',
                currentLevel: 'deep',
                selectedIndex: 1,
            })

            expect(buffer.getLine(0)).toContain('Reasoning')
            expect(buffer.getLine(0)).toContain('Claude 3.7 Sonnet')
            expect(buffer.getLine(2)).toContain('Fast')
            expect(buffer.getLine(3)).toContain('❭')
            expect(buffer.getLine(3)).toContain('Deep')
            expect(buffer.getLine(3)).toContain('current')
            expect(buffer.getLine(3)).not.toContain('(Current)')
            expect(buffer.getLine(5)).toContain('navigate')
            expect(buffer.getLine(5)).toContain('enter select')
            expect(buffer.getLine(5)).toContain('esc close')
        })

        it('computes correct fixed height', () => {
            expect(EffortMenuView.getHeight()).toBe(6)
            // A model with no reasoning setting gets one line in place of two (M7.2)
            expect(EffortMenuView.getHeight('none')).toBe(5)
            expect(EffortMenuView.getHeight('fixed')).toBe(5)
        })

        it('renders message when model does not support reasoning', () => {
            const buffer = new ScreenBuffer(70, 6)
            EffortMenuView.render(buffer, {
                x: 0,
                y: 0,
                width: 70,
                height: 6,
                modelLabel: 'GPT-4o',
                currentLevel: 'auto',
                selectedIndex: 0,
                reasoningSupport: 'none',
            })
            expect(buffer.getLine(0)).toContain('Reasoning')
            expect(buffer.getLine(2)).toContain(
                'GPT-4o has no reasoning setting. There is nothing to set.'
            )
            expect(buffer.getLine(5)).toContain('esc close')
        })

        it('renders message when model has fixed reasoning', () => {
            const buffer = new ScreenBuffer(70, 6)
            EffortMenuView.render(buffer, {
                x: 0,
                y: 0,
                width: 70,
                height: 6,
                modelLabel: 'DeepSeek R1',
                currentLevel: 'auto',
                selectedIndex: 0,
                reasoningSupport: 'fixed',
            })
            expect(buffer.getLine(0)).toContain('Reasoning')
            expect(buffer.getLine(2)).toContain('fixed reasoning')
            expect(buffer.getLine(5)).toContain('esc close')
        })
    })

    describe('LoginMenuView', () => {
        it('renders authentication options with selector and status', () => {
            const buffer = new ScreenBuffer(70, 7)
            LoginMenuView.render(buffer, {
                x: 0,
                y: 0,
                width: 70,
                height: 7,
                selectedIndex: 0,
                userEmail: 'dev@december.io',
                isAuthenticated: true,
                authMethod: 'december',
            })

            expect(buffer.getLine(0)).toContain('Authentication')
            expect(buffer.getLine(2)).toContain('❭')
            expect(buffer.getLine(2)).toContain('Use your own Subscription')
            expect(buffer.getLine(3)).toContain('Use your own API Key (BYOK)')
            expect(buffer.getLine(4)).toContain('Login via December')
            expect(buffer.getLine(4)).toContain('(Logged in as dev@december.io)')
            expect(buffer.getLine(6)).toContain('navigate')
            expect(buffer.getLine(6)).toContain('enter select')
            expect(buffer.getLine(6)).toContain('esc close')
        })

        it('renders confirmation view when switching account', () => {
            const buffer = new ScreenBuffer(70, 6)
            LoginMenuView.render(buffer, {
                x: 0,
                y: 0,
                width: 70,
                height: 6,
                selectedIndex: 1,
                confirmSwitch: true,
                userEmail: 'dev@december.io',
                isAuthenticated: true,
            })

            expect(buffer.getLine(0)).toContain('Switch Account')
            expect(buffer.getLine(2)).toContain('Already logged in as dev@december.io')
            expect(buffer.getLine(3)).toContain(
                'Do you want to switch to a different account? (y/n)'
            )
            expect(buffer.getLine(5)).toContain('y switch account')
            expect(buffer.getLine(5)).toContain('n / enter keep current')
            expect(buffer.getLine(5)).toContain('esc cancel')
        })

        it('computes correct fixed height', () => {
            expect(LoginMenuView.getHeight()).toBe(7)
            expect(LoginMenuView.getHeight(true)).toBe(6)
        })
    })

    describe('ModelSelectMenuView', () => {
        it('renders models list, active radio button, and footer', () => {
            const buffer = new ScreenBuffer(60, 14)
            ModelSelectMenuView.render(buffer, {
                x: 0,
                y: 0,
                width: 60,
                height: 14,
                models: [
                    { label: 'Claude 3.7 Sonnet', value: 'claude-3-7-sonnet' },
                    { label: 'Claude 3.5 Sonnet', value: 'claude-3-5-sonnet' },
                ],
                activeModel: 'claude-3-5-sonnet',
                selectedIndex: 0,
                windowStart: 0,
                searchQuery: '',
                isSearching: false,
            })

            expect(buffer.getLine(0)).toContain('Model  2 models')
            expect(buffer.getLine(1)).toContain('Search: [/ to filter]')
            expect(buffer.getLine(3)).toContain('Claude 3.7 Sonnet')
            expect(buffer.getLine(4)).toContain('Claude 3.5 Sonnet')
            expect(buffer.getLine(4)).toContain('current')
            expect(buffer.getLine(buffer.height - 1)).toContain('select')
        })
    })

    describe('DiffViewMenuView', () => {
        it('renders changed files with additions and deletions', () => {
            const buffer = new ScreenBuffer(60, 10)
            DiffViewMenuView.render(buffer, {
                x: 0,
                y: 0,
                width: 60,
                height: 10,
                files: [
                    {
                        path: 'packages/tui/src/renderer/app.ts',
                        additions: 120,
                        deletions: 15,
                        status: 'modified',
                        diff: '@@ -1,5 +1,10 @@\n+new line\n-old line',
                    },
                ],
                selectedFileIndex: 0,
                windowStart: 0,
                isDetailView: false,
                detailScrollOffset: 0,
            })

            expect(buffer.getLine(0)).toContain('Changes  1 file +120 -15')
            expect(buffer.getLine(0)).not.toContain('1/1')
            expect(buffer.get(2, 0)?.bold).toBe(true)
            const titleAdds = buffer.getLine(0).indexOf('+120')
            expect(buffer.get(titleAdds, 0)?.fg).toBe(THEME.colors.success)
            expect(buffer.getLine(2)).toContain('❭')
            expect(buffer.getLine(2)).toContain('packages/tui/src/renderer/app.ts')
            expect(buffer.getLine(2)).toContain('+120')
            expect(buffer.getLine(2)).toContain('-15')
            expect(buffer.get(2, 2)?.bg).toBeUndefined()
            expect(buffer.get(4, 2)?.fg).toBe(THEME.colors.brand)
            expect(buffer.get(4, 2)?.bold).toBeFalsy()
        })

        it('renders detailed diff lines with line numbers and syntax styling', () => {
            const buffer = new ScreenBuffer(60, 10)
            DiffViewMenuView.render(buffer, {
                x: 0,
                y: 0,
                width: 60,
                height: 10,
                files: [
                    {
                        path: 'packages/tui/src/renderer/app.ts',
                        additions: 1,
                        deletions: 1,
                        status: 'modified',
                        diff: '@@ -10,2 +10,2 @@\n-const oldVal = 1\n+const newVal = 2\n',
                    },
                ],
                selectedFileIndex: 0,
                windowStart: 0,
                isDetailView: true,
                detailScrollOffset: 0,
            })

            // At 60 columns the path is shortened in the middle so the file name stays visible
            expect(buffer.getLine(0)).toContain('packages/…/app.ts  +1 -1')
            expect(buffer.getLine(0)).toContain('change 1/1 · file 1/1')
            expect(buffer.getLine(2)).toContain('unchanged lines')
            expect(buffer.getLine(3)).toContain('- const oldVal = 1')
            expect(buffer.getLine(4)).toContain('+ const newVal = 2')
            // Only the sign is colored; the code stays in text color on the tint
            const delCode = buffer.getLine(3).indexOf('const')
            expect(buffer.get(delCode - 2, 3)?.fg).toBe(THEME.colors.error)
            expect(buffer.get(delCode, 3)?.fg).toBe(THEME.colors.text)
            expect(buffer.get(delCode, 3)?.bg).toBe(THEME.colors.diffDeleteBg)
            const addCode = buffer.getLine(4).indexOf('const')
            expect(buffer.get(addCode - 2, 4)?.fg).toBe(THEME.colors.success)
            expect(buffer.get(addCode, 4)?.fg).toBe(THEME.colors.text)
            expect(buffer.getLine(buffer.height - 1)).toContain('p/n change')
            expect(buffer.getLine(buffer.height - 1)).toContain('f full file')
        })

        it('renders full file expanded view with badge and compact footer when isFullFile is true', () => {
            const buffer = new ScreenBuffer(60, 10)
            const mockFullContent = Array.from(
                { length: 15 },
                (_, i) => `line content ${i + 1}`
            ).join('\n')
            DiffViewMenuView.render(buffer, {
                x: 0,
                y: 0,
                width: 60,
                height: 10,
                files: [
                    {
                        path: 'packages/tui/src/renderer/app.ts',
                        additions: 1,
                        deletions: 1,
                        status: 'modified',
                        diff: '@@ -10,2 +10,2 @@\n-const oldVal = 1\n+const newVal = 2\n',
                    },
                ],
                selectedFileIndex: 0,
                windowStart: 0,
                isDetailView: true,
                isFullFile: true,
                fullContent: mockFullContent,
                detailScrollOffset: 0,
            })

            // The full-file tag takes room from the path, which is shortened in the middle
            expect(buffer.getLine(0)).toContain('pp.ts  +1 -1 · full file')
            expect(buffer.getLine(0)).toContain('change 1/1 · file 1/1')
            expect(buffer.getLine(2)).not.toContain('unchanged lines')
            expect(buffer.getLine(2)).toContain('line content 1')
            expect(buffer.getLine(buffer.height - 1)).toContain('f compact')
        })
    })

    describe('SettingsMenuView', () => {
        it('renders settings items, selection indicator, and values', () => {
            const buffer = new ScreenBuffer(60, 10)
            SettingsMenuView.render(buffer, {
                x: 0,
                y: 0,
                width: 60,
                height: 10,
                selectedIndex: 0,
                settings: [
                    { id: 'model', title: 'Active Model', value: 'Claude 3.5 Sonnet' },
                    { id: 'pathguard', title: 'PathGuard Protection', value: 'on' },
                ],
            })

            expect(buffer.getLine(0)).toContain('Settings')
            expect(buffer.getLine(2)).toContain('❭')
            expect(buffer.getLine(2)).toContain('Active Model')
            expect(buffer.getLine(2)).toContain('Claude 3.5 Sonnet')
            expect(buffer.getLine(2)).not.toContain('[')
            expect(buffer.getLine(3)).toContain('PathGuard Protection')
            expect(buffer.getLine(3)).toContain('on')
        })
    })

    describe('ContextMenuView', () => {
        it('renders progress bar and token breakdown', () => {
            const buffer = new ScreenBuffer(60, 12)
            ContextMenuView.render(buffer, {
                x: 0,
                y: 0,
                width: 60,
                height: 12,
                activeModel: 'claude-3-5-sonnet',
                modelLabel: 'Claude 3.5 Sonnet',
                contextTokens: 25000,
                maxContextTokens: 200000,
            })

            expect(buffer.getLine(0)).toContain('Context · Claude 3.5 Sonnet')
            expect(buffer.getLine(2)).toContain('██████')
            expect(buffer.getLine(4)).toContain('Context Used')
            expect(buffer.getLine(4)).toContain('Messages')
        })

        it('renders fullscreen progress bar scaling across terminal width', () => {
            const buffer100 = new ScreenBuffer(100, 12)
            ContextMenuView.render(buffer100, {
                x: 0,
                y: 0,
                width: 100,
                height: 12,
                activeModel: 'claude-3-7-sonnet',
                modelLabel: 'Claude 3.7 Sonnet',
                contextTokens: 0,
                maxContextTokens: 200000,
            })

            const barLine100 = buffer100.getLine(2)
            const emptyBlocksCount100 = (barLine100.match(/░/g) || []).length
            expect(emptyBlocksCount100).toBe(94)

            const buffer120 = new ScreenBuffer(120, 12)
            ContextMenuView.render(buffer120, {
                x: 0,
                y: 0,
                width: 120,
                height: 12,
                activeModel: 'claude-3-7-sonnet',
                modelLabel: 'Claude 3.7 Sonnet',
                contextTokens: 0,
                maxContextTokens: 200000,
            })
            const barLine120 = buffer120.getLine(2)
            const emptyBlocksCount120 = (barLine120.match(/░/g) || []).length
            expect(emptyBlocksCount120).toBe(114)
        })
    })

    describe('SkillsMenuView', () => {
        it('renders the SKILL.md viewer with line numbers and cursor', () => {
            const buffer = new ScreenBuffer(80, 15)
            SkillsMenuView.render(buffer, {
                x: 0,
                y: 0,
                width: 80,
                height: 15,
                cursorLineIndex: 1,
                scrollOffset: 0,
                detailLines: ['# TDD Guide', 'Step 1: Write test', 'Step 2: Implement'],
                skill: {
                    name: 'tdd',
                    description: 'Test driven development workflow',
                    origin: 'workspace',
                    directoryPath: '/workspace/.agents/skills/tdd',
                    entryFilePath: '/workspace/.agents/skills/tdd/SKILL.md',
                },
            })

            expect(buffer.getLine(0)).toContain(
                'tdd  /workspace/.agents/skills/tdd/SKILL.md · 3 lines'
            )
            expect(buffer.getLine(0)).toContain('2:1')
            expect(buffer.getLine(2)).toContain('1 # TDD Guide')
            expect(buffer.getLine(3)).toContain('❭')
            expect(buffer.getLine(3)).toContain('2 Step 1: Write test')
            // G15 pager row: surface band, brand line number, regular weight
            expect(buffer.get(2, 3)?.bg).toBe(THEME.colors.surface)
            expect(buffer.get(buffer.getLine(3).indexOf('2 Step'), 3)?.fg).toBe(THEME.colors.brand)
            expect(buffer.get(2, 3)?.bold).toBeFalsy()
            expect(buffer.getLine(14)).toContain('scroll')
            expect(buffer.getLine(14)).toContain('back')
        })

        it('renders nothing without a skill', () => {
            const buffer = new ScreenBuffer(40, 5)
            SkillsMenuView.render(buffer, { x: 0, y: 0, width: 40, height: 5, skill: null })
            expect(buffer.getLine(0).trim()).toBe('')
        })
    })

    describe('McpMenuView', () => {
        it('computes compact dynamic height based on mode and item count', () => {
            // Title, blank, rows, blank, "More servers in /plugin", blank, footer
            expect(McpMenuView.getHeight('list', 0)).toBe(7)
            expect(McpMenuView.getHeight('list', 2)).toBe(8)
            expect(McpMenuView.getHeight('detail', 1)).toBe(7)
            // Title, blank, 5 fields, blank, footer (no button row)
            expect(McpMenuView.getHeight('add_custom', 0)).toBe(9)
        })

        it('renders empty servers notice when no MCP servers configured', () => {
            const buffer = new ScreenBuffer(80, 5)
            McpMenuView.render(buffer, {
                x: 0,
                y: 0,
                width: 80,
                height: 5,
                selectedIndex: 0,
                servers: [],
            })

            expect(buffer.getLine(0)).toMatch(/^ {2}MCP servers\s*$/)
            expect(buffer.get(2, 0)?.bold).toBe(true)
            expect(buffer.getLine(2)).toContain('No servers configured')
            expect(buffer.getLine(4)).toContain('add server')
            expect(buffer.getLine(4)).toContain('close')
        })

        it('renders minimal list of MCP servers with ✓ / ○ toggle marks and tool counts', () => {
            const buffer = new ScreenBuffer(80, 8)
            McpMenuView.render(buffer, {
                x: 0,
                y: 0,
                width: 80,
                height: 8,
                selectedIndex: 0,
                servers: [
                    {
                        name: 'postgres',
                        scope: 'project',
                        transport: 'stdio',
                        status: 'connected',
                        target: 'npx -y @modelcontextprotocol/server-postgres',
                        eager: true,
                        tools: [{ name: 'mcp_postgres_query', description: 'Run SQL query' }],
                    },
                    {
                        name: 'sentry',
                        scope: 'global',
                        transport: 'http',
                        status: 'disconnected',
                        target: 'https://mcp.sentry.io/mcp',
                        tools: [],
                    },
                ],
            })

            expect(buffer.getLine(0)).toContain('MCP servers  1 of 2 on')
            expect(buffer.getLine(2)).toContain('❭ ✓ postgres')
            expect(buffer.get(4, 2)?.fg).toBe(THEME.colors.brand)
            expect(buffer.get(4, 2)?.bold).toBeFalsy()
            expect(buffer.getLine(2)).toMatch(/1 tool · stdio · project\s*$/)
            expect(buffer.getLine(3)).toContain('○ sentry')
            expect(buffer.get(4, 3)?.fg).toBe(THEME.colors.dim)
            expect(buffer.getLine(3)).toMatch(/off · user\s*$/)
            expect(buffer.getLine(5)).toContain('More servers in /plugin')
            expect(buffer.getLine(7)).toContain('toggle')
            expect(buffer.getLine(7)).toContain('details')
        })

        it('renders detail view for a server displaying tools and command details', () => {
            const buffer = new ScreenBuffer(80, 15)
            McpMenuView.render(buffer, {
                x: 0,
                y: 0,
                width: 80,
                height: 15,
                selectedIndex: 0,
                isDetailView: true,
                servers: [
                    {
                        name: 'github',
                        scope: 'global',
                        transport: 'stdio',
                        status: 'connected',
                        target: 'npx -y @modelcontextprotocol/server-github',
                        eager: false,
                        tools: [
                            {
                                name: 'mcp_github_create_issue',
                                description: 'Create a GitHub issue',
                            },
                        ],
                    },
                ],
            })

            expect(buffer.getLine(0)).toMatch(/^ {2}github {2}MCP server · user/)
            expect(buffer.getLine(2)).toContain('Status     ● connected')
            expect(buffer.get(13, 2)?.fg).toBe(THEME.colors.success)
            expect(buffer.getLine(3)).toContain('Transport  stdio')
            expect(buffer.getLine(4)).toContain(
                'Command    npx -y @modelcontextprotocol/server-github'
            )
            expect(buffer.getLine(5)).toContain('Tools load on demand')
            expect(buffer.getLine(7)).toMatch(/^ {2}Tools {6}1/)
            expect(buffer.getLine(8)).toMatch(/^ {4}mcp_github_create_issue/)
            expect(buffer.getLine(8)).not.toContain('•')
            expect(buffer.getLine(8)).toContain('Create a GitHub issue')
            expect(buffer.get(4, 8)?.bold).toBeFalsy()
            expect(buffer.getLine(14)).toContain('scroll')
            expect(buffer.getLine(14)).toContain('back')
        })

        it('labels plugin-owned servers and hides remove in their detail view', () => {
            const buffer = new ScreenBuffer(80, 12)
            McpMenuView.render(buffer, {
                x: 0,
                y: 0,
                width: 80,
                height: 12,
                selectedIndex: 0,
                isDetailView: true,
                mode: 'detail',
                servers: [
                    {
                        name: 'github',
                        scope: 'global',
                        transport: 'stdio',
                        status: 'connected',
                        target: 'npx -y @modelcontextprotocol/server-github',
                        plugin: 'github',
                        tools: [],
                    },
                ],
            })
            expect(buffer.getLine(0)).toContain('MCP server · github')
            expect(buffer.getLine(11)).not.toContain('remove')
        })

        it('renders custom configuration mode with form fields and footer', () => {
            const buffer = new ScreenBuffer(100, 20)
            McpMenuView.render(buffer, {
                x: 0,
                y: 0,
                width: 100,
                height: 20,
                selectedIndex: 0,
                mode: 'add_custom',
                customName: 'my-server',
                customCommand: 'npx -y my-mcp',
                customScope: 'project',
                customEager: true,
                customActiveField: 0,
            })

            expect(buffer.getLine(0)).toMatch(/^ {2}Add an MCP server\s*$/)
            // One row per field, no blank rows between them
            expect(buffer.getLine(2)).toContain('❭ Name         my-server')
            expect(buffer.getLine(3)).toContain('Command/URL  npx -y my-mcp')
            expect(buffer.getLine(4)).toContain('Scope        user   project')
            expect(buffer.get(buffer.getLine(4).indexOf('project'), 4)?.fg).toBe(THEME.colors.brand)
            expect(buffer.getLine(5)).toContain('Tools load   at start   on demand')
            expect(buffer.get(buffer.getLine(5).indexOf('at start'), 5)?.fg).toBe(
                THEME.colors.brand
            )
            expect(buffer.getLine(6)).toContain('Env')
            expect(buffer.getLine(7).trim()).toBe('')
            expect(buffer.getLine(19)).toContain('next field')
            expect(buffer.getLine(19)).toContain('save')
            expect(buffer.getLine(19)).toContain('esc cancel')
        })

        it('renders the remove confirm inline on the row when confirmDeleteName is provided', () => {
            const buffer = new ScreenBuffer(80, 12)
            McpMenuView.render(buffer, {
                x: 0,
                y: 0,
                width: 80,
                height: 12,
                selectedIndex: 0,
                confirmDeleteName: 'github',
                servers: [
                    {
                        name: 'github',
                        scope: 'global',
                        transport: 'stdio',
                        status: 'connected',
                        target: 'npx -y @modelcontextprotocol/server-github',
                    },
                ],
            })

            expect(buffer.getLine(2)).toContain('❭ ✓ github [Remove? y/n]')
            const cx = buffer.getLine(2).indexOf('[Remove?')
            expect(buffer.get(cx, 2)?.fg).toBe(THEME.colors.error)
            expect(buffer.get(cx, 2)?.bold).toBeFalsy()
            expect(buffer.getLine(11)).toContain('y remove · n/esc cancel')
        })
    })

    describe('PluginMenuView', () => {
        const installed: ExtensionRow[] = [
            {
                key: 'skill:grill-me',
                kind: 'skill',
                id: 'grill-me',
                name: 'grill-me',
                description: 'Stress-test a plan',
                scope: 'project',
                enabled: true,
                source: '.december/skills',
                meta: '~60 tok',
                removable: false,
            },
            {
                key: 'plugin:github',
                kind: 'plugin',
                id: 'github',
                name: 'github',
                description: 'GitHub tools',
                scope: 'user',
                enabled: true,
                source: 'december-official',
                meta: '2 skills · 1 mcp',
                removable: true,
                updateAvailable: true,
                children: [
                    {
                        key: 'skill:pr',
                        kind: 'skill',
                        id: 'pr',
                        name: 'pr',
                        description: 'Write PRs',
                        scope: 'user',
                        enabled: true,
                        source: 'via github',
                        meta: '~20 tok',
                        removable: false,
                        parentPlugin: 'github',
                    },
                ],
            },
            {
                key: 'plugin:slack',
                kind: 'plugin',
                id: 'slack',
                name: 'slack',
                description: 'Slack tools',
                scope: 'user',
                enabled: false,
                source: 'december-official',
                meta: '1 mcp · off',
                removable: true,
            },
        ]
        const discover: DiscoverRow[] = [
            {
                id: 'github@december-official',
                name: 'github',
                description: 'Repository search and pull requests.',
                category: 'Development',
                marketplace: 'december-official',
                installed: true,
            },
            {
                id: 'sqlite@december-official',
                name: 'sqlite',
                description: 'Query a local SQLite file.',
                category: 'Database',
                marketplace: 'december-official',
            },
            {
                id: 'deploy@acme',
                name: 'deploy',
                description: 'Ship to staging.',
                category: 'Development',
                marketplace: 'acme',
            },
        ]
        const marketplaces: MarketplaceRow[] = [
            {
                name: 'december-official',
                source: 'built in',
                builtIn: true,
                available: 2,
                installedCount: 1,
            },
            {
                name: 'acme',
                source: 'https://github.com/acme/plugins.git',
                builtIn: false,
                available: 1,
                installedCount: 0,
                updatedAt: Date.now() - 2 * 3600 * 1000,
            },
        ]

        const catalog = { installed, discover, marketplaces }
        const render = (
            overrides: Partial<Parameters<typeof PluginMenuView.render>[1]> & { list: any },
            height = 16
        ) => {
            const buffer = new ScreenBuffer(100, height)
            const tab = overrides.activeTab || 'installed'
            PluginMenuView.render(buffer, {
                x: 0,
                y: 0,
                width: 100,
                height,
                activeTab: tab,
                screen: 'list',
                selectedIndex: 0,
                windowStart: 0,
                subtitle: pluginSubtitle(tab, catalog),
                marketNames: marketplaceCounts(discover).map((m) => m.name),
                ...overrides,
            })
            return buffer
        }

        it('renders Installed in the December menu style', () => {
            const list = buildPluginList({ tab: 'installed', ...catalog })
            const buffer = render({ list })
            // G14 tabs with the counts on the same row (no description row), Search row with filters
            expect(buffer.getLine(0)).toContain('discover   installed   marketplaces')
            expect(buffer.getLine(0)).toMatch(/3 installed · 1 off\s*$/)
            expect(buffer.get(buffer.getLine(0).indexOf('installed'), 0)?.fg).toBe(
                THEME.colors.brand
            )
            expect(buffer.get(buffer.getLine(0).indexOf('installed'), 0)?.bold).toBeFalsy()
            expect(buffer.getLine(1)).toContain('Search: [/ to filter]')
            expect(buffer.getLine(1)).toMatch(/all {3}plugins {3}skills {3}mcp\s*$/)
            // Muted section titles, ✓ / ○ marks, right-aligned kind · fact column
            expect(buffer.getLine(3)).toMatch(/^ {2}Project/)
            expect(buffer.get(2, 3)?.bold).toBeFalsy()
            expect(buffer.getLine(4)).toContain('❭ ✓ grill-me')
            expect(buffer.getLine(4)).toMatch(/skill · ~60 tok\s*$/)
            expect(buffer.getLine(5)).toMatch(/^ {2}User/)
            expect(buffer.getLine(6)).toContain('✓ github')
            expect(buffer.getLine(6)).toMatch(/plugin · 2 skills · 1 mcp · update\s*$/)
            expect(buffer.get(buffer.getLine(6).lastIndexOf('update'), 6)?.fg).toBe(
                THEME.colors.brand
            )
            expect(buffer.getLine(7)).toContain('○ slack')
            expect(buffer.getLine(7)).toMatch(/plugin · 1 mcp · off\s*$/)
            expect(buffer.getLine(15)).toContain('space toggle')
            expect(buffer.getLine(15)).toContain('f filter')
            expect(buffer.getLine(15)).not.toContain('uninstall')
        })

        it('flattens plugin parts under a kind filter', () => {
            const skills = buildPluginList({ tab: 'installed', ...catalog, kindFilter: 'skill' })
            expect(skills.items.map((i: any) => i.row.name)).toEqual(['grill-me', 'pr'])
            expect(extensionMetaText((skills.items[1] as any).row)).toBe('skill · ~20 tok · github')
            expect(kindCounts(installed)).toEqual({ all: 3, plugin: 2, skill: 2, mcp: 0 })
        })

        it('caps the list at 10 lines and shows how many more there are', () => {
            const many: ExtensionRow[] = Array.from({ length: 30 }, (_, i) => ({
                ...installed[0]!,
                key: `skill:s${i}`,
                id: `s${i}`,
                name: `skill-${String(i).padStart(2, '0')}`,
            }))
            const list = buildPluginList({
                tab: 'installed',
                installed: many,
                discover,
                marketplaces,
            })
            expect(PluginMenuView.getHeight({ screen: 'list', list })).toBe(16)
            const buffer = render({ list }, 16)
            expect(buffer.getLine(3)).toContain('Project')
            expect(buffer.getLine(12)).toContain('skill-08')
            expect(buffer.getLine(13)).toContain('↓ 21 more')
        })

        it('shows Discover with category titles, descriptions, and the i key', () => {
            const list = buildPluginList({ tab: 'discover', ...catalog })
            expect(list.items.every((i) => i.type === 'discover')).toBe(true)
            const buffer = render({ list, activeTab: 'discover' })
            expect(buffer.getLine(0)).toMatch(/3 plugins · 2 marketplaces\s*$/)
            expect(buffer.getLine(1)).toMatch(/all {3}december-official {3}acme\s*$/)
            expect(buffer.getLine(3)).toMatch(/^ {2}Development/)
            expect(buffer.getLine(4)).toContain('❭ github')
            expect(buffer.getLine(4)).toContain('Repository search and pull requests.')
            // An installed plugin shows a muted ✓ in the meta column
            expect(buffer.getLine(4)).toMatch(/✓\s*$/)
            expect(buffer.getLine(5)).toMatch(/acme\s*$/)
            expect(buffer.getLine(6)).toContain('Database')
            expect(buffer.getLine(15)).toContain('i install from path')
            expect(buffer.getLine(15)).toContain('m marketplace')

            const acmeOnly = buildPluginList({ tab: 'discover', ...catalog, marketFilter: 'acme' })
            expect(acmeOnly.items).toHaveLength(1)
            expect(pluginSubtitle('discover', catalog, 'acme')).toBe('1 plugin · acme')
        })

        it('shows Marketplaces with counts, update age, and the a key', () => {
            const list = buildPluginList({ tab: 'marketplaces', ...catalog })
            const buffer = render({ list, activeTab: 'marketplaces', selectedIndex: 1 })
            expect(buffer.getLine(0)).toMatch(/2 marketplaces\s*$/)
            expect(buffer.getLine(3)).toContain('● december-official')
            expect(buffer.getLine(3)).toContain('built in')
            expect(buffer.getLine(3)).toMatch(/2 plugins · 1 installed\s*$/)
            expect(buffer.getLine(4)).toContain('❭ ● acme')
            expect(buffer.getLine(4)).toMatch(/updated 2h ago\s*$/)
            expect(buffer.getLine(15)).toContain('a add')
            expect(buffer.getLine(15)).toContain('u update')
        })

        it('draws the confirm inline on the selected row and swaps the footer', () => {
            const list = buildPluginList({ tab: 'installed', ...catalog })
            const buffer = render({
                list,
                selectedIndex: 1,
                confirm: 'Uninstall github?',
                confirmVerb: 'uninstall',
            })
            expect(buffer.getLine(6)).toContain('❭ ✓ github [Uninstall? y/n]')
            const cx = buffer.getLine(6).indexOf('[Uninstall?')
            expect(buffer.get(cx, 6)?.fg).toBe(THEME.colors.error)
            expect(buffer.get(cx, 6)?.bold).toBeFalsy()
            expect(buffer.getLine(15)).toContain('y uninstall')
            expect(buffer.getLine(15)).toContain('n/esc cancel')
        })

        it('renders the install screen as a question with Adds / Needs and scope rows', () => {
            const buffer = render({
                list: { lines: [], items: [] },
                activeTab: 'discover',
                screen: 'install',
                installRow: { ...discover[1]!, mcpServerNames: ['sqlite'] },
                installScope: 'project',
                installPaths: {
                    user: '~/.december/plugins/sqlite',
                    project: '.december/plugins/sqlite',
                },
                missingEnv: ['SQLITE_TOKEN'],
            })
            expect(buffer.getLine(0)).toMatch(/^ {2}Install sqlite\? {2}december-official/)
            expect(buffer.getLine(1)).toContain('Query a local SQLite file.')
            expect(buffer.getLine(3)).toContain('Adds   1 MCP server (sqlite)')
            expect(buffer.getLine(4)).toContain('Needs  SQLITE_TOKEN is not set')
            expect(buffer.get(buffer.getLine(4).indexOf('SQLITE_TOKEN'), 4)?.fg).toBe(
                THEME.colors.warning
            )
            expect(buffer.getLine(6)).toContain('For you        ~/.december/plugins/sqlite')
            expect(buffer.getLine(7)).toContain('❭ This project   .december/plugins/sqlite')
            expect(buffer.getLine(7)).toContain('commit it to share')
            expect(buffer.get(4, 7)?.bold).toBeFalsy()
        })

        it('renders plugin details as a label table with actions', () => {
            const buffer = render({
                list: { lines: [], items: [] },
                screen: 'details',
                detailRow: installed[1]!,
                detailActions: ['Turn off plugin', 'Update', 'Uninstall'],
                actionIndex: 0,
            })
            expect(buffer.getLine(0)).toContain('github')
            expect(buffer.getLine(1)).toContain('GitHub tools')
            // G17: labels with no colon, values in one column
            expect(buffer.getLine(3)).toContain('Source     december-official')
            expect(buffer.getLine(4)).toContain('Scope      user')
            expect(buffer.getLine(5)).toContain('Status     on')
            expect(buffer.getLine(6)).toContain('Skills     pr')
            expect(buffer.getLine(7)).toContain('MCP        none')
            expect(buffer.getLine(9)).toContain('❭ Turn off plugin')
            expect(buffer.get(4, 9)?.bold).toBeFalsy()
            expect(buffer.getLine(11)).toContain('Uninstall')
        })

        it('keeps the selected line and its section title in view', () => {
            expect(ensureVisible(0, 3, 5)).toBe(0)
            expect(ensureVisible(0, 9, 5)).toBe(5)
            expect(ensureVisible(6, 6, 5)).toBe(5)
            expect(formatAge(undefined)).toBe('never updated')
        })
    })

    describe('TasksModeMenuView', () => {
        const now = 1_000_000
        const shell = (i: number, extra: Partial<TaskItem> = {}): TaskItem => ({
            id: `task-${i}`,
            command: `cmd ${i}`,
            type: 'shell',
            status: 'running',
            createdAt: now - 4000,
            pid: 4000 + i,
            ...extra,
        })
        const sub = (i: number): TaskItem => ({
            id: `sub-${i}`,
            command: `job ${i}`,
            type: 'subagent',
            role: 'explore',
            depth: 1,
            status: 'running',
            createdAt: now - 40_000,
        })

        const renderTasks = (tasks: TaskItem[], width = 80, extra = {}) => {
            const height = TasksModeMenuView.getHeight(tasks)
            const buffer = new ScreenBuffer(width, height)
            TasksModeMenuView.render(buffer, {
                x: 0,
                y: 0,
                width,
                height,
                tasks,
                selectedTaskIndex: 0,
                windowStart: 0,
                now,
                ...extra,
            })
            const lines = Array.from({ length: height }, (_, i) => buffer.getLine(i))
            return { lines, height }
        }

        it('renders shells and subagents in their own sections', () => {
            const { lines } = renderTasks([shell(1), sub(1)])
            // Title with the running count as meta; no description row
            expect(lines[0]).toMatch(/^ {2}Tasks {2}2 running\s*$/)
            expect(lines[1]?.trim()).toBe('')
            expect(lines[2]).toContain('Shells')
            expect(lines[3]).toContain('❭ ● cmd 1')
            expect(lines[3]).toContain('pid 4001')
            expect(lines[3]).toContain('4s')
            expect(lines[4]).toContain('Subagents')
            expect(lines[5]).toContain('explore: job 1')
            expect(lines[5]).not.toContain('depth')
        })

        it('gives the footer its own row for every list size', () => {
            for (const tasks of [
                [shell(1)],
                Array.from({ length: 8 }, (_, i) => shell(i)),
                [...Array.from({ length: 10 }, (_, i) => shell(i)), sub(1), sub(2)],
            ]) {
                const { lines, height } = renderTasks(tasks)
                expect(lines[height - 1]).toContain('navigate')
                // the row above the footer is the empty gap
                expect(lines[height - 2]?.trim()).toBe('')
            }
        })

        it('shows how many tasks are outside the window', () => {
            const tasks = Array.from({ length: 12 }, (_, i) => shell(i))
            const { lines } = renderTasks(tasks)
            expect(lines.some((l) => l.includes('↓ 4 more'))).toBe(true)
        })

        it('draws a multi-line command on one row with an ellipsis', () => {
            const long = `echo start\n${'x'.repeat(200)}\necho end`
            const { lines } = renderTasks([shell(1, { command: long })], 60)
            const row = lines[3] ?? ''
            expect(row).toContain('echo start x')
            expect(row).toContain('…')
            expect(lines[4]?.trim()).toBe('')
        })

        it('shows the live turn of a running subagent and the total when done', () => {
            const running = renderTasks([{ ...sub(1), turns: 3 }]).lines
            expect(running[3]).toMatch(/turn 3 {2}40s\s*$/)
            const done = renderTasks([
                { ...sub(1), turns: 5, status: 'completed', completedAt: now },
            ]).lines
            expect(done[3]).toMatch(/5 turns {2}40s\s*$/)
        })

        it('shows stopped tasks as stopped, not failed', () => {
            const { lines } = renderTasks([
                shell(1, { status: 'killed', completedAt: now, exitCode: 130 }),
            ])
            expect(lines[3]).toContain('stopped')
            expect(lines[3]).not.toContain('exit 130')
            expect(lines[3]).not.toContain('failed')
        })

        it('asks before stopping', () => {
            expect(renderTasks([shell(1)], 80, { confirmStop: 'one' }).lines[3]).toContain(
                'cmd 1 [Stop? y/n]'
            )
            expect(renderTasks([shell(1)], 80, { confirmStop: 'all' }).lines[1]).toContain(
                'Stop 1 running task? [y/n]'
            )
        })
    })

    describe('MessageListView', () => {
        const longMessages = [
            {
                id: '1',
                role: 'assistant',
                content: Array.from({ length: 30 }, (_, i) => `line ${i + 1}`).join('\n'),
            },
        ]

        it('labels the scroll pill as lines below when nothing new arrived', () => {
            const buffer = new ScreenBuffer(80, 6)
            const { totalLines, maxScroll } = MessageListView.render(buffer, {
                width: 80,
                height: 6,
                messages: longMessages,
                scrollOffset: 0,
                newLinesAnchor: undefined,
            })
            const pill = buffer.getLine(5)
            expect(pill).toContain(`↓ ${maxScroll} lines below · esc`)
            expect(pill).not.toContain('new line')

            // An anchor equal to the current total also means nothing new
            MessageListView.render(buffer, {
                width: 80,
                height: 6,
                messages: longMessages,
                scrollOffset: 0,
                newLinesAnchor: totalLines,
            })
            expect(buffer.getLine(5)).toContain('lines below')
        })

        it('labels the scroll pill with the count of lines added since scrolling up', () => {
            const buffer = new ScreenBuffer(80, 6)
            const { totalLines } = MessageListView.render(buffer, {
                width: 80,
                height: 6,
                messages: longMessages,
                scrollOffset: 0,
                newLinesAnchor: undefined,
            })
            MessageListView.render(buffer, {
                width: 80,
                height: 6,
                messages: longMessages,
                scrollOffset: 0,
                newLinesAnchor: totalLines - 3,
            })
            expect(buffer.getLine(5)).toContain('↓ 3 new lines')
        })

        it('hides the scroll pill at the bottom', () => {
            const buffer = new ScreenBuffer(80, 6)
            MessageListView.render(buffer, { width: 80, height: 6, messages: longMessages })
            expect(buffer.getLine(5)).not.toContain('jump to bottom')
        })

        it('renders messages and handles scroll offset slicing', () => {
            const buffer = new ScreenBuffer(50, 4)
            const messages = [
                { id: '1', role: 'user', content: 'hello agent' },
                { id: '2', role: 'assistant', content: 'line 1\nline 2\nline 3\nline 4\nline 5' },
            ]

            // Scrolled to the bottom (an offset past the end clamps to it). The history has no
            // trailing blank row, so the last line sits on the bottom row.
            MessageListView.render(buffer, {
                x: 0,
                y: 0,
                width: 50,
                height: 4,
                messages,
                scrollOffset: 4,
            })

            expect(buffer.getLine(0)).toContain('line 2')
            expect(buffer.getLine(1)).toContain('line 3')
            expect(buffer.getLine(3)).toContain('line 5')
        })

        it('renders message content cleanly without invasive reading mode banner when scrolled up', () => {
            const buffer = new ScreenBuffer(50, 4)
            const messages = [
                {
                    id: '1',
                    role: 'assistant',
                    content: 'line 1\nline 2\nline 3\nline 4\nline 5\nline 6',
                },
            ]

            // Scrolled to top (scrollOffset = 0 while maxScroll > 0)
            MessageListView.render(buffer, {
                x: 0,
                y: 0,
                width: 50,
                height: 4,
                messages,
                scrollOffset: 0,
            })

            const firstLine = buffer.getLine(0)
            expect(firstLine).toContain('line 1')
            expect(firstLine).not.toContain('Reading mode')
        })

        it('prepends headerProps as scrollable lines at top of chat view', () => {
            const buffer = new ScreenBuffer(80, 10)
            const messages = [
                {
                    id: '1',
                    role: 'user',
                    content: 'hello world',
                },
            ]

            MessageListView.render(buffer, {
                x: 0,
                y: 0,
                width: 80,
                height: 10,
                messages,
                scrollOffset: 0,
                headerProps: {
                    width: 80,
                    cliVersion: '0.4.15',
                    activeModel: 'gemini-2.5-flash',
                    userEmail: 'user@example.com',
                },
            })

            const line1 = buffer.getLine(1)
            expect(line1).toContain('December')
            expect(line1).toContain('0.4.15')
        })
    })

    describe('CodeSearchMenuView', () => {
        it('renders search results with selector, file:line, and content snippet', () => {
            const buffer = new ScreenBuffer(80, 10)
            const results = [
                { file: 'src/index.ts', line: 42, content: 'export const run = true' },
                { file: 'src/config.ts', line: 12, content: 'const config = {}' },
            ]

            CodeSearchMenuView.render(buffer, {
                x: 0,
                y: 0,
                width: 80,
                height: 10,
                query: 'config',
                results,
                selectedIndex: 0,
                windowStart: 0,
            })

            const title = buffer.getLine(0)
            const item0 = buffer.getLine(2)
            const item1 = buffer.getLine(3)
            const footer = buffer.getLine(9)

            expect(title).toContain('Code search  "config" · 2 matches')
            expect(title).not.toContain('1/2')
            expect(item0).toContain('❭')
            expect(item0).toContain('src/index.ts:42')
            expect(item0).toContain('export const run = true')
            expect(buffer.get(2, 2)?.bg).toBeUndefined()
            // The selected row is brand blue with no bold (M18.1)
            expect(buffer.get(4, 2)?.fg).toBe(THEME.colors.brand)
            expect(buffer.get(4, 2)?.bold).toBeFalsy()
            // Matches are brand blue, not yellow, and not bold
            const matchX = item1.lastIndexOf('config')
            expect(buffer.get(matchX, 3)?.fg).toBe(THEME.colors.brand)
            expect(buffer.get(matchX, 3)?.bold).toBeFalsy()
            expect(item1).toContain('src/config.ts:12')
            expect(buffer.get(2, 3)?.bg).toBeUndefined()
            expect(footer).toContain('navigate')
            expect(footer).toContain('view file')
            expect(footer).toContain('insert @file:line')
        })

        it('renders empty workspace notice when no matches found', () => {
            const buffer = new ScreenBuffer(60, 5)
            CodeSearchMenuView.render(buffer, {
                x: 0,
                y: 0,
                width: 60,
                height: 5,
                query: 'unknown_xyz',
                results: [],
                selectedIndex: 0,
                windowStart: 0,
            })

            expect(buffer.getLine(2)).toContain('No matches found in workspace.')
        })

        it('groups multiple matches in the same file into 1 entry with match count', () => {
            const buffer = new ScreenBuffer(80, 10)
            const results = [
                { file: 'src/index.ts', line: 10, content: 'const query = "hello"' },
                { file: 'src/index.ts', line: 25, content: 'console.log(query)' },
                { file: 'src/index.ts', line: 40, content: 'return query' },
                { file: 'src/config.ts', line: 5, content: 'export const config = true' },
            ]

            CodeSearchMenuView.render(buffer, {
                x: 0,
                y: 0,
                width: 80,
                height: 10,
                query: 'query',
                results,
                selectedIndex: 0,
                windowStart: 0,
            })

            const title = buffer.getLine(0)
            const item0 = buffer.getLine(2)
            const item1 = buffer.getLine(3)

            expect(title).toContain('Code search  "query" · 4 matches in 2 files')
            expect(title).not.toContain('1/2')
            expect(item0).toContain('src/index.ts:10')
            expect(item0).toContain('const query = "hello"')
            expect(item1).toContain('src/config.ts:5')
        })
    })

    describe('BtwOverlayView', () => {
        it('renders callout header, answer lines, and footer', () => {
            const buffer = new ScreenBuffer(80, 6)
            BtwOverlayView.render(buffer, {
                x: 0,
                y: 0,
                width: 80,
                state: {
                    question: 'what port is redis?',
                    answer: 'Redis default port is 6379.',
                    status: 'complete',
                },
                scrollOffset: 0,
            })

            const line0 = buffer.getLine(0)
            const line1 = buffer.getLine(1)
            const footer = buffer.getLine(2)

            expect(line0).toContain('▎ btw  what port is redis?')
            // The question is regular text, not bold (M25.1)
            const questionX = line0.indexOf('what')
            expect(buffer.get(questionX, 0)?.fg).toBe(THEME.colors.text)
            expect(buffer.get(questionX, 0)?.bold).toBeFalsy()
            expect(line1).toContain('Redis default port is 6379.')
            expect(footer).toContain('▎ tab scroll · esc dismiss')
        })

        it('renders loading status correctly', () => {
            const buffer = new ScreenBuffer(80, 4)
            BtwOverlayView.render(buffer, {
                x: 0,
                y: 0,
                width: 80,
                state: {
                    question: 'cache query',
                    answer: '',
                    status: 'loading',
                },
                scrollOffset: 0,
            })

            expect(buffer.getLine(0)).toContain('▎ btw  cache query')
            expect(buffer.getLine(1)).toContain('▎ ✱ Thinking it through…')
            expect(buffer.get(buffer.getLine(1).indexOf('✱'), 1)?.fg).toBe(THEME.colors.brand)
            expect(buffer.getLine(2)).toContain('esc cancel')
        })

        it('soft-wraps long paragraphs and bullets across multiple lines without truncating', () => {
            const buffer = new ScreenBuffer(40, 10)
            const longBullet =
                '- **Unidirectional Streaming**: Unlike WebSockets, SSE is one-way streaming from server to client.'
            BtwOverlayView.render(buffer, {
                x: 0,
                y: 0,
                width: 40,
                state: {
                    question: 'explain sse',
                    answer: longBullet,
                    status: 'complete',
                    isExpanded: true,
                    isFocused: true,
                },
                scrollOffset: 0,
            })

            expect(buffer.getLine(0)).toContain('▎ btw  explain sse')
            expect(buffer.getLine(1)).toContain('- **Unidirectional')
            // Second wrapped line should contain remaining text indented
            expect(buffer.getLine(2)).toContain('Unlike WebSockets, SSE is')
        })

        it('renders expanded mode with higher visible lines and focused footer', () => {
            const buffer = new ScreenBuffer(80, 18)
            const answer = Array.from({ length: 12 }, (_, i) => `Point ${i + 1}`).join('\n')
            BtwOverlayView.render(buffer, {
                x: 0,
                y: 0,
                width: 80,
                state: {
                    question: 'explain websockets in detail',
                    answer,
                    status: 'complete',
                    isExpanded: true,
                    isFocused: true,
                },
                scrollOffset: 0,
            })

            expect(buffer.getLine(0)).toContain('▎ btw  explain websockets in detail')
            expect(buffer.getLine(1)).toContain('Point 1')
            expect(buffer.getLine(12)).toContain('Point 12')
            const footer = buffer.getLine(13)
            expect(footer).toContain('esc')
            expect(footer).toContain('back')
        })

        it('renders 401 error state with structured helpful guidance', () => {
            const buffer = new ScreenBuffer(80, 6)
            BtwOverlayView.render(buffer, {
                x: 0,
                y: 0,
                width: 80,
                state: {
                    question: 'what are websockets',
                    answer: '',
                    status: 'error',
                    error: '401 Incorrect API key provided: dummy-key.',
                },
                scrollOffset: 0,
            })

            expect(buffer.getLine(0)).toContain('▎ btw  what are websockets')
            expect(buffer.getLine(1)).toContain('401 Incorrect API key provided')
            expect(buffer.getLine(1)).not.toContain('Error:')
            expect(buffer.getLine(2)).toContain('Authentication Failed: Invalid or missing API key')
            expect(buffer.getLine(3)).toContain('Configure your key via /login')
            expect(buffer.getLine(3)).not.toContain('Tip:')
        })
    })

    describe('FileViewMenuView', () => {
        it('renders file header, line numbers, cursor, and navigation footer', () => {
            const buffer = new ScreenBuffer(80, 10)
            FileViewMenuView.render(buffer, {
                x: 0,
                y: 0,
                width: 80,
                height: 10,
                filePath: 'src/main.ts',
                lines: [
                    'import { app } from "december"',
                    'export function init() {',
                    '  app.start()',
                    '}',
                ],
                cursorLineIndex: 1,
                scrollOffset: 0,
                returnOverlay: 'codesearch',
            })

            expect(buffer.getLine(0)).toContain('src/main.ts  4 lines')
            expect(buffer.getLine(0)).toContain('2:1')
            expect(buffer.getLine(0)).not.toContain('line 2:1')
            expect(buffer.getLine(2)).toContain('  1 ')
            expect(buffer.getLine(2)).toContain('import { app } from "december"')
            expect(buffer.get(2, 2)?.bg).toBeUndefined()
            expect(buffer.getLine(3)).toContain('❭')
            expect(buffer.getLine(3)).toContain('  2 ')
            expect(buffer.getLine(3)).toContain('export function init() {')
            // G15 pager row: surface band, brand line number, regular weight
            expect(buffer.get(2, 3)?.bg).toBe(THEME.colors.surface)
            expect(buffer.get(buffer.getLine(3).indexOf('2 '), 3)?.fg).toBe(THEME.colors.brand)
            expect(buffer.get(buffer.getLine(3).indexOf('export'), 3)?.bold).toBeFalsy()
            expect(buffer.getLine(buffer.height - 1)).toContain('insert @file:line')
            expect(buffer.getLine(buffer.height - 1)).toContain('back')
        })

        it('highlights search query matches and renders n/p navigation footer', () => {
            const buffer = new ScreenBuffer(80, 10)
            FileViewMenuView.render(buffer, {
                x: 0,
                y: 0,
                width: 80,
                height: 10,
                filePath: 'src/main.ts',
                lines: ['const testVal = 1', 'console.log(testVal)', 'return testVal'],
                cursorLineIndex: 0,
                scrollOffset: 0,
                searchQuery: 'testVal',
                matchLines: [1, 2, 3],
                currentMatchIndex: 0,
                returnOverlay: 'codesearch',
            })

            const title = buffer.getLine(0)
            const footer = buffer.getLine(buffer.height - 1)

            // The search position goes into the meta (M19.2)
            expect(title).toContain('src/main.ts  3 lines · "testVal" 1/3')
            expect(buffer.get(title.indexOf('"testVal"'), 0)?.fg).toBe(THEME.colors.muted)
            // The match is brand blue, not yellow and bold
            const matchX = buffer.getLine(2).indexOf('testVal')
            expect(buffer.get(matchX, 2)?.fg).toBe(THEME.colors.brand)
            expect(buffer.get(matchX, 2)?.bold).toBeFalsy()
            expect(footer).toContain('n/p next/prev match')
            expect(footer).toContain('back')
        })

        it('renders multi-file header badge and cycle file footer when totalFiles > 1', () => {
            const buffer = new ScreenBuffer(80, 10)
            FileViewMenuView.render(buffer, {
                x: 0,
                y: 0,
                width: 80,
                height: 10,
                filePath: 'src/main.ts',
                lines: ['const testVal = 1', 'console.log(testVal)'],
                cursorLineIndex: 0,
                scrollOffset: 0,
                searchQuery: 'testVal',
                matchLines: [1, 2],
                currentMatchIndex: 0,
                returnOverlay: 'codesearch',
                fileIndex: 0,
                totalFiles: 3,
            })

            const title = buffer.getLine(0)
            const footer = buffer.getLine(buffer.height - 1)

            expect(title).toContain('src/main.ts  2 lines · file 1/3 · "testVal" 1/2')
            expect(title).not.toContain('[1/3 files]')
            expect(footer).toContain('←/→ cycle file')
            expect(footer).toContain('n/p next/prev match')
        })

        it('renders error state when file cannot be loaded', () => {
            const buffer = new ScreenBuffer(80, 6)
            FileViewMenuView.render(buffer, {
                x: 0,
                y: 0,
                width: 80,
                height: 6,
                filePath: 'missing.ts',
                lines: [],
                cursorLineIndex: 0,
                scrollOffset: 0,
                error: 'ENOENT: no such file or directory',
            })

            expect(buffer.getLine(0)).toContain('missing.ts')
            expect(buffer.getLine(2)).toContain('ENOENT: no such file or directory')
            expect(buffer.getLine(2)).not.toContain('Error:')
        })
    })

    describe('SessionSelectMenuView', () => {
        it('renders session list with titles, relative time, and selector indicator', () => {
            const buffer = new ScreenBuffer(80, 12)
            SessionSelectMenuView.render(buffer, {
                x: 0,
                y: 0,
                width: 80,
                sessions: [
                    {
                        id: 'session-1',
                        preview: 'Fix user authentication bug',
                        updatedAt: Date.now() - 3600 * 1000,
                    },
                    {
                        id: 'session-2',
                        preview: 'Add payment integration with Stripe',
                        updatedAt: Date.now() - 86400 * 1000,
                    },
                ],
                selectedIndex: 0,
                windowStart: 0,
            })

            expect(buffer.getLine(0)).toContain('Resume  2 sessions')
            expect(buffer.getLine(1)).toContain('Filter: [/ to search]')
            expect(buffer.get(2, 1)?.bold).toBeFalsy()
            expect(buffer.getLine(3)).toContain('❭ Fix user authentication bug')
            expect(buffer.get(4, 3)?.fg).toBe(THEME.colors.brand)
            expect(buffer.get(4, 3)?.bold).toBeFalsy()
            expect(buffer.getLine(3)).toContain('1h ago')
            expect(buffer.getLine(4)).toContain('Add payment integration with Stripe')
            expect(buffer.getLine(buffer.height - 1)).toContain('resume')
            expect(buffer.getLine(buffer.height - 1)).toContain('rename')
            expect(buffer.getLine(buffer.height - 1)).toContain('delete')
        })

        it('renders delete confirmation state', () => {
            const buffer = new ScreenBuffer(80, 12)
            SessionSelectMenuView.render(buffer, {
                x: 0,
                y: 0,
                width: 80,
                sessions: [
                    {
                        id: 'session-1',
                        preview: 'Fix user authentication bug',
                        updatedAt: Date.now(),
                    },
                ],
                selectedIndex: 0,
                windowStart: 0,
                confirmDeleteId: 'session-1',
            })

            expect(buffer.getLine(3)).toContain('[Delete? y/n]')
            // Inline confirm in red with no bold (G10)
            const confirmX = buffer.getLine(3).indexOf('[Delete?')
            expect(buffer.get(confirmX, 3)?.fg).toBe(THEME.colors.error)
            expect(buffer.get(confirmX, 3)?.bold).toBeFalsy()
            expect(buffer.getLine(buffer.height - 1)).toContain('confirm delete')
        })

        it('sanitizes XML tags from preview and renders directional overflow', () => {
            const buffer = new ScreenBuffer(80, 14)
            const sessions = Array.from({ length: 15 }, (_, i) => ({
                id: `session-${i}`,
                preview:
                    i === 0
                        ? '@apps/cli/README.md <context_file path="apps/cli/README.md"> # December'
                        : `Task prompt ${i}`,
                updatedAt: Date.now() - i * 60000,
            }))

            SessionSelectMenuView.render(buffer, {
                x: 0,
                y: 0,
                width: 80,
                sessions,
                selectedIndex: 0,
                windowStart: 0,
            })

            // Line 3: Sanitized preview should not contain <context_file> XML tags
            expect(buffer.getLine(3)).toContain('@apps/cli/README.md # December')
            expect(buffer.getLine(3)).not.toContain('<context_file')

            // Line 10: Directional overflow indicator instead of clunky bracketed string
            expect(buffer.getLine(10)).toContain('↓ 8 more')
            expect(buffer.getLine(10)).not.toContain('[1-7 of 15 sessions]')
        })
    })

    describe('UsageSelectMenuView', () => {
        // Friday, Nov 20 2026 (local time)
        const now = new Date(2026, 10, 20, 15, 0, 0)

        const history = {
            input: 12_900,
            output: 6_700_000,
            cacheRead: 1_300_000_000,
            cacheWrite: 15_100_000,
            totalTokens: 1_321_812_900,
            dailyTokens: {
                '2026-11-16': 88_000_000,
                '2026-11-17': 705_000_000,
                '2026-11-18': 264_000_000,
                '2026-11-19': 176_000_000,
                '2026-11-20': 88_812_900,
            },
            sessions: 64,
            topModel: 'claude-opus-5-5',
            activeDays: 14,
            trackedDays: 79,
        }

        const lines = (buffer: ScreenBuffer): string[] =>
            Array.from({ length: buffer.height }, (_, i) => buffer.getLine(i))

        const renderAt = (width: number, overview: any = { history }): ScreenBuffer => {
            const height = UsageSelectMenuView.getHeight(overview, width)
            const buffer = new ScreenBuffer(width, height)
            UsageSelectMenuView.render(buffer, { y: 0, width, height, overview, now })
            return buffer
        }

        it('renders a full-width heatmap with the stats spread in a grid below it', () => {
            const buffer = renderAt(120)
            const rows = lines(buffer)
            const text = rows.join('\n')

            expect(rows[0]!.trim()).toBe('Usage')
            // 2-character cells: a full year spans 104 columns
            const monRow = rows.find((line) => line.trimStart().startsWith('Mon'))!
            expect(monRow.trimEnd().length).toBeGreaterThan(100)

            const legendRow = rows.findIndex((line) => line.includes('less ░'))
            const statsRow = rows.findIndex((line) => line.includes('Total tokens'))
            expect(statsRow).toBe(legendRow + 2)
            // four stat columns share the first stats row
            expect(rows[statsRow]).toMatch(
                /Total tokens\s+1\.3B\s+Sessions\s+64\s+Input\s+12\.9k\s+Cache read\s+1\.3B/
            )
            expect(rows[statsRow + 1]).toMatch(
                /Top model\s+claude-opus-5-5\s+Active days\s+14 \/ 79\s+Output\s+6\.7M\s+Cache write\s+15\.1M/
            )
            expect(rows[statsRow]!.indexOf('Cache read')).toBeGreaterThan(80)
            expect(text).not.toContain('$')
            expect(rows[buffer.height - 1]).toContain('usage dashboard')
        })

        it('shows the december credits in the title row only when a balance is provided', () => {
            const withCredits = { history, creditsRemainingInCents: 420 }
            const rows = lines(renderAt(120, withCredits))
            expect(rows[0]).toContain('Usage  $4.20 in December credits left')
            expect(lines(renderAt(120)).join('\n')).not.toContain('credits')
            // The credits share the title row, so the panel is no taller with them
            expect(UsageSelectMenuView.getHeight({ history }, 120)).toBe(
                UsageSelectMenuView.getHeight(withCredits, 120)
            )
        })

        it('starts the footer at the same x as every other footer (B10)', () => {
            const buffer = renderAt(120)
            const footer = buffer.getLine(buffer.height - 1)
            expect(footer.indexOf('b usage dashboard · esc close')).toBe(THEME.padding.paddingLeft)
        })

        it('shows an empty state before any usage is recorded', () => {
            const empty = {
                history: {
                    ...history,
                    input: 0,
                    output: 0,
                    cacheRead: 0,
                    cacheWrite: 0,
                    totalTokens: 0,
                    dailyTokens: {},
                    sessions: 0,
                    topModel: undefined,
                    activeDays: 0,
                    trackedDays: 0,
                },
            }
            const text = lines(renderAt(120, empty)).join('\n')
            expect(text).toContain('No usage yet. Stats appear after your first request.')
            expect(text).not.toContain('Total tokens')
        })

        it('falls back to two stat columns and 1-character cells on narrow terminals', () => {
            const rows = lines(renderAt(60))
            const statsRow = rows.findIndex((line) => line.includes('Total tokens'))
            expect(rows[statsRow]).toMatch(/Total tokens\s+1\.3B\s+Sessions\s+64/)
            expect(rows[statsRow + 2]).toMatch(/Input\s+12\.9k\s+Cache read\s+1\.3B/)
            // 1-character cells sit next to each other with no spaces
            expect(rows.find((line) => line.trimStart().startsWith('Mon'))).toContain('····')
        })

        it('drops the heatmap first on short terminals', () => {
            const buffer = new ScreenBuffer(120, 9)
            UsageSelectMenuView.render(buffer, {
                y: 0,
                width: 120,
                height: 9,
                overview: { history },
                now,
            })
            const text = lines(buffer).join('\n')
            expect(text).not.toContain('less ░')
            expect(text).toContain('Total tokens')
        })

        it('shows a loading state until the overview arrives', () => {
            const buffer = new ScreenBuffer(80, 10)
            UsageSelectMenuView.render(buffer, { y: 0, width: 80, height: 10, isLoading: true })
            expect(lines(buffer).join('\n')).toContain('Loading usage')
        })

        it('picks heatmap cell width and week count from the available width', () => {
            expect(getHeatmapLayout(114)).toEqual({ weeks: 52, cellWidth: 2 })
            expect(getHeatmapLayout(94)).toEqual({ weeks: 45, cellWidth: 2 })
            expect(getHeatmapLayout(54)).toEqual({ weeks: 50, cellWidth: 1 })
        })

        it('uses the most stat columns that fit without truncating', () => {
            const groups: [string, string][][] = [
                [
                    ['Total tokens', '1.3B'],
                    ['Top model', 'claude-opus-5-5'],
                ],
                [
                    ['Sessions', '64'],
                    ['Active days', '14 / 79'],
                ],
                [
                    ['Input', '12.9k'],
                    ['Output', '6.7M'],
                ],
                [
                    ['Cache read', '1.3B'],
                    ['Cache write', '15.1M'],
                ],
            ]
            expect(layoutStatColumns(groups, 114)).toHaveLength(4)
            expect(layoutStatColumns(groups, 60)).toHaveLength(2)
            const single = layoutStatColumns(groups, 30)
            expect(single).toHaveLength(1)
            expect(single[0]!.pairs).toHaveLength(8)
        })

        it('builds a week-column heatmap that ends in the current week', () => {
            const grid = buildHeatmapGrid(history.dailyTokens, 10, now)
            expect(grid.columns).toHaveLength(10)
            const lastWeek = grid.columns[9]!
            // Friday is day 5; Saturday is after today
            expect(lastWeek[5]!.date).toBe('2026-11-20')
            expect(lastWeek[6]!.level).toBe(-1)
            // the heaviest day gets the darkest shade, an empty day gets none
            expect(lastWeek[2]!.level).toBe(4)
            expect(grid.columns[0]![0]!.level).toBe(0)
            expect(grid.monthLabels.map((l) => l.label)).toContain('Nov')
        })
    })

    describe('RewindSelectMenuView', () => {
        const turns = [
            {
                id: 'snap-3',
                turnIndex: 3,
                commitHash: 'abcdef1234',
                prompt: 'Refactor TUI renderer',
                timestamp: Date.now() - 120000,
                touchedFiles: ['app.ts', 'screen.ts'],
            },
            {
                id: 'snap-2',
                turnIndex: 2,
                commitHash: '1234567890',
                prompt: 'Add diff buffer',
                timestamp: Date.now() - 600000,
                touchedFiles: ['diff.ts'],
            },
        ]

        it('renders turns with prompt, touched files count, and time', () => {
            const buffer = new ScreenBuffer(80, 12)
            RewindSelectMenuView.render(buffer, {
                x: 0,
                y: 0,
                width: 80,
                turns,
                selectedIndex: 0,
                windowStart: 0,
            })

            expect(buffer.getLine(0)).toContain('Rewind  go back to the start of a turn')
            expect(buffer.getLine(2)).toContain('❭ 3  Refactor TUI renderer')
            expect(buffer.getLine(2)).toContain('2 files')
            expect(buffer.getLine(2)).toContain('2m ago')
            expect(buffer.getLine(2)).not.toContain('abcdef1')
            expect(buffer.getLine(2)).not.toContain('Turn')
            expect(buffer.get(4, 2)?.bold).toBeFalsy()
            expect(buffer.getLine(3)).toContain('2  Add diff buffer')
            expect(buffer.get(4, 3)?.fg).toBe(THEME.colors.muted)
            expect(buffer.getLine(3)).toContain('1 file')
            expect(buffer.getLine(buffer.height - 1)).toContain('enter rewind')
        })

        it('shows an inline confirmation on the selected turn', () => {
            const buffer = new ScreenBuffer(80, 12)
            RewindSelectMenuView.render(buffer, {
                x: 0,
                y: 0,
                width: 80,
                turns,
                selectedIndex: 1,
                windowStart: 0,
                confirming: true,
            })

            expect(buffer.getLine(3)).toContain('[Rewind? y/n]')
            expect(buffer.getLine(2)).not.toContain('[Rewind? y/n]')
            // Inline confirm in yellow with no bold (M20.2)
            const confirmX = buffer.getLine(3).indexOf('[Rewind?')
            expect(buffer.get(confirmX, 3)?.fg).toBe(THEME.colors.warning)
            expect(buffer.get(confirmX, 3)?.bold).toBeFalsy()
            expect(buffer.getLine(buffer.height - 1)).toContain('confirm rewind')
        })
    })

    describe('AskQuestionMenuView', () => {
        it('renders question, quick-select numbers, and highlighted option', () => {
            const buffer = new ScreenBuffer(80, 10)
            AskQuestionMenuView.render(buffer, {
                x: 0,
                y: 0,
                width: 80,
                questions: [
                    {
                        question: 'Which database should we configure?',
                        options: ['PostgreSQL', 'SQLite', 'Redis'],
                    },
                ],
                currentQuestionIndex: 0,
                selectedIndex: 0,
            })

            expect(buffer.getLine(0)).toContain('Which database should we configure?')
            expect(buffer.get(THEME.padding.paddingLeft, 0)?.bold).toBe(true)
            expect(buffer.getLine(2)).toContain('❭ PostgreSQL')
            expect(buffer.getLine(3)).toContain('SQLite')
            expect(buffer.getLine(4)).toContain('Redis')
            expect(buffer.getLine(5)).toContain('Type your own answer…')
            expect(buffer.getLine(6)).toContain('enter select · 1-3 pick · esc cancel')
        })

        it('renders multi-select checkboxes', () => {
            const buffer = new ScreenBuffer(80, 10)
            AskQuestionMenuView.render(buffer, {
                x: 0,
                y: 0,
                width: 80,
                questions: [
                    {
                        question: 'Select target platforms:',
                        options: ['Web', 'CLI', 'Server'],
                        is_multi_select: true,
                    },
                ],
                currentQuestionIndex: 0,
                selectedIndex: 1,
                selectedMultiIndices: new Set([0, 1]),
            })

            expect(buffer.getLine(2)).toContain('✓ Web')
            expect(buffer.getLine(3)).toContain('❭ ✓ CLI')
            expect(buffer.getLine(4)).toContain('○ Server')
            expect(buffer.getLine(5)).toContain('Type your own answer…')
            expect(buffer.getLine(6)).toContain('space toggle')
        })
    })

    describe('ToolPermissionMenuView', () => {
        it('asks to run a command, with no git-tracked option', () => {
            const buffer = new ScreenBuffer(80, 14)
            ToolPermissionMenuView.render(buffer, {
                x: 0,
                y: 0,
                width: 80,
                toolName: 'run_command',
                toolCommandOrTarget: 'git checkout -b feature/tui',
                selectedIndex: 0,
            })

            expect(buffer.getLine(0)).toContain('Run this command?')
            expect(buffer.get(THEME.padding.paddingLeft, 0)?.bold).toBe(true)
            expect(buffer.getLine(1)).toContain('$ git checkout -b feature/tui')
            expect(buffer.getLine(3)).toContain('❭ Yes')
            expect(buffer.getLine(4)).toContain('Yes, allow git in this session')
            expect(buffer.getLine(5)).toContain('No, tell December what to do instead')
            expect(buffer.getLine(6)).toContain('enter select · esc no · y a n')
            expect(ToolPermissionMenuView.getHeight('run_command', [], 'git checkout -b x')).toBe(7)
        })

        it('flags risky commands in warning color', () => {
            const buffer = new ScreenBuffer(80, 14)
            ToolPermissionMenuView.render(buffer, {
                x: 0,
                y: 0,
                width: 80,
                toolName: 'bash',
                toolCommandOrTarget: 'rm -rf dist && bun run build',
                selectedIndex: 0,
            })
            expect(buffer.getLine(2)).toContain('! can delete files or data')
            expect(buffer.get(THEME.padding.paddingLeft + 2, 2)?.fg).toBe(THEME.colors.warning)
        })

        it('asks to edit a file and shows a numbered diff', () => {
            const buffer = new ScreenBuffer(80, 16)
            const diffLines = [
                '--- a/src/auth/session.service.ts',
                '+++ b/src/auth/session.service.ts',
                '@@ -41,3 +41,3 @@',
                '   createSession(userId: string) {',
                '-    const ttl = 3600',
                '+    const ttl = env.SESSION_TTL',
            ]
            ToolPermissionMenuView.render(buffer, {
                x: 0,
                y: 0,
                width: 80,
                toolName: 'edit_file',
                toolCommandOrTarget: 'edit_file: src/auth/session.service.ts',
                diffPreviewLines: diffLines,
                selectedIndex: 0,
            })

            expect(buffer.getLine(0)).toContain('Edit src/auth/session.service.ts?')
            expect(buffer.getLine(2)).toContain('41     createSession')
            expect(buffer.getLine(3)).toContain('42 -     const ttl = 3600')
            expect(buffer.getLine(4)).toContain('42 +     const ttl = env.SESSION_TTL')
            expect(buffer.getLine(6)).toContain('❭ Yes')
            expect(buffer.getLine(8)).toContain('Yes, git-tracked files only')
            expect(buffer.getLine(10)).toContain('y a g n')
        })
    })

    describe('PlanApproveMenuView', () => {
        it('renders plan summary, approve/refine/reject options, and navigation footer', () => {
            const buffer = new ScreenBuffer(80, 12)
            PlanApproveMenuView.render(buffer, {
                x: 0,
                y: 0,
                width: 80,
                planSummary: '1. Remove Ink. 2. Implement 2D buffer views. 3. Delete React.',
                selectedIndex: 0,
            })

            expect(buffer.getLine(0)).toContain('Start with this plan?')
            expect(buffer.getLine(1)).toContain(
                '1. Remove Ink. 2. Implement 2D buffer views. 3. Delete React.'
            )
            expect(buffer.getLine(3)).toContain('❭ Yes, start')
            expect(buffer.getLine(4)).toContain('Change the plan')
            expect(buffer.getLine(7)).toContain('enter select · esc no · y r v n')
        })
    })

    describe('plan facts (S20)', () => {
        it('counts numbered steps and the files a plan mentions', () => {
            const plan =
                '1. Move TTL to `src/auth/session.service.ts`\n2. Add env in packages/shared/src/env.ts\n3. Update test/session.test.ts\n4. Update docs/configuration.mdx'
            expect(planFacts(plan)).toBe('4 steps · 4 files')
            expect(planFacts('No steps here')).toBe('')
            expect(PlanApproveMenuView.getHeight(plan)).toBe(9)
        })
    })

    describe('FileAutocompleteMenuView', () => {
        it('renders fuzzy matched files with directory prefix and match highlighting', () => {
            const buffer = new ScreenBuffer(80, 8)
            FileAutocompleteMenuView.render(buffer, {
                x: 0,
                y: 0,
                width: 80,
                files: [
                    {
                        path: 'src/renderer/app.ts',
                        basename: 'app.ts',
                        dir: 'src/renderer',
                        extension: 'ts',
                        score: 100,
                        basenameIndices: [0],
                    },
                    {
                        path: 'src/renderer/screen.ts',
                        basename: 'screen.ts',
                        dir: 'src/renderer',
                        extension: 'ts',
                        score: 80,
                        basenameIndices: [],
                    },
                ],
                selectedIndex: 0,
                windowStart: 0,
            })

            expect(buffer.getLine(0)).toContain('❭')
            expect(buffer.getLine(0)).toContain('src/renderer/')
            expect(buffer.getLine(0)).toContain('app.ts')
            expect(buffer.getLine(1)).toContain('screen.ts')
        })
    })

    describe('MemoryViewMenuView', () => {
        it('renders AGENTS.md with line numbers and no tabs', () => {
            const buffer = new ScreenBuffer(80, 12)
            MemoryViewMenuView.render(buffer, {
                x: 0,
                y: 0,
                width: 80,
                height: 12,
                file: {
                    path: 'AGENTS.md',
                    content: '# AGENTS.md\nRule 1: No Ink\nRule 2: No React',
                },
                cursorLineIndex: 0,
                scrollOffset: 0,
            })

            expect(buffer.getLine(0)).toContain('AGENTS.md  3 lines')
            expect(buffer.getLine(0)).not.toContain('rules')
            expect(buffer.getLine(2)).toContain('1 # AGENTS.md')
            // G15 pager row: surface band, brand line number, code in regular text color
            expect(buffer.get(2, 2)?.bg).toBe(THEME.colors.surface)
            expect(buffer.get(buffer.getLine(2).indexOf('1 #'), 2)?.fg).toBe(THEME.colors.brand)
            const codeX = buffer.getLine(2).indexOf('# AGENTS')
            expect(buffer.get(codeX, 2)?.fg).toBe(THEME.colors.text)
            expect(buffer.get(codeX, 2)?.bold).toBeFalsy()
            expect(buffer.getLine(3)).toContain('2 Rule 1: No Ink')
            expect(buffer.getLine(buffer.height - 1)).toContain('scroll')
            expect(buffer.getLine(buffer.height - 1)).toContain('close')
            expect(buffer.getLine(buffer.height - 1)).not.toContain('switch tab')
            expect(buffer.getLine(buffer.height - 1)).not.toContain('create')
        })

        it('renders fallback file path such as CLAUDE.md', () => {
            const buffer = new ScreenBuffer(80, 12)
            MemoryViewMenuView.render(buffer, {
                x: 0,
                y: 0,
                width: 80,
                height: 12,
                file: { path: 'CLAUDE.md', content: 'rule' },
            })

            expect(buffer.getLine(0)).toContain('CLAUDE.md  1 line')
        })

        it('renders empty state with create shortcut when no file exists', () => {
            const buffer = new ScreenBuffer(80, 12)
            MemoryViewMenuView.render(buffer, {
                x: 0,
                y: 0,
                width: 80,
                height: 12,
                file: null,
            })

            expect(buffer.getLine(2)).toContain('No AGENTS.md found')
            expect(buffer.getLine(buffer.height - 1)).toContain('create AGENTS.md')
        })

        it('renders back label in footer when canGoBack is true', () => {
            const buffer = new ScreenBuffer(80, 12)
            MemoryViewMenuView.render(buffer, {
                x: 0,
                y: 0,
                width: 80,
                height: 12,
                file: { path: 'AGENTS.md', content: 'rule' },
                canGoBack: true,
            })

            expect(buffer.getLine(buffer.height - 1)).toContain('back')
        })
    })

    describe('AuthMenuView', () => {
        it('renders main auth menu with options', () => {
            const buffer = new ScreenBuffer(80, 10)
            AuthMenuView.render(buffer, {
                x: 0,
                y: 0,
                width: 80,
                mode: 'menu',
                isAuthenticated: true,
                userEmail: 'dev@trydecember.com',
                authMethod: 'december',
                menuSelectedIndex: 0,
            })

            expect(buffer.getLine(0)).toContain('Authentication')
            expect(buffer.getLine(2)).toContain('❭')
            expect(buffer.getLine(2)).toContain('Use your own Subscription')
            expect(buffer.getLine(3)).toContain('Use your own API Key (BYOK)')
            expect(buffer.getLine(4)).toContain('Login via December Account')
        })

        it('renders dedicated AI subscriptions menu', () => {
            const buffer = new ScreenBuffer(80, 9)
            AuthMenuView.render(buffer, {
                x: 0,
                y: 0,
                width: 80,
                mode: 'subscription',
                providerSelectedIndex: 0,
            })

            expect(buffer.getLine(0)).toContain('AI Subscriptions')
            expect(buffer.getLine(2)).toContain('❭ Amazon (Q Developer)')
            expect(buffer.getLine(3)).toContain('Anthropic (Claude)')
            expect(buffer.getLine(4)).toContain('GitHub (Copilot)')
            expect(buffer.getLine(5)).toContain('Google (Antigravity)')
            expect(buffer.getLine(6)).toContain('OpenAI (ChatGPT)')
            expect(buffer.getLine(8)).toContain('enter connect')
            expect(buffer.getLine(8)).toContain('esc back')
        })

        it('renders provider selection with search and active indicator', () => {
            const buffer = new ScreenBuffer(80, 13)
            AuthMenuView.render(buffer, {
                x: 0,
                y: 0,
                width: 80,
                mode: 'switch',
                selectedProvider: 'anthropic',
                providers: [
                    { label: 'Anthropic', value: 'anthropic' },
                    { label: 'OpenAI', value: 'openai' },
                    { label: 'Google AI Studio', value: 'google' },
                ],
                providerSelectedIndex: 0,
                providerWindowStart: 0,
            })

            expect(buffer.getLine(0)).toContain('Switch Active Provider')
            expect(buffer.getLine(1)).toContain('Search: [/ to filter]')
            expect(buffer.getLine(2).trim()).toBe('')
            expect(buffer.getLine(3)).toContain('❭')
            expect(buffer.getLine(3)).toContain('Anthropic active')
            expect(buffer.getLine(4)).toContain('OpenAI')
        })

        it('renders masked API key input prompt with portal url and prompt glyph', () => {
            const buffer = new ScreenBuffer(80, 8)
            AuthMenuView.render(buffer, {
                x: 0,
                y: 0,
                width: 80,
                mode: 'byok_key',
                activeProviderName: 'Anthropic',
                providerKeyUrl: 'https://console.anthropic.com/settings/keys',
                apiKeyInput: 'sk-ant-123456',
                apiKeyMasked: true,
            })

            expect(buffer.getLine(0)).toMatch(/^ {2}Anthropic API key\s*$/)
            expect(buffer.get(2, 0)?.bold).toBe(true)
            expect(buffer.getLine(1)).toContain('Get a key at console.anthropic.com/settings/keys')
            const linkX = buffer.getLine(1).indexOf('console.anthropic.com')
            expect(buffer.get(linkX, 1)?.fg).toBe(THEME.colors.brand)
            // Masked key, then the real terminal cursor (G11), no drawn block
            expect(buffer.getLine(3)).toContain('❭ •••••••••••••')
            expect(buffer.getLine(3)).not.toContain('█')
            expect(takePanelCursor()).toEqual({ x: 4 + 13, y: 3 })
            expect(buffer.getLine(buffer.height - 1)).toContain('submit')
            expect(buffer.getLine(buffer.height - 1)).toContain('close')
        })

        it('renders byok providers list without ziggle or inline headers', () => {
            const buffer = new ScreenBuffer(80, 13)
            AuthMenuView.render(buffer, {
                x: 0,
                y: 0,
                width: 80,
                mode: 'byok_provider',
                providers: BYOK_PROVIDER_ITEMS,
                providerSelectedIndex: 0,
                providerWindowStart: 0,
            })

            expect(buffer.getLine(0)).toContain('Providers')
            expect(buffer.getLine(1)).toContain('Search: [/ to filter]')
            expect(buffer.getLine(2).trim()).toBe('')
            expect(buffer.getLine(3)).toContain('❭ Abacus')
            expect(buffer.getLine(buffer.height - 1)).toContain('navigate')
            expect(buffer.getLine(buffer.height - 1)).toContain('select')
        })

        it('renders connected badges, disconnect shortcut, and delete confirmation for subscriptions', () => {
            const buffer = new ScreenBuffer(80, 9)
            AuthMenuView.render(buffer, {
                x: 0,
                y: 0,
                width: 80,
                mode: 'subscription',
                providerSelectedIndex: 0,
                configuredSubscriptionValues: ['claude', 'gemini'],
                selectedProvider: 'claude',
                authMethod: 'subscription',
                confirmDeleteValue: 'subscription:claude',
            })

            expect(buffer.getLine(3)).toContain('Anthropic (Claude)')
            expect(buffer.getLine(3)).toContain('active')
            expect(buffer.getLine(3)).toContain('[Disconnect? (y/n)]')
            expect(buffer.getLine(5)).toContain('Google (Antigravity)')
            expect(buffer.getLine(5)).toContain('connected')
            expect(buffer.getLine(buffer.height - 1)).toContain('confirm')
            expect(buffer.getLine(buffer.height - 1)).toContain('cancel')
        })

        it('renders active badge in green and label in standard text color, and connected badge in muted color', () => {
            const buffer = new ScreenBuffer(80, 9)
            AuthMenuView.render(buffer, {
                x: 0,
                y: 0,
                width: 80,
                mode: 'subscription',
                providerSelectedIndex: 0,
                configuredSubscriptionValues: ['copilot'],
                selectedProvider: 'gemini',
                authMethod: 'subscription',
            })

            expect(buffer.getLine(3)).toContain('Anthropic (Claude)')
            expect(buffer.getLine(4)).toContain('GitHub (Copilot) connected')
            expect(buffer.getLine(5)).toContain('Google (Antigravity) active')

            const labelCell = buffer.get(4, 5)
            expect(labelCell?.char).toBe('G')
            expect(labelCell?.fg).toBe(THEME.colors.text)

            const activeLine = buffer.getLine(5)
            const activeIdx = activeLine.indexOf('active')
            const activeBadgeCell = buffer.get(activeIdx, 5)
            expect(activeBadgeCell?.char).toBe('a')
            expect(activeBadgeCell?.fg).toBe(THEME.colors.success)

            const connectedLine = buffer.getLine(4)
            const connectedIdx = connectedLine.indexOf('connected')
            const connectedBadgeCell = buffer.get(connectedIdx, 4)
            expect(connectedBadgeCell?.char).toBe('c')
            expect(connectedBadgeCell?.fg).toBe(THEME.colors.muted)
        })

        it('renders existing credentials detected switch confirmation prompt', () => {
            const buffer = new ScreenBuffer(80, 6)
            AuthMenuView.render(buffer, {
                x: 0,
                y: 0,
                width: 80,
                mode: 'confirm_switch_subscription',
                confirmTarget: {
                    label: 'Anthropic (Claude)',
                    value: 'claude',
                    account: 'user@example.com',
                },
            })

            expect(buffer.getLine(0)).toContain('Existing Credentials Detected')
            expect(buffer.getLine(2)).toContain(
                'Credentials detected for Anthropic (Claude) (user@example.com).'
            )
            expect(buffer.getLine(3)).toContain(
                'Do you want to switch to a different account? (y/n)'
            )
            expect(buffer.getLine(buffer.height - 1)).toContain('switch account')
            expect(buffer.getLine(buffer.height - 1)).toContain('keep current')
        })

        it('renders configured badge and delete prompt for configured byok provider', () => {
            const buffer = new ScreenBuffer(80, 13)
            AuthMenuView.render(buffer, {
                x: 0,
                y: 0,
                width: 80,
                mode: 'byok_provider',
                providers: [
                    { label: 'Anthropic', value: 'anthropic' },
                    { label: 'OpenAI', value: 'openai' },
                ],
                providerSelectedIndex: 1,
                configuredProviderValues: ['openai'],
                confirmDeleteValue: 'provider:openai',
            })

            expect(buffer.getLine(4)).toContain('OpenAI connected')
            expect(buffer.getLine(4)).toContain('[Delete? (y/n)]')
            expect(buffer.getLine(buffer.height - 1)).toContain('confirm')
            expect(buffer.getLine(buffer.height - 1)).toContain('cancel')
        })

        it('renders configured badge in muted color and active badge in green for byok providers', () => {
            const buffer = new ScreenBuffer(80, 13)
            AuthMenuView.render(buffer, {
                x: 0,
                y: 0,
                width: 80,
                mode: 'byok_provider',
                providers: [
                    { label: 'Anthropic', value: 'anthropic' },
                    { label: 'OpenAI', value: 'openai' },
                ],
                providerSelectedIndex: 0,
                selectedProvider: 'openai',
                configuredProviderValues: ['anthropic'],
            })

            const openAiLabelCell = buffer.get(4, 4)
            expect(openAiLabelCell?.char).toBe('O')
            expect(openAiLabelCell?.fg).toBe(THEME.colors.text)

            const openAiLine = buffer.getLine(4)
            const activeIdx = openAiLine.indexOf('active')
            expect(buffer.get(activeIdx, 4)?.fg).toBe(THEME.colors.success)

            const anthropicLine = buffer.getLine(3)
            const configuredIdx = anthropicLine.indexOf('connected')
            expect(buffer.get(configuredIdx, 3)?.fg).toBe(THEME.colors.muted)
        })

        it('renders configured key detected replace confirmation prompt', () => {
            const buffer = new ScreenBuffer(80, 6)
            AuthMenuView.render(buffer, {
                x: 0,
                y: 0,
                width: 80,
                mode: 'confirm_replace_byok',
                confirmTarget: {
                    label: 'OpenAI',
                    value: 'openai',
                },
            })

            expect(buffer.getLine(0)).toContain('Configured Key Detected')
            expect(buffer.getLine(2)).toContain('An API key for OpenAI is already configured.')
            expect(buffer.getLine(3)).toContain('Do you want to replace it with a new key? (y/n)')
            expect(buffer.getLine(buffer.height - 1)).toContain('enter new key')
            expect(buffer.getLine(buffer.height - 1)).toContain('use existing key')
        })
    })

    describe('SwitchSelectMenuView', () => {
        it('renders configured providers with active indicator and footer', () => {
            const buffer = new ScreenBuffer(80, 8)
            SwitchSelectMenuView.render(buffer, {
                x: 0,
                y: 0,
                width: 80,
                height: 8,
                items: [
                    {
                        label: 'Anthropic (Subscription)',
                        value: 'subscription:claude',
                        isActive: true,
                    },
                    { label: 'OpenAI (BYOK)', value: 'provider:openai', isActive: false },
                ],
                selectedIndex: 0,
            })

            expect(buffer.getLine(0)).toContain('Provider  2 set up')
            expect(buffer.getLine(2)).toContain('Anthropic (Subscription)')
            expect(buffer.getLine(2)).toContain('current')
            expect(buffer.getLine(3)).toContain('OpenAI (BYOK)')
            expect(buffer.getLine(buffer.height - 1)).toContain('switch')
            expect(buffer.getLine(buffer.height - 1)).toContain('delete')
        })

        it('renders delete confirmation prompt when confirmDeleteValue matches', () => {
            const buffer = new ScreenBuffer(80, 8)
            SwitchSelectMenuView.render(buffer, {
                x: 0,
                y: 0,
                width: 80,
                height: 8,
                items: [
                    {
                        label: 'Anthropic (Subscription)',
                        value: 'subscription:claude',
                        isActive: false,
                    },
                ],
                selectedIndex: 0,
                confirmDeleteValue: 'subscription:claude',
            })

            expect(buffer.getLine(2)).toContain('[Delete? (y/n)]')
            expect(buffer.getLine(buffer.height - 1)).toContain('confirm')
            expect(buffer.getLine(buffer.height - 1)).toContain('cancel')
        })
    })

    describe('MessageListView with Tools & Thinking', () => {
        it('renders running and completed tool calls with status glyphs', () => {
            const buffer = new ScreenBuffer(80, 10)
            MessageListView.render(buffer, {
                x: 0,
                y: 0,
                width: 80,
                height: 10,
                messages: [
                    {
                        role: 'tool',
                        toolCall: {
                            id: 'tc-1',
                            name: 'read_file',
                            command: 'Read(src/index.ts)',
                            status: 'success',
                        },
                    },
                    {
                        role: 'thinking',
                        content: 'analyzing token expiration threshold',
                        isStreaming: true,
                    },
                ],
            })

            const text = Array.from({ length: buffer.height }, (_, i) => buffer.getLine(i)).join(
                '\n'
            )
            expect(text).toContain('● Read src/index.ts')
            // Thoughts are not shown in the history; the activity line shows them live (L5)
            expect(text).not.toContain('analyzing token expiration threshold')
        })

        it('renders the user prompt in regular text on the surface band', () => {
            const buffer = new ScreenBuffer(80, 5)
            MessageListView.render(buffer, {
                x: 0,
                y: 0,
                width: 80,
                height: 5,
                messages: [{ role: 'user', content: 'hello agent' }],
            })

            expect(buffer.getLine(0)).toContain('❭ hello agent')
            const cell = buffer.get(THEME.padding.paddingLeft + 2, 0)
            expect(cell?.char).toBe('h')
            expect(cell?.fg).toBe(THEME.colors.text)
            expect(cell?.bg).toBe(THEME.colors.surface)
            expect(cell?.bold).toBeFalsy()
            expect(buffer.get(THEME.padding.paddingLeft, 0)?.fg).toBe(THEME.colors.brand)
        })

        it('highlights the user prompt across the chat width and wraps long prompts', () => {
            const buffer = new ScreenBuffer(60, 8)
            MessageListView.render(buffer, {
                x: 0,
                y: 0,
                width: 60,
                height: 8,
                messages: [
                    {
                        role: 'user',
                        content: 'a long prompt that needs to wrap onto another row here\nsecond',
                    },
                ],
            })

            const left = THEME.padding.paddingLeft
            const right = 60 - THEME.padding.paddingRight
            for (const row of [0, 1, 2]) {
                expect(buffer.get(left, row)?.bg).toBe(THEME.colors.surface)
                expect(buffer.get(right - 1, row)?.bg).toBe(THEME.colors.surface)
                expect(buffer.get(right, row)?.bg).toBeUndefined()
                expect(buffer.get(left - 1, row)?.bg).toBeUndefined()
            }
            expect(buffer.getLine(0)).toContain('❭ a long prompt')
            // Continuation and second paragraph align under the text, not the glyph
            expect(buffer.getLine(1).search(/\S/)).toBe(left + 2)
            expect(buffer.getLine(2)).toContain('second')
            expect(buffer.getLine(2).search(/\S/)).toBe(left + 2)
            // Blank spacer row after the prompt has no highlight
            expect(buffer.get(left, 3)?.bg).toBeUndefined()
        })

        it('starts header, user, and assistant lines at the theme left padding', () => {
            const buffer = new ScreenBuffer(80, 12)
            MessageListView.render(buffer, {
                x: 0,
                y: 0,
                width: 80,
                height: 12,
                headerProps: { width: 80, cliVersion: '1.0.0' },
                messages: [
                    { role: 'user', content: 'hello agent' },
                    { role: 'assistant', content: 'word '.repeat(40).trim() },
                ],
            })

            const edge = THEME.padding.paddingLeft
            const firstCol = (line: string) => line.search(/\S/)
            const lines = Array.from({ length: 12 }, (_, i) => buffer.getLine(i)).filter((l) =>
                l.trim()
            )
            expect(lines.length).toBeGreaterThan(3)
            for (const line of lines) {
                expect(firstCol(line)).toBe(edge)
                // Wrapped text ends where the prompt separator ends
                expect(line.trimEnd().length).toBeLessThanOrEqual(80 - THEME.padding.paddingRight)
            }
        })

        it('draws no loader rows in the history while streaming (L0 lives above the prompt)', () => {
            const buffer = new ScreenBuffer(80, 5)
            MessageListView.render(buffer, {
                x: 0,
                y: 0,
                width: 80,
                height: 5,
                messages: [{ role: 'user', content: 'tell me a joke' }],
                isStreaming: true,
            })

            expect(buffer.getLine(0)).toContain('❭ tell me a joke')
            expect(buffer.getLine(2).trim()).toBe('')
        })

        it('renders file edits with change counts and a command result line', () => {
            const buffer = new ScreenBuffer(80, 10)
            MessageListView.render(buffer, {
                x: 0,
                y: 0,
                width: 80,
                height: 10,
                messages: [
                    {
                        role: 'tool',
                        toolCall: {
                            id: 'tc-edit',
                            name: 'edit_file',
                            command: 'Edit(src/app.ts)',
                            input: {
                                path: 'src/app.ts',
                                Target: 'foo\nbar',
                                Replacement: 'foo\nbar\nbaz\nqux',
                            },
                            status: 'success',
                        },
                    },
                    {
                        role: 'tool',
                        toolCall: {
                            id: 'tc-bash',
                            name: 'run_command',
                            command: 'Bash(git status)',
                            status: 'success',
                            output: 'On branch main\nnothing to commit',
                        },
                    },
                ],
            })

            const text = Array.from({ length: buffer.height }, (_, i) => buffer.getLine(i)).join(
                '\n'
            )
            // One row per step: counts from a line diff, then the command's last line (S4, S7)
            expect(text).toContain('● Edited src/app.ts  +2')
            expect(text).toContain('● Ran git status')
            expect(text).toContain('    └ nothing to commit')
            expect(text).not.toContain('On branch main')
        })
    })
})
