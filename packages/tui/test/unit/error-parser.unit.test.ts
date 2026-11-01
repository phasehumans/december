import { describe, expect, it } from 'bun:test'

import { parseTuiError } from '../../src/utils/error-parser'

describe('parseTuiError Utility (Unit)', () => {
    it('parses HTTP 402 / December Wallet errors into user-friendly message and billing hint', () => {
        const raw =
            '402 Insufficient credits in December Wallet. Please add credits at https://app.trydecember.com/settings/billing'
        const parsed = parseTuiError(raw)

        expect(parsed.message).toContain('Insufficient credits in December Wallet.')
        expect(parsed.hint).toContain('https://app.trydecember.com/settings/billing')
        expect(parsed.hint).toContain('/login')
    })

    it('parses Rate limit and quota exhaustion errors into friendly hint', () => {
        const raw =
            'Rate limit or quota exhausted from LLM provider. Please check your account limits.'
        const parsed = parseTuiError(raw)

        expect(parsed.message).toContain('Rate limit or quota exhausted from LLM provider.')
        expect(parsed.hint).toContain('/model')
    })

    it('parses OpenRouter credit exhaustion into direct dashboard link', () => {
        const raw =
            'OpenRouter credits exhausted or insufficient. Please add credits at https://openrouter.ai/settings/credits'
        const parsed = parseTuiError(raw)

        expect(parsed.message).toContain('OpenRouter credits exhausted')
        expect(parsed.hint).toContain('https://openrouter.ai/settings/credits')
    })

    it('normalizes connection errors', () => {
        const raw = 'Connection error.'
        const parsed = parseTuiError(raw)

        expect(parsed.message).toBe('Unable to connect to LLM provider (Connection error).')
    })

    it('preserves existing cause and hint when passed explicitly', () => {
        const parsed = parseTuiError('Custom error', 'Cause: Network failure', 'Hint: Try again')

        expect(parsed.message).toBe('Custom error')
        expect(parsed.cause).toBe('Network failure')
        expect(parsed.hint).toBe('Try again')
    })
})
