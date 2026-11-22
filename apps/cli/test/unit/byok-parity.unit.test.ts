import { BYOK_PROVIDERS } from '@december/providers'
import { PROVIDER_KEY_NOTES, PROVIDER_KEY_URLS, PROVIDER_MENU_ITEMS } from '@december/tui'
import { describe, expect, test } from 'bun:test'

// december cloud offers the same own-key providers as the cli. The cloud list lives in
// packages/providers (BYOK_PROVIDERS), the cli list in packages/tui. This test keeps them equal.
describe('cloud byok providers match the cli', () => {
    test('same ids in the same order', () => {
        expect(BYOK_PROVIDERS.map((p) => p.id)).toEqual(PROVIDER_MENU_ITEMS.map((p) => p.value))
    })

    test('same names', () => {
        for (const item of PROVIDER_MENU_ITEMS) {
            expect(BYOK_PROVIDERS.find((p) => p.id === item.value)?.name).toBe(item.label)
        }
    })

    test('same key pages', () => {
        for (const provider of BYOK_PROVIDERS) {
            expect(provider.keyUrl).toBe(PROVIDER_KEY_URLS[provider.id])
        }
    })

    test('watsonx explains its key format in both lists', () => {
        expect(PROVIDER_KEY_NOTES.watsonx).toContain('API_KEY:PROJECT_ID')
        expect(BYOK_PROVIDERS.find((p) => p.id === 'watsonx')?.keyHint).toContain(
            'API_KEY:PROJECT_ID'
        )
    })
})
