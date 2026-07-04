import type { DialogContextValue } from '../../providers/dialog'
import type { ToastContextValue } from '../../providers/toast'

export type CommandContext = {
    exit: () => void
    toast: ToastContextValue
    dialog: DialogContextValue
    agent?: any // We use any here to avoid a circular dependency if not careful, or we can import Agent type. Let's try importing Agent type.
}

export type Command = {
    name: string
    description: string
    value: string
    action?: (ctx: CommandContext) => void | Promise<void>
}
