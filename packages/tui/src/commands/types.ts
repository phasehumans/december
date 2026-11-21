export type ToastContextValue = {
    show: (options: { message: string; variant?: 'success' | 'error' | 'info' }) => void
}

export type CommandContext = {
    exit: () => void
    toast: ToastContextValue
    agent?: any
    args?: string
    resetChat?: () => void
    onUpdateSuccess?: () => Promise<void>
}

export type Command = {
    name: string
    /** Plain English, 45 characters at most, with no usage text */
    description: string
    /** Argument hint shown after the name in the command menu, e.g. "<query>" */
    args?: string
    value: string
    action?: (ctx: CommandContext) => void | Promise<void>
}
