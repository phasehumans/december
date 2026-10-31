import { describe, expect, it } from 'bun:test'

import { ScreenBuffer } from '../../src/renderer/buffer'
import { Box, Text, drawBox, drawDivider, drawText } from '../../src/renderer/ui'

describe('2D UI Primitives & Layout (Renderer)', () => {
    describe('drawBox', () => {
        it('renders rounded border box onto ScreenBuffer correctly', () => {
            const buffer = new ScreenBuffer(10, 4)
            drawBox(buffer, {
                x: 0,
                y: 0,
                width: 10,
                height: 4,
                borderStyle: 'rounded',
            })

            // Top line: ╭────────╮
            expect(buffer.getLine(0)).toBe('╭────────╮')
            // Middle lines: │        │
            expect(buffer.getLine(1)).toBe('│        │')
            expect(buffer.getLine(2)).toBe('│        │')
            // Bottom line: ╰────────╯
            expect(buffer.getLine(3)).toBe('╰────────╯')
        })

        it('renders single border box onto ScreenBuffer correctly', () => {
            const buffer = new ScreenBuffer(6, 3)
            drawBox(buffer, {
                x: 0,
                y: 0,
                width: 6,
                height: 3,
                borderStyle: 'single',
            })

            expect(buffer.getLine(0)).toBe('┌────┐')
            expect(buffer.getLine(1)).toBe('│    │')
            expect(buffer.getLine(2)).toBe('└────┘')
        })

        it('renders title inside the top border', () => {
            const buffer = new ScreenBuffer(16, 3)
            drawBox(buffer, {
                x: 0,
                y: 0,
                width: 16,
                height: 3,
                borderStyle: 'rounded',
                title: 'december',
            })

            expect(buffer.getLine(0)).toBe('╭─ december ───╮')
        })

        it('applies styling and colors to borders and title', () => {
            const buffer = new ScreenBuffer(8, 3)
            drawBox(buffer, {
                x: 0,
                y: 0,
                width: 8,
                height: 3,
                borderColor: '#333333',
                title: 'hi',
                titleColor: '#89B4F8',
            })

            const cornerCell = buffer.get(0, 0)
            expect(cornerCell?.char).toBe('╭')
            expect(cornerCell?.fg).toBe('#333333')

            const titleCell = buffer.get(3, 0)
            expect(titleCell?.char).toBe('h')
            expect(titleCell?.fg).toBe('#89B4F8')
        })
    })

    describe('drawText', () => {
        it('writes text string at specified coordinates with styling', () => {
            const buffer = new ScreenBuffer(20, 3)
            drawText(buffer, 'hello terminal', {
                x: 2,
                y: 1,
                style: { fg: '#6EE7B7', bold: true },
            })

            expect(buffer.getLine(1)).toBe('  hello terminal    ')
            const cell = buffer.get(2, 1)
            expect(cell?.char).toBe('h')
            expect(cell?.fg).toBe('#6EE7B7')
            expect(cell?.bold).toBe(true)
        })

        it('wraps long text across multiple lines when wrap is enabled', () => {
            const buffer = new ScreenBuffer(10, 4)
            drawText(buffer, 'one two three four', {
                x: 0,
                y: 0,
                maxWidth: 10,
                wrap: true,
            })

            expect(buffer.getLine(0)).toBe('one two   ')
            expect(buffer.getLine(1)).toBe('three four')
        })

        it('truncates text with ellipsis when maxWidth is exceeded and wrap is false', () => {
            const buffer = new ScreenBuffer(10, 2)
            drawText(buffer, 'supercalifragilistic', {
                x: 0,
                y: 0,
                maxWidth: 8,
                wrap: false,
                ellipsis: true,
            })

            expect(buffer.getLine(0).trim()).toBe('superca…')
        })
    })

    describe('drawDivider', () => {
        it('draws horizontal divider line across the buffer', () => {
            const buffer = new ScreenBuffer(10, 3)
            drawDivider(buffer, {
                x: 0,
                y: 1,
                width: 10,
                char: '─',
                style: { fg: '#444444' },
            })

            expect(buffer.getLine(1)).toBe('──────────')
            expect(buffer.get(0, 1)?.fg).toBe('#444444')
        })
    })

    describe('Declarative Box and Text primitives', () => {
        it('renders nested Box and Text components cleanly into ScreenBuffer', () => {
            const buffer = new ScreenBuffer(20, 5)

            const component = Box(
                {
                    x: 0,
                    y: 0,
                    width: 20,
                    height: 5,
                    borderStyle: 'rounded',
                    padding: { left: 1 },
                },
                [
                    Text('hello world', { color: '#89B4F8', bold: true }),
                    Text('subtext', { color: '#AAAAAA' }),
                ]
            )

            component.render(buffer)

            expect(buffer.getLine(0)).toBe('╭──────────────────╮')
            expect(buffer.getLine(1)).toBe('│ hello world      │')
            expect(buffer.getLine(2)).toBe('│ subtext          │')
            expect(buffer.getLine(4)).toBe('╰──────────────────╯')
        })
    })
})
