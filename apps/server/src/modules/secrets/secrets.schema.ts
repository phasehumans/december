import { z } from 'zod'

export const CreateSecretSchema = z.object({
    name: z.string().min(1),
    value: z.string().min(1),
})

export type CreateSecretDto = z.infer<typeof CreateSecretSchema>
