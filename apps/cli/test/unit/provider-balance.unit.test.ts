import { describe, expect, it } from 'bun:test'

import { fetchProviderBalance } from '../../src/utils/provider-balance'

describe('Provider Balance Fetcher (Unit)', () => {
    it('returns unsupported for providers without public balance APIs', async () => {
        const anthropicRes = await fetchProviderBalance('anthropic', 'sk-ant-test')
        expect(anthropicRes.supported).toBe(false)

        const openaiRes = await fetchProviderBalance('openai', 'sk-proj-test')
        expect(openaiRes.supported).toBe(false)

        const geminiRes = await fetchProviderBalance('gemini', 'AIzaSyTest')
        expect(geminiRes.supported).toBe(false)

        const groqRes = await fetchProviderBalance('groq', 'gsk_test')
        expect(groqRes.supported).toBe(false)
    })

    it('returns unsupported if apiKey or provider is missing', async () => {
        const noKey = await fetchProviderBalance('openrouter', '')
        expect(noKey.supported).toBe(false)

        const noProvider = await fetchProviderBalance('', 'sk-test')
        expect(noProvider.supported).toBe(false)
    })

    it('fetches balance from OpenRouter API correctly', async () => {
        const originalFetch = globalThis.fetch
        globalThis.fetch = (async (url: string, init?: any) => {
            if (url.toString().includes('openrouter.ai')) {
                expect(init?.headers?.Authorization).toBe('Bearer sk-or-test-key')
                return {
                    ok: true,
                    json: async () => ({
                        data: {
                            label: 'my-cli-key',
                            usage: 2.5,
                            limit: 10.0,
                            is_free_tier: false,
                        },
                    }),
                } as any
            }
            return { ok: false } as any
        }) as any

        try {
            const res = await fetchProviderBalance('openrouter', 'sk-or-test-key')
            expect(res.supported).toBe(true)
            expect(res.balance).toBe('$7.50')
            expect(res.currency).toBe('USD')
        } finally {
            globalThis.fetch = originalFetch
        }
    })

    it('fetches balance from DeepSeek API correctly', async () => {
        const originalFetch = globalThis.fetch
        globalThis.fetch = (async (url: string, init?: any) => {
            if (url.toString().includes('deepseek.com')) {
                expect(init?.headers?.Authorization).toBe('Bearer sk-ds-test-key')
                return {
                    ok: true,
                    json: async () => ({
                        is_available: true,
                        balance_infos: [
                            {
                                currency: 'CNY',
                                total_balance: '48.50',
                                granted_balance: '0.00',
                                topped_up_balance: '48.50',
                            },
                        ],
                    }),
                } as any
            }
            return { ok: false } as any
        }) as any

        try {
            const res = await fetchProviderBalance('deepseek', 'sk-ds-test-key')
            expect(res.supported).toBe(true)
            expect(res.balance).toBe('48.50 CNY')
            expect(res.currency).toBe('CNY')
        } finally {
            globalThis.fetch = originalFetch
        }
    })

    it('handles network failure or non-200 gracefully without throwing', async () => {
        const originalFetch = globalThis.fetch
        globalThis.fetch = (async () => {
            throw new Error('Connection refused')
        }) as any

        try {
            const res = await fetchProviderBalance('openrouter', 'sk-or-test-key')
            expect(res.supported).toBe(true)
            expect(res.error).toBeDefined()
        } finally {
            globalThis.fetch = originalFetch
        }
    })
})
