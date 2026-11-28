import type { HookEvent } from '../types'

import { apiRequest } from '@/shared/api/client'

// user hooks saved on the account, in the cli's hooks.json terms. server module: hook

export type ApiHook = {
    id: string
    event: HookEvent
    /** a regex on the tool name for tool events; empty matches every tool */
    matcher: string
    command: string
    /** seconds */
    timeout: number
    enabled: boolean
    position: number
    updatedAt: string
}

export type HookInput = {
    event: HookEvent
    matcher: string
    command: string
    timeout: number
    enabled: boolean
}

const hookPath = (id: string) => `/connections/hooks/${encodeURIComponent(id)}`

const listHooks = async () => {
    const data = await apiRequest<{ hooks: ApiHook[] }>('/connections/hooks')
    return data.hooks ?? []
}

const createHook = async (hook: HookInput) => {
    const data = await apiRequest<{ hook: ApiHook }>('/connections/hooks', {
        method: 'POST',
        body: JSON.stringify(hook),
    })
    return data.hook
}

const updateHook = async (id: string, patch: Partial<HookInput>) => {
    const data = await apiRequest<{ hook: ApiHook }>(hookPath(id), {
        method: 'PATCH',
        body: JSON.stringify(patch),
    })
    return data.hook
}

const deleteHook = (id: string) =>
    apiRequest<{ deleted: boolean }>(hookPath(id), { method: 'DELETE' })

/** saves a whole hooks.json: the list takes the place of the saved hooks */
const replaceHooks = async (hooks: HookInput[]) => {
    const data = await apiRequest<{ hooks: ApiHook[] }>('/connections/hooks', {
        method: 'PUT',
        body: JSON.stringify({ hooks }),
    })
    return data.hooks ?? []
}

export const hooksAPI = {
    listHooks,
    createHook,
    updateHook,
    deleteHook,
    replaceHooks,
}
