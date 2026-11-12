import { describe, expect, it } from 'bun:test'

import {
    antigravityProvider,
    AntigravityProvider,
    resolveAntigravityModel,
    ANTIGRAVITY_DEFAULT_ENDPOINT,
} from '../../src/providers/antigravity'

import type { Message, ProviderTool } from '../../src/types'

describe('Antigravity Provider Adapter (Unit)', () => {
    it('resolves model aliases and strips antigravity/ and google/ prefixes correctly', () => {
        expect(resolveAntigravityModel('gemini-3.7-flash')).toBe('gemini-3.7-flash-tiered')
        expect(resolveAntigravityModel('antigravity/gemini-3.7-flash')).toBe(
            'gemini-3.7-flash-tiered'
        )
        expect(resolveAntigravityModel('google/gemini-3.7-flash')).toBe('gemini-3.7-flash-tiered')
        expect(resolveAntigravityModel('antigravity/gemini-3.6-flash')).toBe(
            'gemini-3.6-flash-high'
        )
        expect(resolveAntigravityModel('gemini-3.1-pro')).toBe('gemini-pro-agent')
        expect(resolveAntigravityModel('antigravity/gemini-3.1-pro')).toBe('gemini-pro-agent')
        expect(resolveAntigravityModel()).toBe('gemini-3.8-flash-tiered')
    })

    it('instantiates AntigravityProvider class wrapper correctly', () => {
        const provider = new AntigravityProvider('test-oauth-token')
        expect(provider.id).toBe('antigravity')
        expect(typeof provider.stream).toBe('function')
    })

    it('streams SSE chunks and yields thinking_delta, text, tool_call_delta, and usage', async () => {
        let capturedUrl = ''
        let capturedOptions: any = null

        const sseData = [
            'data: {"candidates":[{"content":{"parts":[{"thought":true,"text":"Thinking about user request..."}]}}]}\n\n',
            'data: {"candidates":[{"content":{"parts":[{"text":"Here is the file list:"}]}}]}\n\n',
            'data: {"candidates":[{"content":{"parts":[{"functionCall":{"name":"list_dir","args":{"DirectoryPath":"/home/code"}}}]}}],"usageMetadata":{"promptTokenCount":42,"candidatesTokenCount":18}}\n\n',
        ].join('')

        const mockFetch: typeof fetch = async (url, options) => {
            capturedUrl = String(url)
            capturedOptions = options

            const encoder = new TextEncoder()
            const stream = new ReadableStream({
                start(controller) {
                    controller.enqueue(encoder.encode(sseData))
                    controller.close()
                },
            })

            return new Response(stream, {
                status: 200,
                headers: { 'Content-Type': 'text/event-stream' },
            })
        }

        const provider = antigravityProvider('ya29.test-bearer-token', {
            fetchFn: mockFetch,
            projectId: 'test-antigravity-project',
        })

        const messages: Message[] = [{ role: 'user', content: 'List directory' }]
        const tools: ProviderTool[] = [
            {
                name: 'list_dir',
                description: 'List directory contents',
                inputSchema: {
                    type: 'object',
                    properties: {
                        DirectoryPath: { type: 'string' },
                    },
                    required: ['DirectoryPath'],
                },
            },
        ]

        const stream = provider.stream(messages, tools, 'You are an AI assistant', {
            model: 'antigravity/gemini-3.7-flash',
            temperature: 0.3,
        })

        const chunks: any[] = []
        for await (const chunk of stream) {
            chunks.push(chunk)
        }

        expect(capturedUrl).toBe(
            `${ANTIGRAVITY_DEFAULT_ENDPOINT}/v1internal:streamGenerateContent?alt=sse`
        )
        expect(capturedOptions.method).toBe('POST')
        expect(capturedOptions.headers['Authorization']).toBe('Bearer ya29.test-bearer-token')
        expect(capturedOptions.headers['Accept']).toBe('text/event-stream')
        expect(capturedOptions.headers['User-Agent']).toContain('google-antigravity-cli')
        expect(capturedOptions.headers['x-goog-user-project']).toBe('test-antigravity-project')

        const requestBody = JSON.parse(capturedOptions.body)
        expect(requestBody.project).toBe('test-antigravity-project')
        expect(requestBody.model).toBe('gemini-3.7-flash-tiered')
        expect(requestBody.request.systemInstruction).toEqual({
            parts: [{ text: 'You are an AI assistant' }],
        })
        expect(requestBody.request.tools[0].functionDeclarations[0].name).toBe('list_dir')
        expect(requestBody.request.generationConfig.temperature).toBe(0.3)

        expect(chunks).toEqual([
            { type: 'thinking_delta', text: 'Thinking about user request...' },
            { type: 'text', text: 'Here is the file list:' },
            {
                type: 'tool_call_delta',
                id: expect.any(String),
                name: 'list_dir',
                inputDelta: JSON.stringify({ DirectoryPath: '/home/code' }),
            },
            { type: 'usage', promptTokens: 42, completionTokens: 18 },
        ])
    })

    it('maps thinkingLevel correctly in generationConfig', async () => {
        let capturedBody: any = null

        const mockFetch: typeof fetch = async (_url, options) => {
            capturedBody = JSON.parse(String(options?.body))
            const encoder = new TextEncoder()
            const stream = new ReadableStream({
                start(controller) {
                    controller.enqueue(
                        encoder.encode(
                            'data: {"candidates":[{"content":{"parts":[{"text":"ok"}]}}]}\n\n'
                        )
                    )
                    controller.close()
                },
            })
            return new Response(stream, { status: 200 })
        }

        const provider = antigravityProvider('token', { fetchFn: mockFetch })

        // 1. Fast thinking level
        for await (const _ of provider.stream([{ role: 'user', content: 'test' }], [], undefined, {
            thinkingLevel: 'fast',
        })) {
            // consume
        }
        expect(capturedBody.request.generationConfig.thinkingConfig).toEqual({
            thinkingBudget: 1024,
            includeThoughts: true,
        })

        // 2. Deep thinking level
        for await (const _ of provider.stream([{ role: 'user', content: 'test' }], [], undefined, {
            thinkingLevel: 'deep',
        })) {
            // consume
        }
        expect(capturedBody.request.generationConfig.thinkingConfig).toEqual({
            thinkingBudget: 8192,
            includeThoughts: true,
        })

        // 3. Off thinking level
        for await (const _ of provider.stream([{ role: 'user', content: 'test' }], [], undefined, {
            thinkingLevel: 'off',
        })) {
            // consume
        }
        expect(capturedBody.request.generationConfig.thinkingConfig).toEqual({
            thinkingBudget: 0,
        })
    })

    it('throws descriptive error on non-200 HTTP response', async () => {
        const mockFetch: typeof fetch = async () => {
            return new Response(
                JSON.stringify({
                    error: {
                        code: 403,
                        message: 'Antigravity quota exceeded or unauthorized',
                    },
                }),
                { status: 403, statusText: 'Forbidden' }
            )
        }

        const provider = antigravityProvider('bad-token', { fetchFn: mockFetch })

        let thrownError: any = null
        try {
            const stream = provider.stream([{ role: 'user', content: 'hi' }])
            for await (const _ of stream) {
                // consume
            }
        } catch (err) {
            thrownError = err
        }

        expect(thrownError).not.toBeNull()
        expect(thrownError.message).toContain('Antigravity API error (403)')
        expect(thrownError.message).toContain('Antigravity quota exceeded or unauthorized')
    })

    it('dynamically calls getToken before stream to refresh bearer token', async () => {
        let authHeader = ''
        const mockFetch: typeof fetch = async (_url, options) => {
            authHeader = (options?.headers as any)?.['Authorization']
            const encoder = new TextEncoder()
            const stream = new ReadableStream({
                start(controller) {
                    controller.enqueue(
                        encoder.encode(
                            'data: {"candidates":[{"content":{"parts":[{"text":"hello"}]}}]}\n\n'
                        )
                    )
                    controller.close()
                },
            })
            return new Response(stream, {
                status: 200,
                headers: { 'Content-Type': 'text/event-stream' },
            })
        }

        const getToken = async () => 'ya29.refreshed-dynamic-token'
        const provider = antigravityProvider('ya29.stale-token', {
            fetchFn: mockFetch,
            getToken,
        })

        const stream = provider.stream([{ role: 'user', content: 'test' }])
        for await (const _ of stream) {
            // consume
        }

        expect(authHeader).toBe('Bearer ya29.refreshed-dynamic-token')
    })

    it('retries request once with fresh token when initial response is 401 unauthorized', async () => {
        let attempts = 0
        const tokensUsed: string[] = []

        const mockFetch: typeof fetch = async (_url, options) => {
            attempts++
            const auth = (options?.headers as any)?.['Authorization']
            tokensUsed.push(auth)

            if (attempts === 1) {
                return new Response('Unauthorized: token expired', { status: 401 })
            }

            const encoder = new TextEncoder()
            const stream = new ReadableStream({
                start(controller) {
                    controller.enqueue(
                        encoder.encode(
                            'data: {"candidates":[{"content":{"parts":[{"text":"success after 401 retry"}]}}]}\n\n'
                        )
                    )
                    controller.close()
                },
            })
            return new Response(stream, {
                status: 200,
                headers: { 'Content-Type': 'text/event-stream' },
            })
        }

        let tokenCounter = 0
        const getToken = async () => {
            tokenCounter++
            return tokenCounter === 1 ? 'ya29.initial-token' : 'ya29.freshly-refreshed-token'
        }

        const provider = antigravityProvider('ya29.initial-token', {
            fetchFn: mockFetch,
            getToken,
        })

        const chunks: any[] = []
        const stream = provider.stream([{ role: 'user', content: 'test' }])
        for await (const chunk of stream) {
            chunks.push(chunk)
        }

        expect(attempts).toBe(2)
        expect(tokensUsed[0]).toBe('Bearer ya29.initial-token')
        expect(tokensUsed[1]).toBe('Bearer ya29.freshly-refreshed-token')
        expect(chunks.some((c) => c.text === 'success after 401 retry')).toBe(true)
    })

    it('throws descriptive error when SSE stream chunk contains an error payload', async () => {
        const sseError =
            'data: {"error":{"code":429,"message":"Resource has been exhausted","status":"RESOURCE_EXHAUSTED"}}\n\n'

        const mockFetch: typeof fetch = async () => {
            const encoder = new TextEncoder()
            const stream = new ReadableStream({
                start(controller) {
                    controller.enqueue(encoder.encode(sseError))
                    controller.close()
                },
            })
            return new Response(stream, {
                status: 200,
                headers: { 'Content-Type': 'text/event-stream' },
            })
        }

        const provider = antigravityProvider('ya29.test-token', { fetchFn: mockFetch })

        let thrownError: any = null
        try {
            const stream = provider.stream([{ role: 'user', content: 'test' }])
            for await (const _ of stream) {
                // consume
            }
        } catch (err) {
            thrownError = err
        }

        expect(thrownError).not.toBeNull()
        expect(thrownError.message).toContain('Antigravity stream error')
        expect(thrownError.message).toContain('Resource has been exhausted')
    })

    it('throws descriptive error when candidate finishReason indicates safety or recitation blockage', async () => {
        const sseBlocked =
            'data: {"candidates":[{"finishReason":"SAFETY","content":{"parts":[]}}]}\n\n'

        const mockFetch: typeof fetch = async () => {
            const encoder = new TextEncoder()
            const stream = new ReadableStream({
                start(controller) {
                    controller.enqueue(encoder.encode(sseBlocked))
                    controller.close()
                },
            })
            return new Response(stream, {
                status: 200,
                headers: { 'Content-Type': 'text/event-stream' },
            })
        }

        const provider = antigravityProvider('ya29.test-token', { fetchFn: mockFetch })

        let thrownError: any = null
        try {
            const stream = provider.stream([{ role: 'user', content: 'test' }])
            for await (const _ of stream) {
                // consume
            }
        } catch (err) {
            thrownError = err
        }

        expect(thrownError).not.toBeNull()
        expect(thrownError.message).toContain('Gemini output blocked due to safety settings')
    })

    it('extracts snake_case thought_signature from parts and candidate', async () => {
        const sseData = [
            'data: {"candidates":[{"content":{"parts":[{"functionCall":{"name":"bash","args":{"command":"ls"}},"thought_signature":"sig_snake_123"}]}}]}\n\n',
        ].join('')

        const mockFetch: typeof fetch = async () => {
            const encoder = new TextEncoder()
            const stream = new ReadableStream({
                start(controller) {
                    controller.enqueue(encoder.encode(sseData))
                    controller.close()
                },
            })
            return new Response(stream, {
                status: 200,
                headers: { 'Content-Type': 'text/event-stream' },
            })
        }

        const provider = antigravityProvider('ya29.test-token', { fetchFn: mockFetch })
        const chunks: any[] = []
        for await (const chunk of provider.stream([{ role: 'user', content: 'test' }])) {
            chunks.push(chunk)
        }

        expect(chunks).toEqual([
            { type: 'thought_signature', signature: 'sig_snake_123' },
            {
                type: 'tool_call_delta',
                id: expect.any(String),
                name: 'bash',
                inputDelta: '{"command":"ls"}',
                thoughtSignature: 'sig_snake_123',
            },
        ])
    })

    it('throws descriptive error when SSE chunk contains HTML gateway error instead of JSON', async () => {
        const sseData = 'data: <html><body>502 Bad Gateway</body></html>\n\n'

        const mockFetch: typeof fetch = async () => {
            const encoder = new TextEncoder()
            const stream = new ReadableStream({
                start(controller) {
                    controller.enqueue(encoder.encode(sseData))
                    controller.close()
                },
            })
            return new Response(stream, {
                status: 200,
                headers: { 'Content-Type': 'text/event-stream' },
            })
        }

        const provider = antigravityProvider('ya29.test-token', { fetchFn: mockFetch })
        let thrownError: any = null
        try {
            for await (const _ of provider.stream([{ role: 'user', content: 'test' }])) {
                // consume
            }
        } catch (err) {
            thrownError = err
        }

        expect(thrownError).not.toBeNull()
        expect(thrownError.message).toContain('Upstream gateway error')
        expect(thrownError.message).toContain('502 Bad Gateway')
    })

    it('throws descriptive error when stream finishes with 0 valid chunks and unparsed buffer data', async () => {
        const mockFetch: typeof fetch = async () => {
            const encoder = new TextEncoder()
            const stream = new ReadableStream({
                start(controller) {
                    controller.enqueue(encoder.encode('Internal Server Error without SSE format'))
                    controller.close()
                },
            })
            return new Response(stream, {
                status: 200,
                headers: { 'Content-Type': 'text/event-stream' },
            })
        }

        const provider = antigravityProvider('ya29.test-token', { fetchFn: mockFetch })
        let thrownError: any = null
        try {
            for await (const _ of provider.stream([{ role: 'user', content: 'test' }])) {
                // consume
            }
        } catch (err) {
            thrownError = err
        }

        expect(thrownError).not.toBeNull()
        expect(thrownError.message).toContain(
            'Upstream connection closed without valid stream data'
        )
    })
})
