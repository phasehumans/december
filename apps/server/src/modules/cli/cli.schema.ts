import { z } from 'zod'

export const CompleteHandoffSchema = z.object({
    title: z.string().optional(),
    messages: z.array(z.any()).optional(),
    objectKey: z.string().optional(),
})

export type CompleteHandoffDto = z.infer<typeof CompleteHandoffSchema>
