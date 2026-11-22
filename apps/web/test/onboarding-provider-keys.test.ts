import { describe, expect, test } from 'bun:test'

import { detectProviderFromKey, sortProviders } from '../src/features/onboarding/providerKeys'

describe('detectProviderFromKey', () => {
    test('finds the provider from a known key prefix', () => {
        expect(detectProviderFromKey('sk-ant-api03-abc')).toBe('anthropic')
        expect(detectProviderFromKey('sk-or-v1-abc')).toBe('openrouter')
        expect(detectProviderFromKey('sk-proj-abc')).toBe('openai')
        expect(detectProviderFromKey('AIzaSyabc')).toBe('google')
        expect(detectProviderFromKey('gsk_abc')).toBe('groq')
        expect(detectProviderFromKey('xai-abc')).toBe('xai')
        expect(detectProviderFromKey('  hf_abc  ')).toBe('huggingface')
    })

    test('leaves shared or unknown formats alone', () => {
        expect(detectProviderFromKey('sk-abc123')).toBeNull()
        expect(detectProviderFromKey('abc123')).toBeNull()
        expect(detectProviderFromKey('')).toBeNull()
    })
})

describe('sortProviders', () => {
    test('puts popular providers first in a fixed order, then the rest A to Z', () => {
        const sorted = sortProviders([
            { id: 'abacus', name: 'Abacus' },
            { id: 'zai', name: 'Z.ai' },
            { id: 'openai', name: 'OpenAI' },
            { id: 'ai21', name: 'AI21 Labs' },
            { id: 'anthropic', name: 'Anthropic' },
            { id: 'google', name: 'Google AI Studio' },
        ])

        expect(sorted.map((provider) => provider.id)).toEqual([
            'anthropic',
            'openai',
            'google',
            'abacus',
            'ai21',
            'zai',
        ])
    })
})
