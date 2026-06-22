import { describe, expect, test } from 'bun:test'
import { usageCheckQuerySchema, recordUsageEventSchema } from '../../src/modules/usage/usage.schema'

describe('usage schemas', () => {
    test('usageCheckQuerySchema validation', () => {
        const valid = usageCheckQuerySchema.safeParse({ estimatedCostInCents: 50 })
        expect(valid.success).toBe(true)

        const invalid = usageCheckQuerySchema.safeParse({ estimatedCostInCents: -5 })
        expect(invalid.success).toBe(false)
    })

    test('recordUsageEventSchema validation', () => {
        const valid = recordUsageEventSchema.safeParse({
            model: 'gpt-4',
            inputTokens: 100,
            outputTokens: 200,
            costInCents: 2,
        })
        expect(valid.success).toBe(true)
    })
})
