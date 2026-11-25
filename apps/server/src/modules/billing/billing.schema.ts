import { z } from 'zod'

const isDate = (value: string) => !Number.isNaN(Date.parse(value))

export const createRazorpayOrderSchema = z
    .object({
        amountInCents: z
            .number()
            .int()
            .min(100, { message: 'Minimum amount is $1.00' })
            .max(5000, { message: 'Maximum amount is $50.00' }), // min $1.00, max $50.00
        currency: z.string().trim().length(3).default('USD'),
    })
    .strict()

export const verifyRazorpayPaymentSchema = z
    .object({
        razorpay_order_id: z.string().trim().min(1),
        razorpay_payment_id: z.string().trim().min(1),
        razorpay_signature: z.string().trim().min(1),
    })
    .strict()

export const creditsHistoryQuerySchema = z.object({
    limit: z.coerce.number().int().min(1).max(100).default(25),
    offset: z.coerce.number().int().min(0).default(0),
    periodStart: z.string().refine(isDate, { message: 'periodStart must be a date' }).optional(),
    periodEnd: z.string().refine(isDate, { message: 'periodEnd must be a date' }).optional(),
    // the "all, credits, your keys" control. no value is all
    billingSource: z.enum(['CREDITS', 'OWN_KEY']).optional(),
    // the time zone of the days and hours, sent by the browser. with no value, or a name the
    // server does not know, the days are in the time zone saved for the user
    timezone: z.string().min(1).max(64).optional(),
})

export const receiptParamsSchema = z.object({
    id: z.string().trim().min(1).max(64),
})

export const redeemCodeSchema = z
    .object({
        code: z
            .string()
            .trim()
            .min(1, { message: 'redeem code cannot be empty' })
            .max(100, { message: 'redeem code cannot exceed 100 characters' }),
    })
    .strict()

// #624 part 2: the free credit request form on the billing page
export const creditRequestSchema = z
    .object({
        buildPlan: z
            .string()
            .trim()
            .min(3, { message: 'tell us what you will build' })
            .max(1000, { message: 'keep it under 1000 characters' }),
        heardFrom: z
            .string()
            .trim()
            .min(1, { message: 'tell us how you heard about december' })
            .max(200, { message: 'keep it under 200 characters' }),
        agreeToFeedback: z.literal(true, { message: 'agree to give feedback to request credits' }),
    })
    .strict()

// #638 section 1: an amount in whole cents ($1 to $1000), or null to turn it off
const limitAmount = z
    .number()
    .int({ message: 'the amount must be in whole cents' })
    .min(100, { message: 'the amount must be at least $1' })
    .max(100000, { message: 'the amount cannot be more than $1000' })
    .nullable()

export const updateLimitsSchema = z
    .object({
        lowBalanceAlertCents: limitAmount.optional(),
        sessionLimitCents: limitAmount.optional(),
        dayLimitCents: limitAmount.optional(),
    })
    .strict()
    .refine((value) => Object.values(value).some((amount) => amount !== undefined), {
        message: 'send at least one amount',
    })

export const addCreditsSchema = z
    .object({
        amountInCents: z.number().int().min(100).max(5000),
        paymentMethod: z.enum(['card', 'upi', 'crypto']),
    })
    .strict()
