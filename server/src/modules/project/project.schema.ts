import { z } from 'zod'

export const createProjectSchema = z.object({
    name: z.string(),
    description: z.string().min(10).max(30).optional(),
    prompt: z.string(),
})

export const updateProjectSchema = z.object({
    rename: z.string().optional(),
    isStarred: z.boolean().optional(),
})
