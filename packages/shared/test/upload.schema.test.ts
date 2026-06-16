import { describe, expect, test } from 'bun:test'

import { uploadRepoSchema, importIdParamSchema } from '../src'

describe('upload.schema', () => {
    describe('uploadRepoSchema', () => {
        test('should accept a valid github repo url', () => {
            const result = uploadRepoSchema.safeParse({
                repoURL: 'https://github.com/vercel/next.js',
            })
            expect(result.success).toBe(true)
        })

        test('should reject empty repo url', () => {
            const result = uploadRepoSchema.safeParse({ repoURL: '' })
            expect(result.success).toBe(false)
        })

        test('should reject extremely long url (>500 chars)', () => {
            const result = uploadRepoSchema.safeParse({ repoURL: 'a'.repeat(501) })
            expect(result.success).toBe(false)
        })
    })

    describe('importIdParamSchema', () => {
        test('should accept a valid uuid', () => {
            const result = importIdParamSchema.safeParse({
                id: '864e432c-687f-4424-aa61-a831518f8e12',
            })
            expect(result.success).toBe(true)
        })

        test('should reject invalid uuid', () => {
            const result = importIdParamSchema.safeParse({ id: 'not-a-uuid' })
            expect(result.success).toBe(false)
        })
    })
})
