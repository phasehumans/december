import { describe, it, expect } from 'bun:test'

import { convertAgentMessagesToDifferentialMessages } from '../../src/utils/message-converter'

describe('convertAgentMessagesToDifferentialMessages', () => {
    it('converts user messages and strips skill invocation wrappers', () => {
        const raw = [
            { role: 'system', content: 'system prompt' },
            { role: 'user', content: '[Skill Invocation: /code-review] Please review' },
            { role: 'assistant', content: 'Looks great!' },
        ]
        const converted = convertAgentMessagesToDifferentialMessages(raw)
        expect(converted).toHaveLength(2)
        expect(converted[0]).toEqual({
            role: 'user',
            content: '/code-review',
        })
        expect(converted[1]).toEqual({
            role: 'assistant',
            content: 'Looks great!',
        })
    })

    it('converts thinking and tool calls with outputs into structured message items', () => {
        const raw = [
            {
                role: 'assistant',
                content: 'Running command now',
                thinking: 'Need to inspect git status',
                toolCalls: [
                    {
                        id: 'call-1',
                        name: 'bash',
                        input: { command: 'git status' },
                    },
                ],
            },
            {
                role: 'tool',
                toolCallId: 'call-1',
                content: 'On branch main\nclean',
            },
            {
                role: 'assistant',
                content: 'Everything is up to date.',
            },
        ]
        const converted = convertAgentMessagesToDifferentialMessages(raw)
        expect(converted).toHaveLength(4)
        expect(converted[0]).toEqual({
            role: 'thinking',
            content: 'Need to inspect git status',
            isStreaming: false,
        })
        expect(converted[1]).toEqual({
            role: 'tool',
            toolCall: {
                id: 'call-1',
                name: 'bash',
                command: 'Bash(git status)',
                status: 'success',
                output: 'On branch main\nclean',
            },
        })
        expect(converted[2]).toEqual({
            role: 'assistant',
            content: 'Running command now',
        })
        expect(converted[3]).toEqual({
            role: 'assistant',
            content: 'Everything is up to date.',
        })
    })

    it('marks tool errors when tool content contains error prefix', () => {
        const raw = [
            {
                role: 'assistant',
                toolCalls: [
                    {
                        id: 'call-err',
                        name: 'read_file',
                        input: { path: 'missing.txt' },
                    },
                ],
            },
            {
                role: 'tool',
                toolCallId: 'call-err',
                content: 'Error executing tool: File not found: missing.txt',
            },
        ]
        const converted = convertAgentMessagesToDifferentialMessages(raw)
        expect(converted).toHaveLength(1)
        expect(converted[0].role).toBe('tool')
        expect(converted[0].toolCall?.status).toBe('error')
        expect(converted[0].toolCall?.output).toContain('File not found')
    })
})
