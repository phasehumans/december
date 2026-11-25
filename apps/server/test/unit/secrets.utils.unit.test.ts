import { describe, it, expect } from 'bun:test'

import {
    isRepoFullName,
    maskSecretValue,
    pickSecretsForRepository,
    toApiRepo,
    toSessionRepoFullName,
    toStoredRepo,
} from '../../src/modules/secrets/secrets.utils'

describe('Secrets Utils - Unit Tests', () => {
    describe('maskSecretValue', () => {
        it('should return 4 asterisks for strings of length <= 4', () => {
            expect(maskSecretValue('')).toBe('****')
            expect(maskSecretValue('a')).toBe('****')
            expect(maskSecretValue('ab')).toBe('****')
            expect(maskSecretValue('abc')).toBe('****')
            expect(maskSecretValue('abcd')).toBe('****')
        })

        it('should reveal first 2 and last 2 characters with 4 asterisks in middle for strings > 4 chars', () => {
            expect(maskSecretValue('abcde')).toBe('ab****de')
            expect(maskSecretValue('12345678')).toBe('12****78')
            expect(maskSecretValue('sk-proj-super-secret-key-12345')).toBe('sk****45')
        })
    })

    // #637 section 5: a secret for all repositories, or for one repository
    describe('pickSecretsForRepository', () => {
        const rows = [
            { name: 'API_URL', repoFullName: '', value: 'all' },
            { name: 'API_URL', repoFullName: 'acme/web', value: 'web' },
            { name: 'API_URL', repoFullName: 'acme/api', value: 'api' },
            { name: 'REGION', repoFullName: '', value: 'eu' },
            { name: 'WEB_ONLY', repoFullName: 'acme/web', value: 'only-web' },
        ]
        const values = (picked: typeof rows) =>
            Object.fromEntries(picked.map((row) => [row.name, row.value]))

        it('gives the repository value when a name is in both', () => {
            expect(values(pickSecretsForRepository(rows, 'acme/web'))).toEqual({
                API_URL: 'web',
                REGION: 'eu',
                WEB_ONLY: 'only-web',
            })
        })

        it('gives the repository value in any order of the rows', () => {
            const reversed = [...rows].reverse()
            expect(values(pickSecretsForRepository(reversed, 'acme/web'))).toEqual({
                API_URL: 'web',
                REGION: 'eu',
                WEB_ONLY: 'only-web',
            })
        })

        it('gives another repository the "all repositories" value', () => {
            expect(values(pickSecretsForRepository(rows, 'acme/docs'))).toEqual({
                API_URL: 'all',
                REGION: 'eu',
            })
        })

        it('gives a session with no repository only the "all repositories" rows', () => {
            const expected = { API_URL: 'all', REGION: 'eu' }
            expect(values(pickSecretsForRepository(rows, null))).toEqual(expected)
            expect(values(pickSecretsForRepository(rows, undefined))).toEqual(expected)
            expect(values(pickSecretsForRepository(rows, ''))).toEqual(expected)
        })

        it('compares repository names without case', () => {
            expect(values(pickSecretsForRepository(rows, 'Acme/WEB'))).toEqual({
                API_URL: 'web',
                REGION: 'eu',
                WEB_ONLY: 'only-web',
            })
            const mixed = [{ name: 'KEY', repoFullName: 'Acme/Web', value: 'mixed' }]
            expect(values(pickSecretsForRepository(mixed, 'acme/web'))).toEqual({ KEY: 'mixed' })
        })

        it('reads a row with no repository field as "all repositories"', () => {
            const old = [{ name: 'OLD', value: 'old' }] as typeof rows
            expect(values(pickSecretsForRepository(old, 'acme/web'))).toEqual({ OLD: 'old' })
        })

        it('gives each name one time', () => {
            const names = pickSecretsForRepository(rows, 'acme/web').map((row) => row.name)
            expect(names.sort()).toEqual(['API_URL', 'REGION', 'WEB_ONLY'])
        })
    })

    describe('isRepoFullName', () => {
        it('takes owner/name and a longer GitLab path', () => {
            expect(isRepoFullName('acme/web')).toBe(true)
            expect(isRepoFullName('acme-inc/web.app_2')).toBe(true)
            expect(isRepoFullName('group/team/web')).toBe(true)
        })

        it('refuses everything else', () => {
            for (const value of [
                '',
                'web',
                'acme/',
                '/web',
                'acme//web',
                'acme/web repo',
                'acme/web?x=1',
                '../web',
                'acme/..',
                'https://github.com/acme/web',
            ]) {
                expect(isRepoFullName(value)).toBe(false)
            }
        })
    })

    describe('toStoredRepo and toApiRepo', () => {
        it('keeps "all repositories" as an empty text in the database and null in the api', () => {
            expect(toStoredRepo(null)).toBe('')
            expect(toStoredRepo(undefined)).toBe('')
            expect(toStoredRepo('')).toBe('')
            expect(toApiRepo('')).toBeNull()
        })

        it('keeps a repository in lower case', () => {
            expect(toStoredRepo(' Acme/Web ')).toBe('acme/web')
            expect(toApiRepo('acme/web')).toBe('acme/web')
        })
    })

    describe('toSessionRepoFullName', () => {
        const none = {
            githubRepoOwner: null,
            githubRepoName: null,
            repoUrl: null,
            githubRepoUrl: null,
        }

        it('joins the owner and the name of the session', () => {
            expect(
                toSessionRepoFullName({ ...none, githubRepoOwner: 'Acme', githubRepoName: 'Web' })
            ).toBe('Acme/Web')
        })

        it('reads the path of the repository link when the names are not saved', () => {
            expect(
                toSessionRepoFullName({ ...none, repoUrl: 'https://github.com/acme/web.git' })
            ).toBe('acme/web')
            expect(
                toSessionRepoFullName({ ...none, githubRepoUrl: 'https://github.com/acme/api' })
            ).toBe('acme/api')
        })

        it('gives null for a session with no repository, and for no session', () => {
            expect(toSessionRepoFullName(none)).toBeNull()
            expect(toSessionRepoFullName(null)).toBeNull()
        })
    })
})
