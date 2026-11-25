import { z } from 'zod'

export const sessionIdParamsSchema = z.object({
    id: z.string().uuid('Invalid session ID'),
})

export const compactBodySchema = z.object({
    focus: z.string().trim().max(500).optional(),
})

export const rewindBodySchema = z.object({
    sequence: z.number().int().min(1),
})

export const sideQuestionBodySchema = z.object({
    question: z.string().trim().min(1, 'question is required').max(2000),
})

export const codeSearchQuerySchema = z.object({
    q: z.string().trim().min(1, 'q is required').max(200),
})

export const checkQuerySchema = z.object({
    sessionId: z.string().uuid('Invalid session ID').optional(),
})

export const reviewBodySchema = z.object({
    url: z.string().trim().url('url must be a pull request link').max(500),
})
