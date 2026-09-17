import { describe, expect, it } from 'bun:test'

import {
    getModelContextWindow,
    createProvider,
    MODEL_CONTEXT_WINDOWS,
    supportsModelThinking,
} from '../../src/models'

describe('Models Utility & Context Windows (Unit)', () => {
    it('returns exact context window size for known model names in lookup map', () => {
        expect(getModelContextWindow('gemini-3.7-flash')).toBe(1000000)
        expect(getModelContextWindow('gemini-3.6-flash')).toBe(1000000)
        expect(getModelContextWindow('gemini-3.5-flash')).toBe(1000000)
        expect(getModelContextWindow('gemini-3-pro-preview')).toBe(1000000)
        expect(getModelContextWindow('gemini-3.1-pro')).toBe(1000000)
        expect(getModelContextWindow('claude-3-7-sonnet-latest')).toBe(200000)
        expect(getModelContextWindow('claude-3-5-sonnet-20241022')).toBe(200000)
        expect(getModelContextWindow('o3-mini')).toBe(200000)
        expect(getModelContextWindow('o1')).toBe(200000)
        expect(getModelContextWindow('gpt-4o')).toBe(128000)
        expect(getModelContextWindow('gpt-4o-mini')).toBe(128000)
        expect(getModelContextWindow('deepseek-chat')).toBe(128000)
        expect(getModelContextWindow('trinity-large-thinking')).toBe(262144)
        expect(getModelContextWindow('thinkingmachines/inkling-small')).toBe(262144)
        expect(getModelContextWindow('zai-org/glm-5.2')).toBe(262144)
        expect(getModelContextWindow('moonshotai/kimi-k3')).toBe(1000000)
        expect(getModelContextWindow('kimi-k3')).toBe(1048576)
        expect(getModelContextWindow('kimi-k2.7-code')).toBe(262144)
        expect(getModelContextWindow('kimi-k2.6')).toBe(262144)
        expect(getModelContextWindow('mistral-large-latest')).toBe(262144)
        expect(getModelContextWindow('magistral-medium-latest')).toBe(128000)
        expect(getModelContextWindow('ministral-8b-latest')).toBe(128000)
        expect(getModelContextWindow('deepseek/deepseek-v4-flash-latest')).toBe(1000000)
        expect(getModelContextWindow('muse-spark-1.3')).toBe(1048576)
        expect(getModelContextWindow('MiniMax-M3')).toBe(1000000)
        expect(getModelContextWindow('MiniMax-M2.7')).toBe(204800)
    })

    it('returns inferred context window size based on model name substring heuristics', () => {
        expect(getModelContextWindow('custom-gemini-model')).toBe(1000000)
        expect(getModelContextWindow('custom-claude-model')).toBe(200000)
        expect(getModelContextWindow('o3-mini-custom')).toBe(200000)
        expect(getModelContextWindow('custom-minimax-m3-preview')).toBe(1000000)
        expect(getModelContextWindow('custom-minimax-m2.7-turbo')).toBe(204800)
        expect(getModelContextWindow('gpt-4.5-preview')).toBe(128000)
        expect(getModelContextWindow('gpt-4-custom')).toBe(128000)
        expect(getModelContextWindow('gpt-3.5-turbo')).toBe(16385)
        expect(getModelContextWindow('deepseek-v3')).toBe(128000)
        expect(getModelContextWindow('llama-3.3-70b')).toBe(128000)
        expect(getModelContextWindow('llama-3.1-8b')).toBe(128000)
        expect(getModelContextWindow('custom-trinity-model')).toBe(262144)
        expect(getModelContextWindow('custom-muse-spark-model')).toBe(1048576)
        expect(getModelContextWindow('inkling-small')).toBe(262144)
        expect(getModelContextWindow('model-128k-context')).toBe(131072)
        expect(getModelContextWindow('model-32k-context')).toBe(32768)
        expect(getModelContextWindow('model-8192-context')).toBe(8192)
        expect(getModelContextWindow('model-8k-context')).toBe(8192)
    })

    it('returns default fallback context window size (100000) for unknown or empty model names', () => {
        expect(getModelContextWindow('')).toBe(100000)
        expect(getModelContextWindow(null as any)).toBe(100000)
        expect(getModelContextWindow(undefined as any)).toBe(100000)
        expect(getModelContextWindow('unknown-custom-model')).toBe(100000)
    })

    it('createProvider constructs a valid LLMProvider contract object', () => {
        const dummyStream = async function* () {
            yield { type: 'text' as const, text: 'hi' }
        }

        const provider = createProvider(
            {
                id: 'test-provider',
                name: 'Test Provider',
                models: ['m1'],
                api: {},
            },
            dummyStream
        )

        expect(provider.id).toBe('test-provider')
        expect(typeof provider.stream).toBe('function')
    })

    it('MODEL_CONTEXT_WINDOWS map contains expected defaults', () => {
        expect(MODEL_CONTEXT_WINDOWS['gemini-3.7-flash']).toBe(1000000)
        expect(MODEL_CONTEXT_WINDOWS['gemini-3.6-flash']).toBe(1000000)
        expect(MODEL_CONTEXT_WINDOWS['claude-opus-5']).toBe(1000000)
        expect(MODEL_CONTEXT_WINDOWS['claude-haiku-4.5']).toBe(200000)
        expect(MODEL_CONTEXT_WINDOWS['gpt-4o']).toBe(128000)
    })

    describe('supportsModelThinking', () => {
        it('identifies non-thinking models accurately', () => {
            // Anthropic legacy
            expect(supportsModelThinking('claude-3-5-sonnet-20241022')).toBe(false)
            expect(supportsModelThinking('claude-3-5-haiku-20241022')).toBe(false)
            expect(supportsModelThinking('claude-3-opus-20240229')).toBe(false)
            expect(supportsModelThinking('anthropic/claude-3-5-sonnet')).toBe(false)

            // OpenAI non-reasoning
            expect(supportsModelThinking('gpt-4o')).toBe(false)
            expect(supportsModelThinking('gpt-4o-mini')).toBe(false)
            expect(supportsModelThinking('gpt-4-turbo')).toBe(false)
            expect(supportsModelThinking('gpt-3.5-turbo')).toBe(false)
            expect(supportsModelThinking('openai/gpt-4o')).toBe(false)

            // Gemini non-thinking
            expect(supportsModelThinking('gemini-1.5-pro')).toBe(false)
            expect(supportsModelThinking('gemini-1.5-flash')).toBe(false)
            expect(supportsModelThinking('gemini-1.0-pro')).toBe(false)
            expect(supportsModelThinking('gemini-2.0-flash')).toBe(false)

            // Open source standard
            expect(supportsModelThinking('meta-llama/llama-3.3-70b-instruct')).toBe(false)
            expect(supportsModelThinking('mistral-large-latest')).toBe(false)
            expect(supportsModelThinking('codestral-2501')).toBe(false)
            expect(supportsModelThinking('sarvam-105b')).toBe(false)
            expect(supportsModelThinking('minimax-m2.7')).toBe(false)
            expect(supportsModelThinking('google/gemma-4-31b-it')).toBe(false)
            expect(supportsModelThinking('qwen2.5-coder-32b')).toBe(false)

            // Empty or undefined
            expect(supportsModelThinking('')).toBe(false)
            expect(supportsModelThinking(undefined)).toBe(false)
        })

        it('identifies thinking and reasoning models accurately', () => {
            // OpenAI reasoning
            expect(supportsModelThinking('o1')).toBe(true)
            expect(supportsModelThinking('o1-mini')).toBe(true)
            expect(supportsModelThinking('o3-mini')).toBe(true)
            expect(supportsModelThinking('o3-pro')).toBe(true)
            expect(supportsModelThinking('o4-mini')).toBe(true)
            expect(supportsModelThinking('openai/o3-mini')).toBe(true)

            // Anthropic extended thinking
            expect(supportsModelThinking('claude-3-7-sonnet-20250219')).toBe(true)
            expect(supportsModelThinking('claude-sonnet-4-6')).toBe(true)
            expect(supportsModelThinking('claude-opus-5')).toBe(true)
            expect(supportsModelThinking('claude-fable-5-1')).toBe(true)

            // Gemini thinking
            expect(supportsModelThinking('gemini-2.5-pro')).toBe(true)
            expect(supportsModelThinking('gemini-2.5-flash')).toBe(true)
            expect(supportsModelThinking('gemini-3.8-flash')).toBe(true)
            expect(supportsModelThinking('gemini-2.0-flash-thinking-exp')).toBe(true)
            expect(supportsModelThinking('december-auto')).toBe(true)

            // DeepSeek reasoning
            expect(supportsModelThinking('deepseek-reasoner')).toBe(true)
            expect(supportsModelThinking('deepseek-r1')).toBe(true)
            expect(supportsModelThinking('deepseek/deepseek-r1')).toBe(true)

            // GLM reasoning & abliterated-model-large-v2
            expect(supportsModelThinking('glm-5.3')).toBe(true)
            expect(supportsModelThinking('glm-5.2')).toBe(true)
            expect(supportsModelThinking('abliterated-model-large-v2')).toBe(true)

            // Others
            expect(supportsModelThinking('qwq-32b')).toBe(true)
            expect(supportsModelThinking('trinity-large-thinking')).toBe(true)
            expect(supportsModelThinking('command-a-reasoning-08-2025')).toBe(true)
            expect(supportsModelThinking('grok-4.20-0309-reasoning')).toBe(true)
        })
    })
})
