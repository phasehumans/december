import { describe, it, expect } from 'bun:test'

import {
    CreateSecretSchema,
    BulkCreateSecretsSchema,
    SecretRepoQuerySchema,
} from '../../src/modules/secrets/secrets.schema'

describe('Secrets Schema - Unit Tests', () => {
    describe('CreateSecretSchema', () => {
        it('should pass with valid name, value, and optional note', () => {
            const valid = {
                name: 'STRIPE_API_KEY',
                value: 'sk_test_12345',
                note: 'Stripe test key',
            }
            const res = CreateSecretSchema.safeParse(valid)
            expect(res.success).toBe(true)
            if (res.success) {
                expect(res.data.name).toBe('STRIPE_API_KEY')
                expect(res.data.value).toBe('sk_test_12345')
                expect(res.data.note).toBe('Stripe test key')
            }
        })

        it('should pass with valid name and value when note is omitted', () => {
            const valid = {
                name: 'GITHUB_TOKEN',
                value: 'ghp_abc123',
            }
            const res = CreateSecretSchema.safeParse(valid)
            expect(res.success).toBe(true)
        })

        it('should fail if name is empty string or missing', () => {
            const emptyName = { name: '', value: 'secret-val' }
            expect(CreateSecretSchema.safeParse(emptyName).success).toBe(false)

            const missingName = { value: 'secret-val' }
            expect(CreateSecretSchema.safeParse(missingName).success).toBe(false)
        })

        it('should fail if value is empty string or missing', () => {
            const emptyValue = { name: 'KEY', value: '' }
            expect(CreateSecretSchema.safeParse(emptyValue).success).toBe(false)

            const missingValue = { name: 'KEY' }
            expect(CreateSecretSchema.safeParse(missingValue).success).toBe(false)
        })
    })

    describe('BulkCreateSecretsSchema', () => {
        it('should pass with array of valid secrets', () => {
            const valid = {
                secrets: [
                    { name: 'KEY_ONE', value: 'val1', note: 'First key' },
                    { name: 'KEY_TWO', value: 'val2' },
                ],
            }
            const res = BulkCreateSecretsSchema.safeParse(valid)
            expect(res.success).toBe(true)
            if (res.success) {
                expect(res.data.secrets.length).toBe(2)
            }
        })

        it('should fail if secrets array is empty', () => {
            const empty = { secrets: [] }
            const res = BulkCreateSecretsSchema.safeParse(empty)
            expect(res.success).toBe(false)
        })

        it('should fail if any item in secrets array is invalid', () => {
            const invalidItem = {
                secrets: [
                    { name: 'VALID_KEY', value: 'val1' },
                    { name: '', value: 'val2' },
                ],
            }
            const res = BulkCreateSecretsSchema.safeParse(invalidItem)
            expect(res.success).toBe(false)
        })
    })

    // #637 section 5
    describe('the repository of a secret', () => {
        it('takes owner/name', () => {
            const res = CreateSecretSchema.safeParse({
                name: 'KEY',
                value: 'v',
                repoFullName: 'acme/web',
            })
            expect(res.success).toBe(true)
            if (res.success) expect(res.data.repoFullName).toBe('acme/web')
        })

        it('takes null, an empty text and no field as "all repositories"', () => {
            for (const extra of [{ repoFullName: null }, { repoFullName: '' }, {}]) {
                const res = CreateSecretSchema.safeParse({ name: 'KEY', value: 'v', ...extra })
                expect(res.success).toBe(true)
            }
        })

        it('refuses a repository that is not owner/name', () => {
            for (const repoFullName of ['web', 'acme/web repo', '../web', 42]) {
                const res = CreateSecretSchema.safeParse({ name: 'KEY', value: 'v', repoFullName })
                expect(res.success).toBe(false)
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

        it('checks the repo query of the routes that take a name', () => {
            expect(SecretRepoQuerySchema.safeParse({}).success).toBe(true)
            expect(SecretRepoQuerySchema.safeParse({ repo: 'acme/web' }).success).toBe(true)
            expect(SecretRepoQuerySchema.safeParse({ repo: 'web' }).success).toBe(false)
            expect(
                SecretRepoQuerySchema.safeParse({ repo: ['acme/web', 'acme/api'] }).success
            ).toBe(false)
        })
    })
})
