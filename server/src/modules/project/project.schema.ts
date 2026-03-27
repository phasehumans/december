import { z } from 'zod'

export const createProjectSchema = z.object({
    name: z.string().min(3).max(20),
    description: z.string().min(10).max(30).optional(),
    prompt: z.string().min(3),
})

export const updateProjectSchema = z.object({
    rename: z.string().optional(),
    isStarred: z.boolean().optional(),
})

export const projectVersionQuerySchema = z.object({
    versionId: z.string().uuid().optional(),
})
