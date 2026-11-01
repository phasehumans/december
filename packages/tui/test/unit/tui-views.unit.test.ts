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
import { HelpMenuView } from '../../src/renderer/views/help-menu-view'
import { InputBarView } from '../../src/renderer/views/input-bar-view'
import { LoginMenuView } from '../../src/renderer/views/login-menu-view'
import { MemoryViewMenuView } from '../../src/renderer/views/memory-view-menu-view'
import { MessageListView } from '../../src/renderer/views/message-list-view'
import { ModelSelectMenuView } from '../../src/renderer/views/model-select-menu-view'
import { PlanApproveMenuView } from '../../src/renderer/views/plan-approve-menu-view'
import { RewindSelectMenuView } from '../../src/renderer/views/rewind-select-menu-view'
import { SessionSelectMenuView } from '../../src/renderer/views/session-select-menu-view'
import { SettingsMenuView } from '../../src/renderer/views/settings-menu-view'
import { SkillsMenuView } from '../../src/renderer/views/skills-menu-view'
import { SwitchSelectMenuView } from '../../src/renderer/views/switch-select-menu-view'
import { TasksModeMenuView } from '../../src/renderer/views/tasks-mode-menu-view'
import { ToolPermissionMenuView } from '../../src/renderer/views/tool-permission-menu-view'
import { UsageSelectMenuView } from '../../src/renderer/views/usage-select-menu-view'
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
            expect(buffer.getLine(2)).toContain('December is a')
            expect(buffer.getLine(5)).toContain('0.4.15')
            expect(buffer.getLine(6)).toContain('dev@december.io')
            expect(buffer.getLine(7)).toContain('Claude 3.7 Sonnet')
            expect(buffer.getLine(8)).toContain('feature/effort-help')
            expect(buffer.getLine(10)).toContain('sess-xyz-789')
            expect(buffer.getLine(12)).toContain('cycle tab')
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
    })

    describe('EffortMenuView', () => {
        it('renders reasoning depth options, selection indicator, active level, and footer', () => {
            const buffer = new ScreenBuffer(70, 9)
            EffortMenuView.render(buffer, {
                x: 0,
                y: 0,
                width: 70,
                height: 9,
                modelLabel: 'Claude 3.7 Sonnet',
                currentLevel: 'medium',
                selectedIndex: 3,
            })

            expect(buffer.getLine(0)).toContain('Reasoning')
            expect(buffer.getLine(0)).toContain('Claude 3.7 Sonnet')
            expect(buffer.getLine(2)).toContain('Auto')
            expect(buffer.getLine(3)).toContain('Off')
            expect(buffer.getLine(4)).toContain('Low')
            expect(buffer.getLine(5)).toContain('❭')
            expect(buffer.getLine(5)).toContain('Medium')
            expect(buffer.getLine(5)).toContain('(Current)')
            expect(buffer.getLine(6)).toContain('High')
            expect(buffer.getLine(8)).toContain('navigate')
            expect(buffer.getLine(8)).toContain('enter select')
            expect(buffer.getLine(8)).toContain('esc close')
        })

        it('computes correct fixed height', () => {
            expect(EffortMenuView.getHeight()).toBe(9)
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

            expect(buffer.getLine(0)).toContain('Models')
            expect(buffer.getLine(1)).toContain('Search: [/ to filter]')
            expect(buffer.getLine(3)).toContain('Claude 3.7 Sonnet')
            expect(buffer.getLine(4)).toContain('Claude 3.5 Sonnet')
            expect(buffer.getLine(4)).toContain('(active)')
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

            expect(buffer.getLine(0)).toContain('Workspace Changes')
            expect(buffer.getLine(0)).toContain('1 file (+120 -15)')
            expect(buffer.getLine(2)).toContain('❭')
            expect(buffer.getLine(2)).toContain('packages/tui/src/renderer/app.ts')
            expect(buffer.getLine(2)).toContain('+120')
            expect(buffer.getLine(2)).toContain('-15')
            expect(buffer.get(2, 2)?.bg).toBeUndefined()
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

            expect(buffer.getLine(0)).toContain('packages/tui/src/renderer/app.ts')
            expect(buffer.getLine(0)).toContain('+1')
            expect(buffer.getLine(0)).toContain('-1')
            expect(buffer.getLine(2)).toContain('unchanged lines')
            expect(buffer.getLine(3)).toContain('-')
            expect(buffer.getLine(3)).toContain('const oldVal = 1')
            expect(buffer.getLine(4)).toContain('+')
            expect(buffer.getLine(4)).toContain('const newVal = 2')
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
            expect(buffer.getLine(2)).toContain('[Claude 3.5 Sonnet]')
            expect(buffer.getLine(3)).toContain('PathGuard Protection')
            expect(buffer.getLine(3)).toContain('[on]')
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
            expect(buffer.getLine(4)).toContain('Base System Prompt')
            expect(buffer.getLine(4)).toContain('Tool Schemas')
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
        it('renders discovered skills list with descriptions', () => {
            const buffer = new ScreenBuffer(80, 10)
            SkillsMenuView.render(buffer, {
                x: 0,
                y: 0,
                width: 80,
                height: 10,
                selectedIndex: 0,
                windowStart: 0,
                skills: [{ name: 'tdd', description: 'Test driven development workflow' }],
            })

            expect(buffer.getLine(0)).toContain('Skills (1)')
            expect(buffer.getLine(2)).toContain('❭')
            expect(buffer.getLine(2)).toContain('tdd')
            expect(buffer.getLine(2)).toContain('Test driven development workflow')
        })

        it('renders template guide, origin line, and search filter in full layout', () => {
            const buffer = new ScreenBuffer(80, 20)
            SkillsMenuView.render(buffer, {
                x: 0,
                y: 0,
                width: 80,
                height: 20,
                selectedIndex: 0,
                windowStart: 0,
                searchQuery: 'tdd',
                skills: [
                    {
                        name: 'tdd',
                        description: 'Test driven development workflow',
                        origin: 'workspace',
                        directoryPath: '/workspace/.agents/skills/tdd',
                        entryFilePath: '/workspace/.agents/skills/tdd/SKILL.md',
                    },
                ],
            })

            expect(buffer.getLine(0)).toContain('Skills (1)')
            expect(buffer.getLine(0)).toContain('1 workspace')
            expect(buffer.getLine(2)).toContain('Create new skills')
            expect(buffer.getLine(3)).toContain('workspace: .agents/skills/{skill_name}/SKILL.md')
            expect(buffer.getLine(7)).toContain('Filter: tdd (1 match)')
            expect(buffer.getLine(8)).toContain('Workspace skills')
        })

        it('renders skill detail documentation view with line numbers and cursor', () => {
            const buffer = new ScreenBuffer(80, 15)
            SkillsMenuView.render(buffer, {
                x: 0,
                y: 0,
                width: 80,
                height: 15,
                selectedIndex: 0,
                windowStart: 0,
                isDetailView: true,
                cursorLineIndex: 1,
                scrollOffset: 0,
                detailLines: ['# TDD Guide', 'Step 1: Write test', 'Step 2: Implement'],
                skills: [
                    {
                        name: 'tdd',
                        description: 'Test driven development workflow',
                        origin: 'workspace',
                        directoryPath: '/workspace/.agents/skills/tdd',
                        entryFilePath: '/workspace/.agents/skills/tdd/SKILL.md',
                    },
                ],
            })

            expect(buffer.getLine(0)).toContain('tdd')
            expect(buffer.getLine(0)).toContain('line 2:3')
            expect(buffer.getLine(2)).toContain('1 # TDD Guide')
            expect(buffer.getLine(3)).toContain('❭')
            expect(buffer.getLine(3)).toContain('2 Step 1: Write test')
            expect(buffer.getLine(14)).toContain('scroll')
            expect(buffer.getLine(14)).toContain('back')
        })
    })

    describe('TasksModeMenuView', () => {
        it('renders background tasks with status badges and commands', () => {
            const buffer = new ScreenBuffer(60, 10)
            TasksModeMenuView.render(buffer, {
                x: 0,
                y: 0,
                width: 60,
                height: 10,
                tasks: [
                    {
                        id: 'task-1',
                        command: 'bun test',
                        status: 'running',
                        duration: '4s',
                    },
                ],
                selectedTaskIndex: 0,
                windowStart: 0,
            })

            expect(buffer.getLine(0)).toContain('Tasks (1 task)')
            expect(buffer.getLine(2)).toContain('[RUNNING]')
            expect(buffer.getLine(2)).toContain('bun test')
            expect(buffer.getLine(2)).toContain('4s')
        })
    })

    describe('MessageListView', () => {
        it('renders messages and handles scroll offset slicing', () => {
            const buffer = new ScreenBuffer(50, 4)
            const messages = [
                { id: '1', role: 'user', content: 'hello agent' },
                { id: '2', role: 'assistant', content: 'line 1\nline 2\nline 3\nline 4\nline 5' },
            ]

            // When scrolled down to the bottom (scrollOffset = 4)
            MessageListView.render(buffer, {
                x: 0,
                y: 0,
                width: 50,
                height: 4,
                messages,
                scrollOffset: 4,
            })

            const line0 = buffer.getLine(0)
            const line1 = buffer.getLine(1)
            expect(line0).toContain('line 3')
            expect(line1).toContain('line 4')
        })

        it('displays reading mode indicator when scrolled up from bottom', () => {
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
            expect(firstLine).toContain('Reading mode')
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

            expect(title).toContain('Code Search')
            expect(title).toContain('"config"')
            expect(title).toContain('1/2')
            expect(item0).toContain('❭')
            expect(item0).toContain('src/index.ts:42')
            expect(item0).toContain('export const run = true')
            expect(buffer.get(2, 2)?.bg).toBeUndefined()
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

            expect(title).toContain('Code Search')
            expect(title).toContain('"query"')
            expect(title).toContain('4 matches in 2 files')
            expect(title).toContain('1/2')
            expect(item0).toContain('src/index.ts (3 matches)')
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

            expect(line0).toContain('[btw]')
            expect(line0).toContain('what port is redis?')
            expect(line1).toContain('Redis default port is 6379.')
            expect(footer).toContain('copy')
            expect(footer).toContain('dismiss')
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

            expect(buffer.getLine(0)).toContain('[btw]')
            expect(buffer.getLine(1)).toContain('Looking up cached context...')
        })

        it('renders expanded mode with collapse label and higher visible lines', () => {
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
                },
                scrollOffset: 0,
            })

            expect(buffer.getLine(0)).toContain('[btw]')
            expect(buffer.getLine(1)).toContain('Point 1')
            expect(buffer.getLine(12)).toContain('Point 12')
            const footer = buffer.getLine(13)
            expect(footer).toContain('collapse')
            expect(footer).toContain('copy')
            expect(footer).toContain('dismiss')
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

            expect(buffer.getLine(0)).toContain('[btw]')
            expect(buffer.getLine(1)).toContain('Error: 401 Incorrect API key provided')
            expect(buffer.getLine(2)).toContain('Authentication Failed: Invalid or missing API key')
            expect(buffer.getLine(3)).toContain('Tip: Configure your key via /login')
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

            expect(buffer.getLine(0)).toContain('src/main.ts')
            expect(buffer.getLine(0)).toContain('4 lines')
            expect(buffer.getLine(0)).toContain('line 2:1')
            expect(buffer.getLine(2)).toContain('  1 ')
            expect(buffer.getLine(2)).toContain('import { app } from "december"')
            expect(buffer.get(2, 2)?.bg).toBeUndefined()
            expect(buffer.getLine(3)).toContain('❭')
            expect(buffer.getLine(3)).toContain('  2 ')
            expect(buffer.getLine(3)).toContain('export function init() {')
            expect(buffer.get(2, 3)?.bg).toBe(THEME.colors.codespanBg)
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

            expect(title).toContain('"testVal" (1/3)')
            expect(footer).toContain('n/p next/prev match')
            expect(footer).toContain('back')
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
            expect(buffer.getLine(2)).toContain('Error: ENOENT: no such file or directory')
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

            expect(buffer.getLine(0)).toContain('Session History')
            expect(buffer.getLine(1)).toContain('Filter: [/ to search]')
            expect(buffer.getLine(3)).toContain('❭')
            expect(buffer.getLine(3)).toContain('Fix user authentication bug')
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
        it('renders daily sparkline bar chart and session statistics', () => {
            const buffer = new ScreenBuffer(80, 16)
            UsageSelectMenuView.render(buffer, {
                x: 0,
                y: 0,
                width: 80,
                activeModel: 'claude-3-5-sonnet',
                providerDisplayName: 'Anthropic',
                sessionStats: {
                    requests: 12,
                    inputTokens: 45000,
                    outputTokens: 12000,
                    cacheReadTokens: 5000,
                    totalTokens: 57000,
                    cost: 0.155,
                },
                dailyUsage: [
                    {
                        date: '2026-11-01',
                        dayName: 'Sun',
                        formattedDate: 'Nov 1',
                        tokens: 57000,
                        isToday: true,
                    },
                    {
                        date: '2026-10-31',
                        dayName: 'Sat',
                        formattedDate: 'Oct 31',
                        tokens: 12000,
                        isToday: false,
                    },
                ],
            })

            expect(buffer.getLine(0)).toContain('Token Usage & Cost Analysis')
            expect(buffer.getLine(0)).toContain('claude-3-5-sonnet')
            expect(buffer.getLine(2)).toContain('Daily Volume (Past 7 Days)')
            expect(buffer.getLine(2)).toContain('Session Statistics')
            expect(buffer.getLine(3)).toContain('Sun Nov 1')
            expect(buffer.getLine(3)).toContain('Today')
            expect(buffer.getLine(3)).toContain('Requests:')
            expect(buffer.getLine(3)).toContain('12 requests')
            expect(buffer.getLine(7)).toContain('Estimated Cost: $0.1550')
            expect(buffer.getLine(buffer.height - 1)).toContain('billing')
            expect(buffer.getLine(buffer.height - 1)).toContain('refresh')
        })
    })

    describe('RewindSelectMenuView', () => {
        it('renders turn snapshots with commit hash, touched files count, and prompt preview', () => {
            const buffer = new ScreenBuffer(80, 12)
            RewindSelectMenuView.render(buffer, {
                x: 0,
                y: 0,
                width: 80,
                turns: [
                    {
                        turnIndex: 3,
                        commitHash: 'abcdef1234',
                        prompt: 'Refactor TUI renderer',
                        timestamp: Date.now() - 120000,
                        touchedFiles: ['app.ts', 'screen.ts'],
                    },
                    {
                        turnIndex: 2,
                        commitHash: '1234567890',
                        prompt: 'Add diff buffer',
                        timestamp: Date.now() - 600000,
                        touchedFiles: ['diff.ts'],
                    },
                ],
                selectedIndex: 0,
                windowStart: 0,
            })

            expect(buffer.getLine(0)).toContain('Rewind Checkpoint / Turn Snapshot')
            expect(buffer.getLine(3)).toContain('Turn 3')
            expect(buffer.getLine(3)).toContain('abcdef1')
            expect(buffer.getLine(3)).toContain('Refactor TUI renderer')
            expect(buffer.getLine(3)).toContain('(2 files)')
            expect(buffer.getLine(buffer.height - 1)).toContain('rewind to turn')
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

            expect(buffer.getLine(0)).toContain('Q1/1: Which database should we configure?')
            expect(buffer.getLine(2)).toContain('❭')
            expect(buffer.getLine(2)).toContain('(1) PostgreSQL')
            expect(buffer.getLine(3)).toContain('(2) SQLite')
            expect(buffer.getLine(4)).toContain('(3) Redis')
            expect(buffer.getLine(buffer.height - 1)).toContain('quick select')
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

            expect(buffer.getLine(2)).toContain('[x] Web')
            expect(buffer.getLine(3)).toContain('❭')
            expect(buffer.getLine(3)).toContain('[x] CLI')
            expect(buffer.getLine(4)).toContain('[ ] Server')
            expect(buffer.getLine(buffer.height - 1)).toContain('toggle')
        })
    })

    describe('ToolPermissionMenuView', () => {
        it('renders tool summary, diff preview, and approval options', () => {
            const buffer = new ScreenBuffer(80, 14)
            ToolPermissionMenuView.render(buffer, {
                x: 0,
                y: 0,
                width: 80,
                toolName: 'run_command',
                toolCommandOrTarget: 'git checkout -b feature/tui',
                diffPreviewLines: ['+ added line 1', '- removed line 2'],
                selectedIndex: 0,
            })

            expect(buffer.getLine(0)).toContain('Tool Permission Required: run_command')
            expect(buffer.getLine(1)).toContain('git checkout -b feature/tui')
            expect(buffer.getLine(3)).toContain('+ added line 1')
            expect(buffer.getLine(4)).toContain('- removed line 2')
            expect(buffer.getLine(6)).toContain('❭')
            expect(buffer.getLine(6)).toContain('[y] Approve once')
            expect(buffer.getLine(7)).toContain('[a] Always allow in session')
            expect(buffer.getLine(buffer.height - 1)).toContain('approve')
            expect(buffer.getLine(buffer.height - 1)).toContain('deny')
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

            expect(buffer.getLine(0)).toContain('[PLAN] Architectural Plan Generated')
            expect(buffer.getLine(1)).toContain(
                '1. Remove Ink. 2. Implement 2D buffer views. 3. Delete React.'
            )
            expect(buffer.getLine(3)).toContain('❭')
            expect(buffer.getLine(3)).toContain('[y] Approve & Execute')
            expect(buffer.getLine(4)).toContain('[r] Refine Plan')
            expect(buffer.getLine(buffer.height - 1)).toContain('approve')
            expect(buffer.getLine(buffer.height - 1)).toContain('reject')
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
        it('renders project rules vs memory tabs and document line numbers', () => {
            const buffer = new ScreenBuffer(80, 12)
            MemoryViewMenuView.render(buffer, {
                x: 0,
                y: 0,
                width: 80,
                height: 12,
                activeTab: 'rules',
                ruleFiles: [
                    {
                        path: 'AGENTS.md',
                        content: '# AGENTS.md\nRule 1: No Ink\nRule 2: No React',
                    },
                ],
                selectedRuleIndex: 0,
                ruleCursorLineIndex: 0,
                ruleScrollOffset: 0,
            })

            expect(buffer.getLine(0)).toContain('memory')
            expect(buffer.getLine(0)).toContain('rules')
            expect(buffer.getLine(2)).toContain('AGENTS.md')
            expect(buffer.getLine(4)).toContain('1 │ # AGENTS.md')
            expect(buffer.getLine(5)).toContain('2 │ Rule 1: No Ink')
            expect(buffer.getLine(buffer.height - 1)).toContain('scroll')
            expect(buffer.getLine(buffer.height - 1)).toContain('close')
            expect(buffer.getLine(buffer.height - 1)).not.toContain('open in editor')
            expect(buffer.getLine(buffer.height - 1)).not.toContain('reload')
        })

        it('renders memory tab with budget stats, entries, and interactive footer', () => {
            const buffer = new ScreenBuffer(80, 12)
            MemoryViewMenuView.render(buffer, {
                x: 0,
                y: 0,
                width: 80,
                height: 12,
                activeTab: 'memory',
                memoryDetails: {
                    filePath: '.december/memory.md',
                    totalBytes: 512,
                    maxBytes: 2048,
                    budgetPercent: 25,
                    entries: [
                        { category: 'build_and_test', text: 'bun test --bail' },
                        { category: 'conventions', text: 'no em dashes' },
                    ],
                },
                selectedEntryIndex: 0,
                scrollOffset: 0,
            })

            expect(buffer.getLine(0)).toContain('memory')
            expect(buffer.getLine(0)).toContain('rules')
            expect(buffer.getLine(2)).toContain('Workspace Memory (.december/memory.md)')
            expect(buffer.getLine(2)).toContain('512/2048 B (25%)')
            expect(buffer.getLine(4)).toContain('[build_and_test] bun test --bail')
            expect(buffer.getLine(5)).toContain('[conventions] no em dashes')
            expect(buffer.getLine(buffer.height - 1)).toContain('add')
            expect(buffer.getLine(buffer.height - 1)).toContain('forget')
            expect(buffer.getLine(buffer.height - 1)).toContain('close')
            expect(buffer.getLine(buffer.height - 1)).not.toContain('open in editor')
        })

        it('renders back label in footer when canGoBack is true', () => {
            const buffer = new ScreenBuffer(80, 12)
            MemoryViewMenuView.render(buffer, {
                x: 0,
                y: 0,
                width: 80,
                height: 12,
                activeTab: 'rules',
                ruleFiles: [{ path: 'AGENTS.md', content: 'rule' }],
                canGoBack: true,
            })

            expect(buffer.getLine(buffer.height - 1)).toContain('back')
        })

        it('renders inline add prompt when isAddingEntry is true', () => {
            const buffer = new ScreenBuffer(80, 12)
            MemoryViewMenuView.render(buffer, {
                x: 0,
                y: 0,
                width: 80,
                height: 12,
                activeTab: 'memory',
                memoryDetails: {
                    filePath: '.december/memory.md',
                    totalBytes: 512,
                    maxBytes: 2048,
                    budgetPercent: 25,
                    entries: [{ category: 'conventions', text: 'no em dashes' }],
                },
                isAddingEntry: true,
                newEntryText: 'always use bun',
                newEntryCategory: 'build_and_test',
            })

            expect(buffer.getLine(buffer.height - 3)).toContain(
                'add memory [build_and_test] › always use bun'
            )
            expect(buffer.getLine(buffer.height - 1)).toContain('save')
            expect(buffer.getLine(buffer.height - 1)).toContain('cycle category')
            expect(buffer.getLine(buffer.height - 1)).toContain('cancel')
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
            const buffer = new ScreenBuffer(80, 8)
            AuthMenuView.render(buffer, {
                x: 0,
                y: 0,
                width: 80,
                mode: 'subscription',
                providerSelectedIndex: 0,
            })

            expect(buffer.getLine(0)).toContain('AI Subscriptions')
            expect(buffer.getLine(2)).toContain('❭ Anthropic (Claude)')
            expect(buffer.getLine(3)).toContain('GitHub (Copilot)')
            expect(buffer.getLine(4)).toContain('Google (Antigravity)')
            expect(buffer.getLine(5)).toContain('OpenAI (ChatGPT)')
            expect(buffer.getLine(7)).toContain('enter connect')
            expect(buffer.getLine(7)).toContain('esc back')
        })

        it('renders provider selection with search and active indicator', () => {
            const buffer = new ScreenBuffer(80, 12)
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
            expect(buffer.getLine(2)).toContain('❭')
            expect(buffer.getLine(2)).toContain('Anthropic (active)')
            expect(buffer.getLine(3)).toContain('OpenAI')
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

            expect(buffer.getLine(0)).toContain('Enter API Key for Anthropic:')
            expect(buffer.getLine(1)).toContain("Don't have an API key? Get one at")
            expect(buffer.getLine(1)).toContain('https://console.anthropic.com/settings/keys')
            expect(buffer.getLine(3)).toContain('❭ •••••••••••••█')
            expect(buffer.getLine(buffer.height - 1)).toContain('submit')
            expect(buffer.getLine(buffer.height - 1)).toContain('close')
        })

        it('renders byok providers list without ziggle or inline headers', () => {
            const buffer = new ScreenBuffer(80, 12)
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
            expect(buffer.getLine(2)).toContain('❭ Abacus')
            expect(buffer.getLine(buffer.height - 1)).toContain('navigate')
            expect(buffer.getLine(buffer.height - 1)).toContain('select')
        })

        it('renders connected badges, disconnect shortcut, and delete confirmation for subscriptions', () => {
            const buffer = new ScreenBuffer(80, 8)
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

            expect(buffer.getLine(2)).toContain('Anthropic (Claude)')
            expect(buffer.getLine(2)).toContain('(active)')
            expect(buffer.getLine(2)).toContain('[Disconnect? (y/n)]')
            expect(buffer.getLine(4)).toContain('Google (Antigravity)')
            expect(buffer.getLine(4)).toContain('(connected)')
            expect(buffer.getLine(buffer.height - 1)).toContain('confirm')
            expect(buffer.getLine(buffer.height - 1)).toContain('cancel')
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
            const buffer = new ScreenBuffer(80, 12)
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

            expect(buffer.getLine(3)).toContain('OpenAI (configured)')
            expect(buffer.getLine(3)).toContain('[Delete? (y/n)]')
            expect(buffer.getLine(buffer.height - 1)).toContain('confirm')
            expect(buffer.getLine(buffer.height - 1)).toContain('cancel')
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

            expect(buffer.getLine(0)).toContain('Switch Provider')
            expect(buffer.getLine(2)).toContain('Anthropic (Subscription)')
            expect(buffer.getLine(2)).toContain('(Active)')
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
            expect(text).toContain('Read(src/index.ts)')
            expect(text).toContain('Thinking... analyzing token expiration threshold')
        })
    })
})
