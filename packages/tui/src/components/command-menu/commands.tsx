import type { Command } from './command.types'

export const COMMANDS: Command[] = [
    {
        name: 'new',
        description: 'Start a new conversation',
        value: '/new',
    },
    {
        name: 'agents',
        description: 'Switch between agents',
        value: '/agents',
    },
    {
        name: 'models',
        description: 'Select AI model for generation',
        value: '/models',
    },
    {
        name: 'sessions',
        description: 'Manage your sessions',
        value: '/sessions',
    },
    {
        name: 'theme',
        description: 'Change the theme of the application',
        value: '/theme',
    },
    {
        name: 'login',
        description: 'Login to your account',
        value: '/login',
    },
    {
        name: 'logout',
        description: 'Logout from your account',
        value: '/logout',
    },
    {
        name: 'upgrade',
        description: 'Upgrade your account',
        value: '/upgrade',
    },
    {
        name: 'usage',
        description: 'Check your usage',
        value: '/usage',
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
