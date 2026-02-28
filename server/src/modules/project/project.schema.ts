import { z } from 'zod'

export const createProjectSchema = z.object({
    name: z.string(),
    prompt: z.string(),
})

export const updateProjectSchema = z.object({
    rename: z.string().optional(),
    starred: z.boolean().optional(),
})
