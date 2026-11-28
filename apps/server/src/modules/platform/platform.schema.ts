import { z } from 'zod'

export const createGithubRepoSchema = z.object({
    name: z
        .string({ message: 'repository name is required' })
        .min(1, 'repository name must be at least 1 character')
        .max(100, 'repository name must be at most 100 characters')
        .regex(
            /^[a-zA-Z0-9_.-]+$/,
            'repository name can only contain letters, numbers, dots, hyphens, and underscores'
        ),
    private: z.boolean({ message: 'private must be a boolean' }).default(true),
    description: z.string({ message: 'description must be a string' }).optional(),
})

export const syncGithubRepoSchema = z.object({
    commitMessage: z
        .string({ message: 'commitMessage must be a string' })
        .min(1, 'commit message must be at least 1 character')
        .optional(),
})

export const sessionIdParamSchema = z.object({
    sessionId: z.string().min(1, 'session id is required'),
})

// no page means every page up to the cap (1,000 repositories a host)
export const listReposQuerySchema = z.object({
    page: z.coerce.number().int().min(1).max(1000).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    search: z.string().trim().min(1).max(200).optional(),
})
