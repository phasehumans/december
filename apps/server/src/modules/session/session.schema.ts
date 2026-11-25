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
    searchIn: z.enum(['title', 'all']).optional(),
    page: z.preprocess(
        (val) => (val !== undefined && val !== '' ? Number(val) : undefined),
        z.number().int().min(1).optional()
    ),
    limit: z.preprocess(
        (val) => (val !== undefined && val !== '' ? Number(val) : undefined),
        z.number().int().min(1).max(100).optional()
    ),
    vmStatus: z.string().optional(),
    hasPr: z
        .preprocess((val) => (val === 'true' ? true : undefined), z.boolean().optional())
        .optional(),
    pinnedFirst: z
        .preprocess((val) => (val === 'true' ? true : undefined), z.boolean().optional())
        .optional(),
    needsAnswer: z
        .preprocess((val) => (val === 'true' ? true : undefined), z.boolean().optional())
        .optional(),
})

const PULL_REQUEST_STATE_VALUES = ['open', 'draft', 'merged', 'closed'] as const

export const getPullRequestsSchema = z.object({
    // one state or several, comma separated: state=merged,closed
    state: z
        .preprocess(
            (val) =>
                typeof val === 'string' && val.trim()
                    ? val
                          .split(',')
                          .map((item) => item.trim())
                          .filter(Boolean)
                    : undefined,
            z.array(z.enum(PULL_REQUEST_STATE_VALUES)).max(4).optional()
        )
        .optional(),
    isArchived: z
        .preprocess(
            (val) => (val === 'true' ? true : val === 'false' ? false : undefined),
            z.boolean().optional()
        )
        .optional(),
    repo: z.string().trim().min(1).max(200).optional(),
    tag: z.string().trim().min(1).max(30).optional(),
    search: z.string().trim().max(200).optional(),
    sortBy: z.enum(['updatedAt', 'createdAt', 'prOpenedAt']).optional(),
    sortOrder: z.enum(['asc', 'desc']).optional(),
    page: z.preprocess(
        (val) => (val !== undefined && val !== '' ? Number(val) : undefined),
        z.number().int().min(1).optional()
    ),
    limit: z.preprocess(
        (val) => (val !== undefined && val !== '' ? Number(val) : undefined),
        z.number().int().min(1).max(100).optional()
    ),
})

export const smartSearchSessionsSchema = z.object({
    q: z.string().trim().min(3).max(200),
})

/** what the model must return; anything else falls back to plain search */
export const smartSearchFiltersSchema = z.object({
    topic: z
        .array(
            z
                .string()
                .trim()
                .min(1)
                .max(40)
                .transform((word) => word.toLowerCase())
        )
        .max(5)
        .default([]),
    updatedWithinDays: z.number().int().min(1).max(366).nullable().default(null),
    repo: z.string().trim().min(1).max(100).nullable().default(null),
    running: z.boolean().default(false),
    archived: z.boolean().default(false),
    sort: z.enum(['newest', 'oldest']).default('newest'),
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
    billingSource: z.enum(['CREDITS', 'OWN_KEY']).optional(),
    provider: z.string().trim().max(64).optional(),
    model: z.string().trim().max(200).optional(),
    // december credits: the server picks the model for fast and deep
    tier: z.enum(['fast', 'deep']).optional(),
    // session configuration; a field left out takes the user's default
    planFirst: z.boolean().optional(),
    effort: z.enum(['fast', 'deep']).optional(),
    openPullRequest: z.boolean().optional(),
    // plugins and mcp servers switched off for this session only (the + menu)
    disabledPlugins: z.array(z.string().trim().min(1).max(64)).max(50).optional(),
    disabledMcps: z.array(z.string().trim().min(1).max(64)).max(50).optional(),
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

export const pinSessionParamsSchema = z.object({
    id: z.string().uuid('Invalid session ID'),
})

export const unpinSessionParamsSchema = z.object({
    id: z.string().uuid('Invalid session ID'),
})

export const unarchiveSessionsBodySchema = z.object({
    sessionIds: z.array(z.string().uuid('Invalid session ID')).min(1).max(100),
    pins: z
        .array(
            z.object({
                sessionId: z.string().uuid('Invalid session ID'),
                pinnedAt: z.coerce.date(),
            })
        )
        .max(100)
        .optional(),
})

export const updateSessionTagsParamsSchema = z.object({
    id: z.string().uuid('Invalid session ID'),
})
export const updateSessionTagsBodySchema = z.object({
    tags: z.array(z.string().max(30)).max(1, 'Only one tag is allowed per session'),
})

// the web asks the user to type "delete" first; the server checks it too (#636)
export const deleteAllSessionsSchema = z.object({
    confirm: z.literal('delete', { message: 'type delete to confirm' }),
})

export const deleteSessionParamsSchema = z.object({
    id: z.string().uuid('Invalid session ID'),
})

export const disconnectSessionParamsSchema = z.object({
    id: z.string().uuid('Invalid session ID'),
})

export const previewActivityParamsSchema = z.object({
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

export const submitQuestionAnswerParamsSchema = z.object({
    id: z.string().uuid('Invalid session ID'),
})

export const submitQuestionAnswerBodySchema = z.object({
    questionId: z.string().optional(),
    answer: z.union([z.string(), z.array(z.string())]),
})

export const getPendingQuestionParamsSchema = z.object({
    id: z.string().uuid('Invalid session ID'),
})

export const getSessionDesktopViewportParamsSchema = z.object({
    id: z.string().uuid('Invalid session ID'),
})
