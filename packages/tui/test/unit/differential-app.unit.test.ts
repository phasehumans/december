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

        // 1. Direct argument invocation: /effort high
        app.executeCommand('effort high')
        expect(app.state.thinkingLevel).toBe('high')
        expect(selectedLevel).toBe('high')
        expect(app.state.activeOverlay).toBe('none')
        expect(app.state.toast?.message).toBe('Reasoning set to High.')

        // 2. Open interactive effort menu: /effort
        app.executeCommand('effort')
        expect(app.state.activeOverlay).toBe('effort')
        // Pre-selected index should match current 'high' (index 4)
        expect(app.state.effortSelectedIndex).toBe(4)

        // Up arrow navigates to Medium (index 3)
        app.handleKey('\x1b[A')
        expect(app.state.effortSelectedIndex).toBe(3)

        // Enter selects Medium, invokes callback, and closes overlay
        app.handleKey('\r')
        expect(app.state.activeOverlay).toBe('none')
        expect(app.state.thinkingLevel).toBe('medium')
        expect(selectedLevel).toBe('medium')
        expect(app.state.toast?.message).toBe('Reasoning set to Medium.')

        // 3. /reasoning alias with argument
        app.executeCommand('reasoning low')
        expect(app.state.thinkingLevel).toBe('low')
        expect(selectedLevel).toBe('low')

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

    it('handles /login command with two-option menu (BYOK and December) and OAuth flow', async () => {
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
            onSubscriptionLogin: async (provider) => {
                subscriptionProviderCalled = provider
            },
        })
        app.start()

        // 1. Bare /login opens authentication card menu with BYOK and December options
        app.executeCommand('login')
        expect(app.state.activeOverlay).toBe('login')
        expect(app.state.loginSelectedIndex).toBe(0)

        // Enter on index 0 (BYOK) switches to model selection
        app.handleKey('\r')
        expect(app.state.activeOverlay).toBe('model')

        // 2. Open /login again and select December
        app.executeCommand('login')
        expect(app.state.activeOverlay).toBe('login')
        app.handleKey('\x1b[B')
        expect(app.state.loginSelectedIndex).toBe(1)

        // Enter triggers device login flow
        app.handleKey('\r')
        expect(app.state.activeOverlay).toBe('none')

        // Wait a tick for async login
        await new Promise((r) => setTimeout(r, 20))
        expect(loggedInOnCodeCalled).toBe(true)
        expect(app.state.isAuthenticated).toBe(true)
        expect(app.state.userEmail).toBe('user@example.com')
        expect(app.state.authMethod).toBe('december')

        // 3. Targeted /login copilot triggers subscription OAuth directly
        app.executeCommand('login copilot')
        expect(subscriptionProviderCalled).toBe('copilot')

        app.stop()
    })

    it('handles /session menu navigation, delete, and session switching', async () => {
        let switchedSessionId: string | null = null
        let deletedSessionId: string | null = null

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
        })
        app.start()

        // 1. Open session overlay
        app.executeCommand('session')
        expect(app.state.activeOverlay).toBe('session')
        expect(app.state.sessionSelectedIndex).toBe(0)

        // 2. Navigate down to sess-2
        app.handleKey('\x1b[B')
        expect(app.state.sessionSelectedIndex).toBe(1)

        // 3. Press 'd' to trigger delete confirmation
        app.handleKey('d')
        expect(app.state.sessionConfirmDeleteId).toBe('sess-2')

        // 4. Press 'y' to confirm delete
        app.handleKey('y')
        expect(deletedSessionId).toBe('sess-2')
        expect(app.state.sessions.length).toBe(2)
        expect(app.state.sessionConfirmDeleteId).toBeNull()

        // 5. Select remaining sess-1 on Enter
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

        app.executeCommand('usage')
        expect(app.state.activeOverlay).toBe('usage')

        // Press 'p' to open billing portal
        app.handleKey('p')
        expect(billingPortalOpened).toBe(true)

        // Press 'q' to dismiss overlay
        app.handleKey('q')
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
        })

        expect(app.state.activeOverlay).toBe('plan_approve')
        expect(app.state.pendingPlan?.summary).toContain('2D differential buffer')

        // Press '1' or 'y' to approve
        app.handleKey('1')

        const result = await planPromise
        expect(result).toBe('approve')
        expect(app.state.activeOverlay).toBe('none')
        expect(app.state.pendingPlan).toBeNull()

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
})
