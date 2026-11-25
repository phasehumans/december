import { isRepoFullName } from '@december/shared'
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

// import setup (#637 section 6)

const repoFullName = z
    .string()
    .trim()
    .max(200)
    // a part of dots only would point the request at another path of the git host
    .refine(isRepoFullName, 'use owner/name')

const importRepoShape = {
    repoFullName,
    provider: z.enum(['GITHUB', 'GITLAB']).default('GITHUB'),
}

const isHostPath = (value: { repoFullName: string; provider: 'GITHUB' | 'GITLAB' }) =>
    value.provider === 'GITLAB' || value.repoFullName.split('/').length === 2

export const importPreviewSchema = z
    .object(importRepoShape)
    .refine(isHostPath, { message: 'use owner/name', path: ['repoFullName'] })

export const importSetupSchema = z
    .object({
        ...importRepoShape,
        skills: z.array(z.string().trim().min(1).max(100)).max(100).default([]),
        mcps: z.array(z.string().trim().min(1).max(100)).max(100).default([]),
        overwrite: z.boolean().default(false),
    })
    .refine(isHostPath, { message: 'use owner/name', path: ['repoFullName'] })
