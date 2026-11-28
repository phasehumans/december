import { z } from 'zod'

// a date the usage list takes: from 2020 to 2100. a value outside that (year 10000) would
// fail in the database and is a 400 here
const MIN_DATE_MS = Date.UTC(2020, 0, 1)
const MAX_DATE_MS = Date.UTC(2100, 0, 1)
const isDate = (value: string) => {
    const ms = Date.parse(value)
    return !Number.isNaN(ms) && ms >= MIN_DATE_MS && ms < MAX_DATE_MS
}

export const createRazorpayOrderSchema = z
    .object({
        amountInCents: z
            .number()
            .int()
            .min(100, { message: 'Minimum amount is $1.00' })
            .max(5000, { message: 'Maximum amount is $50.00' }), // min $1.00, max $50.00
        // the wallet is in USD. the order is charged in INR, worked out on the server
        currency: z.literal('USD').default('USD'),
    })
    .strict()

export const verifyRazorpayPaymentSchema = z
    .object({
        razorpay_order_id: z.string().trim().min(1).max(64),
        razorpay_payment_id: z.string().trim().min(1).max(64),
        razorpay_signature: z.string().trim().min(1).max(256),
    })
    .strict()

export const creditsHistoryQuerySchema = z
    .object({
        limit: z.coerce.number().int().min(1).max(100).default(25),
        // a cap keeps a huge offset from making the database walk every row
        offset: z.coerce.number().int().min(0).max(100000).default(0),
        periodStart: z
            .string()
            .max(64)
            .refine(isDate, { message: 'periodStart must be a date from 2020 to 2100' })
            .optional(),
        periodEnd: z
            .string()
            .max(64)
            .refine(isDate, { message: 'periodEnd must be a date from 2020 to 2100' })
            .optional(),
        // no value is all events
        billingSource: z.enum(['CREDITS', 'OWN_KEY']).optional(),
        // the time zone of the days and hours, sent by the browser. with no value, or a name the
        // server does not know, the days are in the time zone saved for the user
        timezone: z.string().min(1).max(64).optional(),
    })
    .strict()
    .refine(
        (value) =>
            !value.periodStart ||
            !value.periodEnd ||
            Date.parse(value.periodStart) <= Date.parse(value.periodEnd),
        { message: 'periodStart must be before periodEnd', path: ['periodStart'] }
    )

// the payments list on Billing: wallet transactions that are not pending, and codes
export const transactionsQuerySchema = z
    .object({
        limit: z.coerce.number().int().min(1).max(50).default(10),
        offset: z.coerce.number().int().min(0).max(10000).default(0),
    })
    .strict()

export const receiptParamsSchema = z.object({
    id: z.string().trim().min(1).max(64),
})

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
