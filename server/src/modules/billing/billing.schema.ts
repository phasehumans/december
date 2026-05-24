import { z } from 'zod'

export const billingPlanSchema = z.enum(['PRO'])

export const createSubscriptionSchema = z
    .object({
        plan: billingPlanSchema.default('PRO'),
        quantity: z.number().int().min(1).max(100).default(1),
        totalCount: z.number().int().min(1).max(120).default(120),
    })
    .strict()

export const verifySubscriptionSchema = z
    .object({
        razorpay_subscription_id: z.string().trim().min(1),
        razorpay_payment_id: z.string().trim().min(1),
        razorpay_signature: z.string().trim().min(1),
    })
    .strict()

export const cancelSubscriptionSchema = z
    .object({
        cancelAtPeriodEnd: z.boolean().default(true),
    })
    .strict()

export const creditsHistoryQuerySchema = z.object({
    limit: z.coerce.number().int().min(1).max(100).default(25),
    offset: z.coerce.number().int().min(0).default(0),
    periodStart: z.string().optional(),
    periodEnd: z.string().optional(),
})
