import { describe, expect, test } from 'bun:test'

import {
    connectVercelQuerySchema,
    connectOAuthQuerySchema,
} from '../../src/modules/integration/integration.schema'

describe('integration schemas', () => {
    describe('connectVercelQuerySchema', () => {
        test('validates correct vercel integration query', () => {
            const valid = connectVercelQuerySchema.safeParse({
                code: 'vercel-code-123',
                state: 'user-id-abc',
                teamId: 'team-xyz',
                configurationId: 'config-999',
            })
            expect(valid.success).toBe(true)
        })

        test('validates without optional teamId and configurationId', () => {
            const valid = connectVercelQuerySchema.safeParse({
                code: 'vercel-code-123',
                state: 'user-id-abc',
            })
            expect(valid.success).toBe(true)
        })

        test('fails if code is missing', () => {
            const invalid = connectVercelQuerySchema.safeParse({
                state: 'user-id-abc',
            })
            expect(invalid.success).toBe(false)
        })

        test('fails if state is missing', () => {
            const invalid = connectVercelQuerySchema.safeParse({
                code: 'vercel-code-123',
            })
            expect(invalid.success).toBe(false)
        })

        test('fails if code is not a string', () => {
            const invalid = connectVercelQuerySchema.safeParse({
                code: 123,
                state: 'user-id-abc',
            })
            expect(invalid.success).toBe(false)
        })
    })

    describe('connectOAuthQuerySchema', () => {
        test('validates correct oauth query', () => {
            const valid = connectOAuthQuerySchema.safeParse({
                code: 'oauth-code-123',
                state: 'user-id-abc',
            })
            expect(valid.success).toBe(true)
        })

        test('fails if code is empty', () => {
            const invalid = connectOAuthQuerySchema.safeParse({
                code: '',
                state: 'user-id-abc',
            })
            expect(invalid.success).toBe(false)
        })

        test('fails if state is empty', () => {
            const invalid = connectOAuthQuerySchema.safeParse({
                code: 'oauth-code-123',
                state: '',
            })
            expect(invalid.success).toBe(false)
        })

        test('fails if state is not a string', () => {
            const invalid = connectOAuthQuerySchema.safeParse({
                code: 'oauth-code-123',
                state: 123,
            })
            expect(invalid.success).toBe(false)
        })
    })
})
