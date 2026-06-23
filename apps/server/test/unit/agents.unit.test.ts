import { describe, expect, test } from 'bun:test'

import {
    retryAsync,
    readChatCompletionText,
    parseModelJson,
} from '../../src/modules/agent/agents.utils'

describe('agent utils', () => {
    describe('retryAsync', () => {
        test('should succeed immediately if the task succeeds', async () => {
            const res = await retryAsync({
                label: 'test-success',
                maxAttempts: 3,
                initialDelayMs: 1,
                maxDelayMs: 2,
                task: async (attempt) => `success-${attempt}`,
            })
            expect(res).toBe('success-1')
        })

        test('should retry and succeed if subsequent attempt succeeds', async () => {
            let calls = 0
            const res = await retryAsync({
                label: 'test-retry-success',
                maxAttempts: 3,
                initialDelayMs: 1,
                maxDelayMs: 2,
                task: async (attempt) => {
                    calls++
                    if (calls < 2) {
                        throw new Error('fail')
                    }
                    return 'success'
                },
            })
            expect(res).toBe('success')
            expect(calls).toBe(2)
        })

        test('should throw error after maxAttempts reached', async () => {
            let calls = 0
            const action = () =>
                retryAsync({
                    label: 'test-fail',
                    maxAttempts: 3,
                    initialDelayMs: 1,
                    maxDelayMs: 2,
                    task: async () => {
                        calls++
                        throw new Error('fail always')
                    },
                })
            expect(action()).rejects.toThrow('test-fail failed after 3 attempts | fail always')
            expect(calls).toBe(3)
        })
    })

    describe('readChatCompletionText', () => {
        test('should return content string when it is a string', () => {
            const completion = {
                choices: [{ message: { content: 'hello world' } }],
            }
            expect(readChatCompletionText(completion)).toBe('hello world')
        })

        test('should return joint text when content is an array of parts', () => {
            const completion = {
                choices: [
                    {
                        message: {
                            content: [
                                'hello ',
                                { type: 'text', text: 'world' },
                                { type: 'image' }, // no text property
                            ],
                        },
                    },
                ],
            }
            expect(readChatCompletionText(completion)).toBe('hello world')
        })

        test('should return null if content is missing or null', () => {
            expect(readChatCompletionText(null)).toBe(null)
            expect(readChatCompletionText(undefined)).toBe(null)
            expect(readChatCompletionText({ choices: [] })).toBe(null)
        })
    })

    describe('parseModelJson', () => {
        test('should parse valid JSON', () => {
            const res = parseModelJson<{ foo: string }>('{"foo": "bar"}', 'test-agent')
            expect(res).toEqual({ foo: 'bar' })
        })

        test('should parse JSON wrapped in markdown code fence', () => {
            const res = parseModelJson<{ foo: string }>(
                '```json\n{"foo": "bar"}\n```',
                'test-agent'
            )
            expect(res).toEqual({ foo: 'bar' })
        })

        test('should extract and parse JSON from text around it', () => {
            const res = parseModelJson<{ foo: string }>(
                'Here is the data: {"foo": "bar"} hope it helps!',
                'test-agent'
            )
            expect(res).toEqual({ foo: 'bar' })
        })

        test('should handle and escape control characters inside string properties', () => {
            const raw = '{"message": "hello\nworld"}'
            const res = parseModelJson<{ message: string }>(raw, 'test-agent')
            expect(res.message).toBe('hello\nworld')
        })

        test('should throw error for invalid JSON', () => {
            expect(() => parseModelJson('not a json', 'test-agent')).toThrow(
                'invalid JSON response | test-agent'
            )
        })
    })
})
