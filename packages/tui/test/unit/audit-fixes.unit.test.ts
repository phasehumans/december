import { homedir } from 'node:os'
import { PassThrough } from 'node:stream'

import { describe, expect, it } from 'bun:test'

import { DifferentialApp } from '../../src/renderer/app'
import { ScreenBuffer } from '../../src/renderer/buffer'
import { TerminalController } from '../../src/renderer/terminal'
import { HelpMenuView } from '../../src/renderer/views/help-menu-view'
import { formatMarkdownToLines } from '../../src/renderer/views/markdown'
import { McpMenuView } from '../../src/renderer/views/mcp-menu-view'
import { MenuFooterView } from '../../src/renderer/views/menu-footer-view'
import { isListingCommand } from '../../src/renderer/views/message-line-cache'
import { ModelSelectMenuView } from '../../src/renderer/views/model-select-menu-view'
import { formatSettingValue } from '../../src/renderer/views/settings-menu-view'

const rows = (b: ScreenBuffer) => Array.from({ length: b.height }, (_, y) => b.getLine(y))

describe('final audit fixes', () => {
    it('keeps footers on one line, dropping keys from the right and always keeping esc', () => {
        const items = [
            { key: '↑/↓', label: 'navigate' },
            { key: 'enter', label: 'log' },
            { key: 'd', label: 'stop' },
            { key: 'D', label: 'stop all' },
            { key: 'c', label: 'copy' },
            { key: 'x', label: 'clear done' },
            { key: 'esc', label: 'close' },
        ]
        const fitted = MenuFooterView.fitItems(items, 60)
        expect(fitted[fitted.length - 1]).toEqual({ key: 'esc', label: 'close' })
        expect(fitted.length).toBeLessThan(items.length)
        expect(MenuFooterView.fitItems(items, 200)).toEqual(items)

        const buffer = new ScreenBuffer(80, 1)
        MenuFooterView.render(buffer, { x: 0, y: 0, width: 80, items })
        expect(buffer.getLine(0).trimEnd().endsWith('esc close')).toBe(true)
    })

    it('shows "none" in lowercase in /settings', () => {
        expect(formatSettingValue({ id: 'provider', value: 'none' })).toBe('none')
    })

    it('shows the workspace with ~ in /help, the same as the header', () => {
        const buffer = new ScreenBuffer(100, 16)
        HelpMenuView.render(buffer, {
            x: 0,
            y: 0,
            width: 100,
            height: 16,
            activeTab: 'general',
            cwd: `${homedir()}/code/demo`,
        } as any)
        expect(rows(buffer).find((r) => r.includes('Workspace'))).toContain('~/code/demo')
    })

    it('does not repeat "/plugin" under the empty MCP list', () => {
        const buffer = new ScreenBuffer(80, 8)
        McpMenuView.render(buffer, {
            x: 0,
            y: 0,
            width: 80,
            height: 8,
            mode: 'list',
            servers: [],
            selectedIndex: 0,
        } as any)
        expect(rows(buffer).some((r) => r.includes('More servers in'))).toBe(false)
    })

    it('shows no "0 models" count above the empty model list', () => {
        const buffer = new ScreenBuffer(80, 8)
        ModelSelectMenuView.render(buffer, {
            x: 0,
            y: 0,
            width: 80,
            height: 8,
            models: [],
            activeModel: '',
            selectedIndex: 0,
            windowStart: 0,
            searchQuery: '',
            isSearching: false,
        } as any)
        expect(buffer.getLine(0)).not.toContain('0 models')
        expect(rows(buffer).join('\n')).toContain('No models from')
    })

    it('draws table headers in brand with no bold (D6)', () => {
        const lines = formatMarkdownToLines('| Col 1 | Col 2 |\n|---|---|\n| a | b |', 60)
        const header = lines.flat().find((s) => s.text.includes('Col 1'))
        expect(header?.style?.bold).toBeFalsy()
    })

    it('puts the real terminal cursor in the /model search row (G11)', () => {
        const terminal = new TerminalController({
            stdin: new PassThrough() as any,
            stdout: new PassThrough() as any,
            handleSignals: false,
        } as any)
        const app: any = new DifferentialApp({ terminal, width: 80, height: 24 } as any)
        app.start()
        app.state.models = [{ label: 'Opus 5.5', value: 'opus' }]
        app.state.activeOverlay = 'model'
        app.state.isModelSearching = true
        app.state.modelSearchQuery = 'op'
        app.render()
        const cursor = app.screen.cursorPosition
        const searchRow = rows(app.screen.backBuffer).findIndex((r) => r.includes('Search: op'))
        expect(cursor?.visible).toBe(true)
        expect(cursor?.y).toBe(searchRow)
        expect(cursor?.x).toBe(
            rows(app.screen.backBuffer)[searchRow]!.indexOf('Search: op') + 'Search: op'.length
        )
        app.stop()
    })
})

describe('command rows and the chat end (round 2)', () => {
    it('shows a line count, not the last line, for listing commands', () => {
        expect(isListingCommand("find packages/providers -maxdepth 3 -not -path '*/.*'")).toBe(true)
        expect(isListingCommand('cd packages && ls -la')).toBe(true)
        expect(isListingCommand('rg SESSION_TTL src | head -20')).toBe(true)
        expect(isListingCommand('git log --oneline -5')).toBe(true)
        expect(isListingCommand('find . -name "*.ts" | wc -l')).toBe(false)
        expect(isListingCommand('bun test test/session')).toBe(false)
        expect(isListingCommand('git status')).toBe(false)
    })

    it('keeps exactly one blank row between a finished chat and the prompt box', () => {
        const terminal = new TerminalController({
            stdin: new PassThrough() as any,
            stdout: new PassThrough() as any,
            handleSignals: false,
        })
        const app = new DifferentialApp({ terminal, width: 80, height: 20 })
        app.start()
        for (let i = 0; i < 20; i++) {
            app.state.messages.push({ role: 'user', content: `question ${i}` })
            app.state.messages.push({ role: 'assistant', content: `answer ${i}` })
        }
        app.render()
        const rows = Array.from({ length: 20 }, (_, y) => app.screen.backBuffer.getLine(y))
        const promptRule = rows.findIndex((r) => r.includes('────'))
        expect(rows[promptRule - 1]!.trim()).toBe('')
        expect(rows[promptRule - 2]).toContain('answer 19')
        app.stop()
    })
})
