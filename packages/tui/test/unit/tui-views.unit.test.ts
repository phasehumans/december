import { describe, expect, it } from 'bun:test'

import { ScreenBuffer } from '../../src/renderer/buffer'
import { HeaderView } from '../../src/renderer/views/header-view'
import { InputBarView } from '../../src/renderer/views/input-bar-view'
import { MessageListView } from '../../src/renderer/views/message-list-view'

describe('Interactive Differential TUI Views (Renderer)', () => {
    describe('HeaderView', () => {
        it('renders brand title, cli version, and active model', () => {
            const buffer = new ScreenBuffer(60, 2)
            HeaderView.render(buffer, {
                x: 0,
                y: 0,
                width: 60,
                cliVersion: '0.4.15',
                modelLabel: 'Claude 3.7 Sonnet',
                authMethod: 'subscription',
                contextTokens: 1420,
            })

            const line0 = buffer.getLine(0)
            expect(line0).toContain('December')
            expect(line0).toContain('0.4.15')
            expect(line0).toContain('Claude 3.7 Sonnet')
            expect(line0).toContain('1420 tokens')
        })
    })

    describe('InputBarView', () => {
        it('renders placeholder when input is empty', () => {
            const buffer = new ScreenBuffer(60, 3)
            InputBarView.render(buffer, {
                x: 0,
                y: 0,
                width: 60,
                height: 3,
                input: '',
                cursorPos: 0,
                placeholder: 'Ask December anything...',
            })

            expect(buffer.getLine(0)).toContain('╭')
            expect(buffer.getLine(1)).toContain('Ask December anything...')
            expect(buffer.getLine(2)).toContain('╰')
        })

        it('renders typed user input and calculates cursor position', () => {
            const buffer = new ScreenBuffer(60, 3)
            const cursor = InputBarView.render(buffer, {
                x: 0,
                y: 0,
                width: 60,
                height: 3,
                input: 'fix the failing test',
                cursorPos: 4,
            })

            expect(buffer.getLine(1)).toContain('fix the failing test')
            expect(cursor.visible).toBe(true)
            expect(cursor.x).toBe(5) // border (1) + padding (0) + pos (4) = 5
            expect(cursor.y).toBe(1)
        })
    })

    describe('MessageListView', () => {
        it('renders messages and handles scroll offset slicing', () => {
            const buffer = new ScreenBuffer(50, 4)
            const messages = [
                { id: '1', role: 'user', content: 'hello agent' },
                { id: '2', role: 'assistant', content: 'line 1\nline 2\nline 3\nline 4\nline 5' },
            ]

            // When scrolled down to the bottom (scrollOffset = 4)
            MessageListView.render(buffer, {
                x: 0,
                y: 0,
                width: 50,
                height: 4,
                messages,
                scrollOffset: 4,
            })

            const line0 = buffer.getLine(0)
            const line1 = buffer.getLine(1)
            expect(line0).toContain('line 3')
            expect(line1).toContain('line 4')
        })

        it('displays reading mode indicator when scrolled up from bottom', () => {
            const buffer = new ScreenBuffer(50, 4)
            const messages = [
                {
                    id: '1',
                    role: 'assistant',
                    content: 'line 1\nline 2\nline 3\nline 4\nline 5\nline 6',
                },
            ]

            // Scrolled to top (scrollOffset = 0 while maxScroll > 0)
            MessageListView.render(buffer, {
                x: 0,
                y: 0,
                width: 50,
                height: 4,
                messages,
                scrollOffset: 0,
            })

            const topIndicator = buffer.getLine(0)
            expect(topIndicator).toContain('Reading mode')
        })
    })
})
