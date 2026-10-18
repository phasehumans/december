import type { ToastContextValue } from '../../providers/toast'

export type CommandContext = {
    exit: () => void
    toast: ToastContextValue
    agent?: any // we use any here to avoid a circular dependency if not careful, or we can import agent type. let's try importing agent type.
    resetChat?: () => void
    onUpdateSuccess?: () => Promise<void>
}

export type Command = {
    name: string
    description: string
    value: string
    action?: (ctx: CommandContext) => void | Promise<void>
}
