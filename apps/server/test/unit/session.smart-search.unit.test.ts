import { describe, expect, it } from 'bun:test'

import {
    buildSmartSearchPrompt,
    isEmptySmartSearchFilters,
    parseSmartSearchFilters,
} from '../../src/modules/session/session.utils'

describe('buildSmartSearchPrompt', () => {
    it('includes the date, weekday and repo names', () => {
        const prompt = buildSmartSearchPrompt({
            today: new Date('2026-11-23T10:00:00Z'),
            repoNames: ['acme-api', 'storefront'],
        })
        expect(prompt).toContain('Today is 2026-11-23 (Monday)')
        expect(prompt).toContain('acme-api, storefront')
    })

    it('says none when the user has no repos', () => {
        const prompt = buildSmartSearchPrompt({ today: new Date(), repoNames: [] })
        expect(prompt).toContain("The user's repositories: none.")
    })
})

describe('parseSmartSearchFilters', () => {
    it('reads a JSON reply and fills defaults', () => {
        const filters = parseSmartSearchFilters('{"topic":["Stripe"],"updatedWithinDays":7}', [])
        expect(filters).toEqual({
            topic: ['stripe'],
            updatedWithinDays: 7,
            repo: null,
            running: false,
            archived: false,
            sort: 'newest',
        })
    })

    it('finds the JSON inside extra text or a code fence', () => {
        const filters = parseSmartSearchFilters(
            'Here you go:\n```json\n{"topic":["gitlab"],"running":true}\n```',
            []
        )
        expect(filters?.topic).toEqual(['gitlab'])
        expect(filters?.running).toBe(true)
    })

    it('keeps a known repo with its real casing and drops an unknown one', () => {
        expect(parseSmartSearchFilters('{"repo":"ACME-API"}', ['acme-api'])?.repo).toBe('acme-api')
        expect(parseSmartSearchFilters('{"repo":"made-up"}', ['acme-api'])?.repo).toBeNull()
    })

    it('returns null for a reply that is not valid filter JSON', () => {
        expect(parseSmartSearchFilters('no idea', [])).toBeNull()
        expect(parseSmartSearchFilters('{"topic": [1, 2', [])).toBeNull()
        expect(parseSmartSearchFilters('{"updatedWithinDays": -3}', [])).toBeNull()
        expect(parseSmartSearchFilters('{"sort": "random"}', [])).toBeNull()
    })
})

describe('isEmptySmartSearchFilters', () => {
    it('is true only when no filter is set', () => {
        const empty = parseSmartSearchFilters('{}', [])!
        expect(isEmptySmartSearchFilters(empty)).toBe(true)
        expect(isEmptySmartSearchFilters({ ...empty, running: true })).toBe(false)
        expect(isEmptySmartSearchFilters({ ...empty, topic: ['x'] })).toBe(false)
    })
})
