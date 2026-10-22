import { describe, it, expect } from 'bun:test'

import {
    createGithubRepoSchema,
    syncGithubRepoSchema,
    sessionIdParamSchema,
} from '../../src/modules/platform/platform.schema'

describe('Platform Schema - Unit Tests', () => {
    describe('createGithubRepoSchema', () => {
        it('should pass with valid repository name and default private to true', () => {
            const res = createGithubRepoSchema.safeParse({
                name: 'my-awesome-app_v1.0',
            })
            expect(res.success).toBe(true)
            if (res.success) {
                expect(res.data.name).toBe('my-awesome-app_v1.0')
                expect(res.data.private).toBe(true)
            }
        })

        it('should fail with invalid characters in name or empty name', () => {
            expect(createGithubRepoSchema.safeParse({ name: 'my app with spaces' }).success).toBe(
                false
            )
            expect(createGithubRepoSchema.safeParse({ name: '' }).success).toBe(false)
            expect(createGithubRepoSchema.safeParse({}).success).toBe(false)
        })
    })

    describe('syncGithubRepoSchema', () => {
        it('should pass with optional commitMessage', () => {
            expect(syncGithubRepoSchema.safeParse({ commitMessage: 'fix: typo' }).success).toBe(
                true
            )
            expect(syncGithubRepoSchema.safeParse({}).success).toBe(true)
        })

        it('should fail if commitMessage is empty string', () => {
            expect(syncGithubRepoSchema.safeParse({ commitMessage: '' }).success).toBe(false)
        })
    })

    describe('sessionIdParamSchema', () => {
        it('should pass with non-empty string IDs', () => {
            expect(sessionIdParamSchema.safeParse({ sessionId: 'session-123' }).success).toBe(true)
        })

        it('should fail with empty string IDs', () => {
            expect(sessionIdParamSchema.safeParse({ sessionId: '' }).success).toBe(false)
        })
    })
})
