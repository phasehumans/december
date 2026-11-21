/**
 * Long-session renderer benchmark (E2).
 *
 * Drives the real DifferentialApp against a fake terminal and reports, for a short and
 * a long history: frame cost while text streams, frame cost during a long tool turn,
 * the first frame of a new turn, resume (cold first paint), resize, and a keystroke.
 *
 * Run: bun packages/tui/bench/long-session.bench.ts
 */
import { Writable, PassThrough } from 'node:stream'

import { DifferentialApp } from '../src/renderer/app'
import { TerminalController } from '../src/renderer/terminal'

import type { MessageItem } from '../src/renderer/views/message-list-view'

const WIDTH = 160
const HEIGHT = 48

class CountingStdout extends Writable {
    bytes = 0
    columns = WIDTH
    rows = HEIGHT
    isTTY = true
    override _write(chunk: Buffer | string, _enc: BufferEncoding, cb: () => void): void {
        this.bytes += typeof chunk === 'string' ? Buffer.byteLength(chunk) : chunk.length
        cb()
    }
}

const ANSWER =
    '## Plan\n\nHere is what I found in the **renderer** and why the `diff` grows.\n\n' +
    '- first point about the cache and its key\n- second point with `inline code`\n\n' +
    '```ts\nconst x = computeDiff(front, back)\nfor (const row of rows) paint(row)\n```\n\n' +
    'A long paragraph that wraps across the terminal width several times so that the layout has real work to do on every frame. '.repeat(
        6
    ) +
    '\n\n| col a | col b |\n| --- | --- |\n| 1 | 2 |\n| 3 | 4 |\n\nDone. 日本語のテキスト and emoji 🚀 too.\n'

function buildHistory(turns: number): MessageItem[] {
    const messages: MessageItem[] = []
    for (let i = 0; i < turns; i++) {
        messages.push({ role: 'user', content: `question number ${i} about the code` })
        messages.push({
            role: 'tool',
            toolCall: {
                id: `read-${i}`,
                name: 'read_file',
                input: { path: `src/file${i}.ts` },
                command: `Read(src/file${i}.ts)`,
                status: 'success',
                output: 'const a = 1\n'.repeat(80),
                durationMs: 12,
            },
        })
        messages.push({
            role: 'tool',
            toolCall: {
                id: `bash-${i}`,
                name: 'bash',
                input: { command: 'bun test' },
                command: 'bun test',
                status: 'success',
                output: 'ok line\n'.repeat(40),
                durationMs: 900,
            },
        })
        messages.push({ role: 'assistant', content: ANSWER })
    }
    return messages
}

function makeApp(messages: MessageItem[]) {
    const stdout = new CountingStdout()
    const terminal = new TerminalController({
        stdin: new PassThrough() as any,
        stdout: stdout as any,
        handleSignals: false,
    })
    const app = new DifferentialApp({
        terminal,
        width: WIDTH,
        height: HEIGHT,
        cliVersion: 'bench',
        // Paint synchronously so each render() call is one measured frame
        scheduleFrame: (cb) => cb(),
    })
    app.state.messages = messages
    return { app, stdout }
}

function timeIt(fn: () => void): number {
    const t = performance.now()
    fn()
    return performance.now() - t
}

function median(xs: number[]): number {
    const s = [...xs].sort((a, b) => a - b)
    return s[Math.floor(s.length / 2)] ?? 0
}

function p95(xs: number[]): number {
    const s = [...xs].sort((a, b) => a - b)
    return s[Math.min(s.length - 1, Math.floor(s.length * 0.95))] ?? 0
}

interface Row {
    scenario: string
    turns: number
    median: string
    p95: string
    bytes: string
    bytesP95: string
}

const rows: Row[] = []
const fmt = (n: number) => n.toFixed(2)

function record(scenario: string, turns: number, samples: number[], bytes?: number[]): void {
    rows.push({
        scenario,
        turns,
        median: fmt(median(samples)),
        p95: fmt(p95(samples)),
        bytes: bytes ? String(Math.round(bytes.reduce((a, b) => a + b, 0) / bytes.length)) : '',
        bytesP95: bytes ? String(Math.round(p95(bytes))) : '',
    })
}

function run(turns: number): void {
    // Resume: cold first paint of the whole history
    {
        const { app } = makeApp(buildHistory(turns))
        const samples = [timeIt(() => app.start())]
        record('resume first paint', turns, samples)
        app.stop()
    }

    const { app, stdout } = makeApp(buildHistory(turns))
    app.start()

    // Keystroke while idle
    {
        const samples: number[] = []
        for (let i = 0; i < 30; i++) samples.push(timeIt(() => app.handleKey('a')))
        for (let i = 0; i < 30; i++) app.handleKey('\x7f')
        record('keystroke (idle)', turns, samples)
    }

    // New turn: the first frame after the user message
    {
        const samples = [
            timeIt(() => {
                app.state.messages.push({ role: 'user', content: 'new question' })
                app.state.isStreaming = true
                app.requestRender()
            }),
        ]
        record('new turn first frame', turns, samples)
    }

    // Streaming text: one frame per 24-char delta
    {
        const samples: number[] = []
        const bytes: number[] = []
        for (let i = 0; i < ANSWER.length * 2; i += 24) {
            const delta = (ANSWER + ANSWER).slice(i, i + 24)
            const before = stdout.bytes
            samples.push(
                timeIt(() => {
                    app.appendStreamDelta(delta)
                    app.requestRender()
                })
            )
            bytes.push(stdout.bytes - before)
        }
        record('stream frame', turns, samples, bytes)
        app.flushStream()
    }

    // Long tool turn: 40 finished steps, then output streaming into a running command
    {
        for (let k = 0; k < 40; k++) {
            app.appendToolCall({
                id: `t-${k}`,
                name: k % 2 ? 'read_file' : 'grep_search',
                input: k % 2 ? { path: `src/x${k}.ts` } : { pattern: `foo${k}` },
                command: k % 2 ? `Read(src/x${k}.ts)` : `Search(foo${k})`,
            })
            app.updateToolResult(`t-${k}`, { output: 'found\n'.repeat(10) })
        }
        app.appendToolCall({
            id: 'run',
            name: 'bash',
            input: { command: 'bun test' },
            command: 'bun test',
        })
        const samples: number[] = []
        const bytes: number[] = []
        for (let i = 0; i < 200; i++) {
            const before = stdout.bytes
            samples.push(
                timeIt(() => {
                    app.updateToolExecution('run', `test line ${i} passed\n`)
                    app.requestRender()
                })
            )
            bytes.push(stdout.bytes - before)
        }
        record('tool output frame (40 steps)', turns, samples, bytes)
        app.updateToolResult('run', { output: 'done' })
        app.finishStream()
    }

    // Resize
    {
        const samples: number[] = []
        for (let i = 0; i < 4; i++) {
            samples.push(
                timeIt(() => {
                    app.screen.handleResize(i % 2 ? WIDTH : WIDTH - 20, HEIGHT)
                    app.requestRender()
                })
            )
        }
        record('resize', turns, samples)
    }

    app.stop()
}

for (const turns of [100, 1000]) run(turns)

console.table(rows)
// Pending throttle timers would keep the process alive
process.exit(0)
