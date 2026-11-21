import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { PassThrough } from 'node:stream'

import { describe, expect, it } from 'bun:test'

import { loadKeybindings } from '../../src/keybindings'
import { DifferentialApp } from '../../src/renderer/app'
import { TerminalController } from '../../src/renderer/terminal'
import {
    DEFAULT_PERMISSION_OPTIONS,
    getPermissionOptions,
} from '../../src/renderer/views/tool-permission-menu-view'

function makeApp(width = 100, height = 24) {
    const terminal = new TerminalController({
        stdin: new PassThrough() as any,
        stdout: new PassThrough() as any,
        handleSignals: false,
    })
    const app = new DifferentialApp({ terminal, width, height })
    app.start()
    return app
}

const rows = (app: DifferentialApp, height = 24) =>
    Array.from({ length: height }, (_, y) => app.screen.backBuffer.getLine(y))

describe('pr 620 review fixes', () => {
    it('labels "always" with what it saves: the exact command or file, for this project', () => {
        const always = getPermissionOptions('bash', 'git status').find((o) => o.value === 'always')
        expect(always?.label).toBe('Yes, always allow this exact command in this project')
        const edit = DEFAULT_PERMISSION_OPTIONS.find((o) => o.value === 'always')
        expect(edit?.label).toBe('Yes, always allow edits to this file in this project')
    })

    it('clears the retry when thinking output resumes', () => {
        const app = makeApp()
        app.state.messages.push({ role: 'user', content: 'go' })
        app.state.isStreaming = true
        app.startSpinner()
        app.setRetry({ attempt: 2, maxAttempts: 5, delayMs: 4000, reason: 'rate limit' })
        app.render()
        expect(rows(app).some((r) => r.includes('Retrying the request'))).toBe(true)

        app.appendThinkingChunk('**Session TTL source**\nLooking at createSession.')
        app.render()
        expect(rows(app).some((r) => r.includes('Retrying the request'))).toBe(false)
        app.stop()
    })

    it('ignores the removed toggleToolOutput action in keybindings.json', () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kb-'))
        const file = path.join(dir, 'keybindings.json')
        fs.writeFileSync(file, JSON.stringify({ bindings: { toggleToolOutput: ['ctrl+e'] } }))
        expect(loadKeybindings(file).problems).toEqual([])
        fs.rmSync(dir, { recursive: true, force: true })
    })

    it('puts back a queued prompt as typed, with its paste placeholder (L14)', () => {
        const app = makeApp()
        app.state.messages.push({ role: 'user', content: 'go' })
        app.state.isStreaming = true
        app.handlePaste(Array.from({ length: 20 }, (_, i) => `log ${i}`).join('\n'))
        const typed = app.state.input
        expect(typed).toMatch(/\[Pasted \d+ lines/)

        app.submitPrompt()
        expect(app.state.promptQueue).toHaveLength(1)
        expect(app.state.promptQueue[0]).toContain('log 19')

        app.handleKey('\x1b[A')
        expect(app.state.input).toBe(typed)
        expect(app.state.promptQueue).toHaveLength(0)
        app.stop()
    })
})
