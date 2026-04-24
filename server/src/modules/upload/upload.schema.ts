import { z } from 'zod'

export const uploadRepoSchema = z.object({
    repoURL: z.string().url(),
})
