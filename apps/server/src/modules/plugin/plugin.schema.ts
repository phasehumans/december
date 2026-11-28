import { z } from 'zod'

export const installPluginSchema = z
    .object({
        // a marketplace name, owner/repo or a github.com link; the service checks each part
        source: z
            .string()
            .trim()
            .min(1, 'enter a plugin name, owner/repo or a github link')
            .max(300),
    })
    .strict()

export const pluginNameParamsSchema = z.object({
    name: z
        .string()
        .max(64)
        .regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/, 'use letters, numbers, ".", "_" or "-"')
        .refine((name) => !name.includes('..'), 'use letters, numbers, ".", "_" or "-"'),
})

export const setPluginEnabledSchema = z.object({ enabled: z.boolean() }).strict()
