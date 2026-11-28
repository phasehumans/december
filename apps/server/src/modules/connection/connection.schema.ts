import { RULE_FILE_NAMES, isRepoFullName } from '@december/shared'
import { z } from 'zod'

const skillName = z
    .string()
    .trim()
    .regex(/^[a-z0-9][a-z0-9-]{0,63}$/, 'use lowercase letters, numbers and dashes')

const mcpName = z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9][A-Za-z0-9_-]{0,39}$/, 'use letters, numbers, dashes and underscores')

// headers the http client sets for each request: a saved value would break the request or
// send it somewhere else
const RESERVED_HEADERS = new Set([
    'host',
    'content-length',
    'content-type',
    'transfer-encoding',
    'connection',
    'keep-alive',
    'upgrade',
    'te',
    'trailer',
    'accept',
    'accept-encoding',
    'mcp-session-id',
    'mcp-protocol-version',
])
const isReservedHeader = (key: string) => {
    const lower = key.toLowerCase()
    return RESERVED_HEADERS.has(lower) || lower.startsWith('proxy-')
}

export const skillNameParamsSchema = z.object({ name: skillName }).strict()
export const mcpNameParamsSchema = z.object({ name: mcpName }).strict()

export const saveSkillSchema = z
    .object({
        name: skillName,
        description: z.string().trim().min(1, 'description is required').max(300),
        body: z.string().min(1, 'the skill needs instructions').max(20_000),
        runs: z.enum(['agent', 'user']).default('agent'),
        enabled: z.boolean().default(true),
    })
    .strict()

export const setEnabledSchema = z.object({ enabled: z.boolean() }).strict()

export const saveMcpServerSchema = z
    .object({
        name: mcpName,
        url: z.string().trim().url('url is not valid').max(500),
        transport: z.enum(['http', 'sse']).default('http'),
        auth: z.enum(['none', 'header'], {
            message: 'auth must be none or header; sign-in with oauth is not supported yet',
        }),
        headers: z
            .array(
                z
                    .object({
                        key: z
                            .string()
                            .trim()
                            .regex(
                                /^[A-Za-z0-9-]{1,64}$/,
                                'a header name has letters, numbers and dashes'
                            )
                            .refine(
                                (key) => !isReservedHeader(key),
                                'this header is set by the connection itself'
                            ),
                        value: z
                            .string()
                            .max(4000)
                            // eslint-disable-next-line no-control-regex
                            .regex(/^[^\u0000-\u001f\u007f]*$/, {
                                message: 'a header value has no line breaks or control characters',
                            }),
                    })
                    .strict()
            )
            .max(10)
            .refine(
                (headers) =>
                    new Set(headers.map((header) => header.key.toLowerCase())).size ===
                    headers.length,
                'each header name once'
            )
            .default([]),
        enabled: z.boolean().default(true),
        disabledTools: z.array(z.string().trim().min(1).max(200)).max(200).default([]),
    })
    .strict()

export const updateMcpServerSchema = z
    .object({
        enabled: z.boolean(),
        disabledTools: z.array(z.string().trim().min(1).max(200)).max(200),
    })
    .strict()
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
    .strict()
    .refine(isHostPath, { message: 'use owner/name', path: ['repoFullName'] })

export const importSetupSchema = z
    .object({
        ...importRepoShape,
        skills: z.array(z.string().trim().min(1).max(100)).max(100).default([]),
        mcps: z.array(z.string().trim().min(1).max(100)).max(100).default([]),
        // rule files at the root of the repository (AGENTS.md, CLAUDE.md)
        rules: z.array(z.enum(RULE_FILE_NAMES)).max(RULE_FILE_NAMES.length).default([]),
        overwrite: z.boolean().default(false),
    })
    .strict()
    .refine(isHostPath, { message: 'use owner/name', path: ['repoFullName'] })
