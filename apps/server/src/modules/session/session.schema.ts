import { z } from 'zod'

export const getSessionsSchema = z.object({
    type: z.enum(['WEB', 'SEARCH']).optional(),
    isArchived: z
        .preprocess(
            (val) => (val === 'true' ? true : val === 'false' ? false : undefined),
            z.boolean().optional()
        )
        .optional(),
    tags: z.string().optional(),
    sortBy: z.enum(['updatedAt', 'createdAt']).optional(),
    sortOrder: z.enum(['asc', 'desc']).optional(),
    search: z.string().optional(),
    page: z.preprocess(
        (val) => (val !== undefined && val !== '' ? Number(val) : undefined),
        z.number().int().min(1).optional()
    ),
    limit: z.preprocess(
        (val) => (val !== undefined && val !== '' ? Number(val) : undefined),
        z.number().int().min(1).max(100).optional()
    ),
    vmStatus: z.string().optional(),
})

export const createSessionSchema = z.object({
    title: z.string().max(100).optional(),
    type: z.enum(['WEB', 'SEARCH']).optional(),
    prompt: z.string().min(1, 'prompt is required').optional(),
    projectId: z.string().uuid().optional(),
    repoUrl: z.string().url().optional(),
    branch: z.string().max(100).optional(),
    gitRef: z.string().max(100).optional(),
    issueNumber: z.number().int().positive().optional(),
})

export const getSessionByIdSchema = z.object({
    id: z.string().uuid('Invalid session ID'),
})

export const renameSessionParamsSchema = z.object({
    id: z.string().uuid('Invalid session ID'),
})
export const renameSessionBodySchema = z.object({
    title: z.string().min(1, 'title is required').max(100),
})

export const archiveSessionParamsSchema = z.object({
    id: z.string().uuid('Invalid session ID'),
})

export const unarchiveSessionParamsSchema = z.object({
    id: z.string().uuid('Invalid session ID'),
})

export const updateSessionTagsParamsSchema = z.object({
    id: z.string().uuid('Invalid session ID'),
})
export const updateSessionTagsBodySchema = z.object({
    tags: z.array(z.string().max(30)).max(1, 'Only one tag is allowed per session'),
})

export const deleteSessionParamsSchema = z.object({
    id: z.string().uuid('Invalid session ID'),
})

export const disconnectSessionParamsSchema = z.object({
    id: z.string().uuid('Invalid session ID'),
})

export const rehydrateSessionParamsSchema = z.object({
    id: z.string().uuid('Invalid session ID'),
})

export const proxyPreviewParamsSchema = z.object({
    id: z.string().uuid('Invalid session ID'),
    port: z
        .preprocess(
            (val) => (val !== undefined && val !== null ? Number(val) : 3000),
            z.number().int().min(1).max(65535)
        )
        .default(3000),
})

export const streamSearchResponseParamsSchema = z.object({
    id: z.string().uuid('Invalid session ID'),
})

export const streamSearchResponseBodySchema = z.object({
    prompt: z.string().min(1, 'prompt is required'),
    messageHistory: z
        .array(
            z.object({
                role: z.preprocess(
                    (val) => (typeof val === 'string' ? val.toLowerCase() : val),
                    z.enum(['user', 'assistant', 'system'])
                ),
                content: z.string().optional().default(''),
            })
        )
        .optional(),
})

export const getSessionDiffParamsSchema = z.object({
    id: z.string().uuid('Invalid session ID'),
})

export const getSessionFileTreeParamsSchema = z.object({
    id: z.string().uuid('Invalid session ID'),
})

export const getSessionFileContentParamsSchema = z.object({
    id: z.string().uuid('Invalid session ID'),
})

export const getSessionFileContentQuerySchema = z.object({
    path: z.string().min(1, 'path is required'),
})

export const getSessionPullRequestsParamsSchema = z.object({
    id: z.string().uuid('Invalid session ID'),
})

export const getSessionPlanParamsSchema = z.object({
    id: z.string().uuid('Invalid session ID'),
})

export const getSessionTestsParamsSchema = z.object({
    id: z.string().uuid('Invalid session ID'),
})

export const getSessionPreviewPortParamsSchema = z.object({
    id: z.string().uuid('Invalid session ID'),
})
