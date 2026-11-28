import { z } from 'zod'

export const usageCheckQuerySchema = z
    .object({
        // up to $10,000: a larger estimate is not a real run
        estimatedCostInCents: z.coerce.number().int().min(0).max(1_000_000).optional(),
    })
    .strict()
