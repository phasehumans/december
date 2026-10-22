import { describe, it, expect } from 'bun:test'

import { connectOAuthQuerySchema } from '../../src/modules/integration/integration.schema'

describe('Integration Schema - Unit Tests', () => {
    describe('connectOAuthQuerySchema', () => {
        it('should pass with valid code and state', () => {
            const valid = {
                code: 'oauth-code-456',
                state: 'user-id-xyz:/path',
            }
            const res = connectOAuthQuerySchema.safeParse(valid)
            expect(res.success).toBe(true)
            if (res.success) {
                expect(res.data.code).toBe('oauth-code-456')
                expect(res.data.state).toBe('user-id-xyz:/path')
            }
        })

        it('should fail if code or state is empty or missing', () => {
            expect(connectOAuthQuerySchema.safeParse({ code: '', state: 'state' }).success).toBe(
                false
            )
            expect(connectOAuthQuerySchema.safeParse({ code: 'code', state: '' }).success).toBe(
                false
            )
            expect(connectOAuthQuerySchema.safeParse({ code: 'code' }).success).toBe(false)
            expect(connectOAuthQuerySchema.safeParse({ state: 'state' }).success).toBe(false)
        })
    })
})
