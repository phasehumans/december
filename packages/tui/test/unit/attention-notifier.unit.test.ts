import { PassThrough } from 'node:stream'

import { describe, expect, it } from 'bun:test'

import { DifferentialApp } from '../../src/renderer/app'
import {
    AttentionNotifier,
    FOCUS_IN,
    FOCUS_OUT,
    desktopNotificationSequence,
    nextNotifyMode,
    normalizeNotifyMode,
    type AttentionEvent,
} from '../../src/renderer/attention-notifier'
import { TerminalController } from '../../src/renderer/terminal'

function makeNotifier(start = 100_000) {
    let now = start
    const writes: string[] = []
    const events: AttentionEvent[] = []
    const notifier = new AttentionNotifier({
        write: (data) => writes.push(data),
        onAttention: (event) => events.push(event),
        now: () => now,
        env: {},
    })
    return {
        notifier,
        writes,
        events,
        advance: (ms: number) => {
            now += ms
        },
    }
}

describe('AttentionNotifier', () => {
    it('writes nothing when the mode is off, but still runs the hook', () => {
        const { notifier, writes, events } = makeNotifier()
        notifier.focus = 'blurred'
        expect(notifier.notify('tool_permission', 60_000)).toBe(false)
        expect(writes).toEqual([])
        expect(events).toEqual([
            {
                reason: 'tool_permission',
                message: 'December needs your approval to run a tool',
            },
        ])
    })

    it('rings the bell when blurred, whatever the turn length', () => {
        const { notifier, writes } = makeNotifier()
        notifier.mode = 'bell'
        notifier.focus = 'blurred'
        expect(notifier.notify('ask_question', 1_000)).toBe(true)
        expect(writes).toEqual(['\x07'])
    })

    it('stays quiet while the window has focus', () => {
        const { notifier, writes, events } = makeNotifier()
        notifier.mode = 'bell'
        notifier.focus = 'focused'
        expect(notifier.notify('plan_approve', 120_000)).toBe(false)
        expect(writes).toEqual([])
        // the hook does not check focus
        expect(events).toHaveLength(1)
    })

    it('uses the 30s rule when the terminal does not report focus', () => {
        const { notifier, writes, advance } = makeNotifier()
        notifier.mode = 'bell'
        expect(notifier.focus).toBe('unknown')
        expect(notifier.notify('tool_permission', 10_000)).toBe(false)
        advance(10_000)
        expect(notifier.notify('tool_permission', 31_000)).toBe(true)
        expect(writes).toEqual(['\x07'])
    })

    it('treats a short finished turn as no event, for the hook too', () => {
        const { notifier, writes, events } = makeNotifier()
        notifier.mode = 'bell'
        notifier.focus = 'blurred'
        expect(notifier.notify('turn_finished', 29_000)).toBe(false)
        expect(writes).toEqual([])
        expect(events).toEqual([])
        expect(notifier.notify('turn_finished', 31_000)).toBe(true)
        expect(events.map((e) => e.reason)).toEqual(['turn_finished'])
    })

    it('makes one terminal notification of two that come close together', () => {
        const { notifier, writes, events, advance } = makeNotifier()
        notifier.mode = 'bell'
        notifier.focus = 'blurred'
        notifier.notify('turn_finished', 40_000)
        advance(500)
        notifier.notify('plan_approve', 40_000)
        expect(writes).toHaveLength(1)
        // the hook gets both events
        expect(events.map((e) => e.reason)).toEqual(['turn_finished', 'plan_approve'])
        advance(5_000)
        notifier.notify('tool_permission', 40_000)
        expect(writes).toHaveLength(2)
    })

    it('records focus reports and drops them as keys', () => {
        const { notifier } = makeNotifier()
        expect(notifier.handleFocusSequence(FOCUS_OUT)).toBe(true)
        expect(notifier.focus).toBe('blurred')
        expect(notifier.handleFocusSequence(FOCUS_IN)).toBe(true)
        expect(notifier.focus).toBe('focused')
        expect(notifier.handleFocusSequence('a')).toBe(false)
    })

    it('runs the terminal notification when the hook throws', () => {
        const writes: string[] = []
        const notifier = new AttentionNotifier({
            write: (data) => writes.push(data),
            onAttention: () => {
                throw new Error('hook failed')
            },
        })
        notifier.mode = 'bell'
        notifier.focus = 'blurred'
        expect(notifier.notify('ask_question', 0)).toBe(true)
        expect(writes).toEqual(['\x07'])
    })
})

describe('desktopNotificationSequence', () => {
    it('sends OSC 9 and a bell by default', () => {
        expect(desktopNotificationSequence('December finished', {})).toBe(
            '\x1b]9;December finished\x07\x07'
        )
    })

    it('sends OSC 777 to foot, urxvt and VTE terminals', () => {
        const expected = '\x1b]777;notify;December;December finished\x07\x07'
        expect(desktopNotificationSequence('December finished', { TERM: 'foot' })).toBe(expected)
        expect(desktopNotificationSequence('December finished', { TERM: 'rxvt-unicode' })).toBe(
            expected
        )
        expect(desktopNotificationSequence('December finished', { VTE_VERSION: '7600' })).toBe(
            expected
        )
    })

    it('removes control characters and semicolons from the message', () => {
        expect(desktopNotificationSequence('a\x1b]0;b\x07c', {})).toBe('\x1b]9;a ]0 b c\x07\x07')
    })
})

describe('notify mode helpers', () => {
    it('cycles off, bell, desktop', () => {
        expect(nextNotifyMode('off')).toBe('bell')
        expect(nextNotifyMode('bell')).toBe('desktop')
        expect(nextNotifyMode('desktop')).toBe('off')
        expect(nextNotifyMode('nonsense')).toBe('off')
    })

    it('reads unknown values as off', () => {
        expect(normalizeNotifyMode(undefined)).toBe('off')
        expect(normalizeNotifyMode('loud')).toBe('off')
        expect(normalizeNotifyMode('desktop')).toBe('desktop')
    })
})

describe('DifferentialApp attention triggers (#617)', () => {
    function makeApp(notifyMode?: 'off' | 'bell' | 'desktop') {
        const stdin = new PassThrough()
        const stdout = new PassThrough()
        ;(stdout as any).isTTY = true
        const terminal = new TerminalController({
            stdin: stdin as any,
            stdout: stdout as any,
            handleSignals: false,
        })
        // each write() call, so a bell is not confused with the BEL that ends an OSC title
        const writes: string[] = []
        const write = terminal.write.bind(terminal)
        terminal.write = (data: string) => {
            writes.push(data)
            write(data)
        }
        const titles: string[] = []
        terminal.setWindowTitle = (title: string) => {
            titles.push(title)
        }
        const events: AttentionEvent[] = []
        const app = new DifferentialApp({
            terminal,
            width: 80,
            height: 24,
            cliVersion: '0.4.20',
            notifyMode,
            onAttention: (event) => events.push(event),
        })
        return { app, events, writes, titles }
    }

    function startTurn(app: DifferentialApp, ageMs: number) {
        app.state.messages.push({ role: 'user', content: 'do it' } as any)
        app.state.isStreaming = true
        ;(app as any).streamStartTime = Date.now() - ageMs
    }

    it('fires once when each approval prompt opens', () => {
        const { app, events } = makeApp()
        startTurn(app, 1_000)
        void app.requestToolPermission({ toolName: 'bash', commandOrTarget: 'ls' })
        void app.askQuestion([{ question: 'which?', options: [] } as any])
        void app.requestPlanApproval({ summary: 'plan' })
        expect(events.map((e) => e.reason)).toEqual([
            'tool_permission',
            'ask_question',
            'plan_approve',
        ])
    })

    it('does not fire for menus the user opens', () => {
        const { app, events } = makeApp('bell')
        startTurn(app, 60_000)
        app.state.activeOverlay = 'settings'
        app.render()
        expect(events).toEqual([])
    })

    it('rings the bell for a prompt only when the window is blurred', () => {
        const { app, writes } = makeApp('bell')
        startTurn(app, 1_000)
        app.handleKey(FOCUS_IN)
        void app.requestToolPermission({ toolName: 'bash', commandOrTarget: 'ls' })
        expect(writes).not.toContain('\x07')
        app.state.activeOverlay = 'none'
        app.handleKey(FOCUS_OUT)
        void app.requestToolPermission({ toolName: 'bash', commandOrTarget: 'pwd' })
        expect(writes).toContain('\x07')
    })

    it('does not type focus reports into the prompt', () => {
        const { app } = makeApp()
        app.handleKey(FOCUS_OUT)
        app.handleKey(FOCUS_IN)
        expect(app.state.input).toBe('')
    })

    it('fires "turn finished" for a long turn that ends normally', () => {
        const { app, events } = makeApp()
        startTurn(app, 40_000)
        app.finishStream()
        expect(events.map((e) => e.reason)).toEqual(['turn_finished'])
    })

    it('does not fire "turn finished" for a short turn, an error, or a queued prompt', () => {
        const short = makeApp()
        startTurn(short.app, 5_000)
        short.app.finishStream()
        expect(short.events).toEqual([])

        const failed = makeApp()
        startTurn(failed.app, 40_000)
        failed.app.state.messages.push({ role: 'error', content: 'boom' } as any)
        failed.app.finishStream()
        expect(failed.events).toEqual([])

        const queued = makeApp()
        startTurn(queued.app, 40_000)
        queued.app.state.promptQueue = ['next']
        queued.app.finishStream()
        expect(queued.events).toEqual([])
    })

    it('does not fire "turn finished" after an interrupt', () => {
        const { app, events } = makeApp()
        startTurn(app, 40_000)
        app.handleAbortStream()
        app.finishStream()
        expect(events).toEqual([])
    })

    it('marks the window title while a prompt waits', () => {
        const { app, titles } = makeApp()
        app.setSessionTitle('fix tests')
        startTurn(app, 1_000)
        void app.requestToolPermission({ toolName: 'bash', commandOrTarget: 'ls' })
        expect(titles.at(-1)).toBe('● december · fix tests')
        app.state.activeOverlay = 'none'
        app.render()
        expect(titles.at(-1)).toBe('december · fix tests')
    })

    it('applies a new notify mode from /settings', () => {
        const { app, writes } = makeApp()
        startTurn(app, 1_000)
        app.handleKey(FOCUS_OUT)
        void app.requestToolPermission({ toolName: 'bash', commandOrTarget: 'ls' })
        expect(writes).not.toContain('\x07')
        app.state.activeOverlay = 'none'
        app.setNotifyMode('bell')
        void app.requestToolPermission({ toolName: 'bash', commandOrTarget: 'pwd' })
        expect(writes).toContain('\x07')
    })
})
