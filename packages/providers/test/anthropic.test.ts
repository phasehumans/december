import { describe, expect, test, mock } from 'bun:test'

import { anthropicProvider } from '../src/providers/anthropic'

// Mock the Anthropic client module completely
mock.module('@anthropic-ai/sdk', () => {
    return {
        default: class MockAnthropic {
            public messages = {
                create: mock(async (options: any) => {
                    // Return an async iterable simulating a stream
                    return {
                        async *[Symbol.asyncIterator]() {
                            yield {
                                type: 'content_block_start',
                                index: 0,
                                content_block: { type: 'text', text: '' },
                            }
                            yield {
                                type: 'content_block_delta',
                                index: 0,
                                delta: { type: 'text_delta', text: 'Anthropic ' },
                            }
                            yield {
                                type: 'content_block_delta',
                                index: 0,
                                delta: { type: 'text_delta', text: 'says hi' },
                            }
                            yield {
                                type: 'content_block_start',
                                index: 1,
                                content_block: {
                                    type: 'tool_use',
                                    id: 'tool_1',
                                    name: 'search',
                                    input: {},
                                },
                            }
                            yield {
                                type: 'content_block_delta',
                                index: 1,
                                delta: { type: 'input_json_delta', partial_json: '{"q":"' },
                            }
                            yield {
                                type: 'content_block_delta',
                                index: 1,
                                delta: { type: 'input_json_delta', partial_json: 'test"}' },
                            }
                        },
                    }
                }),
            }
            public options: any
            constructor(options: any) {
                this.options = options
            }
        },
    }
})

describe('Anthropic Provider', () => {
    test('should initialize with correct API key', () => {
        const provider = anthropicProvider('test-anthropic-key')
        expect(provider.id).toBe('anthropic')
    })

    test('should stream text and tool chunks correctly', async () => {
        const provider = anthropicProvider('test-key')
        const gen = provider.stream([{ role: 'user', content: 'Say hi' }])

        const chunks: any[] = []
        for await (const chunk of gen) {
            chunks.push(chunk)
        }

        expect(chunks.length).toBe(5)
        expect(chunks[0]).toEqual({ type: 'text', text: 'Anthropic ' })
        expect(chunks[1]).toEqual({ type: 'text', text: 'says hi' })
        expect(chunks[2]).toEqual({
            type: 'tool_call_delta',
            id: 'tool_1',
            name: 'search',
            inputDelta: '',
        })
        expect(chunks[3]).toEqual({ type: 'tool_call_delta', id: 'tool_1', inputDelta: '{"q":"' })
        expect(chunks[4]).toEqual({ type: 'tool_call_delta', id: 'tool_1', inputDelta: 'test"}' })
    })
})
