import { z } from 'zod'

// G1: never more than 90 days in one query
// the Refresh button on Overview and System: skip the short cache
export const freshQuerySchema = z.object({
    fresh: z
        .enum(['1', 'true'])
        .optional()
        .transform((value) => value !== undefined),
})

// O2: the Overview chart: 7, 30 or 90 days by day, or a year (365) by week
export const trendQuerySchema = z.object({
    days: z.coerce
        .number()
        .int()
        .refine((days) => [7, 30, 90, 365].includes(days), { message: 'days is 7, 30, 90 or 365' })
        .default(30),
})

export const statsWindowQuerySchema = z.object({
    days: z.coerce.number().int().min(7).max(90).default(30),
})
