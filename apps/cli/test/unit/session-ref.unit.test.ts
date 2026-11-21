import { describe, expect, test } from 'bun:test'

import { resolveSessionRef } from '../../src/utils/session-ref'

// most recent first, as listSessions returns them
const sessions = [
    { id: 'session-300', title: 'Fix rewind snapshot ordering' },
    { id: 'session-200', title: 'Rewind docs' },
    { id: 'session-100' },
    { id: 'legacy-custom-name' },
]

describe('resolveSessionRef', () => {
    test('matches an exact id first', () => {
        expect(resolveSessionRef('session-100', sessions)?.id).toBe('session-100')
    })

    test('matches an exact title without case', () => {
        expect(resolveSessionRef('rewind DOCS', sessions)?.id).toBe('session-200')
    })

    test('an exact title beats a more recent partial match', () => {
        expect(resolveSessionRef('Rewind docs', sessions)?.id).toBe('session-200')
    })

    test('falls back to the most recent partial title match', () => {
        expect(resolveSessionRef('rewind', sessions)?.id).toBe('session-300')
    })

    test('matches part of a legacy id', () => {
        expect(resolveSessionRef('custom', sessions)?.id).toBe('legacy-custom-name')
    })

    test('returns undefined when nothing matches or the ref is blank', () => {
        expect(resolveSessionRef('payments', sessions)).toBeUndefined()
        expect(resolveSessionRef('   ', sessions)).toBeUndefined()
    })
})
