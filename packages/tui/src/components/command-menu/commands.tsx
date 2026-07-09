import type { Command } from './types'

export const COMMANDS: Command[] = [
    {
        name: 'btw',
        description: 'Ask a side question without disrupting the current task',
        value: '/btw',
        action: (ctx) => {
            ctx.toast.show({ message: 'Command /btw coming soon...' })
        },
    },
    {
        name: 'canvas',
        description: 'Open the visual workspace',
        value: '/canvas',
        action: (ctx) => {
            ctx.toast.show({ message: 'Command /canvas coming soon...' })
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
        name: 'compact',
        description: 'Compact the conversation context to save tokens',
        value: '/compact',
        action: (ctx) => {
            ctx.toast.show({ message: 'Command /compact coming soon...' })
        },
    },
    {
        name: 'context',
        description: 'Manage the context window',
        value: '/context',
        action: (ctx) => {
            ctx.toast.show({ message: 'Command /context coming soon...' })
        },
    },
    {
        name: 'copy',
        description: 'Copy the session or generated code',
        value: '/copy',
        action: (ctx) => {
            ctx.toast.show({ message: 'Command /copy coming soon...' })
        },
    },
    {
        name: 'exit',
        description: 'Quit the CLI',
        value: '/exit',
        action: (ctx) => {
            ctx.exit()
        },
    },
    {
        name: 'fork',
        description: 'Fork the session into a new branch',
        value: '/fork',
        action: (ctx) => {
            ctx.toast.show({ message: 'Command /fork coming soon...' })
        },
    },
    {
        name: 'grill-me',
        description: 'Align on a plan through an interactive interview',
        value: '/grill-me',
        action: (ctx) => {
            ctx.toast.show({ message: 'Command /grill-me coming soon...' })
        },
    },
    {
        name: 'handoff',
        description: 'Handoff the current task to a cloud agent',
        value: '/handoff',
        action: (ctx) => {
            ctx.toast.show({ message: 'Command /handoff coming soon...' })
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
        name: 'hooks',
        description: 'Manage agent lifecycle hooks',
        value: '/hooks',
        action: (ctx) => {
            ctx.toast.show({ message: 'Command /hooks coming soon...' })
        },
    },
    {
        name: 'login',
        description: 'Sign in via browser',
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
        name: 'loop',
        description: 'Configure agent loop settings',
        value: '/loop',
        action: (ctx) => {
            ctx.toast.show({ message: 'Command /loop coming soon...' })
        },
    },
    {
        name: 'mcp',
        description: 'Manage MCP servers',
        value: '/mcp',
        action: (ctx) => {
            ctx.toast.show({ message: 'Command /mcp coming soon...' })
        },
    },
    {
        name: 'model',
        description: 'Switch the active AI model',
        value: '/model',
        action: (ctx) => {
            ctx.toast.show({ message: 'Use arrow keys to select a model.' })
        },
    },
    {
        name: 'new',
        description: 'Start a new conversation',
        value: '/new',
        action: (ctx) => {
            ctx.toast.show({ message: 'Starting new conversation...' })
        },
    },
    {
        name: 'plan',
        description: 'Toggle planning mode',
        value: '/plan',
        action: (ctx) => {
            ctx.toast.show({ message: 'Command /plan coming soon...' })
        },
    },
    {
        name: 'resume',
        description: 'Resume a previous session',
        value: '/resume',
        action: (ctx) => {
            ctx.toast.show({ message: 'Command /resume coming soon...' })
        },
    },
    {
        name: 'schedule',
        description: 'Schedule a recurring or background task',
        value: '/schedule',
        action: (ctx) => {
            ctx.toast.show({ message: 'Command /schedule coming soon...' })
        },
    },
    {
        name: 'settings',
        description: 'Open CLI settings',
        value: '/settings',
        action: (ctx) => {
            ctx.toast.show({ message: 'Command /settings coming soon...' })
        },
    },
    {
        name: 'skills',
        description: 'Manage agent skills',
        value: '/skills',
        action: (ctx) => {
            ctx.toast.show({ message: 'Command /skills coming soon...' })
        },
    },
    {
        name: 'tasks',
        description: 'Manage background tasks',
        value: '/tasks',
        action: (ctx) => {
            ctx.toast.show({ message: 'Command /tasks coming soon...' })
        },
    },
    {
        name: 'update',
        description: 'Update to the latest version',
        value: '/update',
        action: (ctx) => {
            ctx.toast.show({ message: 'Command /update coming soon...' })
        },
    },
    {
        name: 'usage',
        description: 'View API and token usage',
        value: '/usage',
        action: (ctx) => {
            ctx.toast.show({ message: 'Command /usage coming soon...' })
        },
    },
]
