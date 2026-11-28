import {
    SECRET_NAME_MAX,
    SECRET_NOTE_MAX,
    SECRETS_BULK_MAX,
    checkSecretName,
    checkSecretValue,
} from '@december/shared/secrets'
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

/** a new name: A-Z, 0-9 and _, not a digit first, not a name the sandbox keeps (PATH) */
export const SecretNameSchema = z.string().superRefine((name, ctx) => {
    const problem = checkSecretName(name)
    if (problem) ctx.addIssue({ code: z.ZodIssueCode.custom, message: problem })
})

/** at most 16 KiB, not only spaces, no NUL character */
export const SecretValueSchema = z.string().superRefine((value, ctx) => {
    const problem = checkSecretValue(value)
    if (problem) ctx.addIssue({ code: z.ZodIssueCode.custom, message: problem })
})

/** a short note. an empty note is no note */
export const SecretNoteSchema = z.string().trim().max(SECRET_NOTE_MAX).nullish()

export const CreateSecretSchema = z
    .object({
        name: SecretNameSchema,
        value: SecretValueSchema,
        note: SecretNoteSchema,
        repoFullName: SecretRepoSchema,
    })
    .strict()

export const BulkCreateSecretsSchema = z
    .object({
        // the repository of every item that names none
        repoFullName: SecretRepoSchema,
        secrets: z
            .array(
                z
                    .object({
                        name: SecretNameSchema,
                        value: SecretValueSchema,
                        note: SecretNoteSchema,
                        repoFullName: SecretRepoSchema,
                    })
                    .strict()
            )
            .min(1)
            .max(SECRETS_BULK_MAX),
    })
    .strict()

/**
 * The name in the path of the routes that read or delete one secret. Looser than a new name,
 * so a row saved before the name rules can still be read and deleted.
 */
export const SecretNameParamsSchema = z.object({
    name: z
        .string()
        .min(1)
        .max(SECRET_NAME_MAX * 2),
})

/** `?repo=owner/name` on the routes that take a secret name. none: the "all repositories" row */
export const SecretRepoQuerySchema = z
    .object({
        repo: SecretRepoSchema,
    })
    .strict()

export type CreateSecretDto = z.infer<typeof CreateSecretSchema>
export type BulkCreateSecretsDto = z.infer<typeof BulkCreateSecretsSchema>
export type SecretRepoQueryDto = z.infer<typeof SecretRepoQuerySchema>
