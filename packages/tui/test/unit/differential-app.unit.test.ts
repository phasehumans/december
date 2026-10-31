import { PassThrough } from 'node:stream'

import { beforeEach, describe, expect, it } from 'bun:test'

import { DifferentialApp } from '../../src/renderer/app'
import { TerminalController } from '../../src/renderer/terminal'

describe('DifferentialApp Interactive Engine (Renderer)', () => {
    let mockStdin: PassThrough
    let mockStdout: PassThrough
    let terminal: TerminalController

    beforeEach(() => {
        mockStdin = new PassThrough()
        mockStdout = new PassThrough()
        terminal = new TerminalController({
            stdin: mockStdin as any,
            stdout: mockStdout as any,
            handleSignals: false,
        })
    })

    it('measures and verifies cold boot time under 30ms', () => {
        const start = performance.now()
        const app = new DifferentialApp({
            terminal,
            width: 80,
            height: 24,
            cliVersion: '0.4.15',
            modelLabel: 'Claude 3.7',
        })
        app.start()
        const duration = performance.now() - start
        app.stop()

        expect(duration).toBeLessThan(30)
    })

    it('processes user typing and cursor movement with zero input lag', () => {
        const app = new DifferentialApp({
            terminal,
            width: 80,
            height: 24,
            cliVersion: '0.4.15',
        })
        app.start()

        // Simulate typing "hello"
        app.handleKey('h')
        app.handleKey('e')
        app.handleKey('l')
        app.handleKey('l')
        app.handleKey('o')

        expect(app.state.input).toBe('hello')
        expect(app.state.cursorPos).toBe(5)

        // Simulate backspace
        app.handleKey('\x7f')
        expect(app.state.input).toBe('hell')
        expect(app.state.cursorPos).toBe(4)

        app.stop()
    })

    it('appends streaming assistant tokens and updates message list without tearing', () => {
        const app = new DifferentialApp({
            terminal,
            width: 80,
            height: 24,
            cliVersion: '0.4.15',
        })
        app.start()

        // Submit user prompt
        app.state.input = 'test prompt'
        app.submitPrompt()

        expect(app.state.messages.length).toBe(1)
        expect(app.state.messages[0].role).toBe('user')
        expect(app.state.messages[0].content).toBe('test prompt')

        // Simulate token streaming deltas
        app.appendStreamDelta('first token ')
        app.appendStreamDelta('second token.')

        expect(app.state.messages.length).toBe(2)
        expect(app.state.messages[1].role).toBe('assistant')
        expect(app.state.messages[1].content).toBe('first token second token.')

        app.stop()
    })

    it('supports scrolling through message history and reading mode navigation', () => {
        const app = new DifferentialApp({
            terminal,
            width: 80,
            height: 10,
        })
        app.start()

        // Add 20 lines of messages
        for (let i = 1; i <= 20; i++) {
            app.state.messages.push({
                role: 'assistant',
                content: `message line ${i}`,
            })
        }
        app.render()

        // Scroll up by 3
        app.scrollUp(3)
        expect(app.state.scrollOffset).toBeDefined()
        expect(app.state.isReadingMode).toBe(true)

        // Esc or scroll to bottom resets reading mode
        app.scrollToBottom()
        expect(app.state.isReadingMode).toBe(false)

        app.stop()
    })

    it('navigates floating command menu when input starts with /', () => {
        const app = new DifferentialApp({
            terminal,
            width: 80,
            height: 24,
        })
        app.start()

        // Type '/'
        app.handleKey('/')
        expect(app.state.input).toBe('/')

        // Type 'm'
        app.handleKey('m')
        expect(app.state.input).toBe('/m')

        // Tab autocompletes selected command (e.g. /model )
        app.handleKey('\t')
        expect(app.state.input.startsWith('/m')).toBe(true)
        expect(app.state.input.endsWith(' ')).toBe(true)

        // Esc dismisses command
        app.handleKey('\x1b')
        expect(app.state.input).toBe('')

        app.stop()
    })

    it('opens overlay menus on command execution and closes on Esc', () => {
        const app = new DifferentialApp({
            terminal,
            width: 80,
            height: 24,
        })
        app.start()

        // Execute /help
        app.executeCommand('help')
        expect(app.state.activeOverlay).toBe('help')

        // Esc closes overlay
        app.handleKey('\x1b')
        expect(app.state.activeOverlay).toBe('none')

        // Execute /model
        app.executeCommand('model')
        expect(app.state.activeOverlay).toBe('model')

        // Esc closes overlay
        app.handleKey('\x1b')
        expect(app.state.activeOverlay).toBe('none')

        // Ctrl+T toggles tasks
        app.handleKey('\x14')
        expect(app.state.activeOverlay).toBe('tasks')

        app.handleKey('\x1b')
        expect(app.state.activeOverlay).toBe('none')

        // Execute /settings
        app.executeCommand('settings')
        expect(app.state.activeOverlay).toBe('settings')

        app.handleKey('\x1b')
        expect(app.state.activeOverlay).toBe('none')

        // Execute /context
        app.executeCommand('context')
        expect(app.state.activeOverlay).toBe('context')

        app.handleKey('\x1b')
        expect(app.state.activeOverlay).toBe('none')

        // Execute /skills
        app.executeCommand('skills')
        expect(app.state.activeOverlay).toBe('skills')

        app.handleKey('\x1b')
        expect(app.state.activeOverlay).toBe('none')

        app.stop()
    })

    it('handles web & clipboard commands without submitting to chat', () => {
        let submittedPrompt: string | null = null
        const app = new DifferentialApp({
            terminal,
            width: 80,
            height: 24,
            onSubmit: (prompt) => {
                submittedPrompt = prompt
            },
        })
        app.start()

        // /changelog
        app.executeCommand('changelog')
        expect(submittedPrompt).toBeNull()
        expect(app.state.toast?.message).toContain('changelog')

        // /docs
        app.executeCommand('docs')
        expect(submittedPrompt).toBeNull()
        expect(app.state.toast?.message).toContain('docs')

        // /copy
        app.state.messages.push({ role: 'assistant', content: 'generated answer' })
        app.executeCommand('copy')
        expect(submittedPrompt).toBeNull()
        expect(app.state.toast?.message).toContain('Copied')

        // unknown command does not submit to chat
        app.executeCommand('unknown_test_cmd')
        expect(submittedPrompt).toBeNull()
        expect(app.state.toast?.message).toContain('Unknown command')

        app.stop()
    })

    it('triggers exit confirm on first Ctrl+C and calls onExit on second Ctrl+C', () => {
        let exitCalled = false
        const app = new DifferentialApp({
            terminal,
            width: 80,
            height: 24,
            onExit: () => {
                exitCalled = true
            },
        })
        app.start()

        // First Ctrl+C
        app.handleKey('\x03')
        expect(app.state.showExitConfirm).toBe(true)
        expect(exitCalled).toBe(false)

        // Second Ctrl+C
        app.handleKey('\x03')
        expect(exitCalled).toBe(true)

        app.stop()
    })
})
