import { z } from 'zod'

// the Refresh button skips the short cache
export const freshQuerySchema = z.object({
    fresh: z
        .enum(['1', 'true'])
        .optional()
        .transform((value) => value !== undefined),
})

// C1, C2: the same windows as the Analytics page. 365 asks for a year; Cloudflare answers
// with its 90 days
export const visitorsQuerySchema = z.object({
    days: z.coerce
        .number()
        .int()
        .refine((days) => [7, 30, 90, 365].includes(days), { message: 'days is 7, 30, 90 or 365' })
        .default(30),
})
