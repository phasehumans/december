import { z } from 'zod'

export const WAITLIST_FEATURES = ['super-crew'] as const

export const WaitlistParamsSchema = z.object({
    feature: z.enum(WAITLIST_FEATURES, {
        message: "feature must be one of 'super-crew'",
    }),
})

export type WaitlistFeature = (typeof WAITLIST_FEATURES)[number]
