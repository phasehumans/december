import { describe, expect, test } from 'bun:test'

import { anthropicProvider } from '../../src/providers/anthropic'
import { geminiProvider } from '../../src/providers/gemini'
import { openaiProvider } from '../../src/providers/openai'

import type { Message } from '../../src/types'

describe('Cross-Provider Context Migration (Integration)', () => {
    // Multi-turn conversation starting with thinking and multiple tool calls
    const conversationHistory: Message[] = [
        { role: 'user', content: 'Explore repository and read CONTEXT.md' },
        {
            role: 'assistant',
            content: 'Checking repository files now.',
            thinking: 'I need to check git status and read CONTEXT.md',
            thoughtSignature: 'sig_claude_123',
            toolCalls: [
                { id: 'call_bash_1', name: 'bash', input: '{"command":"ls"}' },
                { id: 'call_read_2', name: 'read_file', input: '{"path":"CONTEXT.md"}' },
            ],
        },
        {
            role: 'tool',
            toolCallId: 'call_bash_1',
            content: 'README.md\nCONTEXT.md',
        },
        {
            role: 'tool',
            toolCallId: 'call_read_2',
            content: '# December Agent Runtime',
        },
    ]

    test('switches mid-session to OpenAI gpt-4o without 400 schema validation errors', async () => {
        let capturedPayload: any = null

        const mockClient: any = {
            chat: {
                completions: {
                    create: async (payload: any) => {
                        capturedPayload = payload

                        // Validate payload schema against OpenAI specification
                        for (const msg of payload.messages) {
                            // gpt-4o rejects reasoning_content with 400 Bad Request
                            if (payload.model.includes('gpt-4o') && 'reasoning_content' in msg) {
                                throw new Error(
                                    '400 Bad Request: Unrecognized request argument: reasoning_content'
                                )
                            }
                            if (msg.role === 'assistant' && msg.tool_calls) {
                                for (const tc of msg.tool_calls) {
                                    if (tc.type !== 'function' || !tc.function.name) {
                                        throw new Error(
                                            '400 Bad Request: Malformed tool_calls structure'
                                        )
                                    }
                                }
                            }
                        }

                        return (async function* () {
                            yield {
                                choices: [
                                    { delta: { content: 'Next OpenAI generation successful' } },
                                ],
                            }
                        })()
                    },
                },
            },
        }

        const provider = openaiProvider(undefined, 'test-key', undefined, mockClient)
        const chunks: any[] = []

        const stream = provider.stream(conversationHistory, undefined, undefined, {
            model: 'gpt-4o',
        })

        for await (const chunk of stream) {
            chunks.push(chunk)
        }

        expect(chunks.some((c) => c.text === 'Next OpenAI generation successful')).toBe(true)
        expect(capturedPayload).not.toBeNull()
        expect(capturedPayload.model).toBe('gpt-4o')

        const messages = capturedPayload.messages
        // System message + user + assistant + 2 tool messages
        expect(messages.length).toBeGreaterThanOrEqual(4)

        const asst = messages.find((m: any) => m.role === 'assistant')
        expect(asst).toBeDefined()
        expect(asst.tool_calls).toHaveLength(2)
        expect(asst.tool_calls[0].id).toBe('call_bash_1')
        expect(asst.tool_calls[1].id).toBe('call_read_2')

        // Tool messages must follow sequentially with matching tool_call_id
        const toolMsgs = messages.filter((m: any) => m.role === 'tool')
        expect(toolMsgs).toHaveLength(2)
        expect(toolMsgs[0].tool_call_id).toBe('call_bash_1')
        expect(toolMsgs[0].content).toBe('README.md\nCONTEXT.md')
        expect(toolMsgs[1].tool_call_id).toBe('call_read_2')
        expect(toolMsgs[1].content).toBe('# December Agent Runtime')
    })

    test('switches mid-session to Google Gemini without alternating turn or name mismatch errors', async () => {
        let capturedPayload: any = null

        const mockClient: any = {
            models: {
                generateContentStream: async (payload: any) => {
                    capturedPayload = payload

                    // Validate Gemini API constraints
                    let lastRole: string | null = null
                    for (const content of payload.contents) {
                        // Gemini requires strict alternating turns (user <-> model)
                        if (content.role === lastRole) {
                            throw new Error(
                                `400 Bad Request: Consecutive turns with role ${content.role} are forbidden`
                            )
                        }
                        lastRole = content.role

                        // Function responses must have a valid tool name
                        for (const part of content.parts) {
                            if (
                                part.functionResponse &&
                                (!part.functionResponse.name ||
                                    part.functionResponse.name === 'unknown')
                            ) {
                                throw new Error(
                                    '400 Bad Request: functionResponse missing matched function name'
                                )
                            }
                            if ((part as any).thinking || (part as any).thought) {
                                throw new Error(
                                    '400 Bad Request: Gemini parts do not support thinking blocks'
                                )
                            }
                        }
                    }

                    return (async function* () {
                        yield {
                            candidates: [
                                { content: { parts: [{ text: 'Gemini continuation succeeded' }] } },
                            ],
                        }
                    })()
                },
            },
        }

        const provider = geminiProvider('test-api-key', mockClient)
        const chunks: any[] = []

        const stream = provider.stream(conversationHistory, undefined, undefined, {
            model: 'gemini-2.5-flash',
        })

        for await (const chunk of stream) {
            chunks.push(chunk)
        }

        expect(chunks.some((c) => c.text === 'Gemini continuation succeeded')).toBe(true)
        expect(capturedPayload).not.toBeNull()

        const contents = capturedPayload.contents
        // Must alternate: user -> model -> user
        expect(contents).toHaveLength(3)
        expect(contents[0].role).toBe('user')
        expect(contents[1].role).toBe('model')
        expect(contents[2].role).toBe('user')

        // Model turn has function calls
        const fnCalls = contents[1].parts.filter((p: any) => p.functionCall)
        expect(fnCalls).toHaveLength(2)
        expect(fnCalls[0].functionCall.name).toBe('bash')
        expect(fnCalls[1].functionCall.name).toBe('read_file')

        // User turn bundles both function responses with matching names
        const fnResponses = contents[2].parts.filter((p: any) => p.functionResponse)
        expect(fnResponses).toHaveLength(2)
        expect(fnResponses[0].functionResponse.name).toBe('bash')
        expect(fnResponses[0].functionResponse.response).toEqual({
            result: 'README.md\nCONTEXT.md',
        })
        expect(fnResponses[1].functionResponse.name).toBe('read_file')
        expect(fnResponses[1].functionResponse.response).toEqual({
            result: '# December Agent Runtime',
        })
    })

    test('switches mid-session to DeepSeek Reasoner converting tool calls to readable text transcript', async () => {
        let capturedPayload: any = null

        const mockClient: any = {
            chat: {
                completions: {
                    create: async (payload: any) => {
                        capturedPayload = payload

                        // DeepSeek reasoner strictly rejects tool_calls in request
                        if (payload.model.includes('deepseek-reasoner') && payload.tools) {
                            throw new Error(
                                '400 Bad Request: DeepSeek Reasoner does not support tools'
                            )
                        }
                        for (const msg of payload.messages) {
                            if (msg.tool_calls) {
                                throw new Error(
                                    '400 Bad Request: tool_calls not supported on deepseek-reasoner'
                                )
                            }
                            if (msg.role === 'tool') {
                                throw new Error(
                                    '400 Bad Request: role tool not supported on deepseek-reasoner'
                                )
                            }
                        }

                        return (async function* () {
                            yield {
                                choices: [{ delta: { content: 'DeepSeek generation completed' } }],
                            }
                        })()
                    },
                },
            },
        }

        const provider = openaiProvider(
            'https://api.deepseek.com',
            'test-key',
            undefined,
            mockClient
        )
        const chunks: any[] = []

        const stream = provider.stream(conversationHistory, undefined, undefined, {
            model: 'deepseek-reasoner',
        })

        for await (const chunk of stream) {
            chunks.push(chunk)
        }

        expect(chunks.some((c) => c.text === 'DeepSeek generation completed')).toBe(true)
        expect(capturedPayload).not.toBeNull()

        // Tools and tool roles should be converted to clean conversation text
        const messages = capturedPayload.messages
        expect(messages.some((m: any) => m.role === 'tool')).toBe(false)

        const asst = messages.find((m: any) => m.role === 'assistant')
        expect(asst.tool_calls).toBeUndefined()
        expect(asst.content).toContain('bash')
        expect(asst.content).toContain('read_file')

        // Context contains the tool results in user text
        const userMsgWithResults = messages.find(
            (m: any) => m.role === 'user' && m.content.includes('December Agent Runtime')
        )
        expect(userMsgWithResults).toBeDefined()
    })

    test('switches back to Claude 3.5 Sonnet bundling tool results into single user message and omitting unsupported thinking', async () => {
        let capturedPayload: any = null

        const mockClient: any = {
            messages: {
                create: async (payload: any) => {
                    capturedPayload = payload

                    // Verify Anthropic schema constraints
                    let prevRole: string | null = null
                    for (const msg of payload.messages) {
                        if (msg.role === prevRole) {
                            throw new Error(
                                `400 Bad Request: Consecutive messages with role ${msg.role} violate Anthropic API schema`
                            )
                        }
                        prevRole = msg.role

                        if (Array.isArray(msg.content)) {
                            for (const block of msg.content) {
                                // Claude 3.5 Sonnet rejects thinking blocks
                                if (
                                    payload.model.includes('claude-3-5') &&
                                    block.type === 'thinking'
                                ) {
                                    throw new Error(
                                        '400 Bad Request: thinking block is not permitted for claude-3-5-sonnet'
                                    )
                                }
                            }
                        }
                    }

                    return (async function* () {
                        yield {
                            type: 'content_block_delta',
                            index: 0,
                            delta: {
                                type: 'text_delta',
                                text: 'Claude 3.5 continuation succeeded',
                            },
                        }
                    })()
                },
            },
        }

        const provider = anthropicProvider(undefined, 'test-key', undefined, mockClient)
        const chunks: any[] = []

        const stream = provider.stream(conversationHistory, undefined, undefined, {
            model: 'claude-3-5-sonnet-20241022',
        })

        for await (const chunk of stream) {
            chunks.push(chunk)
        }

        expect(chunks.some((c) => c.text === 'Claude 3.5 continuation succeeded')).toBe(true)
        expect(capturedPayload).not.toBeNull()

        const messages = capturedPayload.messages
        // Must alternate: user -> assistant -> user (containing BOTH tool_result blocks)
        expect(messages).toHaveLength(3)
        expect(messages[0].role).toBe('user')
        expect(messages[1].role).toBe('assistant')
        expect(messages[2].role).toBe('user')

        // Check assistant tool_use blocks
        const toolUseBlocks = messages[1].content.filter((b: any) => b.type === 'tool_use')
        expect(toolUseBlocks).toHaveLength(2)

        // Check user tool_result blocks are bundled into the single message
        const toolResultBlocks = messages[2].content.filter((b: any) => b.type === 'tool_result')
        expect(toolResultBlocks).toHaveLength(2)
        expect(toolResultBlocks[0].tool_use_id).toBe('call_bash_1')
        expect(toolResultBlocks[1].tool_use_id).toBe('call_read_2')

        // Verify no thinking block was sent to Claude 3.5 Sonnet
        const thinkingBlock = messages[1].content.find((b: any) => b.type === 'thinking')
        expect(thinkingBlock).toBeUndefined()
    })
})
