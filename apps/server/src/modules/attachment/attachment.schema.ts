import { z } from 'zod'

export const uploadAttachmentParamsSchema = z.object({
    id: z.string().uuid('session id is not valid'),
})

export const uploadAttachmentQuerySchema = z.object({
    name: z.string().min(1, 'name is required').max(500),
})

export const removeAttachmentParamsSchema = z.object({
    id: z.string().uuid('session id is not valid'),
    attachmentId: z.string().uuid('attachment id is not valid'),
})
