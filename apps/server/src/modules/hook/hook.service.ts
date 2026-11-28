import { MAX_ACCOUNT_HOOKS, isToolHookEvent, type UserHookEvent } from '@december/shared'

import { AppError } from '../../shared/appError'

import { hookRepository } from './hook.repository'
import { matcherFor, toPublicHook } from './hook.utils'

import type { CreateHook, HookById, ReplaceHooks, UpdateHook, UserRef } from './hook.types'

const notFound = () => new AppError('Hook not found.', 404)
const tooMany = () => new AppError(`You can save up to ${MAX_ACCOUNT_HOOKS} hooks.`, 409)

const listHooks = async (data: UserRef) => {
    const { userId } = data
    const hooks = await hookRepository.findHooks(userId)
    return { hooks: hooks.map(toPublicHook) }
}

/** adds a hook at the end; hooks of one event run in the order of the list */
const createHook = async (data: CreateHook) => {
    const { userId, event, matcher, command, timeout, enabled } = data
    if ((await hookRepository.countHooks(userId)) >= MAX_ACCOUNT_HOOKS) throw tooMany()
    const hook = await hookRepository.createHook({
        userId,
        event,
        matcher: matcherFor(event, matcher),
        command,
        timeoutSeconds: timeout,
        enabled,
        position: (await hookRepository.lastPosition(userId)) + 1,
    })
    return { hook: toPublicHook(hook) }
}

const updateHook = async (data: UpdateHook) => {
    const { userId, id, event, matcher, command, timeout, enabled } = data
    const existing = await hookRepository.findHook(userId, id)
    if (!existing) throw notFound()
    const nextEvent = (event ?? existing.event) as UserHookEvent
    const nextMatcher = matcher ?? existing.matcher
    const hook = await hookRepository.updateHook(existing.id, {
        event: nextEvent,
        // a hook moved to an event that is not about tools drops its match
        matcher: isToolHookEvent(nextEvent) ? nextMatcher : '',
        ...(command !== undefined ? { command } : {}),
        ...(timeout !== undefined ? { timeoutSeconds: timeout } : {}),
        ...(enabled !== undefined ? { enabled } : {}),
    })
    return { hook: toPublicHook(hook) }
}

const deleteHook = async (data: HookById) => {
    const { userId, id } = data
    const { count } = await hookRepository.deleteHook(userId, id)
    if (count === 0) throw notFound()
    return { deleted: true }
}

/** saves a whole hooks.json at once (the JSON view): the list replaces the saved hooks */
const replaceHooks = async (data: ReplaceHooks) => {
    const { userId, hooks } = data
    if (hooks.length > MAX_ACCOUNT_HOOKS) throw tooMany()
    const saved = await hookRepository.replaceHooks(
        userId,
        hooks.map((hook, position) => ({
            event: hook.event,
            matcher: matcherFor(hook.event, hook.matcher),
            command: hook.command,
            timeoutSeconds: hook.timeout,
            enabled: hook.enabled,
            position,
        }))
    )
    return { hooks: saved.map(toPublicHook) }
}

export const hookService = {
    listHooks,
    createHook,
    updateHook,
    deleteHook,
    replaceHooks,
}
