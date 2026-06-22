import { describe, expect, test } from 'bun:test'
import { uploadRepoSchema, importIdParamSchema } from '../../src/modules/import/import.schema'
import { parseGitHubRepoUrl } from '../../src/modules/import/import.utils'

describe('import schemas', () => {
    describe('uploadRepoSchema', () => {
        test('validates correct GitHub repo URL', () => {
            const valid = uploadRepoSchema.safeParse({
                repoURL: 'https://github.com/phasehumans/december',
            })
            expect(valid.success).toBe(true)
        })

        test('fails if repoURL is empty', () => {
            const invalid = uploadRepoSchema.safeParse({
                repoURL: '',
            })
            expect(invalid.success).toBe(false)
        })

        test('fails if repoURL is too long', () => {
            const invalid = uploadRepoSchema.safeParse({
                repoURL: 'a'.repeat(501),
            })
            expect(invalid.success).toBe(false)
        })
    })

    describe('importIdParamSchema', () => {
        test('validates valid UUID import ID', () => {
            const valid = importIdParamSchema.safeParse({
                id: '11111111-2222-4333-8444-555555555555',
            })
            expect(valid.success).toBe(true)
        })

        test('fails if ID is not a valid UUID', () => {
            const invalid = importIdParamSchema.safeParse({
                id: 'invalid-id',
            })
            expect(invalid.success).toBe(false)
        })
    })
})

describe('import utils', () => {
    describe('parseGitHubRepoUrl', () => {
        test('parses standard https url', () => {
            const result = parseGitHubRepoUrl('https://github.com/owner/repo')
            expect(result.ok).toBe(true)
            if (result.ok) {
                expect(result.owner).toBe('owner')
                expect(result.repo).toBe('repo')
                expect(result.normalizedUrl).toBe('https://github.com/owner/repo')
            }
        })

        test('parses url with .git extension', () => {
            const result = parseGitHubRepoUrl('https://github.com/owner/repo.git')
            expect(result.ok).toBe(true)
            if (result.ok) {
                expect(result.owner).toBe('owner')
                expect(result.repo).toBe('repo')
            }
        })

        test('parses ssh git url', () => {
            const result = parseGitHubRepoUrl('git@github.com:owner/repo.git')
            expect(result.ok).toBe(true)
            if (result.ok) {
                expect(result.owner).toBe('owner')
                expect(result.repo).toBe('repo')
            }
        })

        test('parses url without protocol', () => {
            const result = parseGitHubRepoUrl('github.com/owner/repo')
            expect(result.ok).toBe(true)
            if (result.ok) {
                expect(result.owner).toBe('owner')
                expect(result.repo).toBe('repo')
            }
        })

        test('fails on empty input', () => {
            const result = parseGitHubRepoUrl('   ')
            expect(result.ok).toBe(false)
            if (!result.ok) {
                expect(result.code).toBe('EMPTY_INPUT')
            }
        })

        test('fails on non-github domains', () => {
            const result = parseGitHubRepoUrl('https://gitlab.com/owner/repo')
            expect(result.ok).toBe(false)
            if (!result.ok) {
                expect(result.code).toBe('NOT_GITHUB')
            }
        })

        test('fails on incomplete repository paths', () => {
            const result = parseGitHubRepoUrl('https://github.com/owner')
            expect(result.ok).toBe(false)
            if (!result.ok) {
                expect(result.code).toBe('NOT_REPO_URL')
            }
        })
    })
})
