import { describe, expect, it } from 'bun:test'

import { COMMANDS } from '../../src/commands/commands'
import { ScreenBuffer } from '../../src/renderer/buffer'
import { CommandMenuView } from '../../src/renderer/views/command-menu-view'
import { ContextMenuView } from '../../src/renderer/views/context-menu-view'
import { EffortMenuView } from '../../src/renderer/views/effort-menu-view'
import {
    FileAutocompleteMenuView,
    fitPath,
    middleEllipsis,
} from '../../src/renderer/views/file-autocomplete-menu-view'
import { HelpMenuView } from '../../src/renderer/views/help-menu-view'
import { ModelSelectMenuView } from '../../src/renderer/views/model-select-menu-view'
import { SettingsMenuView, formatSettingValue } from '../../src/renderer/views/settings-menu-view'
import { SwitchSelectMenuView } from '../../src/renderer/views/switch-select-menu-view'
import { THEME } from '../../src/theme'

import type { ScoredFile } from '../../src/utils/fuzzy'

function findText(buffer: ScreenBuffer, text: string): { x: number; y: number } | null {
    for (let y = 0; y < buffer.height; y++) {
        const x = buffer.getLine(y).indexOf(text)
        if (x >= 0) return { x, y }
    }
    return null
}

/** True when no cell in the buffer is bold, except on the given rows */
function noBoldExcept(buffer: ScreenBuffer, rows: number[] = []): boolean {
    for (let y = 0; y < buffer.height; y++) {
        if (rows.includes(y)) continue
        for (let x = 0; x < buffer.width; x++) {
            if (buffer.get(x, y)?.bold) return false
        }
    }
    return true
}

function file(dir: string, basename: string, indices: number[] = []): ScoredFile {
    return {
        path: dir === '.' ? basename : `${dir}/${basename}`,
        dir,
        basename,
        extension: basename.split('.').pop() || '',
        score: 1,
        basenameIndices: indices,
    }
}

describe('menus group A', () => {
    describe('M1 command menu', () => {
        it('keeps every description at 45 characters or less, with no usage text', () => {
            for (const cmd of COMMANDS) {
                expect(cmd.description.length).toBeLessThanOrEqual(45)
                expect(cmd.description).not.toContain('usage:')
                expect(cmd.description).not.toContain('\u2014')
            }
            expect(COMMANDS.find((c) => c.name === 'btw')?.args).toBe('<question>')
            expect(COMMANDS.find((c) => c.name === 'codesearch')?.args).toBe('<query>')
        })

        it('draws the name in a 22-cell column, the args in muted, and no bold', () => {
            const buffer = new ScreenBuffer(80, 8)
            CommandMenuView.render(buffer, {
                x: 0,
                y: 0,
                width: 80,
                query: '',
                selectedIndex: 0,
                windowStart: 0,
            })

            const btw = findText(buffer, '/btw')!
            expect(btw).not.toBeNull()
            expect(buffer.get(btw.x - 2, btw.y)?.char).toBe(THEME.glyphs.selector)
            expect(buffer.get(btw.x, btw.y)?.fg).toBe(THEME.colors.brand)
            const args = findText(buffer, '<question>')!
            expect(args.x).toBe(btw.x + 5)
            expect(buffer.get(args.x, args.y)?.fg).toBe(THEME.colors.muted)
            const desc = findText(buffer, 'Ask a side question. It is not saved.')!
            expect(desc.x).toBe(btw.x + 22)
            expect(buffer.get(desc.x, desc.y)?.fg).toBe(THEME.colors.text)

            const changelog = findText(buffer, '/changelog')!
            expect(buffer.get(changelog.x, changelog.y)?.fg).toBe(THEME.colors.text)
            const changelogDesc = findText(buffer, 'Open the changelog in your browser')!
            expect(buffer.get(changelogDesc.x, changelogDesc.y)?.fg).toBe(THEME.colors.muted)

            const more = findText(buffer, 'more')!
            expect(buffer.get(more.x, more.y)?.fg).toBe(THEME.colors.dim)
            expect(noBoldExcept(buffer)).toBe(true)
        })
    })

    describe('M2 file menu', () => {
        it('draws the folder muted, the name in text color, matches in brand with no bold or underline', () => {
            const buffer = new ScreenBuffer(80, 4)
            FileAutocompleteMenuView.render(buffer, {
                x: 0,
                y: 0,
                width: 80,
                files: [
                    file('src/renderer/views', 'menu-footer-view.ts', [0, 1, 2, 3]),
                    file('src/renderer/views', 'model-select-menu-view.ts', [0]),
                ],
                selectedIndex: 0,
                windowStart: 0,
            })

            const dir = findText(buffer, 'src/renderer/views/')!
            expect(buffer.get(dir.x, dir.y)?.fg).toBe(THEME.colors.muted)
            // Selected row: the whole file name is brand
            const sel = findText(buffer, 'menu-footer-view.ts')!
            expect(buffer.get(sel.x + 10, sel.y)?.fg).toBe(THEME.colors.brand)
            // Other row: the match is brand, the rest is text color
            const other = findText(buffer, 'model-select-menu-view.ts')!
            expect(buffer.get(other.x, other.y)?.fg).toBe(THEME.colors.brand)
            expect(buffer.get(other.x + 1, other.y)?.fg).toBe(THEME.colors.text)
            for (let x = 0; x < 80; x++) {
                expect(buffer.get(x, 0)?.underline).toBeFalsy()
            }
            expect(noBoldExcept(buffer)).toBe(true)
        })

        it('shortens long folders in the middle with a one-cell ellipsis', () => {
            expect(middleEllipsis('abcdefghij', 5)).toBe('ab…ij')
            const fit = fitPath(
                file('packages/tui/src/renderer/views/very/deep/folder', 'a.ts'),
                20
            )
            expect(fit.dir.length + fit.base.length).toBeLessThanOrEqual(20)
            expect(fit.dir).toContain('…')
            expect(fit.dir.endsWith('/')).toBe(true)
            expect(fit.base).toBe('a.ts')
        })
    })

    describe('M3 help', () => {
        it('draws tabs with no bold, one intro sentence, and labels with no colon', () => {
            const buffer = new ScreenBuffer(90, 13)
            HelpMenuView.render(buffer, {
                x: 0,
                y: 0,
                width: 90,
                height: 13,
                activeTab: 'general',
                cliVersion: 'v0.4.15',
                cwd: '~/code/december',
                branch: 'main',
            })
            const tabs = buffer.getLine(0)
            expect(tabs).toContain('general   commands   shortcuts')
            expect(buffer.get(2, 0)?.fg).toBe(THEME.colors.brand)
            expect(buffer.get(tabs.indexOf('commands'), 0)?.fg).toBe(THEME.colors.muted)
            expect(buffer.getLine(2)).toContain(
                'December writes code, fixes bugs and runs commands'
            )
            expect(buffer.getLine(4)).toContain('Version    0.4.15')
            expect(buffer.getLine(6)).toContain('Model      none')
            expect(buffer.getLine(7)).toContain('~/code/december · main')
            const all = Array.from({ length: 13 }, (_, i) => buffer.getLine(i)).join('\n')
            expect(all).not.toContain('Guest')
            expect(all).not.toContain('Claude 3.7 Sonnet')
            expect(all).not.toContain('Version:')
            expect(buffer.getLine(12)).toContain('←/→ cycle tab · esc dismiss')
            expect(noBoldExcept(buffer)).toBe(true)
        })

        it('uses the command menu rows on the commands tab', () => {
            const buffer = new ScreenBuffer(90, 13)
            HelpMenuView.render(buffer, {
                x: 0,
                y: 0,
                width: 90,
                height: 13,
                activeTab: 'commands',
                commands: [
                    {
                        name: 'btw',
                        args: '<question>',
                        description: 'Ask a side question. It is not saved.',
                    },
                    { name: 'clear', description: 'Clear the conversation' },
                ],
                cmdSelectedIndex: 0,
            })
            const btw = findText(buffer, '/btw <question>')!
            expect(findText(buffer, 'Ask a side question')!.x).toBe(btw.x + 22)
            expect(noBoldExcept(buffer)).toBe(true)
        })
    })

    describe('M4 settings', () => {
        it('draws values with no brackets, the description line, and the footer', () => {
            const buffer = new ScreenBuffer(80, 9 + 6)
            SettingsMenuView.render(buffer, {
                x: 0,
                y: 0,
                width: 80,
                height: SettingsMenuView.getHeight(3),
                selectedIndex: 0,
                settings: [
                    { id: 'provider', title: 'Provider', value: 'anthropic' },
                    { id: 'pathguard', title: 'Path guard', value: 'on' },
                    { id: 'browser_visible', title: 'Browser window', value: 'off' },
                ],
            })
            expect(buffer.getLine(0)).toContain('Settings')
            expect(buffer.get(2, 0)?.bold).toBe(true)
            expect(buffer.getLine(2)).toContain('❭ Provider')
            expect(buffer.getLine(2)).toContain('Anthropic')
            expect(buffer.getLine(3)).toContain('Path guard')
            expect(buffer.getLine(4)).toContain('hidden')
            const all = Array.from({ length: 15 }, (_, i) => buffer.getLine(i)).join('\n')
            expect(all).not.toContain('[')
            const value = findText(buffer, ' on')!
            expect(buffer.get(value.x + 1, value.y)?.fg).toBe(THEME.colors.text)
            expect(buffer.getLine(6)).toContain('Which backend runs the model.')
            expect(buffer.getLine(8)).toContain('↑/↓ navigate · enter select · esc dismiss')
            expect(noBoldExcept(buffer, [0])).toBe(true)
        })

        it('maps stored values to display words', () => {
            expect(formatSettingValue({ id: 'browser_visible', value: 'on' })).toBe('shown')
            expect(formatSettingValue({ id: 'tool_permission', value: 'always-proceed' })).toBe(
                'always proceed'
            )
        })
    })

    describe('M5 model', () => {
        it('draws "Model" with provider and count, the search row, and "current" with no green', () => {
            const buffer = new ScreenBuffer(80, 12)
            ModelSelectMenuView.render(buffer, {
                x: 0,
                y: 0,
                width: 80,
                height: 10,
                models: [
                    { label: 'Opus 5.5', value: 'opus-5-5' },
                    { label: 'Sonnet 5.5', value: 'sonnet-5-5' },
                ],
                activeModel: 'opus-5-5',
                providerName: 'Anthropic',
                selectedIndex: 1,
                windowStart: 0,
                searchQuery: '',
                isSearching: false,
            })
            expect(buffer.getLine(0)).toContain('Model  anthropic · 2 models')
            expect(buffer.getLine(1)).toContain('Search: [/ to filter]')
            expect(buffer.getLine(3)).toContain('Opus 5.5  current')
            expect(buffer.getLine(4)).toContain('❭ Sonnet 5.5')
            const opus = findText(buffer, 'Opus 5.5')!
            expect(buffer.get(opus.x, opus.y)?.fg).toBe(THEME.colors.text)
            for (let y = 0; y < 12; y++) {
                for (let x = 0; x < 80; x++)
                    expect(buffer.get(x, y)?.fg).not.toBe(THEME.colors.success)
            }
            expect(buffer.getLine(9)).toContain('/switch provider')
            expect(noBoldExcept(buffer, [0])).toBe(true)
        })

        it('shows the empty state instead of a fixed list of old models', () => {
            const buffer = new ScreenBuffer(80, 8)
            ModelSelectMenuView.render(buffer, {
                x: 0,
                y: 0,
                width: 80,
                height: 7,
                models: [],
                providerName: 'Anthropic',
                selectedIndex: 0,
                windowStart: 0,
                searchQuery: '',
                isSearching: false,
            })
            expect(buffer.getLine(3)).toContain('No models from anthropic. Check /login.')
            const all = Array.from({ length: 8 }, (_, i) => buffer.getLine(i)).join('\n')
            expect(all).not.toContain('Claude 3.7 Sonnet')
        })
    })

    describe('M6 provider', () => {
        it('draws "Provider" with a count, "current", and the inline red confirm with no bold', () => {
            const buffer = new ScreenBuffer(80, 8)
            SwitchSelectMenuView.render(buffer, {
                x: 0,
                y: 0,
                width: 80,
                items: [
                    { label: 'Anthropic', value: 'anthropic', isActive: true },
                    { label: 'OpenAI', value: 'openai' },
                    { label: 'OpenRouter', value: 'openrouter' },
                ],
                selectedIndex: 2,
                confirmDeleteValue: 'openrouter',
            })
            expect(buffer.getLine(0)).toContain('Provider  3 set up')
            expect(buffer.getLine(2)).toContain('Anthropic  current')
            expect(buffer.getLine(4)).toContain('❭ OpenRouter [Delete? (y/n)]')
            const confirm = findText(buffer, '[Delete?')!
            expect(buffer.get(confirm.x, confirm.y)?.fg).toBe(THEME.colors.error)
            expect(buffer.getLine(6)).toContain('y confirm · n / esc cancel')
            expect(noBoldExcept(buffer, [0])).toBe(true)
        })
    })

    describe('M7 reasoning', () => {
        it('draws short descriptions and "current" at the end of the row within 80 columns', () => {
            const buffer = new ScreenBuffer(80, 6)
            EffortMenuView.render(buffer, {
                x: 0,
                y: 0,
                width: 80,
                modelLabel: 'Opus 5.5',
                currentLevel: 'fast',
                selectedIndex: 0,
                reasoningSupport: 'controllable',
            })
            expect(buffer.getLine(0)).toContain('Reasoning  Opus 5.5')
            expect(buffer.getLine(2)).toContain('❭ Fast    Quick answers, lowest cost  current')
            expect(buffer.getLine(3)).toContain(
                'Deep    More reasoning for hard bugs and design work'
            )
            expect(buffer.getLine(3)).not.toContain('current')
            expect(noBoldExcept(buffer, [0])).toBe(true)
        })

        it('shows one dim line for a model with fixed reasoning', () => {
            const buffer = new ScreenBuffer(80, 5)
            EffortMenuView.render(buffer, {
                x: 0,
                y: 0,
                width: 80,
                modelLabel: 'Opus 4.1',
                selectedIndex: 0,
                reasoningSupport: 'fixed',
            })
            const line = findText(
                buffer,
                'Opus 4.1 uses fixed reasoning. There is nothing to set.'
            )!
            expect(line).not.toBeNull()
            expect(buffer.get(line.x, line.y)?.fg).toBe(THEME.colors.dim)
            expect(buffer.getLine(4)).toContain('esc close')
        })
    })

    describe('M8 context', () => {
        it("keeps today's layout with bold only on the title", () => {
            const buffer = new ScreenBuffer(80, 9)
            ContextMenuView.render(buffer, {
                x: 0,
                y: 0,
                width: 80,
                height: 9,
                modelLabel: 'Opus 5.5',
                contextTokens: 42100,
                maxContextTokens: 200000,
                messageCount: 24,
            })
            expect(buffer.getLine(0)).toContain('Context · Opus 5.5')
            expect(buffer.getLine(4)).toContain('Context Used')
            expect(buffer.getLine(8)).toContain('c clear context · esc dismiss')
            expect(noBoldExcept(buffer, [0])).toBe(true)
        })
    })
})
