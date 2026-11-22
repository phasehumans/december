import { z } from 'zod'

export const updateNameSchema = z.object({
    name: z
        .string({ message: 'name is required' })
        .min(3, 'name must be at least 3 characters')
        .max(20, 'name must be at most 20 characters'),
})

export const updateNotificationSchema = z.object({
    notifyProjectActivity: z
        .boolean({ message: 'notifyProjectActivity must be a boolean' })
        .optional(),
    notifyProductUpdates: z
        .boolean({ message: 'notifyProductUpdates must be a boolean' })
        .optional(),
    notifySecurityAlerts: z
        .boolean({ message: 'notifySecurityAlerts must be a boolean' })
        .optional(),
})

export const updateOnboardingSchema = z.object({
    step: z.enum(['github', 'start', 'models'], {
        message: 'step must be github, start or models',
    }),
})

export const submitFeedbackSchema = z.object({
    rating: z.enum(['sad', 'neutral', 'happy']).nullable(),
    feedback: z.string({ message: 'feedback is required' }).min(1, 'feedback cannot be empty'),
})

export const updateModelSourceSchema = z.object({
    defaultModelSource: z.enum(['CREDITS', 'OWN_KEY'], {
        message: 'defaultModelSource must be CREDITS or OWN_KEY',
    }),
})
