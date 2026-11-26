import { describe, it, expect } from 'bun:test'

import {
    isWorkingVmStatus,
    parseStoredSessionFiles,
    toListTitle,
} from '../../src/modules/session/session.utils'
import { escapeLike } from '../../src/shared/escape-like'

describe('Session Utils - Unit Tests', () => {
    describe('parseStoredSessionFiles', () => {
        it('should return empty array for non-array input', () => {
            expect(parseStoredSessionFiles(null)).toEqual([])
            expect(parseStoredSessionFiles(undefined)).toEqual([])
            expect(parseStoredSessionFiles('invalid')).toEqual([])
            expect(parseStoredSessionFiles(123)).toEqual([])
            expect(parseStoredSessionFiles({})).toEqual([])
        })

        it('should parse valid stored session files correctly', () => {
            const input = [
                {
                    path: 'src/index.ts',
                    key: 'sessions/123/workspace/src/index.ts',
                    contentType: 'text/plain',
                    size: 1024,
                },
                {
                    path: 'public/logo.png',
                    key: 'sessions/123/workspace/public/logo.png',
                    contentType: 'image/png',
                    size: 2048,
                },
            ]

            const result = parseStoredSessionFiles(input)
            expect(result).toHaveLength(2)
            expect(result[0]).toEqual({
                path: 'src/index.ts',
                key: 'sessions/123/workspace/src/index.ts',
                contentType: 'text/plain',
                size: 1024,
            })
            expect(result[1]).toEqual({
                path: 'public/logo.png',
                key: 'sessions/123/workspace/public/logo.png',
                contentType: 'image/png',
                size: 2048,
            })
        })

        it('should filter out invalid items and supply default size 0 if missing', () => {
            const input = [
                null,
                'invalid',
                { path: 'file.txt' }, // missing key
                { key: 'key.txt' }, // missing path
                { path: 123, key: 'key.txt' }, // non-string path
                { path: 'valid.txt', key: 'sessions/key.txt' }, // valid without size/contentType
            ]

            const result = parseStoredSessionFiles(input)
            expect(result).toHaveLength(1)
            expect(result[0]).toEqual({
                path: 'valid.txt',
                key: 'sessions/key.txt',
                size: 0,
            })
        })
    })
})

describe('escapeLike', () => {
    it('escapes the LIKE wildcards and the escape character', () => {
        expect(escapeLike('50%')).toBe('50\\%')
        expect(escapeLike('my_repo')).toBe('my\\_repo')
        expect(escapeLike('a\\b')).toBe('a\\\\b')
        expect(escapeLike('%_\\')).toBe('\\%\\_\\\\')
    })

    it('leaves other text as it is', () => {
        expect(escapeLike('acme/web-app.v2')).toBe('acme/web-app.v2')
        expect(escapeLike('')).toBe('')
    })
})

describe('isWorkingVmStatus', () => {
    it('is true while the sandbox starts or runs', () => {
        expect(isWorkingVmStatus('PROVISIONING')).toBe(true)
        expect(isWorkingVmStatus('RUNNING')).toBe(true)
    })

    it('is false for an ended or unknown status', () => {
        for (const status of ['STOPPED', 'FAILED', null, undefined, 'running']) {
            expect(isWorkingVmStatus(status)).toBe(false)
        }
    })
})

describe('toListTitle', () => {
    it('keeps a saved title, trimmed', () => {
        expect(toListTitle('  Fix login  ', 'some prompt')).toBe('Fix login')
    })

    it('uses the first prompt when there is no title or only spaces', () => {
        expect(toListTitle(null, 'add dark mode')).toBe('add dark mode')
        expect(toListTitle('   ', 'add dark mode')).toBe('add dark mode')
        expect(toListTitle(undefined, 'add dark mode')).toBe('add dark mode')
    })

    it('puts the prompt on one line and cuts it at 50 characters', () => {
        expect(toListTitle(null, '  line one\n\nline   two  ')).toBe('line one line two')
        expect(toListTitle(null, 'x'.repeat(50))).toBe('x'.repeat(50))
        expect(toListTitle(null, 'x'.repeat(51))).toBe(`${'x'.repeat(50)}...`)
    })

    it('is New Chat with no title and no prompt', () => {
        expect(toListTitle(null)).toBe('New Chat')
        expect(toListTitle(null, '   ')).toBe('New Chat')
        expect(toListTitle('', null)).toBe('New Chat')
    })
})
