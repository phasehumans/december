import { PassThrough } from 'node:stream'

import { describe, expect, it } from 'bun:test'

import { DifferentialApp } from '../../src/renderer/app'
import { TerminalController } from '../../src/renderer/terminal'
import {
    getSessionDisplayTitle,
    SessionSelectMenuView,
} from '../../src/renderer/views/session-select-menu-view'

const createApp = (options: Record<string, any> = {}) => {
    const stdout = new PassThrough()
    const terminal = new TerminalController({
        stdin: new PassThrough() as any,
        stdout: stdout as any,
        handleSignals: false,
    })
    const app = new DifferentialApp({ terminal, width: 80, height: 24, ...options })
    return { app, stdout }
}

const flush = () => new Promise((r) => setTimeout(r, 0))

describe('session display titles', () => {
    it('prefers the title, then a legacy custom id, then the first prompt, then the id', () => {
        const now = Date.now()
        expect(getSessionDisplayTitle({ id: 'session-1', title: 'Auth', updatedAt: now })).toBe(
            'Auth'
        )
        expect(getSessionDisplayTitle({ id: 'my-old-name', preview: 'hi', updatedAt: now })).toBe(
            'my-old-name'
        )
        expect(
            getSessionDisplayTitle({
                id: 'session-2',
                preview: '<context_file path="a">x</context_file> fix login',
                updatedAt: now,
            })
        ).toBe('fix login')
        expect(getSessionDisplayTitle({ id: 'session-3', updatedAt: now })).toBe('session-3')
    })

    it('search matches the title', () => {
        const sessions = [
            { id: 'session-1', title: 'Rewind ordering', preview: 'x', updatedAt: 1 },
            { id: 'session-2', preview: 'other', updatedAt: 2 },
        ]
        expect(SessionSelectMenuView.getFiltered(sessions, 'rewind').map((s) => s.id)).toEqual([
            'session-1',
        ])
    })
})

describe('/rename', () => {
    it('passes the title to the callback and shows it', async () => {
        const calls: (string | undefined)[] = []
        const { app } = createApp({
            sessionId: 'session-1',
            onRenameSession: async (title?: string) => {
                calls.push(title)
                return title
            },
        })
        app.executeCommand('rename Auth redesign')
        await flush()
        expect(calls).toEqual(['Auth redesign'])
        expect(app.state.sessionTitle).toBe('Auth redesign')
        expect(app.state.toast?.message).toBe('Renamed session to "Auth redesign".')
        app.stop()
    })

    it('without a title asks for a generated one and reports failure', async () => {
        const calls: (string | undefined)[] = []
        const { app } = createApp({
            onRenameSession: async (title?: string) => {
                calls.push(title)
                return undefined
            },
        })
        app.executeCommand('rename')
        await flush()
        expect(calls).toEqual([undefined])
        expect(app.state.toast?.message).toBe(
            'Could not generate a title. Use /rename <title> to set one.'
        )
        app.stop()
    })

    it('mirrors the title to the terminal window title', () => {
        const { app, stdout } = createApp()
        let written = ''
        stdout.on('data', (chunk) => (written += chunk.toString()))
        ;(stdout as any).isTTY = true
        app.setSessionTitle('Auth redesign')
        expect(written).toContain('\x1b]0;december · Auth redesign\x07')
        app.stop()
    })
})
