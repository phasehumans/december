import { z } from 'zod'

const skillName = z
    .string()
    .trim()
    .regex(/^[a-z0-9][a-z0-9-]{0,63}$/, 'use lowercase letters, numbers and dashes')

const mcpName = z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9][A-Za-z0-9_-]{0,39}$/, 'use letters, numbers, dashes and underscores')

export const skillNameParamsSchema = z.object({ name: skillName })
export const mcpNameParamsSchema = z.object({ name: mcpName })

export const saveSkillSchema = z.object({
    name: skillName,
    description: z.string().trim().min(1, 'description is required').max(300),
    body: z.string().min(1, 'the skill needs instructions').max(20_000),
    runs: z.enum(['agent', 'user']).default('agent'),
    enabled: z.boolean().default(true),
})

export const setEnabledSchema = z.object({ enabled: z.boolean() })

export const saveMcpServerSchema = z.object({
    name: mcpName,
    url: z.string().trim().url('url is not valid').max(500),
    transport: z.enum(['http', 'sse']).default('http'),
    auth: z.enum(['none', 'header'], {
        message: 'auth must be none or header; sign-in with oauth is not supported yet',
    }),
    headers: z
        .array(
            z.object({
                key: z
                    .string()
                    .trim()
                    .regex(/^[A-Za-z0-9-]{1,64}$/, 'a header name has letters, numbers and dashes'),
                value: z.string().max(4000),
            })
        )
        .max(10)
        .default([]),
    enabled: z.boolean().default(true),
    disabledTools: z.array(z.string().trim().min(1).max(200)).max(200).default([]),
})

export const updateMcpServerSchema = z
    .object({
        enabled: z.boolean(),
        disabledTools: z.array(z.string().trim().min(1).max(200)).max(200),
    })
    .partial()
    .refine((value) => Object.keys(value).length > 0, { message: 'send enabled or disabledTools' })
