import { z } from 'zod'

export const toggleLikeSchema = z.object({
    isLiked: z.boolean(),
})
