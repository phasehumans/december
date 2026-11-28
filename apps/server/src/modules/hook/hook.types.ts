import type { UserHookEvent } from '@december/shared'

// user hooks saved on the account (connections page), in the cli's hooks.json terms

export interface UserRef {
    userId: string
}

export interface HookInput {
    event: UserHookEvent
    matcher: string
    command: string
    timeout: number
    enabled: boolean
}

export interface CreateHook extends HookInput {
    userId: string
}

export interface UpdateHook extends Partial<HookInput> {
    userId: string
    id: string
}

export interface HookById {
    userId: string
    id: string
}

export interface ReplaceHooks {
    userId: string
    hooks: HookInput[]
}

export interface HookRow {
    id: string
    event: string
    matcher: string
    command: string
    timeoutSeconds: number
    enabled: boolean
    position: number
    updatedAt: Date
}
