import { describe, expect, it } from 'bun:test'

import {
    areCellsEqual,
    computeDiff,
    computeSgrTransition,
    createCell,
    DifferentialScreen,
    getCharWidth,
    ScreenBuffer,
    TerminalController,
} from '../../src/renderer'

describe('Differential 2D Screen Buffer Engine', () => {
    describe('Cell & Style Utilities', () => {
        it('calculates character display widths correctly', () => {
            expect(getCharWidth('A')).toBe(1)
            expect(getCharWidth(' ')).toBe(1)
            expect(getCharWidth('~')).toBe(1)
            expect(getCharWidth('')).toBe(0)
            expect(getCharWidth('\x1b')).toBe(0)

            // Fullwidth & CJK
            expect(getCharWidth('你')).toBe(2)
            expect(getCharWidth('好')).toBe(2)
            expect(getCharWidth('한')).toBe(2)

            // Emoji
            expect(getCharWidth('🔥')).toBe(2)
            expect(getCharWidth('🚀')).toBe(2)
        })

        it('correctly tests cell equality', () => {
            const c1 = createCell('A', { bold: true, fg: 'red' })
            const c2 = createCell('A', { bold: true, fg: 'red' })
            const c3 = createCell('A', { bold: false, fg: 'red' })
            const c4 = createCell('B', { bold: true, fg: 'red' })

            expect(areCellsEqual(c1, c2)).toBe(true)
            expect(areCellsEqual(c1, c3)).toBe(false)
            expect(areCellsEqual(c1, c4)).toBe(false)
        })

        it('computes minimal SGR transitions between styles', () => {
            // No change
            expect(computeSgrTransition({ bold: true }, { bold: true })).toBe('')

            // Enabling bold
            expect(computeSgrTransition({}, { bold: true })).toBe('\x1b[1m')

            // Changing foreground color
            expect(computeSgrTransition({ fg: 'red' }, { fg: 'green' })).toBe('\x1b[32m')

            // Enabling bold while keeping color
            expect(computeSgrTransition({ fg: 'red' }, { fg: 'red', bold: true })).toBe('\x1b[1m')

            // Transitioning back to unstyled
            expect(computeSgrTransition({ bold: true, fg: 'red' }, {})).toBe('\x1b[0m')
        })
    })

    describe('ScreenBuffer', () => {
        it('allocates grid and fills with blank cells', () => {
            const buffer = new ScreenBuffer(10, 5)
            expect(buffer.width).toBe(10)
            expect(buffer.height).toBe(5)

            for (let y = 0; y < 5; y++) {
                for (let x = 0; x < 10; x++) {
                    const cell = buffer.get(x, y)
                    expect(cell).toBeDefined()
                    expect(cell?.char).toBe(' ')
                }
            }
        })

        it('writes plain text and wraps at boundary', () => {
            const buffer = new ScreenBuffer(10, 3)
            buffer.write(0, 0, 'Hello')

            expect(buffer.get(0, 0)?.char).toBe('H')
            expect(buffer.get(1, 0)?.char).toBe('e')
            expect(buffer.get(2, 0)?.char).toBe('l')
            expect(buffer.get(3, 0)?.char).toBe('l')
            expect(buffer.get(4, 0)?.char).toBe('o')
            expect(buffer.get(5, 0)?.char).toBe(' ')

            expect(buffer.getLine(0)).toBe('Hello     ')
        })

        it('writes text across newlines', () => {
            const buffer = new ScreenBuffer(10, 3)
            buffer.write(0, 0, 'Line1\nLine2')

            expect(buffer.getLine(0)).toBe('Line1     ')
            expect(buffer.getLine(1)).toBe('Line2     ')
        })

        it('writes wide CJK characters and allocates continuation cells', () => {
            const buffer = new ScreenBuffer(10, 2)
            buffer.write(0, 0, '你好')

            const cell0 = buffer.get(0, 0)
            const cell1 = buffer.get(1, 0)
            const cell2 = buffer.get(2, 0)
            const cell3 = buffer.get(3, 0)

            expect(cell0?.char).toBe('你')
            expect(cell0?.width).toBe(2)

            expect(cell1?.char).toBe('')
            expect(cell1?.width).toBe(0)

            expect(cell2?.char).toBe('好')
            expect(cell2?.width).toBe(2)

            expect(cell3?.char).toBe('')
            expect(cell3?.width).toBe(0)
        })

        it('resizes buffer while preserving existing cells', () => {
            const buffer = new ScreenBuffer(4, 2)
            buffer.write(0, 0, 'ABCD\nEFGH')

            const resized = buffer.resize(6, 3)
            expect(resized.width).toBe(6)
            expect(resized.height).toBe(3)

            expect(resized.get(0, 0)?.char).toBe('A')
            expect(resized.get(3, 0)?.char).toBe('D')
            expect(resized.get(4, 0)?.char).toBe(' ')
            expect(resized.get(0, 1)?.char).toBe('E')
            expect(resized.get(3, 1)?.char).toBe('H')
            expect(resized.get(0, 2)?.char).toBe(' ')
        })

        it('copies cells cleanly from another buffer', () => {
            const src = new ScreenBuffer(5, 2)
            src.write(0, 0, 'Hello')

            const dst = new ScreenBuffer(5, 2)
            dst.copyFrom(src)

            expect(dst.getLine(0)).toBe('Hello')
        })
    })

    describe('Differential Diff Engine (computeDiff)', () => {
        it('returns empty string when front and back buffers are identical', () => {
            const front = new ScreenBuffer(10, 5)
            const back = new ScreenBuffer(10, 5)

            const delta = computeDiff(front, back)
            expect(delta).toBe('')
        })

        it('emits exact minimal jump and character for a single modified cell', () => {
            const front = new ScreenBuffer(10, 5)
            const back = new ScreenBuffer(10, 5)

            // Modify cell at x=2, y=1 (ANSI 1-indexed row 2, col 3)
            back.setChar(2, 1, 'X')

            const delta = computeDiff(front, back)
            // Cursor jump to row 2, col 3: \x1b[2;3H, followed by 'X'
            expect(delta).toBe('\x1b[2;3HX')
        })

        it('emits a single cursor jump sequence for a contiguous run of modified cells', () => {
            const front = new ScreenBuffer(10, 5)
            const back = new ScreenBuffer(10, 5)

            // Modify cells at (2, 1), (3, 1), (4, 1)
            back.setChar(2, 1, 'A')
            back.setChar(3, 1, 'B')
            back.setChar(4, 1, 'C')

            const delta = computeDiff(front, back)
            // Exactly one cursor positioning escape sequence followed by continuous text
            expect(delta).toBe('\x1b[2;3HABC')
        })

        it('emits separate cursor jumps across non-contiguous gaps on the same row', () => {
            const front = new ScreenBuffer(10, 5)
            const back = new ScreenBuffer(10, 5)

            // Cell at (1, 0) and cell at (5, 0)
            back.setChar(1, 0, '1')
            back.setChar(5, 0, '2')

            const delta = computeDiff(front, back)
            expect(delta).toBe('\x1b[1;2H1\x1b[1;6H2')
        })

        it('completely skips unmodified rows', () => {
            const front = new ScreenBuffer(10, 5)
            const back = new ScreenBuffer(10, 5)

            // Row 0 and Row 3 modified, rows 1, 2, 4 left untouched
            back.setChar(0, 0, 'T')
            back.setChar(0, 3, 'B')

            const delta = computeDiff(front, back)
            expect(delta).toBe('\x1b[1;1HT\x1b[4;1HB')
        })

        it('emits minimal SGR sequence and resets styling only at the end of active frame', () => {
            const front = new ScreenBuffer(10, 2)
            const back = new ScreenBuffer(10, 2)

            back.setChar(0, 0, 'R', { fg: 'red' })
            back.setChar(1, 0, 'G', { fg: 'green' })

            const delta = computeDiff(front, back)
            // Starts at (1, 1), sets red (31), writes 'R', sets green (32), writes 'G', resets (0)
            expect(delta).toBe('\x1b[1;1H\x1b[31mR\x1b[32mG\x1b[0m')
        })

        it('handles 24-bit RGB Truecolor and 256 color codes', () => {
            const front = new ScreenBuffer(5, 1)
            const back = new ScreenBuffer(5, 1)

            back.setChar(0, 0, 'H', { fg: '#ff0000' })
            back.setChar(1, 0, '2', { bg: 208 })

            const delta = computeDiff(front, back)
            expect(delta).toContain('38;2;255;0;0')
            expect(delta).toContain('48;5;208')
            expect(delta.endsWith('\x1b[0m')).toBe(true)
        })

        it('skips wide character continuation cells without emitting double characters', () => {
            const front = new ScreenBuffer(10, 2)
            const back = new ScreenBuffer(10, 2)

            back.write(0, 0, '你好')

            const delta = computeDiff(front, back)
            // Emits jump and characters: \x1b[1;1H你好
            expect(delta).toBe('\x1b[1;1H你好')
        })

        it('wraps output in synchronized update sequences when requested', () => {
            const front = new ScreenBuffer(5, 2)
            const back = new ScreenBuffer(5, 2)
            back.setChar(0, 0, 'X')

            const delta = computeDiff(front, back, { synchronized: true })
            expect(delta.startsWith('\x1b[?2025h')).toBe(true)
            expect(delta.endsWith('\x1b[?2025l')).toBe(true)
            expect(delta).toContain('\x1b[1;1HX')
        })

        it('does not emit synchronized wrapper when diff is completely empty', () => {
            const front = new ScreenBuffer(5, 2)
            const back = new ScreenBuffer(5, 2)

            const delta = computeDiff(front, back, { synchronized: true })
            expect(delta).toBe('')
        })

        it('positions cursor and toggles visibility at end of frame', () => {
            const front = new ScreenBuffer(10, 5)
            const back = new ScreenBuffer(10, 5)

            const delta = computeDiff(front, back, {
                cursor: { x: 3, y: 2, visible: true },
            })

            // row 3, col 4, show cursor
            expect(delta).toBe('\x1b[3;4H\x1b[?25h')
        })

        it('forces full redraw of all cells when forceFullRedraw is true', () => {
            const front = new ScreenBuffer(2, 2)
            const back = new ScreenBuffer(2, 2)
            front.write(0, 0, '12\n34')
            back.write(0, 0, '12\n34')

            const normalDelta = computeDiff(front, back)
            expect(normalDelta).toBe('')

            const forcedDelta = computeDiff(front, back, { forceFullRedraw: true })
            expect(forcedDelta).toBe('\x1b[1;1H12\x1b[2;1H34')
        })
    })

    describe('TerminalController & Lifecycle Cleanup', () => {
        function createMockTerminal() {
            let written = ''
            const mockStdout = {
                columns: 80,
                rows: 24,
                write: (chunk: string) => {
                    written += chunk
                    return true
                },
            } as unknown as NodeJS.WriteStream

            let rawMode = false
            const mockStdin = {
                setRawMode: (val: boolean) => {
                    rawMode = val
                },
                resume: () => {},
                pause: () => {},
            } as unknown as NodeJS.ReadStream

            const controller = new TerminalController({
                stdout: mockStdout,
                stdin: mockStdin,
                handleSignals: false,
            })

            return {
                controller,
                getWritten: () => written,
                clearWritten: () => {
                    written = ''
                },
                isRaw: () => rawMode,
            }
        }

        it('enters and exits alternate screen buffer', () => {
            const { controller, getWritten, clearWritten } = createMockTerminal()

            controller.enterAlternateScreen()
            expect(getWritten()).toBe('\x1b[?1049h')

            clearWritten()
            controller.exitAlternateScreen()
            expect(getWritten()).toBe('\x1b[?1049l')
        })

        it('hides and shows cursor', () => {
            const { controller, getWritten, clearWritten } = createMockTerminal()

            controller.hideCursor()
            expect(getWritten()).toBe('\x1b[?25l')

            clearWritten()
            controller.showCursor()
            expect(getWritten()).toBe('\x1b[?25h')
        })

        it('toggles raw mode on stdin', () => {
            const { controller, isRaw } = createMockTerminal()

            controller.enableRawMode()
            expect(isRaw()).toBe(true)

            controller.disableRawMode()
            expect(isRaw()).toBe(false)
        })

        it('performs complete terminal cleanup restoring cursor, alternate screen, and raw mode', () => {
            const { controller, getWritten, clearWritten, isRaw } = createMockTerminal()

            controller.enterAlternateScreen()
            controller.hideCursor()
            controller.enableRawMode()
            clearWritten()

            controller.cleanup()

            const cleanupOutput = getWritten()
            expect(cleanupOutput).toContain('\x1b[0m') // Reset styling
            expect(cleanupOutput).toContain('\x1b[?25h') // Show cursor
            expect(cleanupOutput).toContain('\x1b[?1049l') // Exit alternate screen
            expect(isRaw()).toBe(false) // Raw mode disabled

            // Ensure cleanup is idempotent and does not emit duplicate escape codes
            clearWritten()
            controller.cleanup()
            expect(getWritten()).toBe('')
        })

        it('notifies registered resize listeners', () => {
            const { controller } = createMockTerminal()
            let notifiedCols = 0
            let notifiedRows = 0

            controller.onResize((cols, rows) => {
                notifiedCols = cols
                notifiedRows = rows
            })

            // Trigger internal resize handler
            ;(controller as unknown as { handleSigwinch: () => void }).handleSigwinch()

            expect(notifiedCols).toBe(80)
            expect(notifiedRows).toBe(24)
        })
    })

    describe('DifferentialScreen Integration', () => {
        function createMockScreen(width = 10, height = 4) {
            let written = ''
            const mockStdout = {
                columns: width,
                rows: height,
                write: (chunk: string) => {
                    written += chunk
                    return true
                },
            } as unknown as NodeJS.WriteStream

            let rawMode = false
            const mockStdin = {
                setRawMode: (val: boolean) => {
                    rawMode = val
                },
                resume: () => {},
                pause: () => {},
            } as unknown as NodeJS.ReadStream

            const terminal = new TerminalController({
                stdout: mockStdout,
                stdin: mockStdin,
                handleSignals: false,
            })

            const screen = new DifferentialScreen({
                terminal,
                width,
                height,
                synchronized: false,
            })

            return {
                screen,
                getWritten: () => written,
                clearWritten: () => {
                    written = ''
                },
                isRaw: () => rawMode,
            }
        }

        it('renders initial frame and computes subsequent minimal diffs', () => {
            const { screen, getWritten, clearWritten } = createMockScreen(6, 2)

            screen.write(0, 0, 'Hi')
            const delta1 = screen.render()

            expect(delta1).toContain('\x1b[1;1HHi')
            expect(getWritten()).toBe(delta1)

            // Second render with no changes produces zero writes
            clearWritten()
            const delta2 = screen.render()
            expect(delta2).toBe('')
            expect(getWritten()).toBe('')

            // Third render with minor change produces minimal diff only
            clearWritten()
            screen.write(0, 1, 'OK')
            const delta3 = screen.render()
            expect(delta3).toBe('\x1b[2;1HOK')
            expect(getWritten()).toBe('\x1b[2;1HOK')
        })

        it('handles window resize and triggers full redraw on next frame without corruption', () => {
            const { screen, clearWritten } = createMockScreen(6, 2)

            screen.write(0, 0, 'ABC')
            screen.render()
            clearWritten()

            let resizeEventCols = 0
            let resizeEventRows = 0
            screen.onResize((cols, rows) => {
                resizeEventCols = cols
                resizeEventRows = rows
            })

            // Window resizes from 6x2 to 8x3
            screen.handleResize(8, 3)

            expect(screen.columns).toBe(8)
            expect(screen.rows).toBe(3)
            expect(resizeEventCols).toBe(8)
            expect(resizeEventRows).toBe(3)

            // Redraw after resize must emit all cells (full redraw)
            const redrawDelta = screen.render()
            expect(redrawDelta).toContain('\x1b[1;1HABC')
        })

        it('manages start and stop lifecycle cleanly', () => {
            const { screen, isRaw } = createMockScreen()

            screen.start()
            expect(isRaw()).toBe(true)

            screen.stop()
            expect(isRaw()).toBe(false)
        })
    })
})
