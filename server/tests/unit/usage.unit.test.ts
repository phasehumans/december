import { describe, expect, it } from 'bun:test'

import { recordUsageEventSchema, usageCheckQuerySchema } from '../../src/modules/usage/usage.schema'

describe('usage.schema', () => {
    describe('recordUsageEventSchema', () => {
        it('should accept a valid usage event', () => {
            const result = recordUsageEventSchema.safeParse({
                model: 'gpt-5',
                inputTokens: 100,
                outputTokens: 50,
                costInCents: 3,
                projectId: '11111111-1111-4111-8111-111111111111',
                externalRequestId: 'req_123',
                metadata: {
                    route: 'generate',
                },
            })

            expect(result.success).toBe(true)
            expect(result.success && result.data.totalTokens).toBe(150)
        })

        it('should reject negative token and cost values', () => {
            const result = recordUsageEventSchema.safeParse({
                model: 'gpt-5',
                inputTokens: -1,
                outputTokens: 0,
                costInCents: -1,
            })

            expect(result.success).toBe(false)
        })

        it('should reject non-uuid project ids', () => {
            const result = recordUsageEventSchema.safeParse({
                model: 'gpt-5',
                projectId: 'not-a-project-id',
            })

            expect(result.success).toBe(false)
        })
    })

    describe('usageCheckQuerySchema', () => {
        it('should coerce estimated cost query strings', () => {
            const result = usageCheckQuerySchema.safeParse({
                estimatedCostInCents: '25',
            })

            expect(result.success).toBe(true)
            expect(result.success && result.data.estimatedCostInCents).toBe(25)
        })
    })
})
