import { describe, expect, it } from 'bun:test'

import { MessageLineCache } from '../../src/renderer/views/message-line-cache'
import { THEME } from '../../src/theme'

import type { MessageItem } from '../../src/renderer/views/message-list-view'

describe('MessageLineCache', () => {
    it('formats assistant markdown and caches the result', () => {
        const cache = new MessageLineCache()
        const messages: MessageItem[] = [
            {
                id: 'm1',
                role: 'assistant',
                content: 'Hello **world** from assistant',
            },
        ]

        const lines1 = cache.getLines(messages, 80)
        expect(lines1.length).toBeGreaterThan(0)
        expect(lines1[0]!.map((s) => s.text).join('')).toContain('Hello world from assistant')

        // Second call with same reference should return cached lines
        const lines2 = cache.getLines(messages, 80)
        expect(lines2).toBe(lines1)
    })

    it('recomputes when width changes', () => {
        const cache = new MessageLineCache()
        const messages: MessageItem[] = [
            {
                id: 'm1',
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

    it('recomputes when message content changes but keeps unchanged messages cached', () => {
        const cache = new MessageLineCache()
        const messages: MessageItem[] = [
            {
                id: 'm1',
                role: 'user',
                content: 'First question',
            },
            {
                id: 'm2',
                role: 'assistant',
                content: 'Chunk 1',
                isStreaming: true,
            },
        ]

        const firstResult = cache.getLines(messages, 80)
        const m1LinesFirst = cache.getMessageLines(messages[0]!, 80)

        // Simulate streaming next token into m2
        messages[1]!.content = 'Chunk 1 Chunk 2'
        const secondResult = cache.getLines(messages, 80)
        const m1LinesSecond = cache.getMessageLines(messages[0]!, 80)

        // m1 was not modified, so its cached lines are strictly preserved
        expect(m1LinesSecond).toBe(m1LinesFirst)
        expect(secondResult[0]).toBe(firstResult[0])
        expect(secondResult.map((l) => l.map((s) => s.text).join('')).join('\n')).toContain(
            'Chunk 1 Chunk 2'
        )
    })

    it('formats tool calls cleanly and caches successful executions', () => {
        const cache = new MessageLineCache()
        const messages: MessageItem[] = [
            {
                id: 't1',
                role: 'tool',
                toolCall: {
                    id: 'c1',
                    name: 'readFile',
                    command: 'readFile(src/index.ts)',
                    status: 'success',
                },
            },
        ]

        const lines = cache.getLines(messages, 80)
        expect(lines.length).toBeGreaterThan(0)
        expect(lines[0]!.map((s) => s.text).join('')).toContain('readFile(src/index.ts)')
    })

    it('consolidates consecutive read tool calls when collapsed and expands with details', () => {
        const cache = new MessageLineCache()
        const messages: MessageItem[] = [
            {
                role: 'tool',
                toolCall: {
                    id: 'r1',
                    name: 'read_file',
                    command: 'Read(src/a.ts)',
                    input: { path: 'src/a.ts' },
                    status: 'success',
                    durationMs: 40,
                },
            },
            {
                role: 'tool',
                toolCall: {
                    id: 'r2',
                    name: 'read_file',
                    command: 'Read(src/b.ts)',
                    input: { path: 'src/b.ts' },
                    status: 'success',
                    durationMs: 60,
                },
            },
            {
                role: 'tool',
                toolCall: {
                    id: 'r3',
                    name: 'read_file',
                    command: 'Read(src/c.ts)',
                    input: { path: 'src/c.ts' },
                    status: 'success',
                    durationMs: 50,
                },
            },
        ]

        // Collapsed rendering: single consolidated line with +1 more and total duration
        const collapsedLines = cache.getLines(messages, 100, { expandTools: false })
        const collapsedText = collapsedLines.map((l) => l.map((s) => s.text).join('')).join('\n')
        expect(collapsedText).toContain('Read(src/a.ts, src/b.ts, +1 more)')
        expect(collapsedText).toContain('(150ms)')

        // Expanded rendering: header line + indented child file lines
        const expandedLines = cache.getLines(messages, 100, { expandTools: true })
        const expandedText = expandedLines.map((l) => l.map((s) => s.text).join('')).join('\n')
        expect(expandedText).toContain('Read(3 files)')
        expect(expandedText).toContain('ctrl+o to collapse')
        expect(expandedText).toContain('src/a.ts')
        expect(expandedText).toContain('(40ms)')
        expect(expandedText).toContain('src/b.ts')
        expect(expandedText).toContain('(60ms)')
        expect(expandedText).toContain('src/c.ts')
        expect(expandedText).toContain('(50ms)')
    })

    it('stacks consecutive tool calls with zero blank lines between them', () => {
        const cache = new MessageLineCache()
        const messages: MessageItem[] = [
            {
                role: 'tool',
                toolCall: {
                    id: 't1',
                    name: 'edit_file',
                    command: 'Edit(src/index.ts)',
                    input: { path: 'src/index.ts' },
                    status: 'success',
                },
            },
            {
                role: 'tool',
                toolCall: {
                    id: 't2',
                    name: 'run_command',
                    command: 'Bash(npm test)',
                    status: 'success',
                },
            },
            {
                role: 'tool',
                toolCall: {
                    id: 't3',
                    name: 'read_file',
                    command: 'Read(package.json)',
                    input: { path: 'package.json' },
                    status: 'success',
                },
            },
            {
                role: 'assistant',
                content: 'All steps completed.',
            },
        ]

        const lines = cache.getLines(messages, 80)
        const textLines = lines.map((l) => l.map((s) => s.text).join(''))

        // Find indices of tool header lines
        const editIdx = textLines.findIndex((t) => t.includes('Edited'))
        const bashIdx = textLines.findIndex((t) => t.includes('Bash(npm test)'))
        const readIdx = textLines.findIndex((t) => t.includes('Read(package.json)'))
        const asstIdx = textLines.findIndex((t) => t.includes('All steps completed.'))

        // No blank lines between consecutive tools: edit is at index 0, bash at 1, read at 2
        expect(editIdx).toBe(0)
        expect(bashIdx).toBe(1)
        expect(readIdx).toBe(2)

        // Trailing spacing exists between the last tool and assistant message
        expect(textLines[3]).toBe('')
        expect(asstIdx).toBe(4)
    })

    it('renders actual git diff additions and deletions on expand for edit_file', () => {
        const cache = new MessageLineCache()
        const messages: MessageItem[] = [
            {
                role: 'tool',
                toolCall: {
                    id: 'edit-1',
                    name: 'edit_file',
                    command: 'Edit(src/config.ts)',
                    input: {
                        path: 'src/config.ts',
                        Target: 'const port = 3000;\nconst host = "localhost";',
                        Replacement:
                            'const port = 8080;\nconst host = "0.0.0.0";\nconst debug = true;',
                    },
                    status: 'success',
                },
            },
        ]

        // Collapsed: only header, no diff lines
        const collapsedLines = cache.getLines(messages, 100, { expandTools: false })
        const collapsedText = collapsedLines.map((l) => l.map((s) => s.text).join('')).join('\n')
        expect(collapsedText).toContain('Edited src/config.ts (+3, -2)')
        expect(collapsedText).not.toContain('const port = 8080')

        // Expanded: diff lines with unified + and - gutter and theme background
        const expandedLines = cache.getLines(messages, 100, { expandTools: true })
        const expandedText = expandedLines.map((l) => l.map((s) => s.text).join('')).join('\n')
        expect(expandedText).toContain('Edited src/config.ts (+3, -2)')
        expect(expandedText).toContain('- const port = 3000;')
        expect(expandedText).toContain('+ const port = 8080;')
        expect(expandedText).toContain('+ const debug = true;')

        // Theme background tokens matching /diff command view
        const deleteLine = expandedLines.find((l) =>
            l.some((t) => t.text.includes('const port = 3000;'))
        )
        expect(deleteLine?.[0]?.style?.bg).toBe(THEME.colors.diffDeleteBg)
        expect(deleteLine?.[1]?.style?.bg).toBe(THEME.colors.diffDeleteBg)

        const addLine = expandedLines.find((l) =>
            l.some((t) => t.text.includes('const port = 8080;'))
        )
        expect(addLine?.[0]?.style?.bg).toBe(THEME.colors.diffAddBg)
        expect(addLine?.[1]?.style?.bg).toBe(THEME.colors.diffAddBg)
    })

    it('renders subagent ticker during execution and rollup summary on completion', () => {
        const cache = new MessageLineCache()

        // 1. Running subagent with live stream chunk
        const runningSubagent: MessageItem = {
            role: 'tool',
            toolCall: {
                id: 'sub-1',
                name: 'invoke_subagent',
                input: { role: 'codebase-researcher' },
                status: 'running',
                output: '[SubAgent:d1:codebase-researcher] tool: read_file(src/auth.ts) (turn 2)',
            },
        }

        const runningLines = cache.getMessageLines(runningSubagent, 100, '⠋')
        const runningText = runningLines.map((l) => l.map((s) => s.text).join('')).join('\n')
        expect(runningText).toContain('Subagent: codebase-researcher')
        expect(runningText).toContain('↳ tool: read_file(src/auth.ts) (turn 2)')

        // 2. Completed subagent with rollup report
        const rollupReport = [
            '### [SubAgent: codebase-researcher (sub-1)] - COMPLETED',
            '- **Role**: codebase-researcher',
            '- **Task**: find auth guards',
            '- **Total Turns**: 4',
            '- **Tool Calls**: 7',
            '- **Duration**: 2.3s',
            '',
            '#### Rollup Summary & Findings:',
            'Identified AuthGuard middleware mounted in routes/auth.ts.',
        ].join('\n')

        const completedSubagent: MessageItem = {
            role: 'tool',
            toolCall: {
                id: 'sub-1',
                name: 'invoke_subagent',
                input: { role: 'codebase-researcher' },
                status: 'success',
                durationMs: 2300,
                output: rollupReport,
            },
        }

        // Collapsed summary stats
        const collapsedLines = cache.getMessageLines(completedSubagent, 100, '⠋', false)
        const collapsedText = collapsedLines.map((l) => l.map((s) => s.text).join('')).join('\n')
        expect(collapsedText).toContain('Subagent: codebase-researcher (4 turns, 7 tools, 2.3s)')
        expect(collapsedText).toContain('ctrl+o to expand')
        expect(collapsedText).not.toContain('### [SubAgent') // Cleaned up header

        // Expanded shows rollup findings
        const expandedLines = cache.getMessageLines(completedSubagent, 100, '⠋', true)
        const expandedText = expandedLines.map((l) => l.map((s) => s.text).join('')).join('\n')
        expect(expandedText).toContain('Identified AuthGuard middleware mounted in routes/auth.ts.')
    })

    it('renders in-place background task indicator when command moves to background', () => {
        const cache = new MessageLineCache()
        const messages: MessageItem[] = [
            {
                role: 'tool',
                toolCall: {
                    id: 'sh-1',
                    name: 'execute_command',
                    command: 'npm run dev',
                    status: 'success',
                    output: 'Starting dev server on port 3000\n[Moved to background task: task_dev_123. Use /tasks to inspect.]',
                },
            },
        ]

        const lines = cache.getLines(messages, 100)
        const text = lines.map((l) => l.map((s) => s.text).join('')).join('\n')
        expect(text).toContain('npm run dev')
        expect(text).toContain('↳ Moved to background task: task_dev_123 · Use /tasks to inspect')
    })

    it('renders collapsed thinking banner when generation finishes or on session reload, and expands with formatted content on expandTools', () => {
        const cache = new MessageLineCache()
        const messages: MessageItem[] = [
            {
                role: 'thinking',
                content:
                    '## Plan\nWe need to refactor the database schema and add indexes to optimize query performance.',
                isStreaming: false,
                durationMs: 2300,
            },
        ]

        // Collapsed (default)
        const collapsedLines = cache.getLines(messages, 100, { expandTools: false })
        const collapsedText = collapsedLines.map((l) => l.map((s) => s.text).join('')).join('\n')
        expect(collapsedText).toContain('Thought for 2.3s')
        expect(collapsedText).toContain('ctrl+o to expand')
        expect(collapsedText).not.toContain('We need to refactor the database schema')

        // Expanded (expandTools: true)
        const expandedLines = cache.getLines(messages, 100, { expandTools: true })
        const expandedText = expandedLines.map((l) => l.map((s) => s.text).join('')).join('\n')
        expect(expandedText).toContain('Thought for 2.3s')
        expect(expandedText).toContain('ctrl+o to collapse')
        expect(expandedText).toContain('We need to refactor the database schema')
    })

    it('renders live streaming thinking with formatted thought text when expandTools is enabled', () => {
        const cache = new MessageLineCache()
        const messages: MessageItem[] = [
            {
                role: 'thinking',
                content: 'Analyzing repository structure\nFound 15 modules',
                isStreaming: true,
            },
        ]

        // Collapsed (default)
        const collapsedLines = cache.getLines(messages, 100, { expandTools: false })
        const collapsedText = collapsedLines.map((l) => l.map((s) => s.text).join('')).join('\n')
        expect(collapsedText).toContain('Thinking...')
        expect(collapsedText).not.toContain('Found 15 modules')

        // Expanded (expandTools: true)
        const expandedLines = cache.getLines(messages, 100, { expandTools: true })
        const expandedText = expandedLines.map((l) => l.map((s) => s.text).join('')).join('\n')
        expect(expandedText).toContain('Thinking...')
        expect(expandedText).toContain('Found 15 modules')
    })

    it('expands truncated tool command outputs beyond the default 5-line limit when expandTools is enabled', () => {
        const cache = new MessageLineCache()
        const outputLines = Array.from({ length: 25 }, (_, i) => `log line ${i + 1}`)
        const messages: MessageItem[] = [
            {
                role: 'tool',
                toolCall: {
                    id: 'sh-2',
                    name: 'execute_command',
                    command: 'pytest tests/',
                    status: 'success',
                    output: outputLines.join('\n'),
                },
            },
        ]

        // Collapsed (default 5 lines)
        const collapsedLines = cache.getLines(messages, 100, { expandTools: false })
        const collapsedText = collapsedLines.map((l) => l.map((s) => s.text).join('')).join('\n')
        expect(collapsedText).toContain('log line 1')
        expect(collapsedText).toContain('log line 5')
        expect(collapsedText).not.toContain('log line 6')
        expect(collapsedText).toContain('... (20 more lines · Ctrl+O to toggle)')

        // Expanded (shows up to 35 lines, so all 25 lines are visible)
        const expandedLines = cache.getLines(messages, 100, { expandTools: true })
        const expandedText = expandedLines.map((l) => l.map((s) => s.text).join('')).join('\n')
        expect(expandedText).toContain('log line 1')
        expect(expandedText).toContain('log line 25')
        expect(expandedText).not.toContain('more lines · Ctrl+O to toggle')
    })

    it('renders Context Compacted banner and summary correctly', () => {
        const cache = new MessageLineCache()
        const messages: MessageItem[] = [
            {
                role: 'compaction' as any,
                content:
                    '[COMPACTED HISTORY SUMMARY]\nUser asked to refactor auth and add jwt verification.',
            },
        ]

        const lines = cache.getLines(messages, 100)
        const text = lines.map((l) => l.map((s) => s.text).join('')).join('\n')
        expect(text).toContain('Context Compacted')
        expect(text).toContain('User asked to refactor auth and add jwt verification.')
    })

    it('formats stream interrupt notice with muted styling', () => {
        const cache = new MessageLineCache()
        const messages: MessageItem[] = [
            {
                role: 'assistant',
                content:
                    'I will start by reading the config file.\n\nInterrupted · What should December do instead?',
            },
        ]

        const lines = cache.getLines(messages, 100)
        const text = lines.map((l) => l.map((s) => s.text).join('')).join('\n')
        expect(text).toContain('I will start by reading the config file.')
        expect(text).toContain('Interrupted · What should December do instead?')

        const interruptLine = lines.find((l) =>
            l.some((s) => s.text.includes('Interrupted · What should December do instead?'))
        )
        expect(interruptLine).toBeDefined()
        const seg = interruptLine?.find((s) => s.text.includes('Interrupted'))
        expect(seg?.style.italic).toBe(true)
    })

    it('displays active contextual verbs when tools are running and past tense when completed', () => {
        const cache = new MessageLineCache()
        const runningMessages: MessageItem[] = [
            {
                role: 'tool',
                toolCall: {
                    id: 't-edit',
                    name: 'edit_file',
                    input: { TargetFile: 'src/auth.ts', Target: 'a', Replacement: 'b' },
                    status: 'running',
                },
            },
            {
                role: 'tool',
                toolCall: {
                    id: 't-write',
                    name: 'write_file',
                    input: { TargetFile: 'src/new.ts', Content: 'code' },
                    status: 'running',
                },
            },
            {
                role: 'tool',
                toolCall: {
                    id: 't-sh',
                    name: 'run_command',
                    command: 'run_command(npm test)',
                    status: 'running',
                },
            },
        ]

        const runningText = cache
            .getLines(runningMessages, 100)
            .map((l) => l.map((s) => s.text).join(''))
            .join('\n')
        expect(runningText).toContain('Editing src/auth.ts')
        expect(runningText).toContain('Creating src/new.ts')
        expect(runningText).toContain('Executing(npm test)')

        const completedMessages: MessageItem[] = [
            {
                role: 'tool',
                toolCall: {
                    id: 't-edit',
                    name: 'edit_file',
                    input: { TargetFile: 'src/auth.ts', Target: 'a', Replacement: 'b' },
                    status: 'success',
                },
            },
            {
                role: 'tool',
                toolCall: {
                    id: 't-write',
                    name: 'write_file',
                    input: { TargetFile: 'src/new.ts', Content: 'code' },
                    status: 'success',
                },
            },
        ]

        const completedText = cache
            .getLines(completedMessages, 100)
            .map((l) => l.map((s) => s.text).join(''))
            .join('\n')
        expect(completedText).toContain('Edited src/auth.ts')
        expect(completedText).toContain('Created src/new.ts')
    })

    it('rolls up long turns exceeding 25 steps into a collapsed banner and expands on expandTools: true', () => {
        const cache = new MessageLineCache()
        const toolMessages: MessageItem[] = Array.from({ length: 30 }, (_, i) => ({
            role: 'tool',
            toolCall: {
                id: `tool-${i}`,
                name: 'run_command',
                command: `cmd_${i}()`,
                status: 'success' as const,
            },
        }))

        const messages: MessageItem[] = [
            { role: 'user', content: 'Run long workflow' },
            ...toolMessages,
        ]

        // Collapsed (default)
        const collapsedLines = cache.getLines(messages, 100, { expandTools: false })
        const collapsedText = collapsedLines.map((l) => l.map((s) => s.text).join('')).join('\n')
        expect(collapsedText).toContain('[+5 earlier steps hidden · press Ctrl+O to expand]')
        // Earlier steps (cmd_0) should be hidden
        expect(collapsedText).not.toContain('cmd_0()')
        // Latest step (cmd_29) should be visible
        expect(collapsedText).toContain('cmd_29()')

        // Expanded (expandTools: true)
        const expandedLines = cache.getLines(messages, 100, { expandTools: true })
        const expandedText = expandedLines.map((l) => l.map((s) => s.text).join('')).join('\n')
        expect(expandedText).not.toContain('earlier steps hidden')
        expect(expandedText).toContain('cmd_0()')
        expect(expandedText).toContain('cmd_29()')
    })

    it('renders error lines for failed discovery tools even when collapsed', () => {
        const cache = new MessageLineCache()
        const messages: MessageItem[] = [
            {
                role: 'tool',
                toolCall: {
                    id: 'rf-1',
                    name: 'read_file',
                    command: 'Read(missing.ts)',
                    input: { path: 'missing.ts' },
                    status: 'error',
                    output: 'Error: ENOENT: no such file or directory, open missing.ts',
                },
            },
            {
                role: 'tool',
                toolCall: {
                    id: 'rf-2',
                    name: 'read_file',
                    command: 'Read(config.ts)',
                    input: { path: 'config.ts' },
                    status: 'success',
                    output: 'const x = 1',
                },
            },
        ]

        const collapsedLines = cache.getLines(messages, 100, { expandTools: false })
        const text = collapsedLines.map((l) => l.map((s) => s.text).join('')).join('\n')
        expect(text).toContain('Read(missing.ts, config.ts)')
        expect(text).toContain('missing.ts: Error: ENOENT: no such file or directory')
    })

    it('renders Failed editing and Failed creating labels when tool status is error', () => {
        const cache = new MessageLineCache()
        const messages: MessageItem[] = [
            {
                role: 'tool',
                toolCall: {
                    id: 'edit-1',
                    name: 'edit_file',
                    command: 'Edit(src/auth.ts)',
                    input: { TargetFile: 'src/auth.ts', Target: 'old', Replacement: 'new' },
                    status: 'error',
                    output: 'Error executing tool: target content not found in file',
                },
            },
            {
                role: 'tool',
                toolCall: {
                    id: 'write-1',
                    name: 'write_file',
                    command: 'Create(src/read-only.ts)',
                    input: { TargetFile: 'src/read-only.ts', Content: 'code' },
                    status: 'error',
                    output: 'Error executing tool: EACCES permission denied',
                },
            },
        ]

        const lines = cache.getLines(messages, 100, { expandTools: false })
        const text = lines.map((l) => l.map((s) => s.text).join('')).join('\n')
        expect(text).toContain('Failed editing src/auth.ts')
        expect(text).toContain('Failed creating src/read-only.ts')
        expect(text).toContain('target content not found')
        expect(text).toContain('EACCES permission denied')
    })
})
