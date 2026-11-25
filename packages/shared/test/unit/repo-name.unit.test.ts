import { describe, expect, it } from 'bun:test'

import { isRepoFullName, joinRepoFullName, splitRepoFullName } from '../../src/repo-name'

// review B5: one validator and one split for the full name of a repository
describe('the full name of a repository', () => {
    it('takes owner/name and a gitlab group path', () => {
        for (const value of ['acme/web', 'acme-inc/web.app_2', 'group/team/web', 'a/.github']) {
            expect(isRepoFullName(value)).toBe(true)
        }
    })

    it('refuses a part of dots only, and text that is not owner/name', () => {
        for (const value of [
            '../x',
            'acme/..',
            'acme/./web',
            'a/../../b',
            'web',
            '',
            'acme/',
            '/web',
            'acme//web',
            'acme/we b',
            'acme/web?x=1',
            `a/${'b'.repeat(200)}`,
        ]) {
            expect(isRepoFullName(value)).toBe(false)
        }
    })

    it('splits at the last part: the name of a gitlab path is the last part', () => {
        expect(splitRepoFullName('acme/web')).toEqual({ owner: 'acme', name: 'web' })
        expect(splitRepoFullName('group/team/web')).toEqual({ owner: 'group/team', name: 'web' })
        expect(splitRepoFullName('../x')).toBe(null)
        expect(splitRepoFullName('web')).toBe(null)
    })

    it('joins the saved owner and name', () => {
        expect(joinRepoFullName('acme', 'web')).toBe('acme/web')
        expect(joinRepoFullName('group/team', 'web')).toBe('group/team/web')
        expect(joinRepoFullName(null, 'web')).toBe(null)
        expect(joinRepoFullName('acme', '')).toBe(null)
    })
})
