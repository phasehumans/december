import { z } from 'zod'

export const WebhookQuerySchema = z.object({
    installationId: z.string().optional(),
})

export type WebhookQueryDto = z.infer<typeof WebhookQuerySchema>

// a repository list: no page means every page up to the cap
export const listInstallationReposQuerySchema = z.object({
    page: z.coerce.number().int().min(1).max(1000).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    search: z.string().trim().min(1).max(200).optional(),
})
