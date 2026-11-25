import { z } from 'zod'

import { isRepoFullName } from './secrets.utils'

/**
 * The repository of a secret, as `owner/name`. null, an empty text or no field at all
 * mean "all repositories" (#637 section 5).
 */
export const SecretRepoSchema = z
    .string()
    .trim()
    .max(200)
    .refine((value) => value === '' || isRepoFullName(value), { message: 'use owner/name' })
    .nullish()

export const CreateSecretSchema = z.object({
    name: z.string().min(1),
    value: z.string().min(1),
    note: z.string().optional(),
    repoFullName: SecretRepoSchema,
})

export const BulkCreateSecretsSchema = z.object({
    // the repository of every item that names none
    repoFullName: SecretRepoSchema,
    secrets: z
        .array(
            z.object({
                name: z.string().min(1),
                value: z.string().min(1),
                note: z.string().optional(),
                repoFullName: SecretRepoSchema,
            })
        )
        .min(1),
})

/** `?repo=owner/name` on the routes that take a secret name. none: the "all repositories" row */
export const SecretRepoQuerySchema = z.object({
    repo: SecretRepoSchema,
})

export type CreateSecretDto = z.infer<typeof CreateSecretSchema>
export type BulkCreateSecretsDto = z.infer<typeof BulkCreateSecretsSchema>
export type SecretRepoQueryDto = z.infer<typeof SecretRepoQuerySchema>
