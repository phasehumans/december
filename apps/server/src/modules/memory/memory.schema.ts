import { MEMORY_MAX_CHARS } from '@december/shared/agent-context'
import { z } from 'zod'

const content = z
    .string()
    .trim()
    .min(1, 'write the memory')
    .max(MEMORY_MAX_CHARS, `a memory is at most ${MEMORY_MAX_CHARS} characters`)

export const memoryIdParamsSchema = z.object({ id: z.string().uuid('memory not found') }).strict()

export const memorySettingsSchema = z.object({ enabled: z.boolean() }).strict()

export const memoryContentSchema = z.object({ content }).strict()
