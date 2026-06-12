import { z } from 'zod'

export const createGithubRepoSchema = z.object({
    name: z
        .string({ message: 'Repository name is required' })
        .min(1, 'Repository name must be at least 1 character')
        .max(100, 'Repository name must be at most 100 characters')
        .regex(
            /^[a-zA-Z0-9_.-]+$/,
            'Repository name can only contain letters, numbers, dots, hyphens, and underscores'
        ),
    private: z.boolean({ invalid_type_error: 'private must be a boolean' }).default(true),
    description: z.string({ invalid_type_error: 'description must be a string' }).optional(),
})

export const syncGithubRepoSchema = z.object({
    commitMessage: z
        .string({ invalid_type_error: 'commitMessage must be a string' })
        .min(1, 'Commit message must be at least 1 character')
        .optional(),
})
