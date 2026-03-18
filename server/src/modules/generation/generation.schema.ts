import { z } from 'zod'

export const generateWebsiteSchema = z.object({
    prompt: z.string().min(5),
    isDB : z.boolean(),
    dbURL: z.string().optional()
})
