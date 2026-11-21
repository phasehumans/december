import { PassThrough, Writable } from 'node:stream'

import { describe, expect, it } from 'bun:test'

import { DifferentialApp } from '../../src/renderer/app'
import { ScreenBuffer } from '../../src/renderer/buffer'
import { sliceToWidth, stringWidth } from '../../src/renderer/cell'
import { DifferentialScreen } from '../../src/renderer/screen'
import { findScrollMove, hashRows } from '../../src/renderer/scroll'
import { TerminalController } from '../../src/renderer/terminal'
import { wrapSegments } from '../../src/renderer/views/markdown'
import { MessageLineCache } from '../../src/renderer/views/message-line-cache'

import type { MessageItem } from '../../src/renderer/views/message-list-view'

/**
 * A minimal terminal for ASCII output: cursor moves, scroll regions, scroll up, text.
 * Styles are ignored; the grid holds characters only.
 */
class TinyTerminal {
    grid: string[][]
    private x = 0
    private y = 0
    private top = 0
    private bottom: number

    constructor(
        readonly width: number,
        readonly height: number
    ) {
        this.grid = Array.from({ length: height }, () => Array(width).fill(' '))
        this.bottom = height - 1
    }

    feed(data: string): void {
        let i = 0
        while (i < data.length) {
            if (data[i] === '\x1b' && data[i + 1] === '[') {
                let j = i + 2
                while (j < data.length && !/[A-Za-z]/.test(data[j]!)) j++
                const params = data.slice(i + 2, j)
                this.csi(params, data[j]!)
                i = j + 1
                continue
            }
            if (data[i] === '\x1b' && data[i + 1] === ']') {
                const end = data.indexOf('\x07', i)
                i = end + 1
                continue
            }
            if (this.y < this.height && this.x < this.width) this.grid[this.y]![this.x] = data[i]!
            this.x++
            i++
        }
    }

    private csi(params: string, final: string): void {
        if (params.startsWith('?')) return
        const nums = params.split(';').map((n) => (n === '' ? NaN : Number(n)))
        if (final === 'H') {
            this.y = (nums[0] || 1) - 1
            this.x = (nums[1] || 1) - 1
        } else if (final === 'r') {
            this.top = Number.isNaN(nums[0]!) ? 0 : nums[0]! - 1
            this.bottom = Number.isNaN(nums[1]!) ? this.height - 1 : nums[1]! - 1
            this.x = 0
            this.y = 0
        } else if (final === 'S') {
            const n = nums[0] || 1
            for (let k = 0; k < n; k++) {
                this.grid.splice(this.top, 1)
                this.grid.splice(this.bottom, 0, Array(this.width).fill(' '))
            }
        }
    }

    lines(): string[] {
        return this.grid.map((row) => row.join(''))
    }
}

function bufferLines(buffer: ScreenBuffer): string[] {
    return Array.from({ length: buffer.height }, (_, y) => buffer.getLine(y))
}

class CaptureStdout extends Writable {
    out = ''
    columns = 40
    rows = 12
    isTTY = true
    accept = true
    override _write(chunk: Buffer | string, _enc: BufferEncoding, cb: () => void): void {
        this.out += chunk.toString()
        cb()
    }
    override write(chunk: any, ...rest: any[]): boolean {
        super.write(chunk, ...rest)
        return this.accept
    }
}

describe('scroll region moves', () => {
    it('finds a band that moved up and leaves static rows alone', () => {
        const front = new ScreenBuffer(20, 10)
        const back = new ScreenBuffer(20, 10)
        for (let y = 0; y < 8; y++) front.write(0, y, `line ${y}`)
        front.write(0, 9, 'prompt')
        for (let y = 0; y < 8; y++) back.write(0, y, `line ${y + 2}`)
        back.write(0, 9, 'prompt')

        const move = findScrollMove(front, back, hashRows(front), hashRows(back))
        expect(move).toEqual({ top: 0, bottom: 7, shift: 2 })
    })

    it('keeps the terminal showing exactly the back buffer while output scrolls', () => {
        const stdout = new CaptureStdout()
        const terminal = new TerminalController({
            stdin: new PassThrough() as any,
            stdout: stdout as any,
            handleSignals: false,
        })
        const screen = new DifferentialScreen({ terminal, width: 40, height: 12 })
        const tty = new TinyTerminal(40, 12)

        let scrolled = 0
        for (let frame = 0; frame < 30; frame++) {
            screen.backBuffer.clear()
            for (let y = 0; y < 9; y++) screen.backBuffer.write(0, y, `chat line ${frame + y}`)
            screen.backBuffer.write(0, 10, `> prompt ${frame % 3}`)
            stdout.out = ''
            screen.render()
            if (stdout.out.includes('S\x1b[r')) scrolled++
            tty.feed(stdout.out)
            expect(tty.lines()).toEqual(bufferLines(screen.backBuffer))
        }
        expect(scrolled).toBeGreaterThan(20)
    })

    it('can be turned off', () => {
        const stdout = new CaptureStdout()
        const terminal = new TerminalController({
            stdin: new PassThrough() as any,
            stdout: stdout as any,
            handleSignals: false,
        })
        const screen = new DifferentialScreen({
            terminal,
            width: 40,
            height: 12,
            scrollRegions: false,
        })
        for (let frame = 0; frame < 3; frame++) {
            screen.backBuffer.clear()
            for (let y = 0; y < 9; y++) screen.backBuffer.write(0, y, `chat line ${frame + y}`)
            stdout.out = ''
            screen.render()
            expect(stdout.out).not.toContain('S\x1b[r')
        }
    })
})

function history(turns: number): MessageItem[] {
    const messages: MessageItem[] = []
    for (let i = 0; i < turns; i++) {
        messages.push({ role: 'user', content: `question ${i}` })
        messages.push({
            role: 'tool',
            toolCall: {
                id: `r${i}`,
                name: 'read_file',
                command: `Read(src/f${i}.ts)`,
                status: 'success',
                output: 'x\n'.repeat(5),
            },
        })
        messages.push({ role: 'assistant', content: `answer ${i}\n\n- a **point**\n- another` })
    }
    return messages
}

describe('virtualized history layout', () => {
    it('lays out only the newest turns for the bottom view, then finishes the rest', () => {
        const messages = history(200)
        const cache = new MessageLineCache()
        const tail = cache.getLineSegments(messages, 80, { tailLines: 30 })
        expect(cache.isComplete()).toBe(false)
        const tailCount = tail.reduce((n, s) => n + s.length, 0)
        expect(tailCount).toBeGreaterThanOrEqual(30)

        const full = new MessageLineCache().getLines(messages, 80)
        // The tail is the end of the full layout
        expect(([] as typeof full).concat(...tail)).toEqual(full.slice(full.length - tailCount))

        while (!cache.layoutPending(1)) {
            // Keep going in small slices, as the app does between frames
        }
        expect(cache.isComplete()).toBe(true)
        expect(cache.getLines(messages, 80)).toEqual(full)
    })

    it('reuses settled turns when a new turn starts', () => {
        const messages = history(50)
        const cache = new MessageLineCache()
        const before = cache.getLineSegments(messages, 80)
        messages.push({ role: 'user', content: 'next' })
        messages.push({ role: 'assistant', content: 'streaming', isStreaming: true })
        const after = cache.getLineSegments(messages, 80, { liveTurn: true })
        // Every earlier turn is the same cached array, not a copy
        for (let i = 0; i < before.length; i++) expect(after[i]).toBe(before[i]!)
        expect(cache.getLines(messages, 80, { liveTurn: true })).toEqual(
            new MessageLineCache().getLines(messages, 80, { liveTurn: true })
        )
    })

    it('scrolling up in the app lays out the whole history first', () => {
        const stdout = new CaptureStdout()
        stdout.columns = 80
        stdout.rows = 24
        const terminal = new TerminalController({
            stdin: new PassThrough() as any,
            stdout: stdout as any,
            handleSignals: false,
        })
        const app = new DifferentialApp({
            terminal,
            width: 80,
            height: 24,
            scheduleFrame: (cb) => cb(),
        })
        app.state.messages = history(300)
        app.start()
        app.scrollUp(1_000_000)
        // At the very top, the oldest turn is on screen
        const screen = bufferLines(app.screen.frontBuffer).join('\n')
        expect(screen).toContain('question 0')
        app.stop()
    })
})

describe('display width', () => {
    it('measures wide characters, emoji, flags and joined emoji by terminal columns', () => {
        expect(stringWidth('abc')).toBe(3)
        expect(stringWidth('日本')).toBe(4)
        expect(stringWidth('✅')).toBe(2)
        expect(stringWidth('🚀')).toBe(2)
        expect(stringWidth('🇮🇳')).toBe(2)
        expect(stringWidth('👨‍👩‍👧')).toBe(2)
        expect(stringWidth('é')).toBe(1)
    })

    it('never splits a character when cutting to a width', () => {
        expect(sliceToWidth('ab🚀cd', 3)).toBe('ab')
        expect(sliceToWidth('ab🚀cd', 4)).toBe('ab🚀')
        expect(sliceToWidth('日本語', 5)).toBe('日本')
    })

    it('wraps CJK text so no line is wider than the limit', () => {
        const text = '日本語のテキストがここにあります。'.repeat(4)
        const lines = wrapSegments([{ text, style: {} }], 20)
        for (const line of lines) {
            expect(stringWidth(line.map((s) => s.text).join(''))).toBeLessThanOrEqual(20)
        }
        expect(lines.map((l) => l.map((s) => s.text).join('')).join('')).toBe(text)
    })
})

describe('output backpressure', () => {
    it('skips frames while the terminal is blocked and paints once it drains', () => {
        const stdout = new CaptureStdout()
        const terminal = new TerminalController({
            stdin: new PassThrough() as any,
            stdout: stdout as any,
            handleSignals: false,
        })
        const frames: (() => void)[] = []
        const app = new DifferentialApp({
            terminal,
            width: 40,
            height: 12,
            scheduleFrame: (cb) => frames.push(cb),
        })
        app.start()
        while (frames.length) frames.shift()!()

        stdout.accept = false
        app.state.input = 'first'
        app.requestRender()
        frames.shift()!()
        expect(terminal.isBlocked).toBe(true)

        const before = stdout.out.length
        app.state.input = 'second'
        app.requestRender()
        frames.shift()!()
        expect(stdout.out.length).toBe(before)

        stdout.accept = true
        stdout.emit('drain')
        expect(terminal.isBlocked).toBe(false)
        frames.shift()!()
        expect(stdout.out.length).toBeGreaterThan(before)
        app.stop()
    })
})
