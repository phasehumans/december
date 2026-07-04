import type { Command } from './types'

export const COMMANDS: Command[] = [
    {
        name: 'artifacts',
        description: 'Manage or view artifacts',
        value: '/artifacts',
        action: (ctx) => {
            ctx.toast.show({ message: 'Command /artifacts coming soon...' })
        },
    },
    {
        name: 'btw',
        description: 'By the way (extra context)',
        value: '/btw',
        action: (ctx) => {
            ctx.toast.show({ message: 'Command /btw coming soon...' })
        },
    },
    {
        name: 'claude-plugin',
        description: 'Manage Claude plugins',
        value: '/claude-plugin',
        action: (ctx) => {
            ctx.toast.show({ message: 'Command /claude-plugin coming soon...' })
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
        name: 'cloud',
        description: 'Cloud environment settings',
        value: '/cloud',
        action: (ctx) => {
            ctx.toast.show({ message: 'Command /cloud coming soon...' })
        },
    },
    {
        name: 'compact',
        description: 'Compact conversation context',
        value: '/compact',
        action: (ctx) => {
            ctx.toast.show({ message: 'Command /compact coming soon...' })
        },
    },
    {
        name: 'context',
        description: 'Manage context window',
        value: '/context',
        action: (ctx) => {
            ctx.toast.show({ message: 'Command /context coming soon...' })
        },
    },
    {
        name: 'copy',
        description: 'Copy session or code',
        value: '/copy',
        action: (ctx) => {
            ctx.toast.show({ message: 'Command /copy coming soon...' })
        },
    },
    {
        name: 'credits',
        description: 'View remaining credits',
        value: '/credits',
        action: (ctx) => {
            ctx.toast.show({ message: 'Command /credits coming soon...' })
        },
    },
    {
        name: 'diff',
        description: 'View changes diff',
        value: '/diff',
        action: (ctx) => {
            ctx.toast.show({ message: 'Command /diff coming soon...' })
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
    {
        name: 'feedback',
        description: 'Submit feedback',
        value: '/feedback',
        action: (ctx) => {
            ctx.toast.show({ message: 'Command /feedback coming soon...' })
        },
    },
    {
        name: 'fork',
        description: 'Fork the current session',
        value: '/fork',
        action: (ctx) => {
            ctx.toast.show({ message: 'Command /fork coming soon...' })
        },
    },
    {
        name: 'grill-me',
        description: 'Interactive questioning',
        value: '/grill-me',
        action: (ctx) => {
            ctx.toast.show({ message: 'Command /grill-me coming soon...' })
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
        description: 'Manage agent hooks',
        value: '/hooks',
        action: (ctx) => {
            ctx.toast.show({ message: 'Command /hooks coming soon...' })
        },
    },
    {
        name: 'learn',
        description: 'Learn from feedback',
        value: '/learn',
        action: (ctx) => {
            ctx.toast.show({ message: 'Command /learn coming soon...' })
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
        name: 'loop',
        description: 'Agent loop settings',
        value: '/loop',
        action: (ctx) => {
            ctx.toast.show({ message: 'Command /loop coming soon...' })
        },
    },
    {
        name: 'mcp',
        description: 'Model Context Protocol settings',
        value: '/mcp',
        action: (ctx) => {
            ctx.toast.show({ message: 'Command /mcp coming soon...' })
        },
    },
    {
        name: 'mode',
        description: 'Switch agent mode',
        value: '/mode',
        action: (ctx) => {
            ctx.toast.show({ message: 'Command /mode coming soon...' })
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
        name: 'new',
        description: 'Start a new conversation',
        value: '/new',
        action: (ctx) => {
            ctx.toast.show({ message: 'Starting new conversation...' })
        },
    },
    {
        name: 'planning',
        description: 'Toggle planning mode',
        value: '/planning',
        action: (ctx) => {
            ctx.toast.show({ message: 'Command /planning coming soon...' })
        },
    },
    {
        name: 'rename-session',
        description: 'Rename current session',
        value: '/rename-session',
        action: (ctx) => {
            ctx.toast.show({ message: 'Command /rename-session coming soon...' })
        },
    },
    {
        name: 'resume',
        description: 'Resume a session',
        value: '/resume',
        action: (ctx) => {
            ctx.toast.show({ message: 'Command /resume coming soon...' })
        },
    },
    {
        name: 'revert',
        description: 'Revert last action',
        value: '/revert',
        action: (ctx) => {
            ctx.toast.show({ message: 'Command /revert coming soon...' })
        },
    },
    {
        name: 'rm-session',
        description: 'Remove a session',
        value: '/rm-session',
        action: (ctx) => {
            ctx.toast.show({ message: 'Command /rm-session coming soon...' })
        },
    },
    {
        name: 'schedule',
        description: 'Schedule tasks',
        value: '/schedule',
        action: (ctx) => {
            ctx.toast.show({ message: 'Command /schedule coming soon...' })
        },
    },
    {
        name: 'session-stats',
        description: 'View session statistics',
        value: '/session-stats',
        action: (ctx) => {
            ctx.toast.show({ message: 'Command /session-stats coming soon...' })
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
        name: 'settings',
        description: 'Open settings',
        value: '/settings',
        action: (ctx) => {
            ctx.toast.show({ message: 'Command /settings coming soon...' })
        },
    },
    {
        name: 'shortcuts',
        description: 'View keyboard shortcuts',
        value: '/shortcuts',
        action: (ctx) => {
            ctx.toast.show({ message: 'Command /shortcuts coming soon...' })
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
        name: 'stats',
        description: 'View general stats',
        value: '/stats',
        action: (ctx) => {
            ctx.toast.show({ message: 'Command /stats coming soon...' })
        },
    },
    {
        name: 'tasks',
        description: 'Manage tasks',
        value: '/tasks',
        action: (ctx) => {
            ctx.toast.show({ message: 'Command /tasks coming soon...' })
        },
    },
    {
        name: 'update',
        description: 'Update CLI',
        value: '/update',
        action: (ctx) => {
            ctx.toast.show({ message: 'Command /update coming soon...' })
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
        name: 'usage',
        description: 'View API usage',
        value: '/usage',
        action: (ctx) => {
            ctx.toast.show({ message: 'Command /usage coming soon...' })
        },
    },
    {
        name: 'workspace',
        description: 'Workspace configuration',
        value: '/workspace',
        action: (ctx) => {
            ctx.toast.show({ message: 'Command /workspace coming soon...' })
        },
    },
]
