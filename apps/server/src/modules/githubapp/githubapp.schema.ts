import { z } from 'zod'

export const WebhookQuerySchema = z.object({
    installationId: z.string().optional(),
})

export type WebhookQueryDto = z.infer<typeof WebhookQuerySchema>
