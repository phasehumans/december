import type { Command } from './types'

export const COMMANDS: Command[] = [
    {
        name: 'new',
        description: 'Start a new conversation',
        value: '/new',
        action: (ctx) => {
            ctx.toast.show({ message: 'Starting new conversation...' })
        },
    },
    {
        name: 'clear',
        description: 'Clear the current conversation',
        value: '/clear',
        action: (ctx) => {
            ctx.toast.show({ message: 'Conversation cleared.' })
        },
    },
    {
        name: 'model',
        description: 'Switch the active model',
        value: '/model',
        action: (ctx) => {
            ctx.toast.show({ message: 'Use arrow keys to select a model.' })
        },
    },
    {
        name: 'sessions',
        description: 'Browse past sessions',
        value: '/sessions',
        action: (ctx) => {
            ctx.toast.show({ message: 'Loading sessions...' })
        },
    },
    {
        name: 'login',
        description: 'Sign in with your browser',
        value: '/login',
        action: (ctx) => {
            ctx.toast.show({ message: 'Opening browser to sign in...' })
        },
    },
    {
        name: 'logout',
        description: 'Sign out of your account',
        value: '/logout',
        action: (ctx) => {
            ctx.toast.show({ variant: 'success', message: 'Signed out' })
        },
    },
    {
        name: 'upgrade',
        description: 'Buy more credits',
        value: '/upgrade',
        action: (ctx) => {
            ctx.toast.show({ message: 'Opening credits checkout...' })
        },
    },
    {
        name: 'help',
        description: 'Show available commands',
        value: '/help',
        action: (ctx) => {
            ctx.toast.show({ message: 'Type / to browse all commands.' })
        },
    },
    {
        name: 'exit',
        description: 'Quit the application',
        value: '/exit',
        action: (ctx) => {
            ctx.exit()
        },
    },
]
