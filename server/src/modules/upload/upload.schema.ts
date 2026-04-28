import { z } from 'zod'

export const uploadRepoSchema = z.object({
    repoURL: z.string().min(1).max(500),
})

export const importIdParamSchema = z.object({
    id: z.string().uuid(),
})
