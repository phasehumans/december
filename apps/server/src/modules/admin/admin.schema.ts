import { z } from 'zod'

export const idParamSchema = z.object({ id: z.string().trim().min(1).max(100) })

export const rejectCreditRequestSchema = z
    .object({
        reason: z.string().trim().min(1, { message: 'give a reason' }).max(500),
    })
    .strict()

export const listUsersQuerySchema = z.object({
    q: z.string().trim().max(200).optional(),
    page: z.coerce.number().int().min(1).max(10000).default(1),
    // 25 a page, like the problem list on lab.trydecember.com
    pageSize: z.coerce.number().int().min(1).max(50).default(25),
    // U2: all, active in the last 7 days, a pending request (M1), sent feedback (M4)
    filter: z.enum(['all', 'active', 'asked', 'feedback']).default('all'),
})

export const adjustCreditsSchema = z
    .object({
        // add only: the daily limits ($10 a user, $50 in total) are checked on the server
        amountInCents: z.number().int().min(1, { message: 'add at least $0.01' }).max(100000),
    })
    .strict()

export const sandboxActionParamsSchema = z.object({
    id: z.string().trim().min(1).max(100),
    action: z.enum(['pause', 'stop']),
})

export const creditLedgerQuerySchema = z.object({
    limit: z.coerce.number().int().min(1).max(200).default(100),
})
