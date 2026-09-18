import { describe, expect, it } from 'bun:test'
import { render } from 'ink-testing-library'
import React from 'react'

import { BotMessage, formatThought } from '../../src/components/messages/bot-message'

describe('BotMessage Component (Unit)', () => {
    it('renders assistant response text blocks', () => {
        const { lastFrame } = render(
            <BotMessage blocks={[{ type: 'text', content: 'Assistant response text' }]} />
        )
        expect(lastFrame()).toContain('Assistant response text')
    })

    it('renders thought blocks collapsed by default and expands with ctrl+o toggle', () => {
        const thoughtContent =
            'Line 1: Planning search\nLine 2: Locating files\nLine 3: Reading contents\nLine 4: Done'
        const { lastFrame, rerender } = render(
            <BotMessage
                expandCommands={false}
                blocks={[
                    { type: 'thinking', content: thoughtContent },
                    { type: 'text', content: 'Final answer' },
                ]}
            />
        )
        let frame = lastFrame() || ''
        expect(frame).toContain('●')
        expect(frame).toContain('Thought')
        expect(frame).not.toContain('Thought for')
        expect(frame).toContain('ctrl+o to view')
        expect(frame).not.toContain('Line 1: Planning search')
        expect(frame).toContain('Final answer')

        // Re-render with expandCommands=true expands thoughts without vertical border
        rerender(
            <BotMessage
                expandCommands={true}
                blocks={[
                    { type: 'thinking', content: thoughtContent },
                    { type: 'text', content: 'Final answer' },
                ]}
            />
        )

        frame = lastFrame() || ''
        expect(frame).toContain('●')
        expect(frame).toContain('Thought')
        expect(frame).not.toContain('Thought for')
        expect(frame).toContain('ctrl+o to collapse')
        expect(frame).toContain('Line 1: Planning search')
        expect(frame).toContain('Line 4: Done')
        expect(frame).toContain('Final answer')
        expect(frame).not.toContain('│')
    })

    it('parses both <thought> and <think> tags in text blocks and collapses or expands them', () => {
        const { lastFrame, rerender } = render(
            <BotMessage
                expandCommands={false}
                blocks={[
                    {
                        type: 'text',
                        content:
                            '<thought>Thinking deep on problem</thought>First response part\n<think>Reasoning with DeepSeek R1</think>Final response part',
                    },
                ]}
            />
        )
        let frame = lastFrame() || ''
        expect(frame).toContain('●')
        expect(frame).toContain('Thought')
        expect(frame).not.toContain('Thought for')
        expect(frame).toContain('ctrl+o to view')
        expect(frame).toContain('First response part')
        expect(frame).toContain('Final response part')
        expect(frame).not.toContain('<thought>')
        expect(frame).not.toContain('</thought>')
        expect(frame).not.toContain('<think>')
        expect(frame).not.toContain('</think>')

        // Expanded shows the thought contents
        rerender(
            <BotMessage
                expandCommands={true}
                blocks={[
                    {
                        type: 'text',
                        content:
                            '<thought>Thinking deep on problem</thought>First response part\n<think>Reasoning with DeepSeek R1</think>Final response part',
                    },
                ]}
            />
        )
        frame = lastFrame() || ''
        expect(frame).toContain('Thinking deep on problem')
        expect(frame).toContain('Reasoning with DeepSeek R1')
    })

    it('renders active streaming thought blocks cleanly with dots spinner and Thinking... label', () => {
        const thoughtContent =
            'Line 1: Planning search\nLine 2: Locating files\nLine 3: Reading contents\nLine 4: Still thinking'
        const { lastFrame } = render(
            <BotMessage
                blocks={[{ type: 'thinking', content: thoughtContent, isStreaming: true } as any]}
            />
        )
        const frame = lastFrame() || ''
        expect(frame).toContain('Thinking...')
        expect(frame).not.toContain('Line 4: Still thinking')
    })

    it('renders clean thought header without duration on thinking blocks', () => {
        const { lastFrame } = render(
            <BotMessage
                blocks={[
                    {
                        type: 'thinking',
                        content: 'Short thought',
                        durationMs: 4200,
                    } as any,
                ]}
            />
        )
        const frame = lastFrame() || ''
        expect(frame).toContain('●')
        expect(frame).toContain('Thought')
        expect(frame).not.toContain('Thought for')
        expect(frame).toContain('ctrl+o to view')
    })

    it('renders HTTP 429 rate limit error messages correctly without badges', () => {
        const { lastFrame } = render(
            <BotMessage
                blocks={[
                    {
                        type: 'error',
                        error: 'LLM Rate Limit Reached (HTTP 429: Too Many Requests).',
                    },
                ]}
            />
        )
        const frame = lastFrame() || ''
        expect(frame).toContain('HTTP 429')
        expect(frame).toContain('Too Many Requests')
        expect(frame).not.toContain('RATE LIMITED')
    })

    it('renders HTTP 503 provider overload error messages correctly without badges', () => {
        const { lastFrame } = render(
            <BotMessage
                blocks={[
                    { type: 'error', error: 'HTTP 503 Service Unavailable: Gemini overloaded.' },
                ]}
            />
        )
        const frame = lastFrame() || ''
        expect(frame).toContain('HTTP 503')
        expect(frame).toContain('Gemini overloaded')
        expect(frame).not.toContain('HIGH DEMAND')
    })

    it('renders structured error with cause and hint without Error: or Cause: labels and without symbols', () => {
        const { lastFrame } = render(
            <BotMessage
                blocks={[
                    {
                        type: 'error',
                        error: 'Model provider rejected request',
                        cause: 'OpenRouter 402 Payment Required: Insufficient credits',
                        hint: 'Please add credits at https://openrouter.ai/settings/credits',
                    },
                ]}
            />
        )
        const frame = lastFrame() || ''
        expect(frame).toContain('Model provider rejected request')
        expect(frame).not.toContain('Error:')
        expect(frame).not.toContain('Cause:')
        expect(frame).toContain('Please add credits at https://openrouter.ai/settings/credits')
        expect(frame).not.toContain('Hint:')
        expect(frame).not.toContain('✖')
        expect(frame).not.toContain('↳')
        expect(frame).not.toContain('ℹ')
    })

    it('renders git diff outputs collapsed by default and respects expandCommands', () => {
        const diffOutput = '--- a/file.ts\n+++ b/file.ts\n@@ -1,2 +1,2 @@\n-old code\n+new code'
        const { lastFrame, rerender } = render(
            <BotMessage
                blocks={[
                    {
                        type: 'command',
                        toolCallId: '101',
                        toolName: 'bash',
                        command: 'git diff',
                        status: 'success',
                        output: diffOutput,
                    },
                ]}
            />
        )
        let frame = lastFrame() || ''
        expect(frame).toContain('ctrl+o to expand')
        expect(frame).not.toContain('-old code')

        // Re-render with expandCommands=true
        rerender(
            <BotMessage
                expandCommands={true}
                blocks={[
                    {
                        type: 'command',
                        toolCallId: '101',
                        toolName: 'bash',
                        command: 'git diff',
                        status: 'success',
                        output: diffOutput,
                    },
                ]}
            />
        )

        frame = lastFrame() || ''
        expect(frame).toContain('ctrl+o to collapse')
        expect(frame).toContain('-old code')
        expect(frame).toContain('+new code')
    })

    it('renders file modification commands with DiffGutterView line numbers and clickable links', () => {
        const { lastFrame } = render(
            <BotMessage
                expandCommands={true}
                blocks={[
                    {
                        type: 'command',
                        toolCallId: '102',
                        toolName: 'replace_file_content',
                        toolInput: JSON.stringify({
                            TargetFile: 'src/theme.ts',
                            StartLine: 15,
                            targetContent: 'brand: "#89B4F8"',
                            replacementContent: 'brand: "#7AA2F7"',
                        }),
                        command: 'replace_file_content(src/theme.ts)',
                        status: 'success',
                    },
                ]}
            />
        )
        const frame = lastFrame() || ''
        expect(frame).toContain('Updated')
        expect(frame).toContain('src/theme.ts')
        expect(frame).toContain('15')
        expect(frame).toContain('│')
        expect(frame).toContain('brand: "#89B4F8"')
        expect(frame).toContain('brand: "#7AA2F7"')
    })

    it('renders multiple command blocks compactly without gaps between them', () => {
        const blocks: any[] = [
            { type: 'text', content: 'Working...' },
            {
                type: 'command',
                command: 'ListDir(/home/chaitanya/code/december)',
                status: 'success',
                output: 'dir1\ndir2',
            },
            { type: 'text', content: 'Working...' },
            {
                type: 'command',
                command: 'Create(/home/chaitanya/code/december/lion/index.html)',
                status: 'success',
                output: '+html',
            },
            { type: 'text', content: 'Working...' },
            {
                type: 'command',
                command: 'Create(/home/chaitanya/code/december/lion/styles.css)',
                status: 'success',
                output: '+css',
            },
            { type: 'text', content: 'Working...' },
            {
                type: 'command',
                command: 'Create(/home/chaitanya/code/december/lion/script.js)',
                status: 'success',
                output: '+js',
            },
            { type: 'text', content: 'Working...' },
            {
                type: 'command',
                command: 'Bash(node -c lion/script.js)',
                status: 'success',
                output: 'ok',
            },
        ]
        const { lastFrame } = render(<BotMessage blocks={blocks} expandCommands={false} />)
        const frame = lastFrame() || ''
        const lines = frame.split('\n').filter((l) => l.includes('ctrl+o to expand'))
        expect(lines.length).toBe(5)
        // Verify there are no empty lines between the 5 command lines
        const rawLines = frame.split('\n')
        const firstIdx = rawLines.findIndex((l) => l.includes('ListDir'))
        const slice = rawLines.slice(firstIdx, firstIdx + 5)
        expect(slice.every((l) => l.trim().length > 0)).toBe(true)
    })

    it('locks spacing contract: tool calls followed by text response has exactly 1 blank line margin', () => {
        const blocks: any[] = [
            {
                type: 'command',
                command: 'ListDir(/home/chaitanya/code/december)',
                status: 'success',
                output: 'ok',
            },
            {
                type: 'text',
                content: 'I have finished listing the directory.',
            },
        ]
        const { lastFrame } = render(<BotMessage blocks={blocks} expandCommands={false} />)
        const frame = lastFrame() || ''
        const rawLines = frame.split('\n')
        const cmdIdx = rawLines.findIndex((l) => l.includes('ListDir'))
        const textIdx = rawLines.findIndex((l) => l.includes('I have finished'))
        // Exactly 1 blank line between command and text (textIdx should be cmdIdx + 2)
        expect(textIdx).toBe(cmdIdx + 2)
        expect(rawLines[cmdIdx + 1]?.trim()).toBe('')
    })

    it('locks spacing contract: thoughts followed by tool calls has 0 blank lines (adjacent lines)', () => {
        const blocks: any[] = [
            {
                type: 'thinking',
                content: 'Planning next steps',
            },
            {
                type: 'command',
                command: 'ListDir(/home/chaitanya/code/december)',
                status: 'success',
                output: 'ok',
            },
        ]
        const { lastFrame } = render(<BotMessage blocks={blocks} expandCommands={false} />)
        const frame = lastFrame() || ''
        const rawLines = frame.split('\n')
        const thoughtIdx = rawLines.findIndex(
            (l) => l.includes('Thought') || l.includes('Planning next steps')
        )
        const cmdIdx = rawLines.findIndex((l) => l.includes('ListDir'))
        // 0 blank lines: cmdIdx is directly thoughtIdx + 1
        expect(cmdIdx).toBe(thoughtIdx + 1)
    })

    it('locks spacing contract: thoughts followed directly by text response has exactly 1 blank line', () => {
        const blocks: any[] = [
            {
                type: 'thinking',
                content: 'Planning next steps',
            },
            {
                type: 'text',
                content: 'Here is the answer without tools.',
            },
        ]
        const { lastFrame } = render(<BotMessage blocks={blocks} expandCommands={false} />)
        const frame = lastFrame() || ''
        const rawLines = frame.split('\n')
        const thoughtIdx = rawLines.findIndex(
            (l) => l.includes('Thought') || l.includes('Planning next steps')
        )
        const textIdx = rawLines.findIndex((l) => l.includes('Here is the answer'))
        // Exactly 1 blank line between thoughts summary and text response
        expect(textIdx).toBe(thoughtIdx + 2)
        expect(rawLines[thoughtIdx + 1]?.trim()).toBe('')
    })

    it('does not insert spurious blank lines when previous thinking block has empty content', () => {
        const blocks: any[] = [
            {
                type: 'thinking',
                content: '   ',
            },
            {
                type: 'text',
                content: 'Direct answer without thinking gap.',
            },
        ]
        const { lastFrame } = render(<BotMessage blocks={blocks} expandCommands={false} />)
        const frame = lastFrame() || ''
        const rawLines = frame.split('\n')
        const textIdx = rawLines.findIndex((l) => l.includes('Direct answer without thinking gap.'))
        expect(textIdx).toBeGreaterThanOrEqual(0)
        // Ensure no empty lines before the text
        const linesBefore = rawLines.slice(0, textIdx)
        expect(linesBefore.every((l) => l.trim() === '')).toBe(true)
        expect(linesBefore.length).toBe(0)
    })

    it('renders analyzing and generating questions status labels with spinner', () => {
        const { lastFrame: frame1 } = render(
            <BotMessage blocks={[{ type: 'text', content: 'Analyzing prompt...' }]} />
        )
        expect(frame1()).toContain('Analyzing prompt...')

        const { lastFrame: frame2 } = render(
            <BotMessage blocks={[{ type: 'text', content: 'Generating questions...' }]} />
        )
        expect(frame2()).toContain('Generating questions...')
    })

    it('formatThought strips scaffolding labels and bullets while preserving separate lines and natural casing', () => {
        const raw = `*  **Goal Understanding:** The user wants to refactor auth in packages/server.
*  **Analysis:**
   - Need to check auth.service.ts
   - Need to preserve CamelCase and filePath
*  **Execution Plan:**
   1. Run grep_search to find symbols
   2. Edit auth.service.ts`

        const formatted = formatThought(raw)
        const expected = [
            'The user wants to refactor auth in packages/server.',
            'Need to check auth.service.ts',
            'Need to preserve CamelCase and filePath',
            'Run grep_search to find symbols',
            'Edit auth.service.ts',
        ].join('\n')

        expect(formatted).toBe(expected)
        expect(formatted).not.toContain('Goal Understanding:')
        expect(formatted).not.toContain('Analysis:')
        expect(formatted).not.toContain('Execution Plan:')
        expect(formatted).not.toContain('**')
        expect(formatted).not.toContain('*')
        expect(formatted).not.toContain('...')
    })

    it('renders thought block in BotMessage without bullets or scaffolding labels', () => {
        const rawThought = `*  **Goal Understanding:** The user wants to check the database schema.
*  **Analysis:**
   - Looking for schema.prisma in packages/database
   - Verifying User and Session models`

        const { lastFrame } = render(
            <BotMessage
                expandCommands={true}
                blocks={[
                    { type: 'thinking', content: rawThought },
                    { type: 'text', content: 'Final response' },
                ]}
            />
        )

        const frame = lastFrame() || ''
        expect(frame).toContain('The user wants to check the database schema.')
        expect(frame).toContain('Looking for schema.prisma in packages/database')
        expect(frame).toContain('Verifying User and Session models')
        expect(frame).toContain('Final response')
        expect(frame).not.toContain('Goal Understanding:')
        expect(frame).not.toContain('Analysis:')
        expect(frame).not.toContain('**')
    })

    it('renders retry status messages with muted spinner and formatted provider and attempt count', () => {
        const { lastFrame } = render(
            <BotMessage
                blocks={[
                    {
                        type: 'text',
                        content: 'Agnes AI rate limit hit. Retrying in 4s... (attempt 1/3)',
                    },
                ]}
            />
        )
        const frame = lastFrame() || ''
        expect(frame).toContain('Agnes AI rate limit hit.')
        expect(frame).toContain('Retrying in 4s...')
        expect(frame).toContain('(attempt 1/3)')
    })

    it('renders high demand retry status messages with muted spinner', () => {
        const { lastFrame } = render(
            <BotMessage
                blocks={[
                    {
                        type: 'text',
                        content: 'Anthropic high demand hit. Retrying in 2s... (attempt 1/5)',
                    },
                ]}
            />
        )
        const frame = lastFrame() || ''
        expect(frame).toContain('Anthropic high demand hit.')
        expect(frame).toContain('Retrying in 2s...')
        expect(frame).toContain('(attempt 1/5)')
    })

    it('consolidates parallel read tool calls into a single line with +N more and ctrl+o to expand', () => {
        const { lastFrame } = render(
            <BotMessage
                blocks={[
                    {
                        type: 'command',
                        toolName: 'read_file',
                        command: 'Read(/home/user/code/apps/cli/src/index.ts)',
                        toolInput: JSON.stringify({
                            AbsolutePath: '/home/user/code/apps/cli/src/index.ts',
                        }),
                        status: 'success',
                    },
                    {
                        type: 'command',
                        toolName: 'read_file',
                        command: 'Read(/home/user/code/apps/cli/src/local-operations.ts)',
                        toolInput: JSON.stringify({
                            AbsolutePath: '/home/user/code/apps/cli/src/local-operations.ts',
                        }),
                        status: 'success',
                    },
                    {
                        type: 'command',
                        toolName: 'read_file',
                        command: 'Read(/home/user/code/packages/agent/src/agent.ts)',
                        toolInput: JSON.stringify({
                            AbsolutePath: '/home/user/code/packages/agent/src/agent.ts',
                        }),
                        status: 'success',
                    },
                    {
                        type: 'command',
                        toolName: 'read_file',
                        command: 'Read(/home/user/code/packages/agent/src/agent-loop.ts)',
                        toolInput: JSON.stringify({
                            AbsolutePath: '/home/user/code/packages/agent/src/agent-loop.ts',
                        }),
                        status: 'success',
                    },
                ]}
            />
        )
        const frame = lastFrame() || ''
        expect(frame).toContain('Read')
        expect(frame).toContain('+2 more')
        expect(frame).toContain('(ctrl+o to expand)')
        expect(frame).not.toContain('✔')
    })

    it('expands consolidated parallel reads when expandCommands is true', () => {
        const { lastFrame } = render(
            <BotMessage
                expandCommands={true}
                blocks={[
                    {
                        type: 'command',
                        toolName: 'read_file',
                        command: 'Read(apps/cli/src/index.ts)',
                        toolInput: JSON.stringify({ filePath: 'apps/cli/src/index.ts' }),
                        status: 'success',
                    },
                    {
                        type: 'command',
                        toolName: 'read_file',
                        command: 'Read(apps/cli/src/local-operations.ts)',
                        toolInput: JSON.stringify({ filePath: 'apps/cli/src/local-operations.ts' }),
                        status: 'success',
                    },
                    {
                        type: 'command',
                        toolName: 'read_file',
                        command: 'Read(packages/agent/src/agent.ts)',
                        toolInput: JSON.stringify({ filePath: 'packages/agent/src/agent.ts' }),
                        status: 'success',
                    },
                ]}
            />
        )
        const frame = lastFrame() || ''
        expect(frame).toContain('Read(3 files)')
        expect(frame).toContain('(ctrl+o to collapse)')
        expect(frame).toContain('apps/cli/src/index.ts')
        expect(frame).toContain('apps/cli/src/local-operations.ts')
        expect(frame).toContain('packages/agent/src/agent.ts')
        expect(frame).not.toContain('✔')
    })

    it('renders a single read tool call standalone without consolidation or +N more', () => {
        const { lastFrame } = render(
            <BotMessage
                blocks={[
                    {
                        type: 'command',
                        toolName: 'read_file',
                        command: 'Read(apps/cli/src/index.ts)',
                        toolInput: JSON.stringify({ filePath: 'apps/cli/src/index.ts' }),
                        status: 'success',
                    },
                ]}
            />
        )
        const frame = lastFrame() || ''
        expect(frame).toContain('Read')
        expect(frame).toContain('apps/cli/src/index.ts')
        expect(frame).not.toContain('+')
        expect(frame).not.toContain('ctrl+o')
        expect(frame).not.toContain('✔')
    })

    it('preserves other tool calls separately between consolidated read blocks', () => {
        const { lastFrame } = render(
            <BotMessage
                blocks={[
                    {
                        type: 'command',
                        toolName: 'read_file',
                        command: 'Read(file1.ts)',
                        status: 'success',
                    },
                    {
                        type: 'command',
                        toolName: 'read_file',
                        command: 'Read(file2.ts)',
                        status: 'success',
                    },
                    {
                        type: 'command',
                        toolName: 'grep_search',
                        command: 'Search(prisma)',
                        status: 'success',
                    },
                    {
                        type: 'command',
                        toolName: 'read_file',
                        command: 'Read(file3.ts)',
                        status: 'success',
                    },
                    {
                        type: 'command',
                        toolName: 'read_file',
                        command: 'Read(file4.ts)',
                        status: 'success',
                    },
                ]}
            />
        )
        const frame = lastFrame() || ''
        expect(frame).toContain('Search(prisma)')
        expect(frame).toContain('file1.ts')
        expect(frame).toContain('file2.ts')
        expect(frame).toContain('file3.ts')
        expect(frame).toContain('file4.ts')
        expect(frame).not.toContain('✔')
    })
})
