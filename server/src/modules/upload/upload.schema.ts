import { z } from 'zod'

export const uploadRepoSchema = z.object({
    repoURL: z
        .string({ message: 'Please provide a GitHub repository URL' })
        .min(1, 'GitHub repository URL cannot be empty')
        .max(500, 'GitHub repository URL is too long'),
})

export const importIdParamSchema = z.object({
    id: z.string({ message: 'Import ID is required' }).uuid('Please provide a valid Import ID'),
})
