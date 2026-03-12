import { z } from 'zod'

export const generateWebsiteSchema = z.object({
    prompt: z.string().min(10),
})
