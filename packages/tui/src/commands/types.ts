export type ToastContextValue = {
    show: (options: { message: string; variant?: 'success' | 'error' | 'info' }) => void
}

export type CommandContext = {
    exit: () => void
    toast: ToastContextValue
    agent?: any
    resetChat?: () => void
    onUpdateSuccess?: () => Promise<void>
}

export type Command = {
    name: string
    description: string
    value: string
    action?: (ctx: CommandContext) => void | Promise<void>
}
