import { describe, it, expect } from 'vitest'

import { getProviderModels, getModelLabel, getModelContextWindow } from '../src/utils/models'

describe('models utils', () => {
    describe('getProviderModels', () => {
        it('returns anthropic models when provider is anthropic', () => {
            const models = getProviderModels('anthropic')
            expect(models).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ value: 'claude-3-5-sonnet-latest' }),
                ])
            )
            expect(models.length).toBe(3)
        })

        it('returns default model when provider is unknown', () => {
            const models = getProviderModels('unknown-provider')
            expect(models).toEqual([{ label: 'Default', value: 'default' }])
        })
    })

    describe('getModelLabel', () => {
        it('returns correct label for a known model value', () => {
            const label = getModelLabel('gemini-3.5-flash')
            expect(label).toBe('Gemini 3.5 Flash')
        })

        it('returns the value itself if model is not found', () => {
            const label = getModelLabel('unknown-model')
            expect(label).toBe('unknown-model')
        })
    })

    describe('getModelContextWindow', () => {
        it('returns 1000000 for gemini models', () => {
            expect(getModelContextWindow('gemini-3.5-flash')).toBe(1000000)
        })

        it('returns 200000 for claude models', () => {
            expect(getModelContextWindow('claude-3-5-sonnet-latest')).toBe(200000)
        })

        it('returns 128000 for gpt-4 models', () => {
            expect(getModelContextWindow('gpt-4o')).toBe(128000)
        })

        it('returns 100000 as default', () => {
            expect(getModelContextWindow('unknown-model')).toBe(100000)
        })
    })
})
