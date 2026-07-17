import { z } from 'zod'

export const createSessionSchema = z.object({
    title: z.string().max(100).optional(),
    projectId: z.string().uuid().optional().nullable(),
    type: z.enum(['WEB', 'CLI', 'SEARCH']).optional(),
    prompt: z.string().min(1, 'prompt is required').optional(),
})

export const updateSessionSettingsSchema = z.object({
    title: z.string().max(100).optional(),
    projectId: z.string().uuid().optional().nullable(),
    isPinned: z.boolean().optional(),
    isArchived: z.boolean().optional(),
    tags: z.array(z.string().max(30)).optional(),
})

export const addCollaboratorSchema = z.object({
    email: z.string({ message: 'email is required' }).email('please enter a valid email address'),
})
