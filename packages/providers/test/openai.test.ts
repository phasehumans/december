import { describe, expect, test, mock, afterEach } from 'bun:test'
import { openaiProvider } from '../src/providers/openai'

// Mock the OpenAI client module completely
mock.module('openai', () => {
    return {
        OpenAI: class MockOpenAI {
            public chat = {
                completions: {
                    create: mock(async (options: any) => {
                        // Return an async iterable simulating a stream
                        return {
                            async *[Symbol.asyncIterator]() {
                                yield { choices: [{ delta: { content: 'hello ' } }] }
                                yield { choices: [{ delta: { content: 'world' } }] }
                                yield {
                                    choices: [
                                        {
                                            delta: {
                                                tool_calls: [
                                                    {
                                                        id: 'call_1',
                                                        index: 0,
                                                        function: {
                                                            name: 'get_weather',
                                                            arguments: '{"location":"Paris"}',
                                                        },
                                                    },
                                                ],
                                            },
                                        },
                                    ],
                                }
                            },
                        }
                    }),
                },
            }
            public options: any
            constructor(options: any) {
                this.options = options
            }
        },
    }
})

describe('OpenAI Provider', () => {
    const origEnv = process.env.OPENAI_API_KEY

    afterEach(() => {
        process.env.OPENAI_API_KEY = origEnv
    })

    test('should initialize with correct API key', () => {
        const provider = openaiProvider('https://custom.api', 'test-key')
        expect(provider.id).toBe('openai')
    })

    test('should stream text chunks correctly', async () => {
        const provider = openaiProvider(undefined, 'test-key')
        const gen = provider.stream([{ role: 'user', content: 'Say hello' }])

        const chunks: any[] = []
        for await (const chunk of gen) {
            chunks.push(chunk)
        }

        expect(chunks.length).toBe(3)
        expect(chunks[0]).toEqual({ type: 'text', text: 'hello ' })
        expect(chunks[1]).toEqual({ type: 'text', text: 'world' })
        expect(chunks[2]).toEqual({
            type: 'tool_call_delta',
            id: 'call_1',
            name: 'get_weather',
            inputDelta: '{"location":"Paris"}',
        })
    })
})
