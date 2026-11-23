import { describe, expect, test } from 'bun:test'

import { fuzzyMatch, scoreItem } from './fuzzy'

describe('fuzzyMatch', () => {
    test('matches a substring and returns its indexes', () => {
        expect(fuzzyMatch('bill', 'Billing')).toEqual({ score: 390, indexes: [0, 1, 2, 3] })
    })

    test('matches letters in order with skips', () => {
        const match = fuzzyMatch('gtlb', 'Add GitLab OAuth provider')
        expect(match?.indexes).toEqual([4, 6, 7, 9])
    })

    test('returns null when letters are out of order or missing', () => {
        expect(fuzzyMatch('xyz', 'Billing')).toBeNull()
        expect(fuzzyMatch('gnillib', 'Billing')).toBeNull()
    })

    test('rejects letters spread across a long title', () => {
        expect(fuzzyMatch('az', 'a long session title that ends with z')).toBeNull()
        expect(fuzzyMatch('web', 'Getting Started with December')).toBeNull()
    })

    test('rejects skipped-letter matches that start mid-word', () => {
        expect(fuzzyMatch('web', 'Bring Your Own Key (BYOK)')).toBeNull()
    })

    test('allows short skips inside a word', () => {
        expect(fuzzyMatch('slsh', 'Slash commands')?.indexes).toEqual([0, 1, 3, 4])
        expect(fuzzyMatch('stpe', 'Fix Stripe webhook retries')).not.toBeNull()
    })

    test('ranks a word-start substring above a mid-word one', () => {
        const start = fuzzyMatch('key', 'Model keys')!
        const middle = fuzzyMatch('key', 'Turnkey setup')!
        expect(start.score).toBeGreaterThan(middle.score)
    })

    test('ranks any substring above a skipped-letter match', () => {
        const substring = fuzzyMatch('gl', 'Glow effect on cards')!
        const skipped = fuzzyMatch('gl', 'GitLab provider')!
        expect(substring.score).toBeGreaterThan(skipped.score)
    })

    test('an empty query matches everything', () => {
        expect(fuzzyMatch('  ', 'Anything')).toEqual({ score: 1, indexes: [] })
    })
})

describe('scoreItem', () => {
    test('falls back to a keyword match without highlight', () => {
        const match = scoreItem('openai', 'Model keys', ['byok', 'openai'])
        expect(match?.indexes).toEqual([])
        expect(match!.score).toBeGreaterThan(0)
    })

    test('a label match beats a keyword match', () => {
        const label = scoreItem('usage', 'Usage', [])!
        const keyword = scoreItem('usage', 'Billing', ['usage'])!
        expect(label.score).toBeGreaterThan(keyword.score)
    })

    test('ignores skipped-letter keyword matches', () => {
        expect(scoreItem('gtb', 'Account', ['github'])).toBeNull()
    })
})
