import { z } from 'zod'

export const createProjectSchema = z.object({
    name: z.string().min(3).max(20),
    description: z.string().min(10).max(30).optional(),
    prompt: z.string().min(3),
})

export const renameProjectSchema = z.object({
    rename: z.string(),
})

export const getProjectByIdSchema = z.object({
    versionId: z.string().uuid().optional(),
})

export const downloadProjectVersionSchema = z.object({
    versionId: z.string().uuid().optional(),
})

export const toogleStarProjectSchema = z.object({
    isStarred: z.boolean(),
})

export const shareProjectAsTemplateSchema = z.object({
    isSharedAsTemplate: z.boolean(),
})
