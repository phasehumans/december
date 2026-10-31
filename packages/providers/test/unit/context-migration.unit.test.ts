import { describe, expect, test } from 'bun:test'

import {
    toCanonicalMessages,
    normalizeForAnthropic,
    normalizeForOpenAI,
    normalizeForGemini,
    normalizeForProvider,
} from '../../src/normalizer/index.ts'

import type { Message } from '../../src/types.ts'

describe('Cross-Provider Context Migration Normalizer (Unit)', () => {
    describe('toCanonicalMessages', () => {
        test('canonicalizes standard conversation messages', () => {
            const rawMessages: Message[] = [
                { role: 'user', content: 'hello' },
                { role: 'assistant', content: 'hi there' },
            ]

            const canonical = toCanonicalMessages(rawMessages)
            expect(canonical).toHaveLength(2)
            expect(canonical[0]).toEqual({
                role: 'user',
                content: 'hello',
            })
            expect(canonical[1]).toEqual({
                role: 'assistant',
                content: 'hi there',
            })
        })

        test('resolves toolName for tool results from preceding assistant tool calls', () => {
            const rawMessages: Message[] = [
                { role: 'user', content: 'read file.txt' },
                {
                    role: 'assistant',
                    content: 'I will read the file',
                    thinking: 'thinking about reading',
                    toolCalls: [
                        { id: 'call_123', name: 'read_file', input: '{"path":"file.txt"}' },
                        { id: 'call_456', name: 'bash', input: '{"command":"ls"}' },
                    ],
                },
                {
                    role: 'tool',
                    toolCallId: 'call_123',
                    content: 'file contents',
                },
                {
                    role: 'tool',
                    toolCallId: 'call_456',
                    content: 'folder contents',
                },
            ]

            const canonical = toCanonicalMessages(rawMessages)
            expect(canonical).toHaveLength(4)
            expect(canonical[1].thinking?.text).toBe('thinking about reading')
            expect(canonical[1].toolCalls).toHaveLength(2)
            expect(canonical[1].toolCalls?.[0].name).toBe('read_file')
            expect(canonical[1].toolCalls?.[0].input).toEqual({ path: 'file.txt' })

            // Check that tool results have toolName resolved
            expect(canonical[2].role).toBe('tool')
            expect(canonical[2].toolCallId).toBe('call_123')
            expect(canonical[2].toolName).toBe('read_file')
            expect(canonical[2].content).toBe('file contents')

            expect(canonical[3].role).toBe('tool')
            expect(canonical[3].toolCallId).toBe('call_456')
            expect(canonical[3].toolName).toBe('bash')
            expect(canonical[3].content).toBe('folder contents')
        })
    })

    describe('normalizeForAnthropic', () => {
        const rawHistoryWithTools: Message[] = [
            { role: 'user', content: 'inspect repository' },
            {
                role: 'assistant',
                content: 'Running tools',
                thinking: 'Thought from Claude or another model',
                toolCalls: [
                    { id: 'toolu_1', name: 'read_file', input: '{"path":"README.md"}' },
                    { id: 'toolu_2', name: 'bash', input: '{"command":"git status"}' },
                ],
            },
            {
                role: 'tool',
                toolCallId: 'toolu_1',
                content: 'readme content',
            },
            {
                role: 'tool',
                toolCallId: 'toolu_2',
                content: 'clean worktree',
            },
        ]

        test('bundles multiple tool results into a single subsequent user message', () => {
            const antMessages = normalizeForAnthropic(rawHistoryWithTools, {
                model: 'claude-3-5-sonnet-20241022',
            })

            // Should produce:
            // 0: user ('inspect repository')
            // 1: assistant (text + 2 tool_use blocks)
            // 2: user (2 tool_result blocks)
            expect(antMessages).toHaveLength(3)
            expect(antMessages[0].role).toBe('user')
            expect(antMessages[1].role).toBe('assistant')
            expect(antMessages[2].role).toBe('user')

            const assistantBlocks = antMessages[1].content as any[]
            const toolUseBlocks = assistantBlocks.filter((b) => b.type === 'tool_use')
            expect(toolUseBlocks).toHaveLength(2)
            expect(toolUseBlocks[0].id).toBe('toolu_1')
            expect(toolUseBlocks[1].id).toBe('toolu_2')

            const userBlocks = antMessages[2].content as any[]
            expect(Array.isArray(userBlocks)).toBe(true)
            expect(userBlocks).toHaveLength(2)
            expect(userBlocks[0]).toEqual({
                type: 'tool_result',
                tool_use_id: 'toolu_1',
                content: 'readme content',
            })
            expect(userBlocks[1]).toEqual({
                type: 'tool_result',
                tool_use_id: 'toolu_2',
                content: 'clean worktree',
            })
        })

        test('omits thinking block without signature or for non-thinking models to avoid 400 errors', () => {
            // When migrating from DeepSeek/Gemini to Claude 3.5 Sonnet, thinking has no signature
            const antMessages = normalizeForAnthropic(rawHistoryWithTools, {
                model: 'claude-3-5-sonnet-20241022',
                thinkingEnabled: false,
            })

            const assistantBlocks = antMessages[1].content as any[]
            const thinkingBlock = assistantBlocks.find((b) => b.type === 'thinking')
            expect(thinkingBlock).toBeUndefined()
        })

        test('preserves thinking block with signature when thinking is enabled on Claude 3.7', () => {
            const historyWithSignature: Message[] = [
                { role: 'user', content: 'test' },
                {
                    role: 'assistant',
                    content: 'response',
                    thinking: 'valid thought',
                    thoughtSignature: 'valid_signature_token',
                } as any,
            ]

            const antMessages = normalizeForAnthropic(historyWithSignature, {
                model: 'claude-3-7-sonnet-20250219',
                thinkingEnabled: true,
            })

            const assistantBlocks = antMessages[1].content as any[]
            const thinkingBlock = assistantBlocks.find((b) => b.type === 'thinking')
            expect(thinkingBlock).toBeDefined()
            expect(thinkingBlock?.thinking).toBe('valid thought')
            expect(thinkingBlock?.signature).toBe('valid_signature_token')
        })

        test('converts mid-conversation system messages into user messages', () => {
            const historyWithCompaction: Message[] = [
                { role: 'user', content: 'first' },
                { role: 'assistant', content: 'second' },
                { role: 'system', content: '[COMPACTED HISTORY SUMMARY] summary here' },
                { role: 'user', content: 'next question' },
            ]

            const antMessages = normalizeForAnthropic(historyWithCompaction, {
                model: 'claude-3-7-sonnet-20250219',
            })

            // System messages in the middle should not have role: 'system'
            const systemMsg = antMessages.find((m) => m.role === 'system')
            expect(systemMsg).toBeUndefined()
            expect(antMessages[2].role).toBe('user')
        })
    })

    describe('normalizeForOpenAI', () => {
        const rawHistory: Message[] = [
            { role: 'user', content: 'write code' },
            {
                role: 'assistant',
                content: 'I will write it',
                thinking: 'thought process',
                toolCalls: [{ id: 'call_abc', name: 'write_file', input: '{"path":"app.ts"}' }],
            },
            {
                role: 'tool',
                toolCallId: 'call_abc',
                content: 'file written',
            },
        ]

        test('strips reasoning_content when target model is standard gpt-4o', () => {
            const oaiMessages = normalizeForOpenAI(rawHistory, {
                model: 'gpt-4o',
                supportsReasoning: false,
            })

            const asst = oaiMessages.find((m) => m.role === 'assistant') as any
            expect(asst).toBeDefined()
            expect(asst.reasoning_content).toBeUndefined()
            expect(asst.tool_calls).toHaveLength(1)
            expect(asst.tool_calls[0].id).toBe('call_abc')

            const toolMsg = oaiMessages.find((m) => m.role === 'tool') as any
            expect(toolMsg).toBeDefined()
            expect(toolMsg.tool_call_id).toBe('call_abc')
            expect(toolMsg.content).toBe('file written')
        })

        test('preserves reasoning_content when target supports reasoning (e.g. DeepSeek-Reasoner)', () => {
            const oaiMessages = normalizeForOpenAI(rawHistory, {
                model: 'deepseek-reasoner',
                supportsReasoning: true,
                supportsTools: false,
            })

            const asst = oaiMessages.find((m) => m.role === 'assistant') as any
            expect(asst).toBeDefined()
            expect(asst.reasoning_content).toBe('thought process')
        })

        test('converts tool calls and results to text transcript when model does not support tools', () => {
            // Models like DeepSeek-R1 reject tool_calls
            const oaiMessages = normalizeForOpenAI(rawHistory, {
                model: 'deepseek-reasoner',
                supportsTools: false,
            })

            const asst = oaiMessages.find((m) => m.role === 'assistant') as any
            expect(asst.tool_calls).toBeUndefined()
            expect(asst.content).toContain('write_file')

            // No 'tool' role messages because model does not support tool role
            const toolMsg = oaiMessages.find((m) => m.role === 'tool')
            expect(toolMsg).toBeUndefined()

            // The result is in user or assistant content
            const allText = oaiMessages.map((m) => m.content).join('\n')
            expect(allText).toContain('file written')
        })
    })

    describe('normalizeForGemini', () => {
        const rawHistory: Message[] = [
            { role: 'user', content: 'hello' },
            {
                role: 'assistant',
                content: 'checking files',
                thinking: 'thought from Claude',
                toolCalls: [
                    { id: 'call_1', name: 'read_file', input: '{"path":"a.ts"}' },
                    { id: 'call_2', name: 'read_file', input: '{"path":"b.ts"}' },
                ],
            },
            {
                role: 'tool',
                toolCallId: 'call_1',
                content: 'content of a',
            },
            {
                role: 'tool',
                toolCallId: 'call_2',
                content: 'content of b',
            },
        ]

        test('bundles tool responses into a single user message with functionResponse parts', () => {
            const geminiMessages = normalizeForGemini(rawHistory, {
                model: 'gemini-2.5-flash',
            })

            // Should alternate: user -> model -> user
            expect(geminiMessages).toHaveLength(3)
            expect(geminiMessages[0].role).toBe('user')
            expect(geminiMessages[1].role).toBe('model')
            expect(geminiMessages[2].role).toBe('user')

            // Check model functionCalls
            const modelParts = geminiMessages[1].parts
            const fnCalls = modelParts.filter((p) => p.functionCall)
            expect(fnCalls).toHaveLength(2)
            expect(fnCalls[0].functionCall?.name).toBe('read_file')
            expect(fnCalls[1].functionCall?.name).toBe('read_file')

            // Check user functionResponses
            const userParts = geminiMessages[2].parts
            const fnResponses = userParts.filter((p) => p.functionResponse)
            expect(fnResponses).toHaveLength(2)
            expect(fnResponses[0].functionResponse?.name).toBe('read_file')
            expect(fnResponses[0].functionResponse?.response).toEqual({ result: 'content of a' })
            expect(fnResponses[1].functionResponse?.name).toBe('read_file')
            expect(fnResponses[1].functionResponse?.response).toEqual({ result: 'content of b' })
        })

        test('omits thinking parts to prevent Gemini schema errors', () => {
            const geminiMessages = normalizeForGemini(rawHistory, {
                model: 'gemini-2.5-flash',
            })

            const modelParts = geminiMessages[1].parts
            for (const part of modelParts) {
                expect((part as any).thinking).toBeUndefined()
                expect((part as any).thought).toBeUndefined()
            }
        })

        test('merges consecutive user messages to maintain strict user-model alternation', () => {
            const consecutiveUserHistory: Message[] = [
                { role: 'user', content: 'message 1' },
                { role: 'user', content: 'message 2' },
                { role: 'assistant', content: 'reply' },
            ]

            const geminiMessages = normalizeForGemini(consecutiveUserHistory, {
                model: 'gemini-2.5-flash',
            })

            expect(geminiMessages).toHaveLength(2)
            expect(geminiMessages[0].role).toBe('user')
            expect(geminiMessages[1].role).toBe('model')
        })
    })

    describe('normalizeForProvider', () => {
        const rawHistory: Message[] = [
            { role: 'user', content: 'ping' },
            {
                role: 'assistant',
                content: 'pong',
                thinking: 'some thought',
                toolCalls: [{ id: 'tc1', name: 'bash', input: '{"command":"pwd"}' }],
            },
            { role: 'tool', toolCallId: 'tc1', content: '/workspace' },
        ]

        test('routes to anthropic normalizer for anthropic provider id', () => {
            const res = normalizeForProvider('anthropic', rawHistory, {
                model: 'claude-3-5-sonnet-20241022',
            })
            expect(res.provider).toBe('anthropic')
            expect(Array.isArray(res.messages)).toBe(true)
        })

        test('routes to openai normalizer for openai and openai-compatible provider ids', () => {
            const res = normalizeForProvider('openai', rawHistory, {
                model: 'gpt-4o',
            })
            expect(res.provider).toBe('openai')
            expect(Array.isArray(res.messages)).toBe(true)
        })

        test('routes to gemini normalizer for gemini and antigravity provider ids', () => {
            const res = normalizeForProvider('gemini', rawHistory, {
                model: 'gemini-2.5-flash',
            })
            expect(res.provider).toBe('gemini')
            expect(Array.isArray(res.messages)).toBe(true)
        })
    })
})
