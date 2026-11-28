import { isToolHookEvent, type UserHookEvent } from '@december/shared'

import type { HookRow } from './hook.types'

/** the matcher is kept for tool events only, like the cli: other events ignore it */
export const matcherFor = (event: UserHookEvent, matcher: string) =>
    isToolHookEvent(event) ? matcher.trim() : ''

export const toPublicHook = (hook: HookRow) => ({
    id: hook.id,
    event: hook.event,
    matcher: hook.matcher,
    command: hook.command,
    timeout: hook.timeoutSeconds,
    enabled: hook.enabled,
    position: hook.position,
    updatedAt: hook.updatedAt,
})
