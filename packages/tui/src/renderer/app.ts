import { DifferentialScreen } from './screen'
import { TerminalController } from './terminal'
import { HeaderView } from './views/header-view'
import { InputBarView } from './views/input-bar-view'
import { MessageListView, type MessageItem } from './views/message-list-view'

import type { DifferentialScreenOptions } from './types'

export interface DifferentialAppState {
    input: string
    cursorPos: number
    messages: MessageItem[]
    scrollOffset?: number
    isReadingMode: boolean
    isStreaming: boolean
    activeModel?: string
    modelLabel?: string
    authMethod?: string
    selectedProvider?: string
    contextTokens?: number
    cliVersion?: string
}

export interface DifferentialAppOptions extends DifferentialScreenOptions {
    cliVersion?: string
    modelLabel?: string
    activeModel?: string
    authMethod?: string
    selectedProvider?: string
    contextTokens?: number
    onSubmit?: (prompt: string) => void
    onExit?: () => void
}

export class DifferentialApp {
    readonly screen: DifferentialScreen
    readonly terminal: TerminalController
    readonly state: DifferentialAppState
    private isRunning = false
    private stdinListener?: (chunk: Buffer | string) => void
    private maxScroll = 0
    private onSubmitCallback?: (prompt: string) => void
    private onExitCallback?: () => void

    constructor(options?: DifferentialAppOptions) {
        this.terminal = options?.terminal ?? new TerminalController()
        this.screen = new DifferentialScreen({
            terminal: this.terminal,
            width: options?.width,
            height: options?.height,
            synchronized: options?.synchronized,
        })

        this.onSubmitCallback = options?.onSubmit
        this.onExitCallback = options?.onExit

        this.state = {
            input: '',
            cursorPos: 0,
            messages: [],
            isReadingMode: false,
            isStreaming: false,
            cliVersion: options?.cliVersion || '0.4.15',
            modelLabel: options?.modelLabel || 'Gemini 3.7 Flash',
            activeModel: options?.activeModel,
            authMethod: options?.authMethod,
            selectedProvider: options?.selectedProvider,
            contextTokens: options?.contextTokens || 0,
        }

        this.screen.onResize(() => {
            this.render()
        })
    }

    start(): void {
        if (this.isRunning) return
        this.isRunning = true

        this.screen.start()

        this.stdinListener = (data) => {
            const str = data.toString()
            this.handleKey(str)
        }

        if (this.terminal.stdin && typeof this.terminal.stdin.on === 'function') {
            this.terminal.stdin.on('data', this.stdinListener)
        }

        this.render()
    }

    stop(): void {
        if (!this.isRunning) return
        this.isRunning = false

        if (
            this.stdinListener &&
            this.terminal.stdin &&
            typeof this.terminal.stdin.removeListener === 'function'
        ) {
            this.terminal.stdin.removeListener('data', this.stdinListener)
            this.stdinListener = undefined
        }

        this.screen.stop()
    }

    handleKey(key: string): void {
        // Ctrl+C (SIGINT / Exit)
        if (key === '\x03') {
            if (this.onExitCallback) {
                this.onExitCallback()
            } else {
                this.stop()
                process.exit(0)
            }
            return
        }

        // Esc: reset reading mode / scroll to bottom
        if (key === '\x1b') {
            if (this.state.isReadingMode) {
                this.scrollToBottom()
                return
            }
        }

        // Arrow Up: \x1b[A
        if (key === '\x1b[A') {
            this.scrollUp(1)
            return
        }

        // Arrow Down: \x1b[B
        if (key === '\x1b[B') {
            this.scrollDown(1)
            return
        }

        // Page Up: \x1b[5~
        if (key === '\x1b[5~') {
            this.scrollUp(5)
            return
        }

        // Page Down: \x1b[6~
        if (key === '\x1b[6~') {
            this.scrollDown(5)
            return
        }

        // Enter: submit prompt
        if (key === '\r' || key === '\n') {
            if (this.state.input.trim()) {
                this.submitPrompt()
            }
            return
        }

        // Backspace: \x7f or \b
        if (key === '\x7f' || key === '\b') {
            if (this.state.cursorPos > 0) {
                const before = this.state.input.slice(0, this.state.cursorPos - 1)
                const after = this.state.input.slice(this.state.cursorPos)
                this.state.input = before + after
                this.state.cursorPos -= 1
                this.render()
            }
            return
        }

        // Left Arrow: \x1b[D
        if (key === '\x1b[D') {
            if (this.state.cursorPos > 0) {
                this.state.cursorPos -= 1
                this.render()
            }
            return
        }

        // Right Arrow: \x1b[C
        if (key === '\x1b[C') {
            if (this.state.cursorPos < this.state.input.length) {
                this.state.cursorPos += 1
                this.render()
            }
            return
        }

        // Printable text input (ignore other ANSI escape sequences)
        if (!key.startsWith('\x1b') && key.length > 0) {
            const before = this.state.input.slice(0, this.state.cursorPos)
            const after = this.state.input.slice(this.state.cursorPos)
            this.state.input = before + key + after
            this.state.cursorPos += key.length
            this.render()
        }
    }

    submitPrompt(): void {
        const text = this.state.input.trim()
        if (!text) return

        this.state.messages.push({
            role: 'user',
            content: text,
        })

        this.state.input = ''
        this.state.cursorPos = 0
        this.state.scrollOffset = undefined
        this.state.isReadingMode = false

        this.render()

        if (this.onSubmitCallback) {
            this.onSubmitCallback(text)
        }
    }

    appendStreamDelta(delta: string): void {
        if (!delta) return

        const lastMsg = this.state.messages[this.state.messages.length - 1]
        if (lastMsg && lastMsg.role === 'assistant') {
            lastMsg.content = (lastMsg.content || '') + delta
        } else {
            this.state.messages.push({
                role: 'assistant',
                content: delta,
            })
        }

        // Auto-scroll to bottom if not in reading mode
        if (!this.state.isReadingMode) {
            this.state.scrollOffset = undefined
        }

        this.render()
    }

    scrollUp(delta = 1): void {
        const current = this.state.scrollOffset ?? this.maxScroll
        const next = Math.max(0, current - delta)
        this.state.scrollOffset = next
        this.state.isReadingMode = next < this.maxScroll
        this.render()
    }

    scrollDown(delta = 1): void {
        const current = this.state.scrollOffset ?? this.maxScroll
        const next = Math.min(this.maxScroll, current + delta)
        this.state.scrollOffset = next
        this.state.isReadingMode = next < this.maxScroll
        this.render()
    }

    scrollToBottom(): void {
        this.state.scrollOffset = undefined
        this.state.isReadingMode = false
        this.render()
    }

    render(): void {
        const width = this.screen.columns
        const height = this.screen.rows

        this.screen.backBuffer.clear()

        // 1. Render Header (rows 0..1)
        HeaderView.render(this.screen.backBuffer, {
            x: 0,
            y: 0,
            width,
            cliVersion: this.state.cliVersion,
            modelLabel: this.state.modelLabel,
            authMethod: this.state.authMethod,
            selectedProvider: this.state.selectedProvider,
            contextTokens: this.state.contextTokens,
        })

        // 2. Render Input Bar at bottom (height - 3 .. height - 1)
        const inputHeight = 3
        const inputY = Math.max(2, height - inputHeight)
        const cursor = InputBarView.render(this.screen.backBuffer, {
            x: 0,
            y: inputY,
            width,
            height: inputHeight,
            input: this.state.input,
            cursorPos: this.state.cursorPos,
            isStreaming: this.state.isStreaming,
        })

        // 3. Render Message List View in the middle area (rows 2 .. inputY - 1)
        const messageListHeight = Math.max(1, inputY - 2)
        const { maxScroll } = MessageListView.render(this.screen.backBuffer, {
            x: 0,
            y: 2,
            width,
            height: messageListHeight,
            messages: this.state.messages,
            scrollOffset: this.state.scrollOffset,
        })
        this.maxScroll = maxScroll

        // Update terminal cursor
        this.screen.setCursor(cursor.x, cursor.y, cursor.visible)

        // Diff and flush
        this.screen.render()
    }
}
