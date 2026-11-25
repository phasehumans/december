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

// every field is optional: the page saves one row at a time
export const updatePullRequestSettingsSchema = z
    .object({
        branchPrefix: z
            .string()
            .trim()
            .max(40, 'branchPrefix must be at most 40 characters')
            .regex(/^[A-Za-z0-9._/-]*$/, 'branchPrefix has characters git does not allow'),
        prDraft: z.boolean(),
        prCreate: z.enum(['auto', 'ask']),
        prAuthor: z.enum(['december', 'user']),
        commitAuthor: z.enum(['both', 'december']),
        archiveOnMerge: z.boolean(),
        githubCommentsEnabled: z.boolean(),
        reviewReplies: z.enum(['all', 'mention', 'off']),
        replyToBots: z.boolean(),
        fixFailedChecks: z.boolean(),
        autoReview: z.enum(['asked', 'mine', 'all']),
        reviewCadence: z.enum(['once', 'push']),
        reviewRepos: z
            .array(
                z
                    .string()
                    .trim()
                    .regex(/^[\w.-]+\/[\w.-]+$/, 'reviewRepos must be owner/name')
            )
            .max(100),
    })
    .partial()
    .strict()

export const unsubscribeQuerySchema = z.object({
    u: z.string().trim().min(1).max(100),
    t: z.string().trim().min(1).max(200),
})
