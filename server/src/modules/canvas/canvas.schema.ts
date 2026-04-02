import { z } from 'zod'

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
