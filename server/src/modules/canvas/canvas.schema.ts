import { z } from 'zod'

import { canvasDocumentSchema } from './canvas.persistence'

export const webClipRequestSchema = z.object({
    url: z
        .string()
        .trim()
        .url()
        .refine(
            (value) => value.startsWith('http://') || value.startsWith('https://'),
            'URL must start with http:// or https://'
        ),
    projectId: z.string().uuid().optional(),
})

export const saveCanvasSchema = z.object({
    projectId: z.string().uuid(),
    versionId: z.string().uuid().optional(),
    canvasState: canvasDocumentSchema,
})
