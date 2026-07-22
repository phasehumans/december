import { z } from 'zod'

export const createPullRequestReviewSchema = z.object({
    prUrl: z.string().url('Must be a valid PR URL'),
    sessionId: z.string().uuid().optional(),
    preferences: z.record(z.any()).optional(),
})

export const getReviewsQuerySchema = z.object({
    repository: z.string().optional(),
    status: z.string().optional(),
    isAutoReview: z.enum(['true', 'false']).optional(),
    search: z.string().optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
})

export const updateReviewPreferencesSchema = z.object({
    autoReviewAgentPrs: z.boolean().optional(),
    defaultStrictness: z.enum(['LENIENT', 'STANDARD', 'STRICT']).optional(),
    focusAreas: z.array(z.string()).optional(),
})

export type CreatePullRequestReviewDto = z.infer<typeof createPullRequestReviewSchema>
export type GetReviewsQueryDto = z.infer<typeof getReviewsQuerySchema>
export type UpdateReviewPreferencesDto = z.infer<typeof updateReviewPreferencesSchema>
