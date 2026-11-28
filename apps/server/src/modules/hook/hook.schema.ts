import {
    MAX_ACCOUNT_HOOKS,
    MAX_HOOK_COMMAND_LENGTH,
    MAX_HOOK_MATCHER_LENGTH,
    MAX_HOOK_TIMEOUT_SECONDS,
    USER_HOOK_EVENTS,
    isSafeHookMatcher,
} from '@december/shared'
import { z } from 'zod'

const event = z.enum(USER_HOOK_EVENTS, {
    message: `event must be one of ${USER_HOOK_EVENTS.join(', ')}`,
})

const matcher = z
    .string()
    .trim()
    .max(MAX_HOOK_MATCHER_LENGTH)
    .refine(isSafeHookMatcher, 'the tools match is not a valid or safe regex')

const command = z
    .string()
    .trim()
    .min(1, 'add a command')
    .max(MAX_HOOK_COMMAND_LENGTH)
    // eslint-disable-next-line no-control-regex
    .refine((value) => !/[\u0000]/.test(value), 'the command has a character that is not allowed')

const timeout = z
    .number()
    .int('use a whole number of seconds')
    .min(1)
    .max(MAX_HOOK_TIMEOUT_SECONDS, `use at most ${MAX_HOOK_TIMEOUT_SECONDS} seconds`)

export const hookSchema = z
    .object({
        event,
        matcher: matcher.default(''),
        command,
        timeout: timeout.default(60),
        enabled: z.boolean().default(true),
    })
    .strict()

export const updateHookSchema = z
    .object({ event, matcher, command, timeout, enabled: z.boolean() })
    .partial()
    .strict()
    .refine((value) => Object.keys(value).length > 0, { message: 'send at least one field' })

export const replaceHooksSchema = z
    .object({
        hooks: z
            .array(hookSchema)
            .max(MAX_ACCOUNT_HOOKS, `you can save up to ${MAX_ACCOUNT_HOOKS} hooks`),
    })
    .strict()

export const hookIdParamsSchema = z.object({ id: z.string().uuid('not a hook id') })
