import { describe, expect, test } from 'bun:test'

import { registerProvider, getProvider, getAllProviders } from '../src/registry'
import { LLMProvider } from '../src/types'

describe('Provider Registry', () => {
    // reset is not easily possible if the map isn't exported, but we can add dummy providers.

    test('should register and retrieve a provider successfully', () => {
        const dummyProvider: LLMProvider = {
            id: 'dummy',
            name: 'Dummy',
            models: [],
            stream: async function* () {
                yield { type: 'text', text: 'hi' }
            },
        }

        registerProvider(dummyProvider)

        const retrieved = getProvider('dummy')
        expect(retrieved).toBe(dummyProvider)
    })

    test('should throw error when getting an unregistered provider', () => {
        expect(() => {
            getProvider('non-existent-provider')
        }).toThrow("Provider 'non-existent-provider' not found.")
    })

    test('should return all registered providers', () => {
        const providers = getAllProviders()
        expect(Array.isArray(providers)).toBe(true)
        // at least the dummy provider we just added should be here
        const ids = providers.map((p) => p.id)
        expect(ids).toContain('dummy')
    })
})
