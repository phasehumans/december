import { z } from 'zod'

export const CreateReviewSchema = z.object({
    sessionId: z.string().uuid(),
    content: z.string().min(1),
    prUrl: z.string().url().optional(),
    githubCommentId: z.string().optional(),
})

export type CreateReviewDto = z.infer<typeof CreateReviewSchema>
