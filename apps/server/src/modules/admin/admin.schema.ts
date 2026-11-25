import { z } from 'zod'

export const idParamSchema = z.object({ id: z.string().trim().min(1).max(100) })

export const listCreditRequestsQuerySchema = z.object({
    status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional(),
    limit: z.coerce.number().int().min(1).max(200).default(50),
})

export const rejectCreditRequestSchema = z
    .object({
        reason: z.string().trim().min(1, { message: 'give a reason' }).max(500),
    })
    .strict()

export const listFeedbackQuerySchema = z.object({
    userId: z.string().trim().min(1).max(100).optional(),
    limit: z.coerce.number().int().min(1).max(200).default(50),
})

export const listUsersQuerySchema = z.object({
    q: z.string().trim().max(200).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(25),
})

export const adjustCreditsSchema = z
    .object({
        amountInCents: z
            .number()
            .int()
            .min(-100000)
            .max(100000)
            .refine((value) => value !== 0, { message: 'amount cannot be 0' }),
        reason: z.string().trim().min(1, { message: 'give a reason' }).max(500),
    })
    .strict()

export const createRedeemCodeSchema = z
    .object({
        code: z
            .string()
            .trim()
            .min(4)
            .max(64)
            .regex(/^[A-Za-z0-9_-]+$/, { message: 'letters, numbers, - and _ only' })
            .optional(),
        amountInCents: z.number().int().min(1).max(100000),
        maxRedemptions: z.number().int().min(1).max(100000).optional(),
        expiresAt: z.coerce.date().optional(),
    })
    .strict()

export const assignInstallationSchema = z
    .object({
        userId: z.string().trim().min(1).max(100),
    })
    .strict()

export const testAnnouncementSchema = z
    .object({
        subject: z.string().trim().min(1).max(200),
        body: z.string().trim().min(1).max(20000),
    })
    .strict()

export const sendAnnouncementSchema = z
    .object({
        kind: z.enum(['ANNOUNCEMENT', 'FEEDBACK_REQUEST']).default('ANNOUNCEMENT'),
        subject: z.string().trim().min(1).max(200),
        body: z.string().trim().min(1).max(20000),
        signedUpDaysAgo: z.number().int().min(0).max(10000).optional(),
    })
    .strict()
    .refine((data) => data.kind !== 'FEEDBACK_REQUEST' || data.signedUpDaysAgo !== undefined, {
        message: 'feedback requests need signedUpDaysAgo',
        path: ['signedUpDaysAgo'],
    })

export const sandboxActionParamsSchema = z.object({
    id: z.string().trim().min(1).max(100),
    action: z.enum(['pause', 'stop']),
})

export const dailyUsageQuerySchema = z.object({
    days: z.coerce.number().int().min(1).max(90).default(14),
})

export const auditLogQuerySchema = z.object({
    limit: z.coerce.number().int().min(1).max(200).default(50),
})

export const userSessionParamsSchema = z.object({
    id: z.string().trim().min(1).max(100),
    sessionId: z.string().trim().min(1).max(100),
})
