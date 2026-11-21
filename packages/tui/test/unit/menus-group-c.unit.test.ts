import { describe, expect, it } from 'bun:test'

import { ScreenBuffer } from '../../src/renderer/buffer'
import { btwLoaderGlyph, BtwOverlayView } from '../../src/renderer/views/btw-overlay-view'
import { CodeSearchMenuView } from '../../src/renderer/views/code-search-menu-view'
import { DiffViewMenuView } from '../../src/renderer/views/diff-view-menu-view'
import { FileViewMenuView } from '../../src/renderer/views/file-view-menu-view'
import { MemoryViewMenuView } from '../../src/renderer/views/memory-view-menu-view'
import { ReportView } from '../../src/renderer/views/report-view'
import { RewindSelectMenuView } from '../../src/renderer/views/rewind-select-menu-view'
import { SessionSelectMenuView } from '../../src/renderer/views/session-select-menu-view'
import { SkillsMenuView } from '../../src/renderer/views/skills-menu-view'
import { UsageSelectMenuView } from '../../src/renderer/views/usage-select-menu-view'
import { THEME } from '../../src/theme'

import type { DiffFileEntry } from '../../src/utils/diff'

/** True when no cell on the row is bold */
function rowHasNoBold(buffer: ScreenBuffer, y: number): boolean {
    for (let x = 0; x < buffer.width; x++) if (buffer.get(x, y)?.bold) return false
    return true
}

function colOf(buffer: ScreenBuffer, y: number, text: string): number {
    return buffer.getLine(y).indexOf(text)
}

function footerX(buffer: ScreenBuffer, y: number): number {
    return buffer.getLine(y).search(/\S/)
}

const FILES: DiffFileEntry[] = [
    {
        path: 'apps/server/src/modules/auth/auth.service.ts',
        additions: 12,
        deletions: 4,
        status: 'modified',
        diff: '@@ -40,3 +40,3 @@\n   async createSession() {\n-    const ttl = 3600\n+    const ttl = env.SESSION_TTL\n   }\n',
    },
    { path: 'packages/tui/src/theme.ts', additions: 8, deletions: 3, status: 'modified', diff: '' },
    { path: 'docs/agents/domain.md', additions: 4, deletions: 0, status: 'modified', diff: '' },
]

describe('menus group C: review views, pagers, history, reports', () => {
    describe('M16 Changes', () => {
        const render = (width = 80) => {
            const buffer = new ScreenBuffer(width, 8)
            DiffViewMenuView.render(buffer, {
                x: 0,
                y: 0,
                width,
                height: 8,
                files: FILES,
                selectedFileIndex: 0,
                windowStart: 0,
                isDetailView: false,
                detailScrollOffset: 0,
            })
            return buffer
        }

        it('draws the "Changes" title with colored counts and no position counter', () => {
            const buffer = render()
            const title = buffer.getLine(0)
            expect(title).toContain('Changes  3 files +24 -7')
            expect(title).not.toContain('1/3')
            expect(buffer.get(2, 0)?.bold).toBe(true)
            expect(buffer.get(colOf(buffer, 0, '+24'), 0)?.fg).toBe(THEME.colors.success)
            expect(buffer.get(colOf(buffer, 0, '-7'), 0)?.fg).toBe(THEME.colors.error)
        })

        it('selects in brand without bold, hides zero counts, and keeps the footer', () => {
            const buffer = render()
            expect(buffer.get(2, 2)?.char).toBe('❭')
            expect(buffer.get(4, 2)?.fg).toBe(THEME.colors.brand)
            expect(rowHasNoBold(buffer, 2)).toBe(true)
            expect(buffer.get(4, 3)?.fg).toBe(THEME.colors.text)
            expect(buffer.getLine(4)).toContain('+4')
            expect(buffer.getLine(4)).not.toContain('-0')
            expect(buffer.getLine(7)).toContain(
                '↑/↓ navigate · enter view diff · tab insert context · esc dismiss'
            )
        })

        it('shortens long paths in the middle', () => {
            const buffer = render(40)
            expect(buffer.getLine(2)).toContain('…')
            expect(buffer.getLine(2)).toContain('auth.service.ts')
        })
    })

    describe('M17 Diff detail', () => {
        const render = (cursorLineIndex: number) => {
            const buffer = new ScreenBuffer(90, 12)
            DiffViewMenuView.render(buffer, {
                x: 0,
                y: 0,
                width: 90,
                height: 12,
                files: FILES,
                selectedFileIndex: 0,
                windowStart: 0,
                isDetailView: true,
                detailScrollOffset: 0,
                cursorLineIndex,
            })
            return buffer
        }

        it('shows the title row with counts and change/file meta, and "p/n change" in the footer', () => {
            const buffer = render(0)
            const title = buffer.getLine(0)
            expect(title).toContain('apps/server/src/modules/auth/auth.service.ts  +12 -4')
            expect(title).toContain('change 1/1 · file 1/3')
            expect(buffer.getLine(11)).toContain('p/n change')
            expect(buffer.getLine(11)).not.toContain('hunk')
        })

        it('colors only the sign of add and delete rows; the code stays text color', () => {
            const buffer = render(0)
            let delY = -1
            let addY = -1
            for (let y = 2; y < 10; y++) {
                if (buffer.getLine(y).includes('const ttl = 3600')) delY = y
                if (buffer.getLine(y).includes('env.SESSION_TTL')) addY = y
            }
            expect(delY).toBeGreaterThan(0)
            expect(addY).toBeGreaterThan(0)
            const delCode = colOf(buffer, delY, 'const')
            const addCode = colOf(buffer, addY, 'const')
            expect(buffer.get(colOf(buffer, delY, '- '), delY)?.fg).toBe(THEME.colors.error)
            expect(buffer.get(colOf(buffer, addY, '+ '), addY)?.fg).toBe(THEME.colors.success)
            expect(buffer.get(delCode, delY)?.fg).toBe(THEME.colors.text)
            expect(buffer.get(addCode, addY)?.fg).toBe(THEME.colors.text)
            expect(buffer.get(addCode, addY)?.bg).toBe(THEME.colors.diffAddBg)
            expect(buffer.get(delCode, delY)?.bg).toBe(THEME.colors.diffDeleteBg)
        })

        it('draws the cursor row with the surface band, brand line number, and no bold', () => {
            // Row index 0 is the fold row; index 1 is the first context line (line 40)
            const buffer = render(1)
            const y = 3
            expect(buffer.get(2, y)?.char).toBe('❭')
            expect(buffer.get(2, y)?.bg).toBe(THEME.colors.surface)
            const numX = colOf(buffer, y, '40')
            expect(buffer.get(numX, y)?.fg).toBe(THEME.colors.brand)
            expect(rowHasNoBold(buffer, y)).toBe(true)
        })
    })

    describe('M18 Code search', () => {
        it('puts query and counts in the meta, matches in brand, no bold, no counter', () => {
            const buffer = new ScreenBuffer(100, 8)
            CodeSearchMenuView.render(buffer, {
                x: 0,
                y: 0,
                width: 100,
                height: 8,
                query: 'SESSION_TTL',
                results: [
                    {
                        file: 'src/auth/session.ts',
                        line: 12,
                        content: 'const ttl = env.SESSION_TTL',
                    },
                    { file: 'src/auth/session.ts', line: 20, content: 'SESSION_TTL again' },
                    {
                        file: 'src/config/env.ts',
                        line: 8,
                        content: 'SESSION_TTL: z.coerce.number(),',
                    },
                ],
                selectedIndex: 0,
                windowStart: 0,
            })
            const title = buffer.getLine(0)
            expect(title).toContain('Code search  "SESSION_TTL" · 3 matches in 2 files')
            expect(title).not.toContain('1/2')
            expect(rowHasNoBold(buffer, 2)).toBe(true)
            expect(buffer.get(4, 2)?.fg).toBe(THEME.colors.brand)
            const matchX = colOf(buffer, 2, 'SESSION_TTL')
            expect(buffer.get(matchX, 2)?.fg).toBe(THEME.colors.brand)
            expect(buffer.get(matchX, 2)?.bold).toBeFalsy()
            expect(buffer.get(4, 3)?.fg).toBe(THEME.colors.text)
            expect(buffer.getLine(7)).toContain(
                '↑/↓ navigate · enter view file · tab insert @file:line · esc dismiss'
            )
        })
    })

    describe('M19 pagers', () => {
        it('file view: search position in the meta, one pager row style, match in brand', () => {
            const buffer = new ScreenBuffer(90, 10)
            FileViewMenuView.render(buffer, {
                x: 0,
                y: 0,
                width: 90,
                height: 10,
                filePath: 'src/auth/session.ts',
                lines: ['import { env } from "../config/env"', 'const ttl = env.SESSION_TTL', 'x'],
                cursorLineIndex: 1,
                scrollOffset: 0,
                searchQuery: 'SESSION_TTL',
                matchLines: [1, 5, 9],
                currentMatchIndex: 0,
                fileIndex: 1,
                totalFiles: 4,
            })
            const title = buffer.getLine(0)
            expect(title).toContain('src/auth/session.ts  3 lines · file 2/4 · "SESSION_TTL" 1/3')
            expect(title).toContain('2:1')
            expect(rowHasNoBold(buffer, 0)).toBe(false)
            expect(buffer.get(colOf(buffer, 0, '3 lines'), 0)?.fg).toBe(THEME.colors.muted)

            const y = 3
            expect(buffer.get(2, y)?.char).toBe('❭')
            expect(buffer.get(2, y)?.bg).toBe(THEME.colors.surface)
            expect(buffer.get(colOf(buffer, y, '2 '), y)?.fg).toBe(THEME.colors.brand)
            expect(rowHasNoBold(buffer, y)).toBe(true)
            const matchX = colOf(buffer, y, 'SESSION_TTL')
            expect(buffer.get(matchX, y)?.fg).toBe(THEME.colors.brand)
            expect(buffer.get(colOf(buffer, y, 'const'), y)?.fg).toBe(THEME.colors.text)
            // Other rows: dim line number, text color code, no band
            expect(buffer.get(colOf(buffer, 2, 'import'), 2)?.bg).toBeUndefined()
        })

        it('/memory and /skills use the same pager row and title row', () => {
            const memory = new ScreenBuffer(80, 8)
            MemoryViewMenuView.render(memory, {
                x: 0,
                y: 0,
                width: 80,
                height: 8,
                file: { path: 'AGENTS.md', content: '# AGENTS.md\n\n## Agent skills' },
                cursorLineIndex: 0,
                scrollOffset: 0,
            })
            expect(memory.getLine(0)).toContain('AGENTS.md  3 lines')
            expect(memory.get(2, 2)?.bg).toBe(THEME.colors.surface)
            expect(memory.get(colOf(memory, 2, '# AGENTS'), 2)?.fg).toBe(THEME.colors.text)
            expect(rowHasNoBold(memory, 2)).toBe(true)

            const skills = new ScreenBuffer(80, 8)
            SkillsMenuView.render(skills, {
                x: 0,
                y: 0,
                width: 80,
                height: 8,
                skill: { name: 'tdd', description: '', entryFilePath: '/w/skills/tdd/SKILL.md' },
                detailLines: ['# TDD', 'Write the test first.'],
                cursorLineIndex: 0,
                scrollOffset: 0,
            })
            expect(skills.getLine(0)).toContain('tdd  /w/skills/tdd/SKILL.md · 2 lines')
            expect(skills.get(2, 0)?.fg).toBe(THEME.colors.text)
            expect(skills.get(2, 2)?.bg).toBe(THEME.colors.surface)
            expect(rowHasNoBold(skills, 2)).toBe(true)
        })
    })

    describe('M20 Rewind', () => {
        const turns = [
            {
                id: 'a',
                turnIndex: 7,
                prompt: 'move session TTL to env',
                timestamp: Date.now() - 300_000,
                touchedFiles: ['a', 'b'],
            },
            {
                id: 'b',
                turnIndex: 6,
                prompt: 'add idle timeout tests',
                timestamp: Date.now() - 720_000,
            },
        ]

        it('puts the description in the meta and drops the "Turn" word', () => {
            const buffer = new ScreenBuffer(80, 7)
            RewindSelectMenuView.render(buffer, {
                x: 0,
                y: 0,
                width: 80,
                height: 7,
                turns,
                selectedIndex: 0,
                windowStart: 0,
            })
            expect(buffer.getLine(0)).toContain('Rewind  go back to the start of a turn')
            expect(buffer.getLine(2)).toContain('❭ 7  move session TTL to env')
            expect(buffer.getLine(2)).toContain('2 files · 5m ago')
            expect(buffer.getLine(2)).not.toContain('Turn')
            expect(buffer.get(4, 3)?.fg).toBe(THEME.colors.muted)
            expect(buffer.get(colOf(buffer, 3, 'add idle'), 3)?.fg).toBe(THEME.colors.text)
            expect(rowHasNoBold(buffer, 2)).toBe(true)
            expect(RewindSelectMenuView.getHeight(2)).toBe(6)
        })

        it('keeps the confirm inline in yellow with no bold', () => {
            const buffer = new ScreenBuffer(80, 7)
            RewindSelectMenuView.render(buffer, {
                x: 0,
                y: 0,
                width: 80,
                height: 7,
                turns,
                selectedIndex: 0,
                windowStart: 0,
                confirming: true,
            })
            const x = colOf(buffer, 2, '[Rewind? y/n]')
            expect(x).toBeGreaterThan(0)
            expect(buffer.get(x, 2)?.fg).toBe(THEME.colors.warning)
            expect(buffer.get(colOf(buffer, 2, 'move'), 2)?.fg).toBe(THEME.colors.brand)
            expect(rowHasNoBold(buffer, 2)).toBe(true)
            expect(buffer.getLine(6)).toContain('y confirm rewind · n/esc cancel')
        })
    })

    describe('M21 Resume', () => {
        const sessions = [
            { id: 's1', title: 'Fix login redirect bug', updatedAt: Date.now() - 300_000 },
            { id: 's2', title: 'Move session TTL to env', updatedAt: Date.now() - 7_200_000 },
        ]
        const base = {
            x: 0,
            y: 0,
            width: 80,
            height: 8,
            sessions,
            selectedIndex: 0,
            windowStart: 0,
        }

        it('titles the panel "Resume" with a count and keeps the filter row', () => {
            const buffer = new ScreenBuffer(80, 8)
            SessionSelectMenuView.render(buffer, base)
            expect(buffer.getLine(0)).toContain('Resume  2 sessions')
            expect(buffer.getLine(1)).toContain('Filter: [/ to search]')
            expect(rowHasNoBold(buffer, 1)).toBe(true)
            expect(buffer.getLine(3)).toContain('❭ Fix login redirect bug')
            expect(rowHasNoBold(buffer, 3)).toBe(true)
            expect(buffer.getLine(7)).toContain(
                '↑/↓ navigate · enter resume · / search · r rename · d delete · esc close'
            )
        })

        it('renames in place with no drawn cursor and reports where the real cursor goes', () => {
            const buffer = new ScreenBuffer(80, 8)
            const props = { ...base, renameMode: true, renameValue: 'Fix login redirect' }
            SessionSelectMenuView.render(buffer, props)
            expect(buffer.getLine(0)).toContain('Rename session')
            expect(buffer.getLine(3)).toContain('❭ Fix login redirect')
            expect(buffer.getLine(3)).not.toContain('█')
            expect(buffer.getLine(3)).not.toContain('Rename:')
            expect(buffer.get(4, 3)?.fg).toBe(THEME.colors.text)
            expect(SessionSelectMenuView.getCursorPosition(props)).toEqual({ x: 4 + 18, y: 3 })
        })

        it('draws no fake cursor while searching', () => {
            const buffer = new ScreenBuffer(80, 8)
            const props = { ...base, isSearching: true, searchQuery: 'fix' }
            SessionSelectMenuView.render(buffer, props)
            expect(buffer.getLine(1)).toContain('Search: fix')
            expect(buffer.getLine(1)).not.toContain('█')
            expect(rowHasNoBold(buffer, 1)).toBe(true)
            expect(SessionSelectMenuView.getCursorPosition(props)).toEqual({ x: 2 + 8 + 3, y: 1 })
        })

        it('keeps the delete confirm inline in red with no bold', () => {
            const buffer = new ScreenBuffer(80, 8)
            SessionSelectMenuView.render(buffer, { ...base, confirmDeleteId: 's1' })
            const x = colOf(buffer, 3, '[Delete? y/n]')
            expect(x).toBeGreaterThan(0)
            expect(buffer.get(x, 3)?.fg).toBe(THEME.colors.error)
            expect(buffer.get(4, 3)?.fg).toBe(THEME.colors.brand)
            expect(rowHasNoBold(buffer, 3)).toBe(true)
        })
    })

    describe('M22 Usage', () => {
        it('puts the credits in the title meta and starts the footer at the shared x (B10)', () => {
            const history = {
                dailyTokens: {},
                totalTokens: 1000,
                sessions: 2,
                activeDays: 1,
                trackedDays: 3,
                input: 1,
                output: 1,
                cacheRead: 0,
                cacheWrite: 0,
            }
            const overview = { history, creditsRemainingInCents: 1234 }
            const height = UsageSelectMenuView.getHeight(overview, 100)
            const buffer = new ScreenBuffer(100, height)
            UsageSelectMenuView.render(buffer, { x: 0, y: 0, width: 100, height, overview })
            expect(buffer.getLine(0)).toContain('Usage  $12.34 in December credits left')
            expect(buffer.get(colOf(buffer, 0, '$12.34'), 0)?.fg).toBe(THEME.colors.muted)
            const footerY = height - 1
            expect(buffer.getLine(footerY)).toContain('b usage dashboard · esc close')
            expect(footerX(buffer, footerY)).toBe(THEME.padding.paddingLeft)
            expect(buffer.get(colOf(buffer, footerY - 3, 'Total tokens'), footerY - 3)?.fg).toBe(
                THEME.colors.muted
            )
        })
    })

    describe('M25 Side question', () => {
        it('draws the question in regular text and a brand ✱ with "Thinking it through…"', () => {
            const buffer = new ScreenBuffer(80, 3)
            BtwOverlayView.render(buffer, {
                x: 0,
                y: 0,
                width: 80,
                scrollOffset: 0,
                state: {
                    question: 'what does extractThoughtTopic do?',
                    answer: '',
                    status: 'loading',
                },
            })
            expect(buffer.getLine(0)).toContain('▎ btw  what does extractThoughtTopic do?')
            expect(rowHasNoBold(buffer, 0)).toBe(true)
            expect(buffer.get(colOf(buffer, 0, 'what'), 0)?.fg).toBe(THEME.colors.text)
            expect(buffer.getLine(1)).toContain('▎ ✱ Thinking it through…')
            expect(buffer.get(colOf(buffer, 1, '✱'), 1)?.fg).toBe(THEME.colors.brand)
            expect(buffer.getLine(2)).toContain('▎ esc cancel')
        })

        it('breathes the ✱ from the now prop', () => {
            expect(btwLoaderGlyph()).toBe('✱')
            expect(btwLoaderGlyph(0)).toBe('·')
            expect(btwLoaderGlyph(130 * 3)).toBe('✱')
            expect(btwLoaderGlyph(130 * 4)).toBe('✲')
            expect(btwLoaderGlyph(130 * 8)).toBe('·')
        })

        it('uses the MenuFooterView style with "tab scroll"', () => {
            const buffer = new ScreenBuffer(80, 4)
            BtwOverlayView.render(buffer, {
                x: 0,
                y: 0,
                width: 80,
                scrollOffset: 0,
                state: { question: 'q', answer: 'a short answer', status: 'complete' },
            })
            const y = 2
            expect(buffer.getLine(y)).toContain('▎ tab scroll · esc dismiss')
            expect(buffer.get(colOf(buffer, y, 'tab'), y)?.fg).toBe(THEME.colors.brand)
            expect(buffer.get(colOf(buffer, y, ' · ') + 1, y)?.fg).toBe(THEME.colors.dim)
        })

        it('decides on the scroll hint from the wrapped line count (B12)', () => {
            const longLine = 'word '.repeat(80).trim()
            const buffer = new ScreenBuffer(40, 8)
            const state = {
                question: 'q',
                answer: longLine,
                status: 'complete' as const,
                isFocused: true,
            }
            BtwOverlayView.render(buffer, { x: 0, y: 0, width: 40, scrollOffset: 0, state })
            const height = BtwOverlayView.getHeight(state, undefined, 34)
            expect(buffer.getLine(height - 1)).toContain('↑/↓ scroll · esc back')
        })
    })

    describe('M26 Report panels', () => {
        const render = (selectedIndex = 1) => {
            const buffer = new ScreenBuffer(80, 12)
            ReportView.render(buffer, {
                x: 0,
                y: 0,
                width: 80,
                height: 12,
                title: 'Check',
                subtitle: '3 issues',
                rows: [
                    { text: 'Environment', tone: 'heading' },
                    { text: 'git installed', tone: 'ok', detail: '2.43.0', id: 'git' },
                    { text: 'node version', tone: 'warn', detail: '18.19.0', id: 'node' },
                    { text: '↳ Install Node 20 or later', tone: 'muted' },
                    { text: 'OpenAI key', tone: 'fail', detail: 'not set', id: 'key' },
                ],
                selectedIndex,
                footer: [
                    { key: '↑/↓', label: 'navigate' },
                    { key: 'esc', label: 'close' },
                ],
            })
            return buffer
        }

        it('draws the title with muted meta and a muted, regular heading', () => {
            const buffer = render()
            expect(buffer.getLine(0)).toContain('Check  3 issues')
            expect(buffer.get(colOf(buffer, 0, '3 issues'), 0)?.fg).toBe(THEME.colors.muted)
            expect(buffer.get(2, 2)?.fg).toBe(THEME.colors.muted)
            expect(rowHasNoBold(buffer, 2)).toBe(true)
        })

        it('uses a red ● for failures, a yellow ! for warnings, and a dim ✓ for passes', () => {
            const buffer = render(4)
            expect(buffer.getLine(3)).toContain('✓ git installed  2.43.0')
            expect(buffer.get(colOf(buffer, 3, '✓'), 3)?.fg).toBe(THEME.colors.dim)
            expect(buffer.get(colOf(buffer, 4, '!'), 4)?.fg).toBe(THEME.colors.warning)
            expect(buffer.getLine(6)).not.toContain('✗')
            expect(buffer.get(colOf(buffer, 6, 'OpenAI') - 2, 6)?.char).toBe('●')
            expect(buffer.get(colOf(buffer, 6, 'not set'), 6)?.fg).toBe(THEME.colors.error)
        })

        it('selects with no band and no bold', () => {
            const buffer = render(1)
            expect(buffer.get(2, 3)?.char).toBe('❭')
            expect(buffer.get(10, 3)?.bg).toBeUndefined()
            expect(buffer.get(colOf(buffer, 3, 'git'), 3)?.fg).toBe(THEME.colors.brand)
            expect(rowHasNoBold(buffer, 3)).toBe(true)
        })

        it('draws fix lines with a dim └ in place of ↳', () => {
            const buffer = render()
            const line = buffer.getLine(5)
            expect(line).toContain('└ Install Node 20 or later')
            expect(line).not.toContain('↳')
            expect(buffer.get(colOf(buffer, 5, '└'), 5)?.fg).toBe(THEME.colors.dim)
        })

        it('draws tabs per G14 with no bold and no underline', () => {
            const buffer = new ScreenBuffer(80, 10)
            ReportView.render(buffer, {
                x: 0,
                y: 0,
                width: 80,
                height: 10,
                title: 'Permissions',
                rows: [],
                tabs: [
                    { label: 'allow', active: true },
                    { label: 'deny', active: false },
                ],
                footer: [{ key: 'esc', label: 'close' }],
            })
            expect(buffer.getLine(2)).toContain('allow   deny')
            const allowX = colOf(buffer, 2, 'allow')
            expect(buffer.get(allowX, 2)?.fg).toBe(THEME.colors.brand)
            expect(buffer.get(allowX, 2)?.underline).toBeFalsy()
            expect(buffer.get(colOf(buffer, 2, 'deny'), 2)?.fg).toBe(THEME.colors.muted)
            expect(rowHasNoBold(buffer, 2)).toBe(true)
        })
    })
})
