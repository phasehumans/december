import { z } from 'zod'

export const toggleLikeSchema = z.object({
    isLiked: z.boolean({ message: 'isLiked must be a boolean' }),
})

export const remixTemplateSchema = z.object({
    name: z.string({ message: 'name must be a string' }).optional(),
})
