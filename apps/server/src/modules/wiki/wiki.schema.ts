import { z } from 'zod'

export const CreateWikiSchema = z.object({
    projectId: z.string().uuid(),
    title: z.string().min(1),
    content: z.string(),
})

export const UpdateWikiSchema = z.object({
    title: z.string().min(1).optional(),
    content: z.string().optional(),
})

export type CreateWikiDto = z.infer<typeof CreateWikiSchema>
export type UpdateWikiDto = z.infer<typeof UpdateWikiSchema>
