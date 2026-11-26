import { describe, expect, it } from 'bun:test'

import {
    getOllamaApiOrigin,
    normalizeOllamaBaseUrl,
    ollamaProvider,
    OLLAMA_DEFAULT_BASE_URL,
    OLLAMA_DEFAULT_HOST,
    parseOllamaContextWindow,
    resolveModelsRequest,
    supportsReasoningEffort,
} from '../../src/index'

describe('Ollama provider adapter (Unit)', () => {
    it('normalizes Ollama base URLs and native origins', () => {
        expect(normalizeOllamaBaseUrl()).toBe(OLLAMA_DEFAULT_BASE_URL)
        expect(normalizeOllamaBaseUrl('http://localhost:11434')).toBe(OLLAMA_DEFAULT_BASE_URL)
        expect(normalizeOllamaBaseUrl('http://localhost:11434/')).toBe(OLLAMA_DEFAULT_BASE_URL)
        expect(normalizeOllamaBaseUrl('http://localhost:11434/v1')).toBe(OLLAMA_DEFAULT_BASE_URL)
        expect(normalizeOllamaBaseUrl('http://192.168.1.25:11434')).toBe(
            'http://192.168.1.25:11434/v1'
        )

        expect(getOllamaApiOrigin()).toBe(OLLAMA_DEFAULT_HOST)
        expect(getOllamaApiOrigin('http://localhost:11434/v1')).toBe(OLLAMA_DEFAULT_HOST)
        expect(getOllamaApiOrigin('http://192.168.1.25:11434/v1')).toBe('http://192.168.1.25:11434')
    })

    it('extracts context window from Ollama /api/show responses', () => {
        expect(
            parseOllamaContextWindow({
                model_info: { 'qwen3.context_length': 40960 },
            })
        ).toBe(40960)
        expect(
            parseOllamaContextWindow({
                parameters: 'temperature 0.7\nnum_ctx 16384',
                model_info: { 'llama.context_length': 131072 },
            })
        ).toBe(16384)
        expect(parseOllamaContextWindow({})).toBeUndefined()
    })

    it('instantiates ollamaProvider with id ollama', () => {
        const provider = ollamaProvider()
        expect(provider.id).toBe('ollama')
        expect(typeof provider.stream).toBe('function')
    })

    it('resolves model list requests without requiring an API key', () => {
        const req = resolveModelsRequest('ollama', 'ollama')!
        expect(req.url).toBe('http://localhost:11434/v1/models')
        expect(req.headers.Authorization).toBeUndefined()
        expect(req.verifiesKey).toBe(false)

        const custom = resolveModelsRequest('ollama', '', 'http://10.0.0.5:11434')!
        expect(custom.url).toBe('http://10.0.0.5:11434/v1/models')
    })

    it('disables reasoning_effort on Ollama endpoints', () => {
        expect(supportsReasoningEffort('qwen3:8b', 'http://localhost:11434/v1')).toBe(false)
    })
})
