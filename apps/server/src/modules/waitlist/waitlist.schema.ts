import { z } from 'zod'

export const WAITLIST_FEATURES = ['super-crew'] as const

export const WaitlistParamsSchema = z.object({
    feature: z.enum(WAITLIST_FEATURES, {
        message: "feature must be one of 'super-crew'",
    }),
})

export const LaunchWaitlistSchema = z.object({
    subject: z.string().trim().min(1, 'subject is required').max(200),
    body: z.string().trim().min(1, 'body is required').max(10000),
    inboxMessage: z.string().trim().min(1, 'inbox line is required').max(300),
})

export type WaitlistFeature = (typeof WAITLIST_FEATURES)[number]
