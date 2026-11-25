import { isRepoFullName } from '@december/shared'
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

export const listReposQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(30),
    search: z.string().trim().min(1).optional(),
})

// does a branch exist in a repository (#637): the prompt box asks before it uses the
// default base branch
export const checkRepoBranchQuerySchema = z.object({
    provider: z.enum(['GITHUB', 'GITLAB']).default('GITHUB'),
    repository: z.string().trim().max(200).refine(isRepoFullName, 'repository must be owner/name'),
    branch: z
        .string()
        .trim()
        .min(1, 'branch is required')
        .max(100)
        .regex(/^[\w./-]+$/, 'branch has characters git does not allow'),
})
