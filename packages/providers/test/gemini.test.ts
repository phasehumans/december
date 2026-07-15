import { describe, expect, test, mock } from 'bun:test'
import { geminiProvider } from '../src/providers/gemini'

// Mock the Gemini client module completely
mock.module('@google/genai', () => {
    return {
        GoogleGenAI: class MockGoogleGenAI {
            public models = {
                generateContentStream: mock(async (options: any) => {
                    // Return an async iterable simulating a stream
                    return {
                        async *[Symbol.asyncIterator]() {
                            yield { candidates: [{ content: { parts: [{ text: 'Gemini ' }] } }] }
                            yield { candidates: [{ content: { parts: [{ text: 'hello' }] } }] }
                            yield {
                                candidates: [
                                    {
                                        content: {
                                            parts: [
                                                {
                                                    functionCall: {
                                                        id: 'call_1',
                                                        name: 'calculate',
                                                        args: { equation: '1+1' },
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
            }
            public options: any
            constructor(options: any) {
                this.options = options
            }
        },
    }
})

describe('Gemini Provider', () => {
    test('should initialize with correct API key', () => {
        const provider = geminiProvider('test-gemini-key')
        expect(provider.id).toBe('gemini')
    })

    test('should stream text and tool chunks correctly', async () => {
        const provider = geminiProvider('test-key')
        const gen = provider.stream([{ role: 'user', content: 'Say hi' }])

        const chunks: any[] = []
        for await (const chunk of gen) {
            chunks.push(chunk)
        }

        expect(chunks.length).toBe(3)
        expect(chunks[0]).toEqual({ type: 'text', text: 'Gemini ' })
        expect(chunks[1]).toEqual({ type: 'text', text: 'hello' })
        expect(chunks[2].type).toBe('tool_call_delta')
        expect(chunks[2].name).toBe('calculate')
        expect(chunks[2].inputDelta).toBe('{"equation":"1+1"}')
    })
})
