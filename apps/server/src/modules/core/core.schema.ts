import { z } from 'zod'

export const HandlePromptSchema = z.object({
    prompt: z.string().min(1),
    projectId: z.string().optional(),
    sessionId: z.string().optional(),
})

export type HandlePromptDto = z.infer<typeof HandlePromptSchema>
