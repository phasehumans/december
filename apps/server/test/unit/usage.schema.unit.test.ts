import { describe, it, expect } from 'bun:test'

import { usageCheckQuerySchema } from '../../src/modules/usage/usage.schema'

describe('Usage Schema - Unit Tests', () => {
    describe('usageCheckQuerySchema', () => {
        it('should pass with optional estimatedCostInCents coerced from string', () => {
            const res = usageCheckQuerySchema.safeParse({ estimatedCostInCents: '25' })
            expect(res.success).toBe(true)
            if (res.success) {
                expect(res.data.estimatedCostInCents).toBe(25)
            }
        })

        it('should pass with empty query object', () => {
            const res = usageCheckQuerySchema.safeParse({})
            expect(res.success).toBe(true)
            if (res.success) {
                expect(res.data.estimatedCostInCents).toBeUndefined()
            }
        })

        it('should fail if estimatedCostInCents is negative', () => {
            const res = usageCheckQuerySchema.safeParse({ estimatedCostInCents: '-5' })
            expect(res.success).toBe(false)
        })
    })

    describe('usageCheckQuerySchema: bounds', () => {
        it('refuses an estimate over $10,000, part cents and an unknown field', () => {
            expect(
                usageCheckQuerySchema.safeParse({ estimatedCostInCents: '1000001' }).success
            ).toBe(false)
            expect(usageCheckQuerySchema.safeParse({ estimatedCostInCents: '2.5' }).success).toBe(
                false
            )
            expect(usageCheckQuerySchema.safeParse({ userId: 'other' }).success).toBe(false)
        })

        it('takes the top edge', () => {
            expect(
                usageCheckQuerySchema.safeParse({ estimatedCostInCents: '1000000' }).success
            ).toBe(true)
        })
    })
})
