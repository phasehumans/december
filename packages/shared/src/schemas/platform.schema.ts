import { z } from 'zod'

export const downloadProjectVersionSchema = z.object({
    versionId: z
        .string({ message: 'version ID must be a string' })
        .uuid('version ID must be a valid UUID')
        .optional(),
})
