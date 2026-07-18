import { describe, expect, test, mock } from 'bun:test'

import { openrouterProvider } from '../src/providers/openrouter'

// mock the openaiprovider factory to see what arguments it gets called with
mock.module('../src/providers/openai', () => {
    return {
        openaiProvider: mock((baseURL?: string, apiKey?: string, defaultHeaders?: any) => {
            return {
                id: 'openai',
                name: 'OpenAI',
                models: [],
                stream: async function* () {
                    yield { type: 'text', text: 'mocked' }
                },
                _mockArgs: { baseURL, apiKey, defaultHeaders }, // expose for testing
            }
        }),
    }
})

describe('OpenRouter Provider', () => {
    test('should wrap openaiProvider with correct headers and baseURL', () => {
        const provider = openrouterProvider('test-openrouter-key') as any

        expect(provider.id).toBe('openrouter')
        expect(provider._mockArgs.baseURL).toBe('https://openrouter.ai/api/v1')
        expect(provider._mockArgs.apiKey).toBe('test-openrouter-key')
        expect(provider._mockArgs.defaultHeaders).toEqual({
            'HTTP-Referer': 'https://trydecember.com',
            'X-Title': 'December',
        })
    })

    test('should fallback to process.env if no key provided', () => {
        process.env.OPENROUTER_API_KEY = 'env-openrouter-key'
        const provider = openrouterProvider() as any

        expect(provider._mockArgs.apiKey).toBe('env-openrouter-key')

        // cleanup
        delete process.env.OPENROUTER_API_KEY
    })
})
