import { RULE_MAX_BYTES, RULE_NAME_PATTERN, utf8Bytes } from '@december/shared/agent-context'
import { z } from 'zod'

const ruleName = z
    .string()
    .trim()
    .regex(RULE_NAME_PATTERN, 'use lowercase letters, numbers and dashes')

export const ruleNameParamsSchema = z.object({ name: ruleName }).strict()

export const saveRuleSchema = z
    .object({
        name: ruleName,
        body: z
            .string()
            .refine((value) => value.trim().length > 0, 'write the rule')
            .refine((value) => utf8Bytes(value) <= RULE_MAX_BYTES, 'a rule is at most 16 KiB'),
        enabled: z.boolean().default(true),
    })
    .strict()

export const setRuleEnabledSchema = z.object({ enabled: z.boolean() }).strict()
