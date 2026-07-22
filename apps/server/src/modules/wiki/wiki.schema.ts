import { z } from 'zod'

export const GenerateWikiSchema = z.object({
    repoOwner: z.string().min(1),
    repoName: z.string().min(1),
})

export const CreatePageSchema = z.object({
    wikiId: z.string().uuid(),
    title: z.string().min(1),
    content: z.string(),
    slug: z.string().optional(),
    order: z.number().optional(),
})

export const UpdatePageSchema = z.object({
    title: z.string().min(1).optional(),
    content: z.string().optional(),
    slug: z.string().optional(),
    order: z.number().optional(),
})

export const WikiChatSchema = z.object({
    repoFullName: z.string().optional(),
    wikiId: z.string().optional(),
    prompt: z.string().min(1),
})

export type GenerateWikiDto = z.infer<typeof GenerateWikiSchema>
export type CreatePageDto = z.infer<typeof CreatePageSchema>
export type UpdatePageDto = z.infer<typeof UpdatePageSchema>
export type WikiChatDto = z.infer<typeof WikiChatSchema>
