import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { describe, expect, it } from 'bun:test'

import { MessageLineCache } from '../../src/renderer/views/message-line-cache'
import { THEME } from '../../src/theme'

import type { FormattedLine } from '../../src/renderer/views/markdown'
import type { MessageItem } from '../../src/renderer/views/message-list-view'

const textOf = (lines: FormattedLine[]) => lines.map((l) => l.map((s) => s.text).join(''))
const joined = (lines: FormattedLine[]) => textOf(lines).join('\n')
const tool = (
    id: string,
    name: string,
    input: Record<string, unknown>,
    extra: Partial<NonNullable<MessageItem['toolCall']>> = {}
): MessageItem => ({
    role: 'tool',
    toolCall: { id, name, input, status: 'success', ...extra },
})

describe('MessageLineCache', () => {
    it('formats assistant markdown and caches the result', () => {
        const cache = new MessageLineCache()
        const messages: MessageItem[] = [
            { id: 'm1', role: 'assistant', content: 'Hello **world** from assistant' },
        ]
        const lines1 = cache.getLines(messages, 80)
        expect(textOf(lines1)[0]).toContain('Hello world from assistant')
        expect(cache.getLines(messages, 80)).toBe(lines1)
    })

    it('recomputes when width changes', () => {
        const cache = new MessageLineCache()
        const messages: MessageItem[] = [
            {
                role: 'assistant',
                content:
                    'This is a long line that wraps differently across different terminal dimensions.',
            },
        ]
        const lines80 = cache.getLines(messages, 80)
        const lines40 = cache.getLines(messages, 40)
        expect(lines40).not.toBe(lines80)
        expect(lines40.length).toBeGreaterThan(lines80.length)
    })

    it('reuses settled turns while the last turn streams', () => {
        const cache = new MessageLineCache()
        const messages: MessageItem[] = [
            { role: 'user', content: 'First question' },
            { role: 'assistant', content: 'First answer' },
            { role: 'user', content: 'Second question' },
            { role: 'assistant', content: 'Chunk 1', isStreaming: true },
        ]
        const first = cache.getLineSegments(messages, 80)
        messages[3]!.content = 'Chunk 1 Chunk 2'
        const second = cache.getLineSegments(messages, 80)
        expect(second[0]).toBe(first[0])
        expect(joined(second.flat())).toContain('Chunk 1 Chunk 2')
    })

    it('hides thoughts, live or finished (L5, S2)', () => {
        const cache = new MessageLineCache()
        const text = joined(
            cache.getLines(
                [
                    { role: 'user', content: 'why?' },
                    { role: 'thinking', content: '**Session TTL source**\nLet me look.' },
                    { role: 'assistant', content: 'Because.' },
                ],
                80
            )
        )
        expect(text).not.toContain('Thought')
        expect(text).not.toContain('Session TTL source')
        expect(text).toContain('Because.')
    })

    it('merges a run of reads, lists and searches into one Explored row (S3)', () => {
        const cache = new MessageLineCache()
        const lines = cache.getLines(
            [
                tool('1', 'read_file', { path: 'src/a.ts' }),
                tool('2', 'grep_search', { query: 'SESSION_TTL' }),
                tool('3', 'list_dir', { path: 'src/auth' }),
                tool('4', 'read_file', { path: 'src/b.ts' }),
                tool('5', 'code_intelligence', { query: 'createSession' }),
                { role: 'assistant', content: 'Found it.' },
            ],
            100
        )
        const rows = textOf(lines)
        expect(rows[0]).toBe('● Explored 2 files · 2 searches · 1 directory')
        expect(lines[0]![0]!.style?.fg).toBe(THEME.colors.dim)
        expect(rows[1]).toBe('')
        expect(rows[2]).toContain('Found it.')
    })

    it('shows the current target while exploring, with a blinking dot', () => {
        const cache = new MessageLineCache()
        const messages: MessageItem[] = [
            { role: 'user', content: 'go' },
            tool('1', 'read_file', { path: 'src/a.ts' }),
            tool('2', 'read_file', { path: 'packages/shared/src/env.ts' }, { status: 'running' }),
        ]
        const on = cache.getLines(messages, 100, { liveTurn: true, now: 0 })
        const off = cache.getLines(messages, 100, { liveTurn: true, now: 600 })
        const row = textOf(on).find((l) => l.startsWith('●'))!
        expect(row).toBe('● Exploring · packages/shared/src/env.ts')
        const dotOn = on.find((l) => l[0]?.text === '● ')![0]!.style?.fg
        const dotOff = off.find((l) => l[0]?.text === '● ')![0]!.style?.fg
        expect(dotOn).toBe(THEME.colors.brand)
        expect(dotOff).toBe(THEME.colors.dim)
    })

    it('stacks step rows with no blank lines and adds one before text', () => {
        const cache = new MessageLineCache()
        const rows = textOf(
            cache.getLines(
                [
                    tool(
                        '1',
                        'bash',
                        { command: 'bun test' },
                        { output: '14 pass\n', durationMs: 2100 }
                    ),
                    tool(
                        '2',
                        'bash',
                        { command: 'bun run lint' },
                        { output: 'ok\n', durationMs: 400 }
                    ),
                    { role: 'assistant', content: 'Done.' },
                ],
                100
            )
        )
        expect(rows).toEqual([
            '● Ran bun test  2.1s',
            '    └ 14 pass',
            '● Ran bun run lint',
            '    └ ok',
            '',
            'Done.',
            '',
        ])
    })

    it('shows the live output tail with no gutter, then one result line (S7)', () => {
        const cache = new MessageLineCache()
        const messages: MessageItem[] = [
            { role: 'user', content: 'test' },
            tool(
                '1',
                'bash',
                { command: 'bun test test/session' },
                {
                    status: 'running',
                    output: 'a\n✓ one\n✓ two\n✓ three\n',
                }
            ),
        ]
        const running = textOf(cache.getLines(messages, 100, { liveTurn: true }))
        expect(running).toContain('● Running bun test test/session')
        expect(running).toContain('    ✓ three')
        expect(running.some((l) => l.includes('│'))).toBe(false)
        expect(running).not.toContain('    a')

        messages[1]!.toolCall!.status = 'success'
        messages[1]!.toolCall!.output = '✓ one\n14 pass · 0 fail\n'
        messages[1]!.toolCall!.durationMs = 2100
        const done = textOf(cache.getLines(messages, 100))
        expect(done).toContain('● Ran bun test test/session  2.1s')
        expect(done).toContain('    └ 14 pass · 0 fail')
    })

    it('marks a failed command with a red dot, the exit code and the first error (S8)', () => {
        const cache = new MessageLineCache()
        const lines = cache.getLines(
            [
                tool(
                    '1',
                    'bash',
                    { command: 'bun run typecheck' },
                    {
                        status: 'error',
                        durationMs: 4300,
                        output: 'Command failed with exit code 2:\n$ tsc --noEmit\nsrc/a.ts(42,7): error TS2322: bad\nsrc/a.ts(58,3): error TS2554: worse\nsrc/b.ts(1,1): error TS1: worst\n',
                    }
                ),
            ],
            100
        )
        const rows = textOf(lines)
        expect(rows[0]).toBe('● Ran bun run typecheck  exit 2 · 4.3s')
        expect(lines[0]![0]!.style?.fg).toBe(THEME.colors.error)
        expect(rows[1]).toBe('    └ src/a.ts(42,7): error TS2322: bad')
        expect(rows[2]).toBe('      +2 more errors')
        expect(rows.join('\n')).not.toContain('✗')
    })

    it('shows a background command as one row (S13)', () => {
        const cache = new MessageLineCache()
        const rows = textOf(
            cache.getLines(
                [
                    tool(
                        '1',
                        'bash',
                        { command: 'bun dev' },
                        {
                            output: '[Auto-Backgrounded] Task ID: t_8f2a. Command is still running in the background.',
                        }
                    ),
                ],
                100
            )
        )
        expect(rows[0]).toBe('● Ran bun dev  in background · t_8f2a · /tasks')
        expect(rows[1]).toBe('')
    })

    it('shows subagents running and done (L9, S11)', () => {
        const cache = new MessageLineCache()
        const messages: MessageItem[] = [
            { role: 'user', content: 'go' },
            tool(
                '1',
                'invoke_subagent',
                { role: 'explorer' },
                {
                    status: 'running',
                    output: '[SubAgent:explorer] Reading src/auth/session.ts',
                }
            ),
        ]
        expect(textOf(cache.getLines(messages, 100, { liveTurn: true }))).toContain(
            '● Agent explorer · Reading src/auth/session.ts'
        )

        messages[1]!.toolCall = {
            ...messages[1]!.toolCall!,
            status: 'success',
            durationMs: 8200,
            output: '(4 turns, 12 tools)\n#### Rollup Summary & Findings:\n- TTL is set in session.service.ts',
        }
        const done = textOf(cache.getLines(messages, 100))
        expect(done).toContain('● Agent explorer  4 turns · 12 tools · 8.2s')
        expect(done).toContain('    └ TTL is set in session.service.ts')
    })

    it('counts edit changes with a real line diff and merges edits to one file (S4.5)', () => {
        const cache = new MessageLineCache()
        const rows = textOf(
            cache.getLines(
                [
                    tool('1', 'edit_file', {
                        path: 'src/env.ts',
                        targetContent: 'a\nb',
                        replacementContent: 'a\nB\nc',
                    }),
                    tool('2', 'edit_file', {
                        path: 'src/env.ts',
                        targetContent: 'x',
                        replacementContent: 'x\ny',
                    }),
                ],
                100
            )
        )
        expect(rows[0]).toBe('● Edited src/env.ts  +3 -1 · 2 edits')
    })

    describe('open diff (S4)', () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'december-diff-'))
        const file = path.join(dir, 'env.ts')
        fs.writeFileSync(
            file,
            'export const env = {\n    TTL: 60,\n    IDLE: 900,\n    DB: url,\n}\n'
        )
        const edit = (id: string, extra: Partial<NonNullable<MessageItem['toolCall']>> = {}) =>
            tool(
                id,
                'edit_file',
                {
                    path: file,
                    targetContent: '    TTL: 3600,',
                    replacementContent: '    TTL: 60,\n    IDLE: 900,',
                },
                extra
            )

        it('shows the newest edit of the live turn with line numbers and context', () => {
            const cache = new MessageLineCache()
            const rows = textOf(
                cache.getLines([{ role: 'user', content: 'go' }, edit('1')], 100, {
                    liveTurn: true,
                })
            )
            const at = rows.findIndex((r) => r.startsWith('● Edited'))
            expect(rows[at + 1]).toContain('1   export const env = {')
            expect(rows[at + 2]).toContain('2 -     TTL: 3600,')
            expect(rows[at + 3]).toContain('2 +     TTL: 60,')
            expect(rows[at + 4]).toContain('3 +     IDLE: 900,')
            expect(rows[at + 5]).toContain('4       DB: url,')
        })

        it('closes it when the next tool starts', () => {
            const cache = new MessageLineCache()
            const rows = textOf(
                cache.getLines(
                    [
                        { role: 'user', content: 'go' },
                        edit('1'),
                        tool('2', 'bash', { command: 'bun test' }, { status: 'running' }),
                    ],
                    100,
                    { liveTurn: true }
                )
            )
            expect(rows.some((r) => r.includes('TTL: 3600'))).toBe(false)
        })

        it('keeps only the newest of several edits open', () => {
            const cache = new MessageLineCache()
            const rows = textOf(
                cache.getLines(
                    [
                        { role: 'user', content: 'go' },
                        tool('0', 'edit_file', {
                            path: 'src/other.ts',
                            targetContent: 'old',
                            replacementContent: 'new',
                        }),
                        edit('1'),
                    ],
                    100,
                    { liveTurn: true }
                )
            )
            expect(rows.some((r) => r.includes('- old'))).toBe(false)
            expect(rows.some((r) => r.includes('TTL: 60'))).toBe(true)
        })

        it('shows no diff after the turn ends or when the prompt already showed it', () => {
            const settled = textOf(
                new MessageLineCache().getLines([{ role: 'user', content: 'go' }, edit('1')], 100)
            )
            expect(settled.some((r) => r.includes('TTL: 60'))).toBe(false)
            const previewed = textOf(
                new MessageLineCache().getLines([{ role: 'user', content: 'go' }, edit('1')], 100, {
                    liveTurn: true,
                    previewedPaths: new Set([file]),
                })
            )
            expect(previewed.some((r) => r.includes('TTL: 60'))).toBe(false)
        })

        it('cuts a long diff at 12 rows with a pointer to /diff', () => {
            const cache = new MessageLineCache()
            const big = Array.from({ length: 30 }, (_, i) => `line ${i}`).join('\n')
            const rows = textOf(
                cache.getLines(
                    [
                        { role: 'user', content: 'go' },
                        tool('1', 'edit_file', {
                            path: 'nope.ts',
                            targetContent: '',
                            replacementContent: big,
                        }),
                    ],
                    100,
                    { liveTurn: true }
                )
            )
            expect(rows.filter((r) => r.includes('+ line')).length).toBe(12)
            expect(rows).toContain('         … 18 more lines · /diff')
        })
    })

    it('shows a new file with its first 8 lines while open (S6)', () => {
        const cache = new MessageLineCache()
        const content = Array.from({ length: 24 }, (_, i) => `row ${i}`).join('\n')
        const rows = textOf(
            cache.getLines(
                [
                    { role: 'user', content: 'go' },
                    tool('1', 'write_file', { path: 'src/x.ts', content }),
                ],
                100,
                {
                    liveTurn: true,
                }
            )
        )
        expect(rows).toContain('● Created src/x.ts  24 lines')
        expect(rows.filter((r) => r.includes('+ row')).length).toBe(8)
        expect(rows).toContain('         … 16 more lines · /diff')
    })

    it('labels a failed edit with a red dot and the reason', () => {
        const cache = new MessageLineCache()
        const lines = cache.getLines(
            [
                tool(
                    '1',
                    'edit_file',
                    { path: 'src/auth.ts' },
                    { status: 'error', output: 'Failed to edit file: target text not found' }
                ),
            ],
            100
        )
        expect(textOf(lines).slice(0, 2)).toEqual([
            '● Edit src/auth.ts',
            '    └ target text not found',
        ])
        expect(lines[0]![0]!.style?.fg).toBe(THEME.colors.error)
    })

    it('hides update_plan calls from the chat (L19)', () => {
        const cache = new MessageLineCache()
        const text = joined(
            cache.getLines(
                [
                    tool('1', 'update_plan', { items: [{ text: 'a', status: 'pending' }] }),
                    { role: 'assistant', content: 'ok' },
                ],
                100
            )
        )
        expect(text).not.toContain('update_plan')
        expect(text).toContain('ok')
    })

    it('folds earlier steps of a long live turn, keeping the last 12 (S12)', () => {
        const cache = new MessageLineCache()
        const messages: MessageItem[] = [
            { role: 'user', content: 'migrate' },
            { role: 'assistant', content: 'I will migrate.' },
        ]
        for (let i = 0; i < 30; i++) {
            messages.push(tool(`b${i}`, 'bash', { command: `step ${i}` }, { output: 'ok' }))
            messages.push({ role: 'assistant', content: `note ${i}` })
        }
        const rows = textOf(cache.getLines(messages, 100, { liveTurn: true }))
        expect(rows).toContain('● 18 earlier steps · 18 commands')
        expect(rows.filter((r) => r.startsWith('● Ran')).length).toBe(12)
        expect(rows[2]).toContain('I will migrate.')

        // A finished turn keeps every step
        const settled = textOf(new MessageLineCache().getLines(messages, 100))
        expect(settled.filter((r) => r.startsWith('● Ran')).length).toBe(30)
    })

    it('shows the step an approval prompt asks about as a yellow pending row (L10)', () => {
        const cache = new MessageLineCache()
        const lines = cache.getLines(
            [
                { role: 'user', content: 'clean' },
                tool(
                    '1',
                    'bash',
                    { command: 'rm -rf dist && bun run build' },
                    { status: 'running' }
                ),
            ],
            100,
            { liveTurn: true, awaitingApproval: true }
        )
        const row = lines.find((l) => l[0]?.text === '● ')!
        expect(row.map((s) => s.text).join('')).toBe('● Run rm -rf dist && bun run build')
        expect(row[0]!.style?.fg).toBe(THEME.colors.warning)
    })

    it('renders a one-line compaction marker (S15)', () => {
        const cache = new MessageLineCache()
        const lines = cache.getLines(
            [
                {
                    role: 'compaction',
                    content: 'Conversation compacted automatically · ~182.0k → ~24.0k tokens',
                },
            ],
            100
        )
        expect(textOf(lines)).toEqual(['⟳ Context compacted · 182k → 24k tokens', ''])
        expect(lines[0]![0]!.style?.fg).toBe(THEME.colors.dim)
    })

    it('attaches the interrupt notice under the last step (L15, S27)', () => {
        const cache = new MessageLineCache()
        const rows = textOf(
            cache.getLines(
                [
                    tool('1', 'edit_file', {
                        path: 'src/a.ts',
                        targetContent: 'a',
                        replacementContent: 'b',
                    }),
                    {
                        role: 'assistant',
                        content: 'Interrupted · What should December do instead?',
                    },
                ],
                100
            )
        )
        expect(rows.slice(0, 2)).toEqual([
            '● Edited src/a.ts  +1 -1',
            '    └ Interrupted · tell December what to do instead',
        ])
    })

    it('renders the end-of-turn summary line (L16)', () => {
        const cache = new MessageLineCache()
        const lines = cache.getLines(
            [
                {
                    role: 'turn_summary',
                    summary: {
                        durationMs: 72_000,
                        outputTokens: 8400,
                        files: [
                            { path: 'a.ts', added: 2, removed: 1 },
                            { path: 'b.ts', added: 2, removed: 0 },
                        ],
                    },
                },
            ],
            100
        )
        expect(textOf(lines)[0]).toBe(
            '✱ Worked for 1m 12s · 8.4k tokens · 2 files changed +4 -1 · /diff'
        )
    })

    it('shows the time and the changes for a quick turn that edited files', () => {
        const lines = new MessageLineCache().getLines(
            [
                {
                    role: 'turn_summary',
                    summary: { durationMs: 3000, files: [{ path: 'a.ts', added: 1, removed: 0 }] },
                },
            ],
            100
        )
        expect(textOf(lines)[0]).toBe('✱ Worked for 3s · 1 file changed +1 · /diff')
    })

    it('shows provider errors with a red dot and no bold (S16)', () => {
        const cache = new MessageLineCache()
        const lines = cache.getLines(
            [
                {
                    role: 'error',
                    content:
                        '402 Insufficient credits in December Wallet. Please add credits at https://app.trydecember.com/settings/billing',
                    cause: '402 Payment Required: zero balance',
                } as any,
            ],
            100
        )
        const text = joined(lines)
        expect(text).toContain('● ')
        expect(text).toContain('Insufficient credits in December Wallet.')
        expect(text).toContain('402 Payment Required: zero balance')
        expect(text).not.toContain('Error:')
        expect(text).not.toContain('✗')
        expect(lines.every((l) => l.every((s) => !s.style?.bold))).toBe(true)
    })

    it('shows web search, fetch and MCP calls as one row each (S17, S18)', () => {
        const cache = new MessageLineCache()
        const rows = textOf(
            cache.getLines(
                [
                    tool(
                        '1',
                        'search_web',
                        { query: 'bun 1.2 release notes' },
                        {
                            durationMs: 1200,
                            output: 'Search Results for "x":\n\n1. A\n   URL: a\n\n2. B\n   URL: b\n',
                        }
                    ),
                    tool(
                        '2',
                        'fetch',
                        { url: 'https://bun.sh/blog/bun-v1.2' },
                        { output: 'x'.repeat(43_000) }
                    ),
                    tool(
                        '3',
                        'github__create_issue',
                        { title: 'Session TTL ignores env' },
                        { durationMs: 900, output: 'acme/api#482 opened' }
                    ),
                ],
                100
            )
        )
        expect(rows[0]).toBe('● Searched web "bun 1.2 release notes"  2 results · 1.2s')
        expect(rows[1]).toBe('● Fetched bun.sh/blog/bun-v1.2  42 KB')
        expect(rows[2]).toBe('● github · create issue "Session TTL ignores env"')
        expect(rows[3]).toBe('    └ acme/api#482 opened')
    })
})
