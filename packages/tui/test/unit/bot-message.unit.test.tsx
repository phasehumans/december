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

    it('does not persist completed thought blocks once generation finishes', () => {
        const thoughtContent =
            'Line 1: Planning search\nLine 2: Locating files\nLine 3: Reading contents\nLine 4: Done'
        const { lastFrame } = render(
            <BotMessage
                blocks={[
                    { type: 'thinking', content: thoughtContent },
                    { type: 'text', content: 'Final answer' },
                ]}
            />
        )
        const frame = lastFrame() || ''
        expect(frame).not.toContain('Thought')
        expect(frame).not.toContain('Line 1: Planning search')
        expect(frame).toContain('Final answer')
    })

    it('parses both <thought> and <think> tags in text blocks and leaves no static thought residue once finished', () => {
        const { lastFrame } = render(
            <BotMessage
                blocks={[
                    {
                        type: 'text',
                        content:
                            '<thought>Thinking deep on problem</thought>First response part\n<think>Reasoning with DeepSeek R1</think>Final response part',
                    },
                ]}
            />
        )
        const frame = lastFrame() || ''
        expect(frame).not.toContain('Thought')
        expect(frame).not.toContain('Thinking deep on problem')
        expect(frame).not.toContain('Reasoning with DeepSeek R1')
        expect(frame).toContain('First response part')
        expect(frame).toContain('Final response part')
        expect(frame).not.toContain('<thought>')
        expect(frame).not.toContain('</thought>')
        expect(frame).not.toContain('<think>')
        expect(frame).not.toContain('</think>')
    })

    it('renders active streaming thought blocks cleanly with dots spinner and live topic', () => {
        const thoughtContent =
            'Line 1: Planning search\nLine 2: Locating files\nLine 3: Analyzing scroll measurement bottleneck'
        const { lastFrame } = render(
            <BotMessage
                blocks={[{ type: 'thinking', content: thoughtContent, isStreaming: true } as any]}
            />
        )
        const frame = lastFrame() || ''
        expect(frame).toContain('Thinking...')
        expect(frame).toContain('analyzing scroll measurement bottleneck')
        expect(frame).not.toContain('4.1s')
    })

    it('renders null for non-streaming thinking blocks', () => {
        const { lastFrame } = render(
            <BotMessage
                blocks={[
                    {
                        type: 'thinking',
                        content: 'Short thought',
                    } as any,
                ]}
            />
        )
        const frame = lastFrame() || ''
        expect(frame).not.toContain('Thought')
        expect(frame).not.toContain('Thinking...')
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

    it('renders git diff commands compactly without stdout dump on success', () => {
        const diffOutput = '--- a/file.ts\n+++ b/file.ts\n@@ -1,2 +1,2 @@\n-old code\n+new code'
        const { lastFrame } = render(
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
        const frame = lastFrame() || ''
        expect(frame).toContain('git diff')
        expect(frame).not.toContain('ctrl+o')
        expect(frame).not.toContain('-old code')
    })

    it('renders file modification commands with compact 1-line format and clickable links', () => {
        const { lastFrame } = render(
            <BotMessage
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
        expect(frame).toContain('Edited')
        expect(frame).toContain('src/theme.ts')
        expect(frame).toContain('+1')
        expect(frame).toContain('-1')
        expect(frame).not.toContain('ctrl+o')
        expect(frame).not.toContain('brand: "#89B4F8"')
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
        const { lastFrame } = render(<BotMessage blocks={blocks} />)
        const frame = lastFrame() || ''
        expect(frame).toContain('ListDir')
        expect(frame).toContain('Create')
        expect(frame).toContain('Bash')
        expect(frame).not.toContain('ctrl+o')
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
                command: 'Bash(npm test)',
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
        const cmdIdx = rawLines.findIndex((l) => l.includes('Bash'))
        const textIdx = rawLines.findIndex((l) => l.includes('I have finished'))
        // Exactly 1 blank line between command and text (textIdx should be cmdIdx + 2)
        expect(textIdx).toBe(cmdIdx + 2)
        expect(rawLines[cmdIdx + 1]?.trim()).toBe('')
    })

    it('locks spacing contract: tool calls followed by active thinking/loader has 0 blank lines (flush layout)', () => {
        const blocks: any[] = [
            {
                type: 'command',
                command: 'Bash(npm test)',
                status: 'success',
                output: 'ok',
            },
            {
                type: 'text',
                content: 'Working...',
            },
        ]
        const { lastFrame } = render(<BotMessage blocks={blocks} expandCommands={false} />)
        const frame = lastFrame() || ''
        const rawLines = frame.split('\n')
        const cmdIdx = rawLines.findIndex((l) => l.includes('Bash'))
        const loaderIdx = rawLines.findIndex((l) => l.includes('Working...'))
        expect(cmdIdx).toBeGreaterThanOrEqual(0)
        // 0 blank lines between command and loader: loader is immediately adjacent
        expect(loaderIdx).toBe(cmdIdx + 1)
    })

    it('locks spacing contract: streaming thoughts followed by tool calls has 0 blank lines (adjacent lines)', () => {
        const blocks: any[] = [
            {
                type: 'thinking',
                content: 'Planning next steps',
                isStreaming: true,
            },
            {
                type: 'command',
                command: 'Bash(npm test)',
                status: 'running',
                output: 'ok',
            },
        ]
        const { lastFrame } = render(<BotMessage blocks={blocks} expandCommands={false} />)
        const frame = lastFrame() || ''
        const rawLines = frame.split('\n')
        const thoughtIdx = rawLines.findIndex((l) => l.includes('Thinking...'))
        const cmdIdx = rawLines.findIndex((l) => l.includes('Bash'))
        // 0 blank lines: cmdIdx is directly thoughtIdx + 1
        expect(cmdIdx).toBe(thoughtIdx + 1)
    })

    it('locks spacing contract: streaming thoughts followed directly by text response has exactly 1 blank line', () => {
        const blocks: any[] = [
            {
                type: 'thinking',
                content: 'Planning next steps',
                isStreaming: true,
            },
            {
                type: 'text',
                content: 'Here is the answer without tools.',
            },
        ]
        const { lastFrame } = render(<BotMessage blocks={blocks} expandCommands={false} />)
        const frame = lastFrame() || ''
        const rawLines = frame.split('\n')
        const thoughtIdx = rawLines.findIndex((l) => l.includes('Thinking...'))
        const textIdx = rawLines.findIndex((l) => l.includes('Here is the answer'))
        // Exactly 1 blank line between streaming thought and text response
        expect(textIdx).toBe(thoughtIdx + 2)
        expect(rawLines[thoughtIdx + 1]?.trim()).toBe('')
    })

    it('completed thoughts evaporate leaving no ghost blank lines before text response', () => {
        const blocks: any[] = [
            {
                type: 'thinking',
                content: 'Analyzing deep question',
                isStreaming: false,
            },
            {
                type: 'text',
                content: 'Direct response without thoughts.',
            },
        ]
        const { lastFrame } = render(<BotMessage blocks={blocks} />)
        const frame = lastFrame() || ''
        expect(frame).not.toContain('Thinking')
        expect(frame).not.toContain('Analyzing')
        expect(frame.trim()).toBe('Direct response without thoughts.')
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

    it('formatThought strips bullets and scaffolding labels from thoughts', () => {
        const rawThought = `*  **Goal Understanding:** The user wants to check the database schema.
*  **Analysis:**
   - Looking for schema.prisma in packages/database
   - Verifying User and Session models`

        const formatted = formatThought(rawThought)
        expect(formatted).toContain('The user wants to check the database schema.')
        expect(formatted).toContain('Looking for schema.prisma in packages/database')
        expect(formatted).toContain('Verifying User and Session models')
        expect(formatted).not.toContain('Goal Understanding:')
        expect(formatted).not.toContain('Analysis:')
        expect(formatted).not.toContain('**')
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

    it('consolidates running parallel read tool calls into a single line with +N more', () => {
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
                        status: 'running',
                    },
                    {
                        type: 'command',
                        toolName: 'read_file',
                        command: 'Read(/home/user/code/apps/cli/src/local-operations.ts)',
                        toolInput: JSON.stringify({
                            AbsolutePath: '/home/user/code/apps/cli/src/local-operations.ts',
                        }),
                        status: 'running',
                    },
                    {
                        type: 'command',
                        toolName: 'read_file',
                        command: 'Read(/home/user/code/packages/agent/src/agent.ts)',
                        toolInput: JSON.stringify({
                            AbsolutePath: '/home/user/code/packages/agent/src/agent.ts',
                        }),
                        status: 'running',
                    },
                    {
                        type: 'command',
                        toolName: 'read_file',
                        command: 'Read(/home/user/code/packages/agent/src/agent-loop.ts)',
                        toolInput: JSON.stringify({
                            AbsolutePath: '/home/user/code/packages/agent/src/agent-loop.ts',
                        }),
                        status: 'running',
                    },
                ]}
            />
        )
        const frame = lastFrame() || ''
        expect(frame).toContain('Read')
        expect(frame).toContain('+2 more')
        expect(frame).not.toContain('ctrl+o')
        expect(frame).not.toContain('✔')
    })

    it('renders consolidated completed read tool calls in terminal history', () => {
        const { lastFrame } = render(
            <BotMessage
                blocks={[
                    {
                        type: 'command',
                        toolName: 'read_file',
                        command: 'Read(apps/cli/src/index.ts)',
                        status: 'success',
                    },
                    {
                        type: 'command',
                        toolName: 'read_file',
                        command: 'Read(apps/cli/src/local-operations.ts)',
                        status: 'success',
                    },
                ]}
            />
        )
        const frame = lastFrame() || ''
        expect(frame).toContain('Read')
        expect(frame).toContain('apps/cli/src/index.ts')
    })

    it('applies Option A tail truncation on 2 consolidated read files when paths exceed line width', () => {
        const { lastFrame } = render(
            <BotMessage
                blocks={[
                    {
                        type: 'command',
                        toolName: 'read_file',
                        command: 'Read(apps/web/src/features/home/components/HomeHero.tsx)',
                        toolInput: JSON.stringify({
                            AbsolutePath: 'apps/web/src/features/home/components/HomeHero.tsx',
                        }),
                        status: 'running',
                    },
                    {
                        type: 'command',
                        toolName: 'read_file',
                        command: 'Read(apps/web/src/features/home/components/HomeHeader.tsx)',
                        toolInput: JSON.stringify({
                            AbsolutePath: 'apps/web/src/features/home/components/HomeHeader.tsx',
                        }),
                        status: 'running',
                    },
                ]}
            />
        )
        const frame = lastFrame() || ''
        expect(frame).toContain('Read')
        expect(frame).toContain('HomeHero.tsx')
        expect(frame).not.toContain('ctrl+o')
        expect(frame).toContain('...')
        // Entire read collapsed row must fit on a single line
        const readLines = frame.split('\n').filter((l) => l.includes('Read'))
        expect(readLines.length).toBe(1)
    })

    it('renders file_change block with single space after bullet', () => {
        const { lastFrame } = render(
            <BotMessage
                blocks={[
                    {
                        type: 'file_change',
                        action: 'created',
                        filePath: 'src/index.ts',
                    },
                ]}
            />
        )
        const frame = lastFrame() || ''
        expect(frame).toContain('● Created')
        expect(frame).not.toContain('●  Created')
    })

    it('renders consolidated parallel reads cleanly on a single row when running', () => {
        const { lastFrame } = render(
            <BotMessage
                expandCommands={true}
                blocks={[
                    {
                        type: 'command',
                        toolName: 'read_file',
                        command: 'Read(apps/cli/src/index.ts)',
                        toolInput: JSON.stringify({ filePath: 'apps/cli/src/index.ts' }),
                        status: 'running',
                    },
                    {
                        type: 'command',
                        toolName: 'read_file',
                        command: 'Read(apps/cli/src/local-operations.ts)',
                        toolInput: JSON.stringify({ filePath: 'apps/cli/src/local-operations.ts' }),
                        status: 'running',
                    },
                    {
                        type: 'command',
                        toolName: 'read_file',
                        command: 'Read(packages/agent/src/agent.ts)',
                        toolInput: JSON.stringify({ filePath: 'packages/agent/src/agent.ts' }),
                        status: 'running',
                    },
                ]}
            />
        )
        const frame = lastFrame() || ''
        expect(frame).toContain('Read')
        expect(frame).toContain('apps/cli/src/index.ts')
        expect(frame).not.toContain('ctrl+o')
        expect(frame).not.toContain('✔')
    })

    it('renders running standalone read and preserves upon success', () => {
        const { lastFrame: runningFrame } = render(
            <BotMessage
                blocks={[
                    {
                        type: 'command',
                        toolName: 'read_file',
                        command: 'Read(apps/cli/src/index.ts)',
                        toolInput: JSON.stringify({ filePath: 'apps/cli/src/index.ts' }),
                        status: 'running',
                    },
                ]}
            />
        )
        expect(runningFrame()).toContain('Read')
        expect(runningFrame()).toContain('apps/cli/src/index.ts')

        const { lastFrame: successFrame } = render(
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
        expect(successFrame()).toContain('Read')
        expect(successFrame()).toContain('apps/cli/src/index.ts')
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
                        toolName: 'write_file',
                        command: 'Create(file2.ts)',
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
                        toolName: 'bash',
                        command: 'Bash(npm test)',
                        status: 'success',
                    },
                ]}
            />
        )
        const frame = lastFrame() || ''
        expect(frame).toContain('file1.ts')
        expect(frame).toContain('Search(prisma)')
        expect(frame).toContain('Create')
        expect(frame).toContain('Bash')
    })

    it('never hides errors: failed discovery tools persist with error output', () => {
        const { lastFrame } = render(
            <BotMessage
                blocks={[
                    {
                        type: 'command',
                        toolName: 'read_file',
                        command: 'Read(missing.ts)',
                        status: 'error',
                        output: 'ENOENT: no such file or directory, open missing.ts',
                    },
                ]}
            />
        )
        const frame = lastFrame() || ''
        expect(frame).toContain('Read')
        expect(frame).toContain('missing.ts')
        expect(frame).toContain('ENOENT')
    })

    it('renders active spinner and reading status when consolidated reads are currently running', () => {
        const { lastFrame } = render(
            <BotMessage
                blocks={[
                    {
                        type: 'command',
                        toolName: 'read_file',
                        command: 'Read(apps/cli/src/index.ts)',
                        toolInput: JSON.stringify({ filePath: 'apps/cli/src/index.ts' }),
                        status: 'running',
                    },
                    {
                        type: 'command',
                        toolName: 'read_file',
                        command: 'Read(apps/cli/src/local-operations.ts)',
                        toolInput: JSON.stringify({ filePath: 'apps/cli/src/local-operations.ts' }),
                        status: 'running',
                    },
                ]}
            />
        )
        const frame = lastFrame() || ''
        expect(frame).toContain('Read')
        expect(frame).toContain('apps/cli/src/index.ts')
        expect(frame).toContain('apps/cli/src/local-operations.ts')
        // When running, it should NOT prompt to expand or display static glyph
        expect(frame).not.toContain('(ctrl+o to expand)')
    })

    it('renders running command with spinner alongside tool name and arguments', () => {
        const { lastFrame } = render(
            <BotMessage
                blocks={[
                    {
                        type: 'command',
                        toolName: 'bash',
                        command: 'Bash(git status -s)',
                        status: 'running',
                    },
                ]}
            />
        )
        const frame = lastFrame() || ''
        expect(frame).toContain('Bash')
        expect(frame).toContain('git status -s')
    })
})
