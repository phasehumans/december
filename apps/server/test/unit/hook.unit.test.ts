import { isSafeHookMatcher } from '@december/shared'
import { describe, expect, it } from 'bun:test'

import {
    hookIdParamsSchema,
    hookSchema,
    replaceHooksSchema,
    updateHookSchema,
} from '../../src/modules/hook/hook.schema'
import { matcherFor, toPublicHook } from '../../src/modules/hook/hook.utils'

describe('hookSchema', () => {
    it('fills the defaults of the cli: all tools, 60 seconds, on', () => {
        expect(hookSchema.parse({ event: 'PreToolUse', command: ' ./check.sh ' })).toEqual({
            event: 'PreToolUse',
            matcher: '',
            command: './check.sh',
            timeout: 60,
            enabled: true,
        })
    })

    it('refuses unknown events, extra keys, empty or long commands and bad timeouts', () => {
        const base = { event: 'Stop', command: 'echo' }
        for (const body of [
            { ...base, event: 'BeforeEverything' },
            { ...base, extra: true },
            { ...base, command: '   ' },
            { ...base, command: 'x'.repeat(2001) },
            { ...base, command: 'a\u0000b' },
            { ...base, timeout: 0 },
            { ...base, timeout: 601 },
            { ...base, timeout: 1.5 },
            { ...base, timeout: '60' },
            { ...base, enabled: 'yes' },
            { ...base, matcher: 'x'.repeat(201) },
            { ...base, matcher: '(unclosed' },
            { ...base, matcher: '(a+)+' },
        ]) {
            expect(hookSchema.safeParse(body).success).toBe(false)
        }
    })

    it('takes a list of up to 50 hooks for the json view, strictly', () => {
        const hook = { event: 'Stop', command: 'echo' }
        expect(replaceHooksSchema.safeParse({ hooks: Array(50).fill(hook) }).success).toBe(true)
        expect(replaceHooksSchema.safeParse({ hooks: Array(51).fill(hook) }).success).toBe(false)
        expect(replaceHooksSchema.safeParse({ hooks: [], other: 1 }).success).toBe(false)
    })

    it('needs at least one known field to update', () => {
        expect(updateHookSchema.safeParse({}).success).toBe(false)
        expect(updateHookSchema.safeParse({ enabled: false }).success).toBe(true)
        expect(updateHookSchema.safeParse({ enabled: false, plugin: 'x' }).success).toBe(false)
    })

    it('takes only a uuid as the hook id', () => {
        expect(hookIdParamsSchema.safeParse({ id: 'abc' }).success).toBe(false)
        expect(hookIdParamsSchema.safeParse({ id: crypto.randomUUID() }).success).toBe(true)
    })
})

describe('isSafeHookMatcher', () => {
    it('allows plain names, alternatives and wildcards', () => {
        for (const matcher of ['', '*', 'bash', 'bash|edit_file', 'mcp__.*', 'Edit|Write']) {
            expect(isSafeHookMatcher(matcher)).toBe(true)
        }
    })

    it('refuses invalid regexes and repeated groups with a repeat inside', () => {
        for (const matcher of ['(', '[a-', '(a+)+', '(a*)*$', '(.*a){2,}', 'x'.repeat(201)]) {
            expect(isSafeHookMatcher(matcher)).toBe(false)
        }
    })
})

describe('matcherFor and toPublicHook', () => {
    it('keeps a matcher for tool events only', () => {
        expect(matcherFor('PreToolUse', ' bash ')).toBe('bash')
        expect(matcherFor('Stop', 'bash')).toBe('')
    })

    it('returns the cli names (timeout in seconds)', () => {
        const now = new Date()
        expect(
            toPublicHook({
                id: 'h1',
                event: 'Stop',
                matcher: '',
                command: 'echo',
                timeoutSeconds: 30,
                enabled: true,
                position: 2,
                updatedAt: now,
            })
        ).toEqual({
            id: 'h1',
            event: 'Stop',
            matcher: '',
            command: 'echo',
            timeout: 30,
            enabled: true,
            position: 2,
            updatedAt: now,
        })
    })
})
