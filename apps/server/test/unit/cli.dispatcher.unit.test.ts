import { describe, it, expect } from 'bun:test'

import { resolveServerProvider } from '../../src/modules/cli/cli.dispatcher'

describe('CLI Multi-Provider Dispatcher - Unit Tests', () => {
    describe('resolveServerProvider', () => {
        it('resolves native geminiProvider for gemini models when GEMINI_API_KEY is configured', () => {
            const resolution = resolveServerProvider('gemini-3.6-flash')
            expect(resolution.providerName).toBe('gemini')
            expect(resolution.provider.id).toBe('gemini')
            expect(resolution.model).toBe('gemini-3.6-flash')
        })

        it('normalizes model names with google/ prefix to native gemini provider', () => {
            const resolution = resolveServerProvider('google/gemini-2.5-flash')
            expect(resolution.providerName).toBe('gemini')
            expect(resolution.provider.id).toBe('gemini')
            expect(resolution.model).toBe('gemini-2.5-flash')
        })

        it('resolves openrouterProvider fallback for claude models when OPENROUTER_API_KEY is configured', () => {
            const resolution = resolveServerProvider('claude-3-7-sonnet-latest')
            expect(resolution.providerName).toBe('openrouter')
            expect(resolution.provider.id).toBe('openrouter')
            expect(resolution.model).toBe('anthropic/claude-3.7-sonnet')
        })

        it('routes december-auto to gemini-3.8-flash under the hood', () => {
            const resolution = resolveServerProvider('december-auto')
            expect(resolution.providerName).toBe('gemini')
            expect(resolution.provider.id).toBe('gemini')
            expect(resolution.model).toBe('gemini-3.8-flash')
        })

        it('routes undefined or auto to gemini-3.8-flash under the hood', () => {
            const resolution = resolveServerProvider('auto')
            expect(resolution.model).toBe('gemini-3.8-flash')

            const resolutionEmpty = resolveServerProvider('')
            expect(resolutionEmpty.model).toBe('gemini-3.8-flash')
        })
    })
})
