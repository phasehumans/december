import {
    SECRET_NAME_MAX,
    SECRET_NOTE_MAX,
    SECRET_VALUE_MAX,
    SECRETS_BULK_MAX,
} from '@december/shared/secrets'
import { describe, it, expect } from 'bun:test'

import {
    CreateSecretSchema,
    BulkCreateSecretsSchema,
    SecretNameParamsSchema,
    SecretRepoQuerySchema,
} from '../../src/modules/secrets/secrets.schema'

const ok = (body: unknown) => CreateSecretSchema.safeParse(body).success
const firstMessage = (body: unknown) => {
    const res = CreateSecretSchema.safeParse(body)
    return res.success ? null : res.error.issues[0]?.message
}

describe('secrets schemas', () => {
    describe('CreateSecretSchema', () => {
        it('takes a name, a value and a note', () => {
            const res = CreateSecretSchema.safeParse({
                name: 'STRIPE_API_KEY',
                value: 'sk_test_12345',
                note: 'Stripe test key',
            })
            expect(res.success).toBe(true)
            if (res.success) {
                expect(res.data).toEqual({
                    name: 'STRIPE_API_KEY',
                    value: 'sk_test_12345',
                    note: 'Stripe test key',
                })
            }
        })

        it('takes no note, a null note and an empty note', () => {
            expect(ok({ name: 'GITHUB_TOKEN', value: 'ghp_abc123' })).toBe(true)
            expect(ok({ name: 'GITHUB_TOKEN', value: 'ghp_abc123', note: null })).toBe(true)
            expect(ok({ name: 'GITHUB_TOKEN', value: 'ghp_abc123', note: '' })).toBe(true)
        })

        it('refuses a missing or empty name or value, and wrong types', () => {
            expect(ok({ name: '', value: 'v' })).toBe(false)
            expect(ok({ value: 'v' })).toBe(false)
            expect(ok({ name: 'KEY', value: '' })).toBe(false)
            expect(ok({ name: 'KEY' })).toBe(false)
            expect(ok({ name: 42, value: 'v' })).toBe(false)
            expect(ok({ name: 'KEY', value: 42 })).toBe(false)
            expect(ok({ name: 'KEY', value: 'v', note: 42 })).toBe(false)
            expect(ok(null)).toBe(false)
            expect(ok('KEY=v')).toBe(false)
        })

        it('refuses a field it does not know', () => {
            expect(ok({ name: 'KEY', value: 'v', userId: 'someone-else' })).toBe(false)
            expect(ok({ name: 'KEY', value: 'v', id: 'x' })).toBe(false)
        })

        describe('the name', () => {
            it('takes capital letters, digits and _, not a digit first', () => {
                for (const name of ['A', '_A', 'A1', '_PRIVATE', 'API_KEY_2', 'X'.repeat(128)]) {
                    expect(ok({ name, value: 'v' })).toBe(true)
                }
            })

            it('refuses lower case, spaces, dashes, a digit first and other characters', () => {
                expect(firstMessage({ name: 'api_key', value: 'v' })).toBe(
                    'Use only A-Z, 0-9 and _ in the name.'
                )
                expect(firstMessage({ name: '1KEY', value: 'v' })).toBe(
                    'Start the name with a letter or _.'
                )
                for (const name of [
                    'API KEY',
                    'API-KEY',
                    'API.KEY',
                    'KEY;rm',
                    'KEY=1',
                    ' KEY',
                    'KEY\n',
                    'ÉCLAIR',
                    '$KEY',
                ]) {
                    expect(ok({ name, value: 'v' })).toBe(false)
                }
            })

            it(`refuses a name longer than ${SECRET_NAME_MAX} characters`, () => {
                expect(ok({ name: 'X'.repeat(SECRET_NAME_MAX + 1), value: 'v' })).toBe(false)
            })

            it('refuses the system names of the sandbox', () => {
                for (const name of [
                    'PATH',
                    'HOME',
                    'SHELL',
                    'IFS',
                    'BASH_ENV',
                    'PROMPT_COMMAND',
                    'LD_PRELOAD',
                    'LD_LIBRARY_PATH',
                    'DECEMBER_TOKEN',
                    'E2B_API_KEY',
                    'GIT_SSH_COMMAND',
                    'GIT_CONFIG_GLOBAL',
                    'BASH_FUNC_X',
                    '_',
                ]) {
                    expect(firstMessage({ name, value: 'v' })).toBe(
                        `${name} is a system name. Use a different name.`
                    )
                }
            })

            it('takes names that only look like system names', () => {
                for (const name of ['MY_PATH', 'PATH_PREFIX', 'GITHUB_TOKEN', 'HOMEPAGE_URL']) {
                    expect(ok({ name, value: 'v' })).toBe(true)
                }
            })
        })

        describe('the value', () => {
            it(`takes up to ${SECRET_VALUE_MAX} characters and keeps the value as it is`, () => {
                const value = ` ${'a'.repeat(SECRET_VALUE_MAX - 2)}\n`
                const res = CreateSecretSchema.safeParse({ name: 'KEY', value })
                expect(res.success).toBe(true)
                if (res.success) expect(res.data.value).toBe(value)
            })

            it('refuses a longer value, a value of only spaces and a NUL character', () => {
                expect(ok({ name: 'KEY', value: 'a'.repeat(SECRET_VALUE_MAX + 1) })).toBe(false)
                expect(ok({ name: 'KEY', value: '   \n\t' })).toBe(false)
                expect(firstMessage({ name: 'KEY', value: 'a\0b' })).toBe(
                    'Remove the NUL characters from the value.'
                )
            })

            it('takes a value with quotes, $ and new lines', () => {
                expect(ok({ name: 'KEY', value: `it's "a" $b \`c\`\nline 2` })).toBe(true)
            })
        })

        it(`trims the note and refuses a note longer than ${SECRET_NOTE_MAX}`, () => {
            const res = CreateSecretSchema.safeParse({ name: 'KEY', value: 'v', note: '  hi  ' })
            expect(res.success && res.data.note).toBe('hi')
            expect(ok({ name: 'KEY', value: 'v', note: 'n'.repeat(SECRET_NOTE_MAX) })).toBe(true)
            expect(ok({ name: 'KEY', value: 'v', note: 'n'.repeat(SECRET_NOTE_MAX + 1) })).toBe(
                false
            )
        })
    })

    describe('BulkCreateSecretsSchema', () => {
        const items = (count: number) =>
            Array.from({ length: count }, (_, i) => ({ name: `KEY_${i}`, value: `v${i}` }))

        it('takes a list of good secrets', () => {
            const res = BulkCreateSecretsSchema.safeParse({
                secrets: [
                    { name: 'KEY_ONE', value: 'val1', note: 'First key' },
                    { name: 'KEY_TWO', value: 'val2' },
                ],
            })
            expect(res.success).toBe(true)
        })

        it(`takes up to ${SECRETS_BULK_MAX} secrets and refuses more, or none`, () => {
            expect(
                BulkCreateSecretsSchema.safeParse({ secrets: items(SECRETS_BULK_MAX) }).success
            ).toBe(true)
            expect(
                BulkCreateSecretsSchema.safeParse({ secrets: items(SECRETS_BULK_MAX + 1) }).success
            ).toBe(false)
            expect(BulkCreateSecretsSchema.safeParse({ secrets: [] }).success).toBe(false)
            expect(BulkCreateSecretsSchema.safeParse({}).success).toBe(false)
            expect(BulkCreateSecretsSchema.safeParse({ secrets: 'A=1' }).success).toBe(false)
        })

        it('refuses the whole list when one item is bad', () => {
            for (const bad of [
                { name: '', value: 'v' },
                { name: 'PATH', value: 'v' },
                { name: 'lower', value: 'v' },
                { name: 'KEY', value: 'a'.repeat(SECRET_VALUE_MAX + 1) },
                { name: 'KEY', value: 'v', extra: true },
            ]) {
                const res = BulkCreateSecretsSchema.safeParse({
                    secrets: [{ name: 'VALID_KEY', value: 'val1' }, bad],
                })
                expect(res.success).toBe(false)
            }
        })

        it('refuses a field it does not know at the top', () => {
            expect(
                BulkCreateSecretsSchema.safeParse({ secrets: items(1), userId: 'x' }).success
            ).toBe(false)
        })
    })

    // #637 section 5
    describe('the repository of a secret', () => {
        it('takes owner/name, and a GitLab group path', () => {
            for (const repoFullName of ['acme/web', 'group/team/web']) {
                const res = CreateSecretSchema.safeParse({ name: 'KEY', value: 'v', repoFullName })
                expect(res.success).toBe(true)
                if (res.success) expect(res.data.repoFullName).toBe(repoFullName)
            }
        })

        it('takes null, an empty text and no field as "all repositories"', () => {
            for (const extra of [{ repoFullName: null }, { repoFullName: '' }, {}]) {
                expect(ok({ name: 'KEY', value: 'v', ...extra })).toBe(true)
            }
        })

        it('refuses a repository that is not owner/name, or too long', () => {
            for (const repoFullName of [
                'web',
                'acme/web repo',
                '../web',
                'acme/..',
                42,
                `acme/${'w'.repeat(200)}`,
            ]) {
                expect(ok({ name: 'KEY', value: 'v', repoFullName })).toBe(false)
            }
        })

        it('checks the repository of the import and of each item', () => {
            const good = BulkCreateSecretsSchema.safeParse({
                repoFullName: 'acme/web',
                secrets: [{ name: 'KEY', value: 'v', repoFullName: 'acme/api' }],
            })
            expect(good.success).toBe(true)
            const badItem = BulkCreateSecretsSchema.safeParse({
                secrets: [{ name: 'KEY', value: 'v', repoFullName: 'api' }],
            })
            expect(badItem.success).toBe(false)
            const badImport = BulkCreateSecretsSchema.safeParse({
                repoFullName: 'web',
                secrets: [{ name: 'KEY', value: 'v' }],
            })
            expect(badImport.success).toBe(false)
        })

        it('checks the repo query of the routes that take a name, and nothing else in it', () => {
            expect(SecretRepoQuerySchema.safeParse({}).success).toBe(true)
            expect(SecretRepoQuerySchema.safeParse({ repo: 'acme/web' }).success).toBe(true)
            expect(SecretRepoQuerySchema.safeParse({ repo: 'web' }).success).toBe(false)
            expect(
                SecretRepoQuerySchema.safeParse({ repo: ['acme/web', 'acme/api'] }).success
            ).toBe(false)
            expect(SecretRepoQuerySchema.safeParse({ repo: 'acme/web', x: '1' }).success).toBe(
                false
            )
        })
    })

    describe('SecretNameParamsSchema', () => {
        it('takes an old name that breaks the new rules, so it can still be deleted', () => {
            for (const name of ['lower', 'BAD NAME', 'PATH', 'a-b']) {
                expect(SecretNameParamsSchema.safeParse({ name }).success).toBe(true)
            }
        })

        it('refuses an empty or very long name', () => {
            expect(SecretNameParamsSchema.safeParse({ name: '' }).success).toBe(false)
            expect(
                SecretNameParamsSchema.safeParse({ name: 'X'.repeat(SECRET_NAME_MAX * 2 + 1) })
                    .success
            ).toBe(false)
        })
    })
})
