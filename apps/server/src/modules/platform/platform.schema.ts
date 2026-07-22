import { z } from 'zod'

export const syncEnvVarsSchema = z.object({
    keys: z.array(z.string()).optional(),
})

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

export const deploymentIdParamSchema = z.object({
    deploymentId: z.string().min(1, 'deployment id is required'),
})
