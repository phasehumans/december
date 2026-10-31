import { describe, expect, it } from 'bun:test'

import { ScreenBuffer } from '../../src/renderer/buffer'
import { CommandMenuView } from '../../src/renderer/views/command-menu-view'
import { ContextMenuView } from '../../src/renderer/views/context-menu-view'
import { DiffViewMenuView } from '../../src/renderer/views/diff-view-menu-view'
import { HeaderView } from '../../src/renderer/views/header-view'
import { HelpMenuView } from '../../src/renderer/views/help-menu-view'
import { InputBarView } from '../../src/renderer/views/input-bar-view'
import { MessageListView } from '../../src/renderer/views/message-list-view'
import { ModelSelectMenuView } from '../../src/renderer/views/model-select-menu-view'
import { SettingsMenuView } from '../../src/renderer/views/settings-menu-view'
import { SkillsMenuView } from '../../src/renderer/views/skills-menu-view'
import { TasksModeMenuView } from '../../src/renderer/views/tasks-mode-menu-view'

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
        it('renders help title, commands, shortcuts, and footer', () => {
            const buffer = new ScreenBuffer(60, 18)
            HelpMenuView.render(buffer, {
                x: 0,
                y: 0,
                width: 60,
                height: 18,
            })

            expect(buffer.getLine(0)).toContain('Help & Commands')
            expect(buffer.getLine(2)).toContain('COMMANDS')
            expect(buffer.getLine(3)).toContain('/model')
            expect(buffer.getLine(10)).toContain('KEYBOARD SHORTCUTS')
            expect(buffer.getLine(17)).toContain('Esc Close Help')
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

            expect(buffer.getLine(0)).toContain('Select AI Model')
            expect(buffer.getLine(2)).toContain('Type / to filter models')
            expect(buffer.getLine(4)).toContain('❭')
            expect(buffer.getLine(4)).toContain('Claude 3.7 Sonnet')
            expect(buffer.getLine(5)).toContain('(●)')
            expect(buffer.getLine(5)).toContain('Claude 3.5 Sonnet')
            expect(buffer.getLine(13)).toContain('Navigate')
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

            expect(buffer.getLine(0)).toContain('Workspace Changes (1 changed files)')
            expect(buffer.getLine(2)).toContain('M')
            expect(buffer.getLine(2)).toContain('packages/tui/src/renderer/app.ts')
            expect(buffer.getLine(2)).toContain('+120')
            expect(buffer.getLine(2)).toContain('-15')
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

            expect(buffer.getLine(0)).toContain('December Settings')
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

            expect(buffer.getLine(0)).toContain('Context Window Usage')
            expect(buffer.getLine(2)).toContain('Claude 3.5 Sonnet')
            expect(buffer.getLine(3)).toContain('25k / 200k (12.5%)')
            expect(buffer.getLine(5)).toContain('TOKEN BREAKDOWN')
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

            expect(buffer.getLine(0)).toContain('Installed Skills (1 available)')
            expect(buffer.getLine(2)).toContain('❭')
            expect(buffer.getLine(2)).toContain('tdd')
            expect(buffer.getLine(2)).toContain('Test driven development workflow')
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

            expect(buffer.getLine(0)).toContain('Background Tasks (1 total)')
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
})
