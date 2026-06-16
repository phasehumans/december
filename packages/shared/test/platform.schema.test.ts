import { describe, expect, test } from 'bun:test'

import { downloadProjectVersionSchema } from '../src'

describe('platform.schema', () => {
    describe('downloadProjectVersionSchema', () => {
        test('should pass without versionId', () => {
            expect(downloadProjectVersionSchema.safeParse({}).success).toBe(true)
        })

        test('should pass with valid UUID versionId', () => {
            const data = { versionId: '550e8400-e29b-41d4-a716-446655440000' }
            expect(downloadProjectVersionSchema.safeParse(data).success).toBe(true)
        })

        test('should fail with an invalid UUID versionId', () => {
            const data = { versionId: 'bad-id' }
            expect(downloadProjectVersionSchema.safeParse(data).success).toBe(false)
        })
    })
})
