import { PassThrough } from 'node:stream'

import { beforeEach, describe, expect, it } from 'bun:test'

import { DifferentialApp } from '../../src/renderer/app'
import { TerminalController } from '../../src/renderer/terminal'
import { InputBarView } from '../../src/renderer/views/input-bar-view'

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

    it('avoids redundant renders when setting or clearing status messages with identical content', () => {
        const app = new DifferentialApp({
            terminal,
            width: 80,
            height: 24,
        })
        app.start()

        let renderCount = 0
        const origRender = app.render.bind(app)
        app.render = () => {
            renderCount++
            origRender()
        }

        // Initially statusMessage is undefined: clearing it should be a no-op and NOT call render
        renderCount = 0
        app.clearStatusMessage()
        expect(renderCount).toBe(0)

        // Setting a status message triggers 1 render
        app.setStatusMessage('Working...')
        expect(renderCount).toBe(1)

        // Setting the exact same status message should be a no-op and NOT call render
        app.setStatusMessage('Working...')
        expect(renderCount).toBe(1)

        // Clearing an active status message triggers 1 render
        app.clearStatusMessage()
        expect(renderCount).toBe(2)

        // Second clear should be a no-op
        app.clearStatusMessage()
        expect(renderCount).toBe(2)

        app.stop()
    })

    it('tracks isStreaming state on assistant message during live stream and clears on finishStream', () => {
        const app = new DifferentialApp({
            terminal,
            width: 80,
            height: 24,
        })
        app.start()

        app.state.input = 'test stream'
        app.submitPrompt()

        app.appendStreamDelta('streaming chunk')
        const assistantMsg = app.state.messages[app.state.messages.length - 1]
        expect(assistantMsg.role).toBe('assistant')
        expect(assistantMsg.isStreaming).toBe(true)

        app.finishStream()
        expect(assistantMsg.isStreaming).toBe(false)

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

        // Mouse wheel scrolling: wheel up (\x1b[<64;35;10M) and wheel down (\x1b[<65;35;10M)
        app.handleKey('\x1b[<64;35;10M')
        expect(app.state.scrollOffset).toBeDefined()
        expect(app.state.isReadingMode).toBe(true)

        app.handleKey('\x1b[<65;35;10M')
        // Scrolled back down to bottom
        expect(app.state.isReadingMode).toBe(false)

        // Stray SGR mouse clicks should be swallowed and not corrupt prompt input
        app.handleKey('\x1b[<0;20;10M')
        expect(app.state.input).toBe('')

        app.stop()
    })

    it('processes chunked multi-sequence mouse wheel bursts and coalesces renders', () => {
        const app = new DifferentialApp({
            terminal,
            width: 80,
            height: 24,
            cliVersion: '0.4.15',
        })
        app.start()

        for (let i = 1; i <= 30; i++) {
            app.state.messages.push({
                role: 'assistant',
                content: `message row ${i}`,
            })
        }
        app.render()

        const initialScroll = app.state.scrollOffset ?? (app as any).maxScroll
        expect(initialScroll).toBeGreaterThan(0)

        let screenRenderCount = 0
        const origScreenRender = app.screen.render.bind(app.screen)
        app.screen.render = (opts) => {
            screenRenderCount++
            return origScreenRender(opts)
        }

        // Simulate terminal emitting a burst of 3 wheel-up events in a single stdin data chunk
        const chunk = Buffer.from('\x1b[<64;20;10M\x1b[<64;20;10M\x1b[<64;20;10M')
        ;(app as any).stdinListener(chunk)

        // All 3 wheel up events (each 3 lines) should have taken effect: 9 lines scrolled up
        const expectedScroll = initialScroll - 9
        expect(app.state.scrollOffset).toBe(expectedScroll)
        expect(app.state.isReadingMode).toBe(true)

        // Exactly 1 screen render pass should have occurred due to input batching
        expect(screenRenderCount).toBe(1)

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

    it('completes command on first Enter and executes on second Enter when partially typed', () => {
        const app = new DifferentialApp({
            terminal,
            width: 80,
            height: 24,
        })
        app.start()

        // Type partial command "/tas"
        app.handleKey('/')
        app.handleKey('t')
        app.handleKey('a')
        app.handleKey('s')
        expect(app.state.input).toBe('/tas')

        // First Enter: completes command name with trailing space, does not execute yet
        app.handleKey('\r')
        expect(app.state.input).toBe('/tasks ')
        expect(app.state.activeOverlay).toBe('none')

        // Second Enter: executes the completed command
        app.handleKey('\r')
        expect(app.state.activeOverlay).toBe('tasks')

        // Esc closes overlay
        app.handleKey('\x1b')
        expect(app.state.activeOverlay).toBe('none')

        // Full command name "/help" executes immediately on first Enter
        app.state.input = '/help'
        app.handleKey('\r')
        expect(app.state.activeOverlay).toBe('help')

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

    it('renders 1-line separation spacing above prompt box and above card overlays', () => {
        const app = new DifferentialApp({
            terminal,
            width: 80,
            height: 24,
        })
        app.start()

        // 1. Prompt Mode: Input bar is at height 20..23 (inputHeight = 4)
        // Row 19 must be the cleared 1-line breathing separation gap
        const line19 = app.screen.backBuffer.getLine(19).trim()
        const line20 = app.screen.backBuffer.getLine(20)
        expect(line19).toBe('') // Clean breathing line
        expect(line20).toContain('─') // Prompt bar top divider

        // 2. Overlay Mode: Execute /context
        app.executeCommand('context')
        expect(app.state.activeOverlay).toBe('context')

        // ContextMenuView height is 9, so overlay sits at rows 15..23
        // Row 14 must be the 1-line separation gap
        const line14 = app.screen.backBuffer.getLine(14).trim()
        const line15 = app.screen.backBuffer.getLine(15)
        expect(line14).toBe('') // Clean separation line above context overlay
        expect(line15).toContain('Context') // Overlay starts at row 15

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
        expect(app.state.toast?.message).toBe('Opened changelog in browser.')
        expect(app.state.toast?.variant).toBe('success')

        // /docs
        app.executeCommand('docs')
        expect(submittedPrompt).toBeNull()
        expect(app.state.toast?.message).toBe('Opened documentation in browser.')
        expect(app.state.toast?.variant).toBe('success')

        // /feedback
        app.executeCommand('feedback')
        expect(submittedPrompt).toBeNull()
        expect(app.state.toast?.message).toBe('Opened feedback in browser.')
        expect(app.state.toast?.variant).toBe('success')

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

    it('calls onAbort callback and stops streaming on Ctrl+C during active stream', () => {
        let abortCalled = false
        const app = new DifferentialApp({
            terminal,
            width: 80,
            height: 24,
            onAbort: () => {
                abortCalled = true
            },
        })
        app.start()

        app.state.isStreaming = true
        app.startSpinner()
        expect(app.state.isStreaming).toBe(true)

        // Ctrl+C during stream
        app.handleKey('\x03')
        expect(abortCalled).toBe(true)
        expect(app.state.isStreaming).toBe(false)
        expect(app.state.toast?.message).toContain('Aborted')

        app.stop()
    })

    it('hides prompt box and hides terminal cursor when an overlay menu is active', () => {
        const app = new DifferentialApp({
            terminal,
            width: 80,
            height: 24,
        })
        app.start()

        // In prompt mode, cursor is visible
        expect(app.screen.cursorPosition?.visible).toBe(true)
        const promptFrame = app.screen.backBuffer.getLine(21)
        expect(promptFrame).toContain('❭')

        // Open /context overlay
        app.executeCommand('context')
        expect(app.state.activeOverlay).toBe('context')

        // Cursor must be hidden during overlay
        expect(app.screen.cursorPosition?.visible).toBe(false)

        // Buffer should render context usage, NOT the prompt box glyph at bottom
        let hasContextTitle = false
        let hasPromptGlyphInOverlay = false
        for (let y = 0; y < 24; y++) {
            const line = app.screen.backBuffer.getLine(y)
            if (line.includes('Context · ')) hasContextTitle = true
            if (line.includes('❭ ') && y >= 20) hasPromptGlyphInOverlay = true
        }
        expect(hasContextTitle).toBe(true)
        expect(hasPromptGlyphInOverlay).toBe(false)

        // Close overlay with Esc
        app.handleKey('\x1b')
        expect(app.state.activeOverlay).toBe('none')
        expect(app.screen.cursorPosition?.visible).toBe(true)

        app.stop()
    })

    it('executes /codesearch and navigates search results overlay', async () => {
        let submittedToChat: string | null = null
        const app = new DifferentialApp({
            terminal,
            width: 80,
            height: 24,
            onSubmit: (p) => {
                submittedToChat = p
            },
            onCodeSearch: async (query) => {
                return [
                    { file: 'src/main.ts', line: 10, content: 'function startEngine()' },
                    { file: 'src/core.ts', line: 55, content: 'export const startEngine = true' },
                ]
            },
        })
        app.start()

        // Type command with argument
        app.state.input = '/codesearch engine'
        app.handleKey('\r')

        // Must not be sent to chat
        expect(submittedToChat).toBeNull()
        expect(app.state.activeOverlay).toBe('codesearch')
        expect(app.state.codeSearchQuery).toBe('engine')

        // Wait a tick for search promise
        await new Promise((r) => setTimeout(r, 10))
        expect(app.state.codeSearchResults.length).toBe(2)
        expect(app.state.codeSearchSelectedIndex).toBe(0)

        // Bottom card overlay: prompt cursor is hidden and Code Search renders in bottom overlay card
        expect(app.screen.cursorPosition?.visible).toBe(false)
        let hasCodeSearch = false
        for (let y = 0; y < 24; y++) {
            if (app.screen.backBuffer.getLine(y).includes('Code Search')) {
                hasCodeSearch = true
                break
            }
        }
        expect(hasCodeSearch).toBe(true)

        // Navigate down
        app.handleKey('\x1b[B')
        expect(app.state.codeSearchSelectedIndex).toBe(1)

        // Tab to insert @file:line
        app.handleKey('\t')
        expect(app.state.activeOverlay).toBe('none')
        expect(app.state.input).toBe('@src/core.ts:55 ')

        app.stop()
    })

    it('opens fileview on Enter from codesearch results and supports navigation and context insertion', async () => {
        let insertedFile: string | null = null
        let insertedLine: number | null = null
        const app = new DifferentialApp({
            terminal,
            width: 80,
            height: 24,
            onCodeSearch: async () => [
                { file: 'package.json', line: 3, content: '"version": "0.4.15"' },
            ],
            onInsertContext: (file, line) => {
                insertedFile = file
                insertedLine = line ?? 1
            },
        })
        app.start()

        // Search code
        app.state.input = '/codesearch version'
        app.handleKey('\r')
        await new Promise((r) => setTimeout(r, 10))

        expect(app.state.activeOverlay).toBe('codesearch')
        expect(app.state.codeSearchResults.length).toBe(1)

        // Enter on result: must open fileview at line 3!
        app.handleKey('\r')
        expect(app.state.activeOverlay).toBe('fileview')
        expect(app.state.fileViewPath).toBe('package.json')
        expect(app.state.fileViewReturnOverlay).toBe('codesearch')
        // True 100% full screen pager mode replaces even the top header: row 0 renders fileview header
        expect(app.screen.backBuffer.getLine(0)).toContain('package.json')

        // Esc returns to codesearch
        app.handleKey('\x1b')
        expect(app.state.activeOverlay).toBe('codesearch')

        // Enter again opens fileview
        app.handleKey('\r')
        expect(app.state.activeOverlay).toBe('fileview')

        // Enter in fileview inserts context into input bar and closes overlay
        app.handleKey('\r')
        expect(app.state.activeOverlay).toBe('none')
        expect(app.state.input).toContain('@package.json:')
        expect(insertedFile).toBe('package.json')

        app.stop()
    })

    it('groups multi-match code search results and navigates between matches using n and p in fileview', async () => {
        const app = new DifferentialApp({
            terminal,
            width: 80,
            height: 24,
            onCodeSearch: async () => [
                { file: 'package.json', line: 2, content: '"name": "december"' },
                { file: 'package.json', line: 3, content: '"version": "0.4.15"' },
            ],
        })
        app.start()

        app.state.input = '/codesearch name'
        app.handleKey('\r')
        await new Promise((r) => setTimeout(r, 10))

        expect(app.state.activeOverlay).toBe('codesearch')
        expect(app.state.codeSearchResults.length).toBe(2)
        expect(app.state.codeSearchGroups.length).toBe(1)
        expect(app.state.codeSearchGroups[0].matchCount).toBe(2)

        // Open fileview on first match
        app.handleKey('\r')
        expect(app.state.activeOverlay).toBe('fileview')
        expect(app.state.fileViewCursorLine).toBe(1) // 0-based for line 2

        // Press 'n' to jump to next match
        app.handleKey('n')
        expect(app.state.fileViewCursorLine).toBe(2) // 0-based for line 3
        expect(app.state.toast?.message).toContain('Match 2/2 (line 3)')

        // Press 'n' again to wrap to first match
        app.handleKey('n')
        expect(app.state.fileViewCursorLine).toBe(1) // wraps back to line 2
        expect(app.state.toast?.message).toContain('(wrapped)')

        // Press 'p' to jump back to previous match
        app.handleKey('p')
        expect(app.state.fileViewCursorLine).toBe(2)

        app.stop()
    })

    it('cycles between matching files with Left/Right arrow and h/l in codesearch fileview', async () => {
        const app = new DifferentialApp({
            terminal,
            width: 80,
            height: 24,
            onCodeSearch: async () => [
                { file: 'fileA.ts', line: 10, content: 'const queryVal = 1' },
                { file: 'fileB.ts', line: 25, content: 'const queryVal = 2' },
            ],
        })
        app.start()

        app.state.input = '/codesearch queryVal'
        app.handleKey('\r')
        await new Promise((r) => setTimeout(r, 10))

        expect(app.state.activeOverlay).toBe('codesearch')
        expect(app.state.codeSearchGroups.length).toBe(2)

        // Open first file in fileview
        app.handleKey('\r')
        expect(app.state.activeOverlay).toBe('fileview')
        expect(app.state.fileViewPath).toBe('fileA.ts')
        expect(app.state.codeSearchSelectedIndex).toBe(0)

        // Header shows [1/2 files] fileA.ts and footer shows cycle file
        expect(app.screen.backBuffer.getLine(0)).toContain('[1/2 files] fileA.ts')
        expect(app.screen.backBuffer.getLine(23)).toContain('←/→ cycle file')

        // Press Right arrow (\x1b[C) to cycle to next file
        app.handleKey('\x1b[C')
        expect(app.state.fileViewPath).toBe('fileB.ts')
        expect(app.state.codeSearchSelectedIndex).toBe(1)
        expect(app.state.toast?.message).toContain('File 2/2: fileB.ts')

        // Press 'h' to cycle back to previous file
        app.handleKey('h')
        expect(app.state.fileViewPath).toBe('fileA.ts')
        expect(app.state.codeSearchSelectedIndex).toBe(0)
        expect(app.state.toast?.message).toContain('File 1/2: fileA.ts')

        app.stop()
    })

    it('navigates case-insensitively across uppercase and lowercase matches with n and p in fileview', async () => {
        const app = new DifferentialApp({
            terminal,
            width: 80,
            height: 24,
            onCodeSearch: async () => [
                { file: 'email.ts', line: 1, content: 'import resend from "resend"' },
            ],
        })
        app.start()

        app.state.input = '/codesearch resend'
        app.handleKey('\r')
        await new Promise((r) => setTimeout(r, 10))

        expect(app.state.activeOverlay).toBe('codesearch')

        // Open fileview with in-memory content containing uppercase and mixed-case lines
        await app.openFileView(
            'email.ts',
            1,
            'codesearch',
            'resend',
            [1],
            [
                'import resend from "resend"',
                'const apiKey = process.env.RESEND_API_KEY',
                'const client = new Resend()',
            ]
        )

        expect(app.state.activeOverlay).toBe('fileview')
        expect(app.state.fileViewMatchLines).toEqual([1, 2, 3])
        expect(app.state.fileViewCursorLine).toBe(0) // line 1

        // Press 'n' - jumps to line 2 (uppercase RESEND_API_KEY)
        app.handleKey('n')
        expect(app.state.fileViewCursorLine).toBe(1)
        expect(app.state.toast?.message).toContain('Match 2/3 (line 2)')

        // Press 'n' - jumps to line 3 (TitleCase Resend)
        app.handleKey('n')
        expect(app.state.fileViewCursorLine).toBe(2)
        expect(app.state.toast?.message).toContain('Match 3/3 (line 3)')

        // Press 'p' - jumps back to line 2
        app.handleKey('p')
        expect(app.state.fileViewCursorLine).toBe(1)

        app.stop()
    })

    it('executes /btw side question and allows ephemeral review without history pollution', async () => {
        let submittedToChat: string | null = null
        const app = new DifferentialApp({
            terminal,
            width: 80,
            height: 24,
            onSubmit: (p) => {
                submittedToChat = p
            },
            onSideQuestion: async (question, handlers) => {
                handlers.onChunk('Ephemeral side note.')
                handlers.onComplete()
            },
        })
        app.start()

        // User types /btw
        app.state.input = '/btw what is this?'
        app.handleKey('\r')

        expect(submittedToChat).toBeNull()
        expect(app.state.messages.length).toBe(0)
        expect(app.state.btwState?.question).toBe('what is this?')

        // Wait for side question completion
        await new Promise((r) => setTimeout(r, 10))
        expect(app.state.btwState?.status).toBe('complete')
        expect(app.state.btwState?.answer).toBe('Ephemeral side note.')

        // Esc dismisses btw
        app.handleKey('\x1b')
        expect(app.state.btwState).toBeNull()

        app.stop()
    })

    it('supports expand mode and clipboard copying in /btw', async () => {
        const app = new DifferentialApp({
            terminal,
            width: 80,
            height: 24,
            onSideQuestion: async (question, handlers) => {
                handlers.onChunk('Detailed technical answer for side question.')
                handlers.onComplete()
            },
        })
        app.start()

        // Open btw
        app.state.input = '/btw explain websockets'
        app.handleKey('\r')

        await new Promise((r) => setTimeout(r, 10))
        expect(app.state.btwState?.status).toBe('complete')
        expect(app.state.btwState?.isExpanded).toBeFalsy()

        // Press 'e' to toggle expand mode
        app.handleKey('e')
        expect(app.state.btwState?.isExpanded).toBe(true)

        // Press 'e' again to toggle collapse
        app.handleKey('e')
        expect(app.state.btwState?.isExpanded).toBe(false)

        // Press 'c' to copy answer
        app.handleKey('c')
        expect(app.state.toast?.message).toContain('Copied')

        // Esc dismisses
        app.handleKey('\x1b')
        expect(app.state.btwState).toBeNull()

        app.stop()
    })

    it('safeguards slash commands from ever being submitted to LLM chat', () => {
        let submittedToChat: string | null = null
        const app = new DifferentialApp({
            terminal,
            width: 80,
            height: 24,
            onSubmit: (p) => {
                submittedToChat = p
            },
        })
        app.start()

        // Calling submitPrompt with a slash command directly
        app.submitPrompt('/settings')

        expect(submittedToChat).toBeNull()
        expect(app.state.messages.length).toBe(0)
        expect(app.state.activeOverlay).toBe('settings')

        app.stop()
    })

    it('navigates /diff file list and detailed diff hunks with n and p keys', () => {
        const app = new DifferentialApp({
            terminal,
            width: 80,
            height: 24,
        })
        app.start()

        // Populate sample diff files
        app.state.diffFiles = [
            {
                path: 'src/config.ts',
                additions: 5,
                deletions: 2,
                status: 'modified',
                diff: '@@ -10,3 +10,4 @@\n context line 1\n-old line 1\n+new line 1\n context line 2\n@@ -30,3 +31,4 @@\n context line 3\n-old line 2\n+new line 2\n context line 4\n',
            },
            {
                path: 'src/utils.ts',
                additions: 10,
                deletions: 0,
                status: 'added',
                diff: '@@ -1,2 +1,4 @@\n+line 1\n+line 2\n',
            },
        ]

        // Open diff overlay
        app.executeCommand('diff')
        expect(app.state.activeOverlay).toBe('diff')
        expect(app.state.isDiffDetailView).toBe(false)
        expect(app.state.diffSelectedIndex).toBe(0)

        // Down arrow to select second file
        app.handleKey('\x1b[B')
        expect(app.state.diffSelectedIndex).toBe(1)

        // Up arrow to select first file
        app.handleKey('\x1b[A')
        expect(app.state.diffSelectedIndex).toBe(0)

        // Enter to open detail view
        app.handleKey('\r')
        expect(app.state.isDiffDetailView).toBe(true)
        expect(app.state.diffCursorLineIndex).toBe(0)

        // 'n' jumps to next change hunk
        app.handleKey('n')
        expect(app.state.diffCursorLineIndex).toBeGreaterThan(0)
        const hunk1Pos = app.state.diffCursorLineIndex

        // 'n' again jumps to second change hunk
        app.handleKey('n')
        expect(app.state.diffCursorLineIndex).toBeGreaterThan(hunk1Pos)

        // 'p' jumps back to previous change hunk
        app.handleKey('p')
        expect(app.state.diffCursorLineIndex).toBe(hunk1Pos)

        // Esc returns to file list mode
        app.handleKey('\x1b')
        expect(app.state.isDiffDetailView).toBe(false)
        expect(app.state.activeOverlay).toBe('diff')

        // Esc again closes overlay
        app.handleKey('\x1b')
        expect(app.state.activeOverlay).toBe('none')

        app.stop()
    })

    it('handles /effort command, direct argument setting, and interactive menu navigation', () => {
        let selectedLevel: string | null = null
        const app = new DifferentialApp({
            terminal,
            width: 80,
            height: 24,
            thinkingLevel: 'auto',
            onEffortSelect: (lvl) => {
                selectedLevel = lvl
            },
        })
        app.start()

        // 1. Direct argument invocation: /effort deep
        app.executeCommand('effort deep')
        expect(app.state.thinkingLevel).toBe('deep')
        expect(selectedLevel).toBe('deep')
        expect(app.state.activeOverlay).toBe('none')
        expect(app.state.toast?.message).toBe('Reasoning set to Deep.')

        // 2. Open interactive effort menu: /effort
        app.executeCommand('effort')
        expect(app.state.activeOverlay).toBe('effort')
        // Pre-selected index should match current 'deep' (index 2)
        expect(app.state.effortSelectedIndex).toBe(2)

        // Up arrow navigates to Fast (index 1)
        app.handleKey('\x1b[A')
        expect(app.state.effortSelectedIndex).toBe(1)

        // Enter selects Fast, invokes callback, and closes overlay
        app.handleKey('\r')
        expect(app.state.activeOverlay).toBe('none')
        expect(app.state.thinkingLevel).toBe('fast')
        expect(selectedLevel).toBe('fast')
        expect(app.state.toast?.message).toBe('Reasoning set to Fast.')

        // 3. /reasoning alias with argument (backward compatible 'low' normalizes to 'fast')
        app.executeCommand('reasoning low')
        expect(app.state.thinkingLevel).toBe('fast')
        expect(selectedLevel).toBe('fast')

        // 4. Non-reasoning model handling
        app.state.activeModel = 'gpt-4o'
        app.executeCommand('effort deep')
        expect(app.state.thinkingLevel).toBe('deep')
        expect(app.state.toast?.message).toContain('runs in standard mode')

        app.stop()
    })

    it('navigates interactive /help tabs and executes commands from commands tab', () => {
        const app = new DifferentialApp({
            terminal,
            width: 80,
            height: 24,
        })
        app.start()

        // 1. /help defaults to general tab
        app.executeCommand('help')
        expect(app.state.activeOverlay).toBe('help')
        expect(app.state.helpActiveTab).toBe('general')

        // Right arrow cycles to commands tab
        app.handleKey('\x1b[C')
        expect(app.state.helpActiveTab).toBe('commands')

        // Down arrow navigates commands
        app.handleKey('\x1b[B')
        expect(app.state.helpCmdSelectedIndex).toBe(1)

        // Tab cycles to shortcuts tab
        app.handleKey('\t')
        expect(app.state.helpActiveTab).toBe('shortcuts')

        // Down arrow navigates shortcuts
        app.handleKey('\x1b[B')
        expect(app.state.helpShortcutSelectedIndex).toBe(1)

        // Left arrow cycles back to commands tab
        app.handleKey('\x1b[D')
        expect(app.state.helpActiveTab).toBe('commands')

        // Verify that commands tab only receives official commands and no skill commands
        const cmds = app.getAllCommands()
        expect(cmds.length).toBeGreaterThan(0)
        expect(cmds.every((c) => !c.name.startsWith('skill:'))).toBe(true)
        expect(cmds.some((c) => c.name === 'clear')).toBe(true)
        expect(cmds.some((c) => c.name === 'diff')).toBe(true)

        // 'q' closes help overlay
        app.handleKey('q')
        expect(app.state.activeOverlay).toBe('none')

        // 2. Direct tab routing: /help commands opens commands tab
        app.executeCommand('help commands')
        expect(app.state.activeOverlay).toBe('help')
        expect(app.state.helpActiveTab).toBe('commands')

        // 3. /shortcuts alias opens shortcuts tab
        app.executeCommand('shortcuts')
        expect(app.state.activeOverlay).toBe('help')
        expect(app.state.helpActiveTab).toBe('shortcuts')

        app.stop()
    })

    it('handles /login command with three-option menu (Subscriptions, BYOK, December) and OAuth flow', async () => {
        let loggedInOnCodeCalled = false
        let subscriptionProviderCalled: string | null = null

        const app = new DifferentialApp({
            terminal,
            width: 80,
            height: 24,
            onLogin: async (onCode) => {
                loggedInOnCodeCalled = true
                onCode('ABCD-1234', 'https://app.trydecember.com/activate')
                return { token: 'tok_test_123', email: 'user@example.com' }
            },
            onSubscriptionLogin: async (provider, onCode) => {
                subscriptionProviderCalled = provider
                if (onCode) {
                    onCode('COPILOT-9999', 'https://github.com/login/device')
                }
            },
        })
        app.start()

        // 1. Bare /login opens authentication menu with Subscriptions, BYOK, and December options
        app.executeCommand('login')
        expect(app.state.activeOverlay).toBe('login')
        expect(app.state.loginSelectedIndex).toBe(0)

        // Enter on index 0 (Subscriptions) switches to dedicated AI Subscriptions menu
        app.handleKey('\r')
        expect(app.state.activeOverlay).toBe('auth')
        expect(app.state.authViewMode).toBe('subscription')
        expect(app.state.authProviders.length).toBe(4)

        // Esc returns to login menu
        app.handleKey('\x1b')
        expect(app.state.activeOverlay).toBe('login')

        // 2. Select BYOK option (index 1)
        app.handleKey('\x1b[B')
        expect(app.state.loginSelectedIndex).toBe(1)
        app.handleKey('\r')
        expect(app.state.activeOverlay).toBe('auth')
        expect(app.state.authViewMode).toBe('byok_provider')
        expect(app.state.authProviders.length).toBeGreaterThan(10)

        // Esc returns to login menu
        app.handleKey('\x1b')
        expect(app.state.activeOverlay).toBe('login')

        // 3. Select December option (index 2)
        app.handleKey('\x1b[B')
        expect(app.state.loginSelectedIndex).toBe(2)

        // Enter triggers device login flow
        app.handleKey('\r')
        expect(app.state.activeOverlay).toBe('none')

        // Wait a tick for async login
        await new Promise((r) => setTimeout(r, 20))
        expect(loggedInOnCodeCalled).toBe(true)
        expect(app.state.isAuthenticated).toBe(true)
        expect(app.state.userEmail).toBe('user@example.com')
        expect(app.state.authMethod).toBe('december')

        // 4. Targeted /login copilot triggers subscription OAuth directly and shows code & URL in chat
        app.executeCommand('login copilot')
        expect(subscriptionProviderCalled).toBe('copilot')

        await new Promise((r) => setTimeout(r, 20))
        expect(app.state.authMethod).toBe('subscription')
        expect(app.state.selectedProvider).toBe('copilot')

        // Verify message stream has the code and URL rendered cleanly without extra notes
        const messagesText = app.state.messages.map((m) => m.content).join('\n')
        expect(messagesText).toContain('COPILOT-9999')
        expect(messagesText).toContain('https://github.com/login/device')
        expect(messagesText).not.toContain('Ensure your browser is logged into the GitHub account')

        app.stop()
    })

    it('handles /session menu navigation, delete, and session switching', async () => {
        let switchedSessionId: string | null = null
        let deletedSessionId: string | null = null
        let renamedOldId: string | null = null
        let renamedNewId: string | null = null

        const app = new DifferentialApp({
            terminal,
            width: 80,
            height: 24,
            sessions: [
                { id: 'sess-1', preview: 'Initial chat', updatedAt: Date.now() - 60000 },
                { id: 'sess-2', preview: 'Bug diagnosis', updatedAt: Date.now() - 120000 },
                { id: 'sess-3', preview: 'Feature planning', updatedAt: Date.now() - 3600000 },
            ],
            onSessionSelect: (id) => {
                switchedSessionId = id
            },
            onSessionDelete: (id) => {
                deletedSessionId = id
            },
            onSessionRename: (oldId, newId) => {
                renamedOldId = oldId
                renamedNewId = newId
            },
        })
        app.start()

        // 1. Open session overlay with search query args
        app.executeCommand('resume bug')
        expect(app.state.activeOverlay).toBe('session')
        expect(app.state.sessionSearchQuery).toBe('bug')

        // Clear query to see all sessions
        app.state.sessionSearchQuery = ''
        app.state.sessionSelectedIndex = 0

        // 2. Navigate down to sess-2
        app.handleKey('\x1b[B')
        expect(app.state.sessionSelectedIndex).toBe(1)

        // 3. Rename sess-2 with 'r'
        app.handleKey('r')
        expect(app.state.sessionRenameMode).toBe(true)
        app.state.sessionRenameValue = 'Refactored bug'
        app.handleKey('\r')
        expect(app.state.sessionRenameMode).toBe(false)
        expect(renamedOldId).toBe('sess-2')
        expect(renamedNewId).toBe('Refactored bug')
        expect(app.state.sessions[1].id).toBe('Refactored bug')

        // 4. Press 'd' to trigger delete confirmation
        app.handleKey('d')
        expect(app.state.sessionConfirmDeleteId).toBe('Refactored bug')

        // 5. Press 'y' to confirm delete
        app.handleKey('y')
        expect(deletedSessionId).toBe('Refactored bug')
        expect(app.state.sessions.length).toBe(2)
        expect(app.state.sessionConfirmDeleteId).toBeNull()

        // 6. Test Esc closes session menu
        app.handleKey('\x1b')
        expect(app.state.activeOverlay).toBe('none')

        // 7. Re-open and select remaining sess-1 on Enter
        app.executeCommand('session')
        app.state.sessionSelectedIndex = 0
        app.handleKey('\r')
        expect(switchedSessionId).toBe('sess-1')
        expect(app.state.activeOverlay).toBe('none')

        app.stop()
    })

    it('handles /usage menu and triggers billing portal callback', () => {
        let billingPortalOpened = false

        const app = new DifferentialApp({
            terminal,
            width: 80,
            height: 24,
            usageStats: { requests: 42, inputTokens: 1000, outputTokens: 500, totalTokens: 1500 },
            onOpenBillingPortal: () => {
                billingPortalOpened = true
            },
        })
        app.start()

        // Populate a message with token usage
        app.state.messages.push({
            role: 'assistant',
            content: 'Hello world',
            timestamp: Date.now(),
            usage: {
                promptTokens: 250,
                completionTokens: 50,
            },
        })

        app.executeCommand('usage')
        expect(app.state.activeOverlay).toBe('usage')
        // Automatically aggregates from messages
        expect(app.state.usageStats.requests).toBe(1)
        expect(app.state.usageStats.inputTokens).toBe(250)
        expect(app.state.usageStats.outputTokens).toBe(50)

        // Press 'r' to refresh stats
        app.handleKey('r')
        expect(app.state.usageStats.requests).toBe(1)

        // Press 'p' or 'b' to open billing portal
        app.handleKey('b')
        expect(billingPortalOpened).toBe(true)

        // Press 'm' to switch to model select overlay
        app.handleKey('m')
        expect(app.state.activeOverlay).toBe('model')

        // Return to usage
        app.executeCommand('usage')
        expect(app.state.activeOverlay).toBe('usage')

        // Press 'q' to dismiss overlay
        app.handleKey('q')
        expect(app.state.activeOverlay).toBe('none')

        app.stop()
    })

    it('handles /skills menu search, detail view navigation, and space shortcut', async () => {
        const app = new DifferentialApp({
            terminal,
            width: 80,
            height: 24,
            skills: [
                {
                    name: 'tdd',
                    description: 'Test driven development workflow',
                    origin: 'workspace',
                    directoryPath: '/workspace/.agents/skills/tdd',
                    entryFilePath: '/workspace/.agents/skills/tdd/SKILL.md',
                },
                {
                    name: 'code-review',
                    description: 'Performs rigorous code review',
                    origin: 'global',
                    directoryPath: '/global/code-review',
                    entryFilePath: '/global/code-review/SKILL.md',
                },
            ],
        })
        app.start()

        app.executeCommand('skills')
        expect(app.state.activeOverlay).toBe('skills')
        expect(app.state.skills.length).toBe(2)

        // Search mode: press '/'
        app.handleKey('/')
        expect(app.state.skillsIsSearching).toBe(true)

        // Type query 'tdd'
        app.handleKey('t')
        app.handleKey('d')
        app.handleKey('d')
        expect(app.state.skillsSearchQuery).toBe('tdd')

        // Confirm search with Enter
        app.handleKey('\r')
        expect(app.state.skillsIsSearching).toBe(false)
        expect(app.state.skillsSearchQuery).toBe('tdd')

        // Space inserts '/tdd ' into prompt and closes overlay
        app.handleKey(' ')
        expect(app.state.activeOverlay).toBe('none')
        expect(app.state.input).toBe('/tdd ')

        // Re-open skills
        app.executeCommand('skills')
        expect(app.state.activeOverlay).toBe('skills')

        // Enter opens detail view
        app.handleKey('\r')
        expect(app.state.skillsIsDetailView).toBe(true)
        app.state.skillsDetailLines = ['# TDD Guide', 'Step 1: Write test', 'Step 2: Implement']

        // Down arrow moves cursor line
        app.handleKey('\x1b[B')
        expect(app.state.skillsCursorLine).toBe(1)

        // Up arrow moves cursor line back
        app.handleKey('\x1b[A')
        expect(app.state.skillsCursorLine).toBe(0)

        // q returns to list view
        app.handleKey('q')
        expect(app.state.skillsIsDetailView).toBe(false)
        expect(app.state.activeOverlay).toBe('skills')

        // esc closes menu
        app.handleKey('\x1b')
        expect(app.state.activeOverlay).toBe('none')

        app.stop()
    })

    it('handles interactive tool permission requests with quick keys', async () => {
        const app = new DifferentialApp({
            terminal,
            width: 80,
            height: 24,
        })
        app.start()

        const permPromise = app.requestToolPermission({
            toolName: 'run_command',
            commandOrTarget: 'rm -rf /tmp/test',
            diffLines: ['- dangerous file', '+ safe replacement'],
        })

        expect(app.state.activeOverlay).toBe('tool_permission')
        expect(app.state.pendingToolCall?.toolName).toBe('run_command')

        // Press 'y' to approve once
        app.handleKey('y')

        const decision = await permPromise
        expect(decision).toBe('approve')
        expect(app.state.activeOverlay).toBe('none')
        expect(app.state.pendingToolCall).toBeNull()

        app.stop()
    })

    it('handles interactive askQuestion dialog with 1-9 quick-select', async () => {
        const app = new DifferentialApp({
            terminal,
            width: 80,
            height: 24,
        })
        app.start()

        const questionPromise = app.askQuestion([
            {
                question: 'Which database should we use?',
                options: ['PostgreSQL', 'SQLite', 'MongoDB'],
            },
        ])

        expect(app.state.activeOverlay).toBe('ask_question')
        expect(app.state.pendingQuestions?.length).toBe(1)

        // Press '2' to pick SQLite
        app.handleKey('2')

        const answers = await questionPromise
        expect(answers['Which database should we use?']).toBe('SQLite')
        expect(app.state.activeOverlay).toBe('none')
        expect(app.state.pendingQuestions).toBeNull()

        app.stop()
    })

    it('handles interactive plan approval requests', async () => {
        const app = new DifferentialApp({
            terminal,
            width: 80,
            height: 24,
        })
        app.start()

        const planPromise = app.requestPlanApproval({
            summary: 'Migrate CLI architecture from Ink to 2D differential buffer',
            fullPlan: '### Implementation Plan\n1. Replace Ink\n2. Differential rendering',
        })

        expect(app.state.activeOverlay).toBe('plan_approve')
        expect(app.state.pendingPlan?.summary).toContain('2D differential buffer')

        // Press '1' or 'y' to approve
        app.handleKey('1')

        const result = await planPromise
        expect(result).toBe('approve')
        expect(app.state.activeOverlay).toBe('none')
        expect(app.state.pendingPlan).toBeNull()

        // Test viewing plan opens fileview
        const viewPromise = app.requestPlanApproval({
            summary: 'Review plan in full',
            fullPlan: 'Line 1\nLine 2\nLine 3',
        })
        app.handleKey('v')
        const viewResult = await viewPromise
        expect(viewResult).toBe('view')
        expect(app.state.activeOverlay).toBe('fileview')
        expect(app.state.fileViewLines).toEqual(['Line 1', 'Line 2', 'Line 3'])

        // Press Esc to exit fileview
        app.handleKey('\x1b')
        expect(app.state.activeOverlay).toBe('none')

        // Test setInput
        app.setInput('/plan refine: ')
        expect(app.state.input).toBe('/plan refine: ')
        expect(app.state.cursorPos).toBe('/plan refine: '.length)

        app.stop()
    })

    it('handles @ file autocompletion dropup in prompt mode', () => {
        const app = new DifferentialApp({
            terminal,
            width: 80,
            height: 24,
            workspaceFiles: ['src/agent.ts', 'src/types.ts', 'README.md'],
        })
        app.start()

        // Type @ag
        app.handleKey('@')
        app.handleKey('a')
        app.handleKey('g')

        expect(app.state.input).toBe('@ag')
        expect(app.state.isFileAutocompleteVisible).toBe(true)
        expect(app.state.fileAutocompleteItems.length).toBeGreaterThan(0)
        expect(app.state.fileAutocompleteItems[0]?.path).toBe('src/agent.ts')

        // Press Tab to autocomplete
        app.handleKey('\t')
        expect(app.state.input).toBe('@src/agent.ts ')
        expect(app.state.isFileAutocompleteVisible).toBe(false)

        app.stop()
    })

    it('handles /open <file> autocompletion dropup and opens fileview', async () => {
        let openedEditorPath: string | null = null
        const app = new DifferentialApp({
            terminal,
            width: 80,
            height: 24,
            workspaceFiles: ['src/agent.ts', 'src/types.ts', 'README.md'],
            onOpenEditor: async (path) => {
                openedEditorPath = path
            },
        })
        app.start()

        // Type /open RE
        for (const ch of '/open RE') {
            app.handleKey(ch)
        }

        expect(app.state.input).toBe('/open RE')
        expect(app.state.isFileAutocompleteVisible).toBe(true)
        expect(app.state.fileAutocompleteItems.length).toBeGreaterThan(0)
        expect(app.state.fileAutocompleteItems[0]?.path).toBe('README.md')

        // Tab to autocomplete
        app.handleKey('\t')
        expect(app.state.input).toBe('/open README.md ')
        expect(app.state.isFileAutocompleteVisible).toBe(false)

        // Enter to execute /open README.md
        app.handleKey('\r')
        expect(app.state.activeOverlay).toBe('fileview')
        expect(app.state.fileViewPath).toBe('README.md')

        app.stop()
    })

    it('handles /open without args by prompting for file name and opening autocomplete', () => {
        const app = new DifferentialApp({
            terminal,
            width: 80,
            height: 24,
            workspaceFiles: ['src/agent.ts', 'src/types.ts', 'README.md'],
        })
        app.start()

        // Execute /open without args
        app.executeCommand('open')
        expect(app.state.input).toBe('/open ')
        expect(app.state.isFileAutocompleteVisible).toBe(true)
        expect(app.state.fileAutocompleteItems.length).toBeGreaterThan(0)
        expect(app.state.toast?.message).toBe('Please specify a file name: /open <file>[:line]')

        app.stop()
    })

    it('handles /switch overlay navigation, switching providers, and credential deletion', () => {
        let switchedProvider: string | null = null
        let deletedProvider: string | null = null

        const app = new DifferentialApp({
            terminal,
            width: 80,
            height: 24,
            switchItems: [
                { label: 'Anthropic (Subscription)', value: 'subscription:claude', isActive: true },
                { label: 'OpenAI (BYOK)', value: 'provider:openai', isActive: false },
            ],
            onSwitchSelect: (val) => {
                switchedProvider = val
            },
            onDeleteProvider: (val) => {
                deletedProvider = val
            },
        })
        app.start()

        // 1. /switch opens switch overlay
        app.executeCommand('switch')
        expect(app.state.activeOverlay).toBe('switch')
        expect(app.state.switchSelectedIndex).toBe(0)

        // Down arrow selects index 1
        app.handleKey('\x1b[B')
        expect(app.state.switchSelectedIndex).toBe(1)

        // Enter switches provider and closes overlay
        app.handleKey('\r')
        expect(switchedProvider).toBe('provider:openai')
        expect(app.state.activeOverlay).toBe('none')

        // 2. Open /switch again and test delete confirmation flow
        app.executeCommand('switch')
        expect(app.state.activeOverlay).toBe('switch')
        expect(app.state.switchItems.length).toBe(2)

        // Press 'd' triggers delete confirmation
        app.handleKey('d')
        expect(app.state.switchConfirmDeleteValue).toBe('subscription:claude')

        // Press 'y' confirms deletion
        app.handleKey('y')
        expect(deletedProvider).toBe('subscription:claude')
        expect(app.state.switchItems.length).toBe(1)
        expect(app.state.switchConfirmDeleteValue).toBeNull()

        app.stop()
    })

    it('allows disconnecting configured subscription with d and y in subscriptions menu', () => {
        let deleted = ''
        const app = new DifferentialApp({
            terminal,
            width: 80,
            height: 24,
            switchItems: [
                {
                    label: 'Anthropic (Claude) (Subscription)',
                    value: 'subscription:claude',
                    isActive: true,
                },
            ],
            onDeleteProvider: (val) => {
                deleted = val
            },
        })
        app.start()

        // Open login menu, navigate to subscription
        app.executeCommand('login')
        expect(app.state.activeOverlay).toBe('login')
        app.handleKey('\r')
        expect(app.state.activeOverlay).toBe('auth')
        expect(app.state.authViewMode).toBe('subscription')
        expect(app.state.authProviderSelectedIndex).toBe(0) // Claude

        // Press 'd' triggers disconnect confirmation
        app.handleKey('d')
        expect(app.state.authConfirmDeleteValue).toBe('subscription:claude')

        // Press 'y' confirms disconnect
        app.handleKey('y')
        expect(deleted).toBe('subscription:claude')
        expect(app.state.switchItems.length).toBe(0)
        expect(app.state.authConfirmDeleteValue).toBeNull()

        app.stop()
    })

    it('prompts for account switch confirmation when selecting an already configured subscription', () => {
        let switched = ''
        const app = new DifferentialApp({
            terminal,
            width: 80,
            height: 24,
            switchItems: [
                {
                    label: 'Anthropic (Claude) (Subscription)',
                    value: 'subscription:claude',
                    account: 'dev@example.com',
                },
            ],
            onSwitchSelect: (val) => {
                switched = val
            },
        })
        app.start()

        // Open subscription menu
        app.state.activeOverlay = 'auth'
        app.state.authViewMode = 'subscription'
        app.state.authProviderSelectedIndex = 0 // Claude

        // Press Enter on already configured subscription
        app.handleKey('\r')
        expect(app.state.authViewMode as string).toBe('confirm_switch_subscription')
        expect(app.state.authConfirmTarget?.value).toBe('claude')
        expect(app.state.authConfirmTarget?.account).toBe('dev@example.com')

        // Press Enter (or n) keeps current and switches to it
        app.handleKey('\r')
        expect(switched).toBe('subscription:claude')
        expect(app.state.activeOverlay as string).toBe('none')

        app.stop()
    })

    it('esc in confirm_switch_subscription returns to subscription menu, not login', () => {
        const app = new DifferentialApp({
            terminal,
            width: 80,
            height: 24,
            switchItems: [
                {
                    label: 'Anthropic (Claude)',
                    value: 'subscription:claude',
                    account: 'dev@example.com',
                },
            ],
        })
        app.start()

        // Open subscription menu
        app.state.activeOverlay = 'auth'
        app.state.authViewMode = 'subscription'
        app.state.authProviderSelectedIndex = 0 // Claude

        // Press Enter on already configured subscription
        app.handleKey('\r')
        expect(app.state.authViewMode as string).toBe('confirm_switch_subscription')
        expect(app.state.authConfirmTarget?.value).toBe('claude')

        // Press Esc -> should return to subscription view, keeping auth overlay
        app.handleKey('\x1b')
        expect(app.state.authViewMode as string).toBe('subscription')
        expect(app.state.activeOverlay as string).toBe('auth')
        expect(app.state.authConfirmTarget).toBeNull()

        app.stop()
    })

    it('Login via December with existing session prompts switch confirmation and handles esc', () => {
        const app = new DifferentialApp({
            terminal,
            width: 80,
            height: 24,
            hasDecember: true,
            decemberEmail: 'dev@december.io',
            userEmail: 'dev@december.io',
            isAuthenticated: true,
            authMethod: 'subscription', // Even if currently using subscription!
        })
        app.start()

        // Open login menu
        app.executeCommand('login')
        expect(app.state.activeOverlay).toBe('login')
        expect(app.state.loginConfirmSwitch).toBe(false)

        // Navigate to "Login via December" (index 2)
        app.state.loginSelectedIndex = 2
        app.handleKey('\r')

        // Should enter switch confirmation
        expect(app.state.loginConfirmSwitch).toBe(true)

        // Press Esc -> returns to login menu options without closing overlay
        app.handleKey('\x1b')
        expect(app.state.loginConfirmSwitch).toBe(false)
        expect(app.state.activeOverlay).toBe('login')

        // Press Enter again to reopen switch confirmation
        app.handleKey('\r')
        expect(app.state.loginConfirmSwitch).toBe(true)

        // Press Enter or n to keep current account -> closes overlay and shows toast
        app.handleKey('\r')
        expect(app.state.loginConfirmSwitch).toBe(false)
        expect(app.state.activeOverlay).toBe('none')
        expect(app.state.toast?.message).toBe('Already logged in as dev@december.io.')

        app.stop()
    })

    it('allows deleting configured BYOK key with d and y in byok provider menu', () => {
        let deleted = ''
        const app = new DifferentialApp({
            terminal,
            width: 80,
            height: 24,
            switchItems: [
                {
                    label: 'OpenAI',
                    value: 'provider:openai',
                },
            ],
            onDeleteProvider: (val) => {
                deleted = val
            },
        })
        app.start()

        // Open BYOK menu
        app.state.activeOverlay = 'auth'
        app.state.authViewMode = 'byok_provider'
        // Filter to openai
        app.state.authProviderSearchQuery = 'openai'
        app.state.authProviderSelectedIndex = 0

        // Press 'd' triggers deletion confirmation
        app.handleKey('d')
        expect(app.state.authConfirmDeleteValue).toBe('provider:openai')

        // Press 'y' confirms deletion
        app.handleKey('y')
        expect(deleted).toBe('provider:openai')
        expect(app.state.switchItems.length).toBe(0)
        expect(app.state.authConfirmDeleteValue).toBeNull()

        app.stop()
    })

    it('prompts to replace key or use existing when selecting an already configured BYOK provider', () => {
        let switched = ''
        const app = new DifferentialApp({
            terminal,
            width: 80,
            height: 24,
            switchItems: [
                {
                    label: 'OpenAI',
                    value: 'provider:openai',
                },
            ],
            onSwitchSelect: (val) => {
                switched = val
            },
        })
        app.start()

        // Open BYOK menu, filter to openai
        app.state.activeOverlay = 'auth'
        app.state.authViewMode = 'byok_provider'
        app.state.authProviderSearchQuery = 'openai'
        app.state.authProviderSelectedIndex = 0

        // Press Enter on configured provider
        app.handleKey('\r')
        expect(app.state.authViewMode as string).toBe('confirm_replace_byok')
        expect(app.state.authConfirmTarget?.value).toBe('openai')

        // Press Enter (or n) uses existing key
        app.handleKey('\r')
        expect(switched).toBe('provider:openai')
        expect(app.state.activeOverlay as string).toBe('none')

        // Now test pressing 'y' enters new key
        app.state.activeOverlay = 'auth'
        app.state.authViewMode = 'confirm_replace_byok'
        app.handleKey('y')
        expect(app.state.authViewMode as string).toBe('byok_key')

        app.stop()
    })

    it('handles bracketed paste in overlays including auth byok_key without polluting chat input', () => {
        let savedKey: { provider: string; key: string } | null = null
        const app = new DifferentialApp({
            terminal,
            width: 80,
            height: 24,
            onSaveApiKey: (provider, key) => {
                savedKey = { provider, key }
            },
        })
        app.start()

        // 1. Byok key paste
        app.state.activeOverlay = 'auth'
        app.state.authViewMode = 'byok_key'
        app.state.authProviders = [{ label: 'Anthropic', value: 'anthropic' }]
        app.state.authProviderSelectedIndex = 0
        app.state.input = ''

        // Paste an Anthropic API key with trailing newline and whitespace
        const rawApiKey = '  sk-ant-api03-samplekey1234567890\n  '
        app.handleKey(`\x1b[200~${rawApiKey}\x1b[201~`)

        // Verifies authApiKeyInput gets the clean key and chat input is untouched
        expect(app.state.authApiKeyInput).toBe('sk-ant-api03-samplekey1234567890')
        expect(app.state.input).toBe('')

        // Press Enter saves key
        app.handleKey('\r')
        expect(savedKey).toEqual({
            provider: 'anthropic',
            key: 'sk-ant-api03-samplekey1234567890',
        })
        expect(app.state.activeOverlay as string).toBe('none')

        // 2. Auth provider search paste
        app.state.activeOverlay = 'auth'
        app.state.authViewMode = 'byok_provider'
        app.state.isSearchingAuthProviders = true
        app.handleKey('\x1b[200~anthro\x1b[201~')
        expect(app.state.authProviderSearchQuery).toBe('anthro')
        expect(app.state.input).toBe('')

        // 3. Model search paste
        app.state.activeOverlay = 'model'
        app.state.isModelSearching = true
        app.handleKey('\x1b[200~claude-3-7\x1b[201~')
        expect(app.state.modelSearchQuery).toBe('claude-3-7')
        expect(app.state.input).toBe('')

        // 4. Session rename and search paste
        app.state.activeOverlay = 'session'
        app.state.sessionRenameMode = true
        app.handleKey('\x1b[200~my new session\x1b[201~')
        expect(app.state.sessionRenameValue).toBe('my new session')
        expect(app.state.input).toBe('')

        app.state.sessionRenameMode = false
        app.state.isSessionSearching = true
        app.handleKey('\x1b[200~search-session\x1b[201~')
        expect(app.state.sessionSearchQuery).toBe('search-session')
        expect(app.state.input).toBe('')

        // 5. Memory new entry paste
        app.state.activeOverlay = 'memory'
        app.state.isAddingMemory = true
        app.handleKey('\x1b[200~remember this project architecture\x1b[201~')
        expect(app.state.memoryNewEntryText).toBe('remember this project architecture')
        expect(app.state.input).toBe('')

        // 6. Skills search paste
        app.state.activeOverlay = 'skills'
        app.state.skillsIsSearching = true
        app.handleKey('\x1b[200~typescript\x1b[201~')
        expect(app.state.skillsSearchQuery).toBe('typescript')
        expect(app.state.input).toBe('')

        // 7. Non-text overlay (e.g. help) ignores paste and does not leak to chat input
        app.state.activeOverlay = 'help'
        app.handleKey('\x1b[200~leaked text\x1b[201~')
        expect(app.state.input).toBe('')

        app.stop()
    })

    it('dynamically scopes /model list to active provider and supports search and selection', () => {
        let selectedModel: any = null
        const mockProviderModels: Record<string, { label: string; value: string }[]> = {
            anthropic: [
                { label: 'Claude 3.7 Sonnet', value: 'claude-3-7-sonnet' },
                { label: 'Claude 3.5 Haiku', value: 'claude-3-5-haiku' },
            ],
            google: [
                { label: 'Gemini 2.5 Flash', value: 'gemini-2.5-flash' },
                { label: 'Gemini 2.5 Pro', value: 'gemini-2.5-pro' },
            ],
        }

        const app = new DifferentialApp({
            terminal,
            width: 80,
            height: 24,
            selectedProvider: 'anthropic',
            activeModel: 'claude-3-7-sonnet',
            getProviderModels: (prov) => mockProviderModels[prov] || [],
            onModelSelect: (model) => {
                selectedModel = model
            },
        })
        app.start()

        // 1. /model loads anthropic models initially
        app.executeCommand('model')
        expect(app.state.activeOverlay).toBe('model')
        expect(app.state.models.length).toBe(2)
        expect(app.state.models[0].value).toBe('claude-3-7-sonnet')
        expect(app.state.modelSelectedIndex).toBe(0)

        // 2. Search mode with '/'
        app.handleKey('/')
        expect(app.state.isModelSearching).toBe(true)
        app.handleKey('h')
        app.handleKey('a')
        app.handleKey('i')
        expect(app.state.modelSearchQuery).toBe('hai')

        // First escape exits search mode without closing menu
        app.handleKey('\x1b')
        expect(app.state.isModelSearching).toBe(false)
        expect(app.state.activeOverlay).toBe('model')

        // Enter selects the filtered item
        app.handleKey('\r')
        expect(selectedModel?.value).toBe('claude-3-5-haiku')
        expect(app.state.activeModel).toBe('claude-3-5-haiku')
        expect(app.state.activeOverlay).toBe('none')

        // 3. Switch provider to google, /model refreshes to google models
        app.state.selectedProvider = 'google'
        app.executeCommand('model')
        expect(app.state.activeOverlay).toBe('model')
        expect(app.state.models.length).toBe(2)
        expect(app.state.models[0].value).toBe('gemini-2.5-flash')

        app.stop()
    })

    it('copies authorization url to clipboard and displays link copy notice during subscription login', async () => {
        const app = new DifferentialApp({
            terminal,
            width: 80,
            height: 24,
            onSubscriptionLogin: async (_prov, onCode) => {
                if (onCode) {
                    onCode('CLAUDE-AUTH', 'https://claude.ai/oauth/authorize?test=1')
                }
                return { accessToken: 'test-token', provider: 'claude' }
            },
        })
        app.start()

        await app.startSubscriptionLogin('claude', 'Anthropic (Claude)')

        const assistantMsg = app.state.messages.find(
            (m) => m.role === 'assistant' && m.content.includes('Authorization URL:')
        )
        expect(assistantMsg).toBeDefined()
        expect(assistantMsg?.content).toContain('(Link copied to clipboard')
        expect(assistantMsg?.content).toContain('https://claude.ai/oauth/authorize?test=1')

        app.stop()
    })

    it('appends tool calls, updates execution results, and displays thinking', () => {
        const app = new DifferentialApp({
            terminal,
            width: 80,
            height: 24,
        })
        app.start()

        // Append thinking
        app.appendThinkingChunk('analyzing context')
        expect(app.state.messages.some((m) => m.role === 'thinking')).toBe(true)

        // Append tool call
        app.appendToolCall({
            id: 'call-1',
            name: 'read_file',
            command: 'Read(src/index.ts)',
        })
        expect(
            app.state.messages.some(
                (m) => m.role === 'tool' && m.toolCall?.command === 'Read(src/index.ts)'
            )
        ).toBe(true)

        // Update tool result
        app.updateToolResult('call-1', { output: '42 lines read', isError: false })
        const toolMsg = app.state.messages.find((m) => m.role === 'tool')
        expect(toolMsg?.toolCall?.status).toBe('success')

        // Stream answer delta finalizes thinking
        app.appendStreamDelta('Here is the explanation.')
        const thinkingMsg = app.state.messages.find((m) => m.role === 'thinking')
        expect(thinkingMsg?.isStreaming).toBe(false)

        app.stop()
    })

    it('manages fullscreen memory overlay, hierarchical esc back navigation, and adding entries', async () => {
        let recorded: { text: string; category: string } | null = null
        let forgotten: string | null = null

        const app = new DifferentialApp({
            terminal,
            width: 80,
            height: 24,
            onLoadMemoryDetails: async () => ({
                filePath: '.december/memory.md',
                totalBytes: 256,
                maxBytes: 2048,
                budgetPercent: 12,
                entries: [
                    { category: 'build_and_test', text: 'bun test --bail' },
                    { category: 'conventions', text: 'always lowercase commits' },
                ],
            }),
            onLoadProjectRules: async () => [
                { path: 'AGENTS.md', content: '# AGENTS.md\nline 1\nline 2' },
            ],
            onRecordMemory: async (text, category) => {
                recorded = { text, category }
                return { success: true, message: 'Saved' }
            },
            onForgetMemory: async (text) => {
                forgotten = text
                return { success: true, message: 'Removed' }
            },
        })
        app.start()

        // 1. Open /memory from 'help' overlay to test returnOverlay
        app.state.activeOverlay = 'help'
        await app.openMemoryView('memory', 'help')
        expect(app.state.activeOverlay as string).toBe('memory')
        expect(app.state.memoryTab).toBe('memory')
        expect(app.state.workspaceMemoryDetails?.entries.length).toBe(2)

        // 2. Tab switches to rules
        app.handleKey('\t')
        expect(app.state.memoryTab).toBe('rules')

        // 3. Esc from rules steps back to memory tab (does NOT close overlay)
        app.handleKey('\x1b')
        expect(app.state.memoryTab).toBe('memory')
        expect(app.state.activeOverlay as string).toBe('memory')

        // 4. Press 'a' to add new memory entry, then Esc cancels adding without closing
        app.handleKey('a')
        expect(app.state.isAddingMemory).toBe(true)
        app.handleKey('\x1b')
        expect(app.state.isAddingMemory).toBe(false)
        expect(app.state.activeOverlay as string).toBe('memory')

        // 5. Actually add entry: press 'a', type, submit
        app.handleKey('a')
        for (const char of 'run db migration') {
            app.handleKey(char)
        }
        expect(app.state.memoryNewEntryText).toBe('run db migration')
        // Cycle category with Tab
        app.handleKey('\t')
        // Submit with Enter
        app.handleKey('\r')
        expect(app.state.isAddingMemory).toBe(false)
        expect(recorded).not.toBeNull()
        expect(recorded?.text).toBe('run db migration')

        // 6. Test cancellation with 'n', arrow keys, and 'y' confirms forget
        app.handleKey('d')
        expect(app.state.memoryConfirmForgetText).toBe('bun test --bail')
        app.handleKey('n')
        expect(app.state.memoryConfirmForgetText).toBeNull()

        // Arrow down clears confirmation and moves to next item
        app.handleKey('d')
        expect(app.state.memoryConfirmForgetText).toBe('bun test --bail')
        app.handleKey('\x1b[B')
        expect(app.state.memoryConfirmForgetText).toBeNull()

        // Press 'd' on item 1 and 'y' to confirm
        app.handleKey('d')
        expect(app.state.memoryConfirmForgetText).toBe('always lowercase commits')
        app.handleKey('y')
        expect(forgotten).toBe('always lowercase commits')

        // 7. Esc from memory root steps back to returnOverlay ('help')
        app.handleKey('\x1b')
        expect(app.state.activeOverlay as string).toBe('help')

        // 8. Esc from help closes to none
        app.handleKey('\x1b')
        expect(app.state.activeOverlay as string).toBe('none')

        app.stop()
    })

    it('handles direct shell commands (!<cmd>) and invokes onExecuteDirectCommand', async () => {
        let executedShellCmd = ''
        const app = new DifferentialApp({
            onExecuteDirectCommand: (cmd) => {
                executedShellCmd = cmd
            },
        })
        app.start()

        for (const char of '!git status') {
            app.handleKey(char)
        }
        expect(app.state.input).toBe('!git status')
        app.handleKey('\r')

        expect(executedShellCmd).toBe('git status')
        expect(app.state.messages.length).toBe(1)
        expect(app.state.messages[0].role).toBe('user')
        expect(app.state.messages[0].content).toBe('!git status')
        expect(app.state.input).toBe('')

        app.stop()
    })

    it('redirects /ask to /btw and handles /plan slash commands', async () => {
        const submitted: string[] = []
        let sideQuestionAsked: string | null = null
        const app = new DifferentialApp({
            onSubmit: (prompt) => {
                submitted.push(prompt)
            },
            onSideQuestion: async (question) => {
                sideQuestionAsked = question
            },
        })
        app.start()

        // 1. /ask without args shows toast informing about /btw
        app.executeCommand('ask')
        expect(app.state.messages.length).toBe(0)
        expect(app.state.toast?.message).toContain('/btw')

        // 2. /ask with args redirects to /btw (opens btwState and triggers onSideQuestion, no chat message)
        app.executeCommand('ask how does authentication work?')
        expect(app.state.messages.length).toBe(0)
        expect(submitted.length).toBe(0)
        expect(app.state.btwState?.question).toBe('how does authentication work?')
        expect(sideQuestionAsked).toBe('how does authentication work?')

        // 3. /plan with args submits plan goal
        for (const char of '/plan refactor database queries') {
            app.handleKey(char)
        }
        app.handleKey('\r')
        expect(submitted).toContain('/plan refactor database queries')
        expect(app.state.messages[0].role).toBe('user')
        expect(app.state.messages[0].content).toBe('/plan refactor database queries')

        app.stop()
    })

    it('handles dynamic skill execution and /model unauthenticated notice', async () => {
        const submitted: string[] = []
        const app = new DifferentialApp({
            isAuthenticated: false,
            skills: [
                {
                    name: 'code-review',
                    description: 'Review recent code changes',
                },
            ],
            onSubmit: (prompt) => {
                submitted.push(prompt)
            },
        })
        app.start()

        // 1. Dynamic skill invocation: first Enter completes from menu, second Enter executes
        for (const char of '/code-review') {
            app.handleKey(char)
        }
        app.handleKey('\r')
        app.handleKey('\r')
        expect(submitted.length).toBe(1)
        expect(submitted[0]).toContain("Execute skill 'code-review'")

        // 2. /model when unauthenticated outputs notice in chat
        app.executeCommand('model')
        expect(app.state.activeOverlay as string).toBe('none')
        const msgs = app.state.messages
        expect(msgs[msgs.length - 2].content).toBe('/model')
        expect(msgs[msgs.length - 1].content).toContain('You are not logged in')

        // 3. /feedback opens browser and shows toast without polluting chat messages
        const msgCountBefore = app.state.messages.length
        app.executeCommand('feedback')
        expect(app.state.messages.length).toBe(msgCountBefore)
        expect(app.state.toast?.message).toBe('Opened feedback in browser.')

        app.stop()
    })

    it('hierarchically handles esc key across overlay sub-states without dumping to home', async () => {
        const app = new DifferentialApp({
            isAuthenticated: true,
            skills: [
                { name: 'flywheel', description: 'advance autonomous research' },
                { name: 'tdd', description: 'test driven development' },
            ],
            sessions: [
                { id: 'session-1', preview: 'Initial work', updatedAt: '2026-11-01' },
                { id: 'session-2', preview: 'Second task', updatedAt: '2026-11-01' },
            ],
            switchItems: [
                { label: 'Anthropic', value: 'byok:anthropic' },
                { label: 'OpenAI', value: 'byok:openai' },
            ],
        })
        app.start()

        // 1. Skills sub-states: Detail View -> Esc -> List View -> Esc -> None
        app.executeCommand('skills')
        expect(app.state.activeOverlay).toBe('skills')
        app.state.skillsIsDetailView = true
        app.state.skillsDetailLines = ['# Flywheel', 'Description line 1']
        app.handleKey('\x1b')
        expect(app.state.skillsIsDetailView).toBe(false)
        expect(app.state.activeOverlay).toBe('skills')

        // Skills search query: Search -> type query -> Esc exits search mode -> Esc clears query -> Esc closes
        app.handleKey('/')
        expect(app.state.skillsIsSearching).toBe(true)
        app.handleKey('f')
        app.handleKey('l')
        expect(app.state.skillsSearchQuery).toBe('fl')
        app.handleKey('\x1b')
        expect(app.state.skillsIsSearching).toBe(false)
        expect(app.state.skillsSearchQuery).toBe('fl')
        app.handleKey('\x1b')
        expect(app.state.skillsSearchQuery).toBe('')
        expect(app.state.activeOverlay).toBe('skills')
        app.handleKey('\x1b')
        expect(app.state.activeOverlay).toBe('none')

        // 2. Session sub-states:
        // Delete confirm -> Esc cancels confirm
        app.executeCommand('session')
        expect(app.state.activeOverlay).toBe('session')
        app.state.sessionConfirmDeleteId = 'session-1'
        app.handleKey('\x1b')
        expect(app.state.sessionConfirmDeleteId).toBeNull()
        expect(app.state.activeOverlay).toBe('session')

        // Rename mode -> Esc cancels rename
        app.state.sessionRenameMode = true
        app.state.sessionRenameValue = 'Renamed Session'
        app.handleKey('\x1b')
        expect(app.state.sessionRenameMode).toBe(false)
        expect(app.state.activeOverlay).toBe('session')

        // Session search query -> Esc exits search mode -> Esc clears query -> Esc closes
        app.handleKey('/')
        expect(app.state.isSessionSearching).toBe(true)
        app.handleKey('w')
        app.handleKey('o')
        expect(app.state.sessionSearchQuery).toBe('wo')
        app.handleKey('\x1b')
        expect(app.state.isSessionSearching).toBe(false)
        expect(app.state.sessionSearchQuery).toBe('wo')
        app.handleKey('\x1b')
        expect(app.state.sessionSearchQuery).toBe('')
        expect(app.state.activeOverlay).toBe('session')
        app.handleKey('\x1b')
        expect(app.state.activeOverlay).toBe('none')

        // 3. Switch sub-states: Confirm delete -> Esc cancels confirm -> Esc closes
        app.executeCommand('switch')
        expect(app.state.activeOverlay).toBe('switch')
        app.state.switchConfirmDeleteValue = 'byok:anthropic'
        app.handleKey('\x1b')
        expect(app.state.switchConfirmDeleteValue).toBeNull()
        expect(app.state.activeOverlay).toBe('switch')
        app.handleKey('\x1b')
        expect(app.state.activeOverlay).toBe('none')

        app.stop()
    })

    it('navigates cross-menu overlay history stack on esc', async () => {
        const app = new DifferentialApp({
            isAuthenticated: true,
            models: [
                { label: 'Claude 3.7 Sonnet', value: 'claude-3-7-sonnet' },
                { label: 'GPT-4o', value: 'gpt-4o' },
            ],
        })
        app.start()

        // 1. /usage -> press 'm' to switch model -> in model press Esc -> returns to /usage -> press Esc -> returns to none
        app.executeCommand('usage')
        expect(app.state.activeOverlay).toBe('usage')
        app.handleKey('m')
        expect(app.state.activeOverlay).toBe('model')
        expect(app.state.overlayHistory).toEqual(['usage'])

        // Inside model, type search query -> Esc exits search mode -> Esc clears query -> Esc exits to usage
        app.handleKey('/')
        app.handleKey('c')
        app.handleKey('l')
        expect(app.state.modelSearchQuery).toBe('cl')
        app.handleKey('\x1b')
        expect(app.state.isModelSearching).toBe(false)
        expect(app.state.modelSearchQuery).toBe('cl')
        app.handleKey('\x1b')
        expect(app.state.modelSearchQuery).toBe('')
        app.handleKey('\x1b')
        expect(app.state.activeOverlay).toBe('usage')
        expect(app.state.overlayHistory).toEqual([])
        app.handleKey('\x1b')
        expect(app.state.activeOverlay).toBe('none')

        // 2. /settings -> select Model -> in model press Esc -> returns to /settings -> Esc -> none
        app.executeCommand('settings')
        expect(app.state.activeOverlay).toBe('settings')
        app.state.settingsSelectedIndex = 0 // 'model'
        app.handleKey('\r')
        expect(app.state.activeOverlay).toBe('model')
        expect(app.state.overlayHistory).toEqual(['settings'])
        app.handleKey('\x1b')
        expect(app.state.activeOverlay).toBe('settings')
        expect(app.state.overlayHistory).toEqual([])
        app.handleKey('\x1b')
        expect(app.state.activeOverlay).toBe('none')

        // 3. /settings -> select Thinking Level -> in effort press Esc -> returns to /settings -> Esc -> none
        app.executeCommand('settings')
        expect(app.state.activeOverlay).toBe('settings')
        const thinkingIdx = app.state.settings.findIndex((s) => s.id === 'thinking_level')
        app.state.settingsSelectedIndex = thinkingIdx >= 0 ? thinkingIdx : 5
        app.handleKey('\r')
        expect(app.state.activeOverlay).toBe('effort')
        expect(app.state.overlayHistory).toEqual(['settings'])
        app.handleKey('\x1b')
        expect(app.state.activeOverlay).toBe('settings')
        expect(app.state.overlayHistory).toEqual([])
        app.handleKey('\x1b')
        expect(app.state.activeOverlay).toBe('none')

        app.stop()
    })

    it('handles settings toggling and fires onSettingChange for pathguard, permissions, steering, and browser', () => {
        const changes: { id: string; value: string }[] = []
        const app = new DifferentialApp({
            terminal,
            width: 80,
            height: 24,
            onSettingChange: (id, value) => {
                changes.push({ id, value })
            },
        })
        app.start()

        app.executeCommand('settings')
        expect(app.state.activeOverlay).toBe('settings')

        // Find tool_permission and toggle it
        const toolPermIdx = app.state.settings.findIndex((s) => s.id === 'tool_permission')
        app.state.settingsSelectedIndex = toolPermIdx
        app.handleKey(' ')
        expect(app.state.settings[toolPermIdx].value).toBe('always-ask')
        expect(changes).toContainEqual({ id: 'tool_permission', value: 'always-ask' })

        // Find pathguard and toggle it
        const pathGuardIdx = app.state.settings.findIndex((s) => s.id === 'pathguard')
        app.state.settingsSelectedIndex = pathGuardIdx
        app.handleKey('\r')
        expect(app.state.settings[pathGuardIdx].value).toBe('off')
        expect(changes).toContainEqual({ id: 'pathguard', value: 'off' })

        // Find steering_mode and toggle it
        const steeringIdx = app.state.settings.findIndex((s) => s.id === 'steering_mode')
        app.state.settingsSelectedIndex = steeringIdx
        app.handleKey(' ')
        expect(app.state.settings[steeringIdx].value).toBe('one-at-a-time')
        expect(changes).toContainEqual({ id: 'steering_mode', value: 'one-at-a-time' })

        // Find browser_visible and toggle it
        const browserIdx = app.state.settings.findIndex((s) => s.id === 'browser_visible')
        app.state.settingsSelectedIndex = browserIdx
        app.handleKey('\r')
        expect(app.state.settings[browserIdx].value).toBe('on')
        expect(changes).toContainEqual({ id: 'browser_visible', value: 'on' })

        app.stop()
    })

    it('handles background tasks, termination via k, log inspection, and clipboard copying via c', () => {
        let killedTaskId = ''
        const app = new DifferentialApp({
            terminal,
            width: 80,
            height: 24,
            onKillTask: (id) => {
                killedTaskId = id
            },
        })
        app.start()

        app.updateTasks([
            {
                id: 'task-1',
                command: 'npm run dev',
                status: 'running',
                output: 'Server listening on :3000\nCompiling client...',
            },
            {
                id: 'task-2',
                command: 'bun test',
                status: 'completed',
                output: '10 pass\n0 fail',
            },
        ])

        app.executeCommand('tasks')
        expect(app.state.activeOverlay).toBe('tasks')
        expect(app.state.tasks).toHaveLength(2)

        // Press 'k' on running task
        app.state.tasksSelectedIndex = 0
        app.handleKey('k')
        expect(killedTaskId).toBe('task-1')
        expect(app.state.tasks[0].status).toBe('failed')

        // Press enter on task to open raw log viewer
        app.handleKey('\r')
        expect(app.state.activeOverlay).toBe('fileview')
        expect(app.state.fileViewLines).toEqual([
            'Server listening on :3000',
            'Compiling client...',
        ])

        // Press 'c' to copy task output
        app.handleKey('c')
        expect(app.state.toast?.message).toBe('Copied task output to clipboard.')

        // Press Esc to return to tasks
        app.handleKey('\x1b')
        expect(app.state.activeOverlay).toBe('tasks')

        app.stop()
    })

    it('collapses pasted text longer than 5 lines into token badge and expands on submit', () => {
        let submittedPrompt = ''
        const app = new DifferentialApp({
            terminal,
            width: 80,
            height: 24,
            onSubmit: (prompt) => {
                submittedPrompt = prompt
            },
        })
        app.start()

        // Short paste (<= 5 lines) remains as raw multiline text without collapsing
        const shortCode = 'line 1\nline 2\nline 3'
        app.handleKey(`\x1b[200~${shortCode}\x1b[201~`)
        expect(app.state.input).toBe(shortCode)
        expect(submittedPrompt).toBe('') // No premature submit

        // Clear input
        app.state.input = ''
        app.state.cursorPos = 0

        // Long paste (> 5 lines) collapses into token badge
        const longCode = Array.from({ length: 8 }, (_, i) => `const var_${i} = ${i};`).join('\n')
        app.handleKey(`\x1b[200~${longCode}\x1b[201~`)

        // Input contains collapsed token badge
        expect(app.state.input).toMatch(/^\[Pasted 8 lines(?: #\d+)?\]$/)

        // Backspace deletes the entire badge in one hit
        app.handleKey('\x7f')
        expect(app.state.input).toBe('')
        expect(app.state.cursorPos).toBe(0)

        // Type prefix and paste again
        app.handleKey('check this: ')
        app.handleKey(`\x1b[200~${longCode}\x1b[201~`)
        expect(app.state.input).toMatch(/^check this: \[Pasted 8 lines(?: #\d+)?\]$/)

        // Enter submits the fully expanded code
        app.handleKey('\r')
        expect(submittedPrompt).toBe(`check this: ${longCode}`)

        app.stop()
    })

    it('handles Shift+Enter and Alt+Enter to insert newlines without submitting', () => {
        let submittedPrompt = ''
        const app = new DifferentialApp({
            terminal,
            width: 80,
            height: 24,
            onSubmit: (prompt) => {
                submittedPrompt = prompt
            },
        })
        app.start()

        app.handleKey('hello')
        // Shift+Enter (\x1b[13;2u)
        app.handleKey('\x1b[13;2u')
        app.handleKey('world')
        // Alt+Enter (\x1b\r)
        app.handleKey('\x1b\r')
        app.handleKey('december')

        expect(app.state.input).toBe('hello\nworld\ndecember')
        expect(submittedPrompt).toBe('') // Not submitted yet

        // Enter submits the multiline text
        app.handleKey('\r')
        expect(submittedPrompt).toBe('hello\nworld\ndecember')

        app.stop()
    })

    it('dynamically expands input bar from 1 to 8 rows based on text and newlines', () => {
        // 1 line: promptRows = 1 -> height = 1 + 3 = 4
        expect(InputBarView.getHeight('', 80)).toBe(4)
        expect(InputBarView.getHeight('hello', 80)).toBe(4)

        // 3 lines: promptRows = 3 -> height = 3 + 3 = 6
        expect(InputBarView.getHeight('line 1\nline 2\nline 3', 80)).toBe(6)

        // 5 lines: promptRows = 5 -> height = 5 + 3 = 8
        const fiveLines = Array.from({ length: 5 }, (_, i) => `line ${i}`).join('\n')
        expect(InputBarView.getHeight(fiveLines, 80)).toBe(8)

        // 8 lines: promptRows = 8 -> height = 8 + 3 = 11
        const eightLines = Array.from({ length: 8 }, (_, i) => `line ${i}`).join('\n')
        expect(InputBarView.getHeight(eightLines, 80)).toBe(11)

        // 12 lines: capped at promptRows = 8 -> height = 8 + 3 = 11
        const twelveLines = Array.from({ length: 12 }, (_, i) => `line ${i}`).join('\n')
        expect(InputBarView.getHeight(twelveLines, 80)).toBe(11)

        // Long single line wrapping across rows:
        const longLine = 'a'.repeat(250)
        expect(InputBarView.getHeight(longLine, 80)).toBeGreaterThan(4)
    })

    it('toggles tool execution output details with Ctrl+O', () => {
        const app = new DifferentialApp({
            terminal,
            width: 80,
            height: 24,
        })
        app.start()

        expect(app.state.expandTools).toBe(false)

        // Ctrl+O toggles expansion on
        app.handleKey('\x0f')
        expect(app.state.expandTools).toBe(true)
        expect(app.state.toast?.message).toContain('Tool outputs expanded')

        // Ctrl+O toggles expansion off
        app.handleKey('\x0f')
        expect(app.state.expandTools).toBe(false)
        expect(app.state.toast?.message).toContain('Tool outputs collapsed')

        app.stop()
    })

    it('navigates multiline prompt vertically with Up and Down arrows', () => {
        const app = new DifferentialApp({
            terminal,
            width: 80,
            height: 24,
        })
        app.start()

        app.state.input = 'first line\nsecond line'
        // Place cursor at 'second line' col 3
        app.state.cursorPos = 'first line\n'.length + 3

        // Up arrow moves to first line col 3
        app.handleKey('\x1b[A')
        expect(app.state.cursorPos).toBe(3)

        // Down arrow moves back to second line col 3
        app.handleKey('\x1b[B')
        expect(app.state.cursorPos).toBe('first line\n'.length + 3)

        app.stop()
    })

    it('applies subtle backdrop dimming to background chat cells when overlay is active', () => {
        const app = new DifferentialApp({
            terminal,
            width: 80,
            height: 24,
        })
        app.start()

        app.state.messages = [
            {
                role: 'user',
                content: 'build a server',
            },
            {
                role: 'assistant',
                content: 'Sure! Let me start by generating the routes.',
            },
        ]
        app.render()

        // Open help overlay
        app.executeCommand('help')
        expect(app.state.activeOverlay).toBe('help')

        // Chat cells above the overlay card should be dimmed
        let hasDimmedCell = false
        for (let y = 0; y < 5; y++) {
            for (let x = 0; x < 40; x++) {
                const cell = app.screen.backBuffer.get(x, y)
                if (cell && cell.char && cell.char !== ' ' && cell.dim) {
                    hasDimmedCell = true
                    break
                }
            }
            if (hasDimmedCell) break
        }
        expect(hasDimmedCell).toBe(true)

        // Dismiss help overlay with Esc
        app.handleKey('\x1b')
        expect(app.state.activeOverlay).toBe('none')

        // In prompt mode, chat cells are no longer dimmed
        let nonDimmedCellFound = false
        for (let y = 0; y < 5; y++) {
            for (let x = 0; x < 40; x++) {
                const cell = app.screen.backBuffer.get(x, y)
                if (cell && cell.char && cell.char !== ' ' && !cell.dim) {
                    nonDimmedCellFound = true
                    break
                }
            }
            if (nonDimmedCellFound) break
        }
        expect(nonDimmedCellFound).toBe(true)

        app.stop()
    })

    it('handles context lifecycle for /clear, /new, and /fork commands', async () => {
        let clearCalled = false
        let newCalled = false
        let forkTarget: string | undefined = undefined

        const app = new DifferentialApp({
            terminal,
            width: 80,
            height: 24,
            sessionId: 'session-123',
            onClearContext: () => {
                clearCalled = true
            },
            onNewContext: () => {
                newCalled = true
                return 'session-456'
            },
            onForkContext: (target) => {
                forkTarget = target
                return 'session-forked'
            },
        })
        app.start()

        app.state.messages = [{ role: 'user', content: 'hello' }]
        app.state.contextTokens = 150

        // /clear
        app.executeCommand('clear')
        expect(clearCalled).toBe(true)
        expect(app.state.messages.length).toBe(0)
        expect(app.state.contextTokens).toBe(0)
        expect(app.state.toast?.message).toBe('Cleared conversation history.')

        // /new
        app.state.messages = [{ role: 'user', content: 'new question' }]
        app.executeCommand('new')
        expect(newCalled).toBe(true)
        expect(app.state.messages.length).toBe(0)
        expect(app.state.sessionId).toBe('session-456')
        expect(app.state.toast?.message).toBe('Started a new conversation.')

        // /fork
        app.executeCommand('fork feature-branch')
        expect(forkTarget).toBe('feature-branch')
        expect(app.state.sessionId).toBe('session-forked')
        expect(app.state.toast?.message).toBe(
            'Forked conversation into a new branch: session-forked.'
        )

        app.stop()
    })

    it('handles context menu shortcuts c and n to clear context and start new session', async () => {
        let clearCalled = false
        let newCalled = false

        const app = new DifferentialApp({
            terminal,
            width: 80,
            height: 24,
            sessionId: 'session-init',
            onClearContext: () => {
                clearCalled = true
            },
            onNewContext: () => {
                newCalled = true
                return 'session-next'
            },
        })
        app.start()

        // Open context overlay
        app.executeCommand('context')
        expect(app.state.activeOverlay).toBe('context')

        // 'c' to clear
        app.state.messages = [{ role: 'user', content: 'test msg' }]
        app.handleKey('c')
        expect(clearCalled).toBe(true)
        expect(app.state.messages.length).toBe(0)
        expect(app.state.activeOverlay).toBe('none')

        // Reopen and 'n' for new session
        app.executeCommand('context')
        expect(app.state.activeOverlay).toBe('context')
        app.handleKey('n')
        expect(newCalled).toBe(true)
        expect(app.state.sessionId).toBe('session-next')
        expect(app.state.activeOverlay).toBe('none')

        app.stop()
    })

    it('loads turns via onLoadRewindTurns and executes rollback on Enter in /rewind', async () => {
        let rolledBackTurn: number | null = null
        const mockTurns = [
            {
                turnIndex: 2,
                commitHash: 'commit222',
                prompt: 'second turn prompt',
                timestamp: Date.now() - 30000,
                touchedFiles: ['file2.ts'],
            },
            {
                turnIndex: 1,
                commitHash: 'commit111',
                prompt: 'initial turn prompt',
                timestamp: Date.now() - 60000,
                touchedFiles: ['file1.ts'],
            },
        ]

        const app = new DifferentialApp({
            terminal,
            width: 80,
            height: 24,
            onLoadRewindTurns: async () => mockTurns,
            onRewindTurn: (turnIndex) => {
                rolledBackTurn = turnIndex
            },
        })
        app.start()

        // Execute /rewind
        app.executeCommand('rewind')
        expect(app.state.activeOverlay).toBe('rewind')

        // Wait for async loadRewindTurns
        await app.loadRewindTurns()
        expect(app.state.rewindTurns.length).toBe(2)
        expect(app.state.rewindTurns[0]?.turnIndex).toBe(2)

        // Press down arrow 'j' to select turn 1
        app.handleKey('j')
        expect(app.state.rewindSelectedIndex).toBe(1)

        // Press Enter to rewind to turn 1
        app.handleKey('\r')
        expect(rolledBackTurn).toBe(1)
        expect(app.state.activeOverlay).toBe('none')

        app.stop()
    })

    it('enqueues prompts submitted during active streams in FIFO order and executes sequentially', () => {
        const submittedPrompts: string[] = []
        const app = new DifferentialApp({
            terminal,
            width: 80,
            height: 24,
            onSubmit: (prompt) => {
                submittedPrompts.push(prompt)
            },
        })
        app.start()

        // Turn 1: normal submit while idle
        app.state.input = 'first prompt'
        app.submitPrompt()
        expect(submittedPrompts).toEqual(['first prompt'])
        expect(app.state.promptQueue.length).toBe(0)

        // Turn 1 active: streaming starts
        app.state.isStreaming = true

        // User submits prompt 2 while streaming is active
        app.state.input = 'second prompt queued'
        app.submitPrompt()
        expect(submittedPrompts).toEqual(['first prompt']) // NOT submitted immediately
        expect(app.state.promptQueue).toEqual(['second prompt queued'])
        expect(app.state.input).toBe('')
        expect(app.state.toast?.message).toContain('Prompt queued (#1)')

        // User submits prompt 3 while streaming is still active
        app.state.input = 'third prompt queued'
        app.submitPrompt()
        expect(submittedPrompts).toEqual(['first prompt'])
        expect(app.state.promptQueue).toEqual(['second prompt queued', 'third prompt queued'])
        expect(app.state.input).toBe('')
        expect(app.state.toast?.message).toContain('Prompt queued (#2)')

        // Turn 1 finishes: stream stops
        app.state.isStreaming = false
        const drainedFirst = app.drainPromptQueue()
        expect(drainedFirst).toBe(true)
        expect(submittedPrompts).toEqual(['first prompt', 'second prompt queued'])
        expect(app.state.promptQueue).toEqual(['third prompt queued'])

        // Turn 2 finishes: stream stops
        const drainedSecond = app.drainPromptQueue()
        expect(drainedSecond).toBe(true)
        expect(submittedPrompts).toEqual([
            'first prompt',
            'second prompt queued',
            'third prompt queued',
        ])
        expect(app.state.promptQueue.length).toBe(0)

        // No more items to drain
        expect(app.drainPromptQueue()).toBe(false)

        app.stop()
    })

    it('clears prompt queue on abort Ctrl+C during streaming', () => {
        const app = new DifferentialApp({
            terminal,
            width: 80,
            height: 24,
        })
        app.start()

        app.state.isStreaming = true
        app.state.promptQueue = ['queued prompt 1', 'queued prompt 2']

        // Ctrl+C aborts active stream and clears pending queued prompts
        app.handleKey('\x03')
        expect(app.state.isStreaming).toBe(false)
        expect(app.state.promptQueue.length).toBe(0)
        expect(app.state.toast?.message).toBe('Aborted.')

        app.stop()
    })

    it('handles mouse wheel scrolling sequences without hijacking text selection', () => {
        const app = new DifferentialApp({
            terminal,
            width: 80,
            height: 24,
        })
        app.start()

        // Populate messages to allow scrolling
        for (let i = 0; i < 30; i++) {
            app.state.messages.push({
                role: i % 2 === 0 ? 'user' : 'assistant',
                content: `message line ${i}`,
            })
        }
        app.render()

        // Wheel up twice: \x1b[<64;20;10M
        app.handleKey('\x1b[<64;20;10M')
        app.handleKey('\x1b[<64;20;10M')
        expect(app.state.isReadingMode).toBe(true)
        const offsetAfterUp = app.state.scrollOffset!
        expect(typeof offsetAfterUp).toBe('number')

        // Wheel down once: \x1b[<65;20;10M
        app.handleKey('\x1b[<65;20;10M')
        expect(app.state.scrollOffset).toBe(offsetAfterUp + 3)

        app.stop()
    })

    it('batches rapid streaming updates within 33ms throttle window and flushes on flushStream', () => {
        const app = new DifferentialApp({
            terminal,
            width: 80,
            height: 24,
        })
        app.start()

        let renderCount = 0
        const origRender = app.render.bind(app)
        app.render = () => {
            renderCount++
            origRender()
        }

        renderCount = 0
        // Rapidly push multiple streaming chunks within microseconds (high-speed token burst)
        app.appendThinkingChunk('Planning step 1...')
        app.appendThinkingChunk(' Planning step 2...')
        app.appendStreamDelta('Answer token 1')
        app.appendStreamDelta(' Answer token 2')
        app.appendStreamDelta(' Answer token 3')

        // First call triggers immediate render, subsequent calls in burst are throttled
        expect(renderCount).toBe(1)

        // flushStream flushes pending buffer, finalizes thinking message, and renders immediately
        app.flushStream()
        expect(renderCount).toBe(2)

        const thinkingMsg = app.state.messages.find((m) => m.role === 'thinking')
        expect(thinkingMsg).toBeDefined()
        expect(thinkingMsg?.isStreaming).toBe(false)
        expect(typeof thinkingMsg?.durationMs).toBe('number')

        const asstMsg = app.state.messages.find((m) => m.role === 'assistant')
        expect(asstMsg).toBeDefined()
        expect(asstMsg?.content).toBe('Answer token 1 Answer token 2 Answer token 3')

        app.stop()
    })

    it('immediately aborts agent streaming on Escape key and triggers onAbort callback', () => {
        let abortCalled = false
        const app = new DifferentialApp({
            terminal,
            width: 80,
            height: 24,
            onAbort: () => {
                abortCalled = true
            },
        })
        app.start()

        app.state.isStreaming = true
        app.state.statusMessage = 'Thinking...'
        app.state.promptQueue = ['queued prompt']

        // Press Escape (\x1b)
        app.handleKey('\x1b')

        expect(abortCalled).toBe(true)
        expect(app.state.isStreaming).toBe(false)
        expect(app.state.promptQueue.length).toBe(0)
        expect(app.state.statusMessage).toBeUndefined()
        expect(app.state.toast?.message).toBe('Aborted.')

        app.stop()
    })

    it('closes command menu on Escape key during streaming without aborting agent streaming', () => {
        let abortCalled = false
        const app = new DifferentialApp({
            terminal,
            width: 80,
            height: 24,
            onAbort: () => {
                abortCalled = true
            },
        })
        app.start()

        app.state.isStreaming = true
        app.state.statusMessage = 'Thinking...'
        app.state.input = '/model'
        app.state.cursorPos = 6

        // Press Escape (\x1b) while command menu is open during streaming
        app.handleKey('\x1b')

        // Command menu input should be cleared, but streaming and status should remain active
        expect(abortCalled).toBe(false)
        expect(app.state.isStreaming).toBe(true)
        expect(app.state.statusMessage).toBe('Thinking...')
        expect(app.state.input).toBe('')
        expect(app.state.cursorPos).toBe(0)

        // Press Escape a second time when input is now empty -> should abort
        app.handleKey('\x1b')
        expect(abortCalled).toBe(true)
        expect(app.state.isStreaming).toBe(false)

        app.stop()
    })

    it('supports full readline editing keybindings (Ctrl+A, Ctrl+E, Ctrl+K, Ctrl+U, Ctrl+W, Alt+B, Alt+F, Ctrl+P, Ctrl+N, Ctrl+L, Ctrl+H, Ctrl+Y)', () => {
        const app = new DifferentialApp({
            terminal,
            width: 80,
            height: 24,
        })
        app.start()

        app.state.promptHistory = ['first prompt', 'second prompt']

        // Type input
        app.setInput('hello brave new world')
        expect(app.state.cursorPos).toBe(21)

        // Ctrl+A: start of line
        app.handleKey('\x01')
        expect(app.state.cursorPos).toBe(0)

        // Ctrl+E: end of line
        app.handleKey('\x05')
        expect(app.state.cursorPos).toBe(21)

        // Alt+B / Ctrl+Left: word jump backward
        app.handleKey('\x1bb')
        expect(app.state.cursorPos).toBe(16) // before 'world'

        // Alt+F / Ctrl+Right: word jump forward
        app.handleKey('\x1bf')
        expect(app.state.cursorPos).toBe(21)

        // Ctrl+W: word delete backward
        app.handleKey('\x17')
        expect(app.state.input).toBe('hello brave new ')
        expect(app.state.cursorPos).toBe(16)

        // Ctrl+K: delete to end
        app.state.cursorPos = 6 // after 'hello '
        app.handleKey('\x0b')
        expect(app.state.input).toBe('hello ')

        // Ctrl+U: delete to start
        app.handleKey('\x15')
        expect(app.state.input).toBe('')
        expect(app.state.cursorPos).toBe(0)

        // Ctrl+P: history previous
        app.handleKey('\x10')
        expect(app.state.input).toBe('second prompt')

        app.handleKey('\x10')
        expect(app.state.input).toBe('first prompt')

        // Ctrl+N: history next
        app.handleKey('\x0e')
        expect(app.state.input).toBe('second prompt')

        // Ctrl+L: toggle command menu
        app.state.input = ''
        app.handleKey('\x0c')
        expect(app.state.input).toBe('/')

        app.handleKey('\x0c')
        expect(app.state.input).toBe('')

        // Ctrl+H: open sessions overlay when prompt is empty
        app.handleKey('\x08')
        expect(app.state.activeOverlay as string).toBe('session')
        app.state.activeOverlay = 'none'

        // Ctrl+Y: quick copy last response
        app.state.messages.push({ role: 'assistant', content: 'test response content' })
        app.handleKey('\x19')
        expect(app.state.toast?.message).toBe('Copied last response to clipboard.')

        app.stop()
    })

    it('supports tasks mode batch shortcuts: K (kill all), x (clear completed), c (copy log)', () => {
        const killed: string[] = []
        const app = new DifferentialApp({
            terminal,
            width: 80,
            height: 24,
            tasks: [
                { id: 'task-1', command: 'bun test', status: 'running', output: 'log 1' },
                { id: 'task-2', command: 'npm build', status: 'running', output: 'log 2' },
                { id: 'task-3', command: 'git fetch', status: 'completed', output: 'log 3' },
            ],
            onKillTask: (id) => {
                killed.push(id)
            },
        })
        app.start()

        app.state.activeOverlay = 'tasks'
        app.state.tasksSelectedIndex = 0

        // Press 'c' to copy task-1 log
        app.handleKey('c')
        expect(app.state.toast?.message).toBe('Copied task log to clipboard.')

        // Press 'K' to kill all running tasks
        app.handleKey('K')
        expect(killed).toEqual(['task-1', 'task-2'])
        expect(app.state.tasks[0]?.status).toBe('failed')
        expect(app.state.tasks[1]?.status).toBe('failed')
        expect(app.state.toast?.message).toBe('Terminated 2 running tasks.')

        // Press 'x' to clear completed/failed tasks
        app.handleKey('x')
        expect(app.state.tasks.length).toBe(0)
        expect(app.state.toast?.message).toBe('Cleared 3 finished tasks.')

        app.stop()
    })
})
