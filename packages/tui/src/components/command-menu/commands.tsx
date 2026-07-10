import { exec } from 'child_process'

import clipboard from 'clipboardy'
import React from 'react'

import { ContextDialog, SettingsDialog, TasksDialog, UsageDialog } from '../dialogs'

import type { Command } from './types'

export const COMMANDS: Command[] = [
    {
        name: 'btw',
        description: 'Ask a side question without disrupting the current task',
        value: '/btw',
        action: (ctx) => {
            ctx.toast.show({
                message: 'Type /btw <your question> in the input bar and press Enter.',
            })
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
        action: async (ctx) => {
            if (ctx.agent) {
                await ctx.agent.clearContext()
            }
            ctx.resetChat?.()
            ctx.toast.show({ message: 'Conversation cleared.' })
        },
    },
    {
        name: 'compact',
        description: 'Compact the conversation context to save tokens',
        value: '/compact',
        action: async (ctx) => {
            if (ctx.agent) {
                await ctx.agent.compactContext()
            }
            ctx.toast.show({ message: 'Conversation compacted.' })
        },
    },
    {
        name: 'context',
        description: 'Manage the context window',
        value: '/context',
        action: (ctx) => {
            if (ctx.agent) {
                ctx.dialog.open({
                    title: 'Context Manager',
                    children: (
                        <ContextDialog
                            agent={ctx.agent}
                            toast={ctx.toast}
                            resetChat={ctx.resetChat}
                            close={ctx.dialog.close}
                        />
                    ),
                })
            } else {
                ctx.toast.show({ variant: 'error', message: 'No active agent session' })
            }
        },
    },
    {
        name: 'copy',
        description: 'Copy the session or generated code',
        value: '/copy',
        action: (ctx) => {
            if (ctx.agent && ctx.agent.messages.length > 0) {
                try {
                    const lastMsg = ctx.agent.messages[ctx.agent.messages.length - 1]
                    clipboard.writeSync(lastMsg.content || '')
                    ctx.toast.show({
                        variant: 'success',
                        message: 'Copied last message to clipboard!',
                    })
                } catch (e) {
                    ctx.toast.show({ variant: 'error', message: 'Failed to write to clipboard.' })
                }
            } else {
                ctx.toast.show({ variant: 'error', message: 'Nothing to copy.' })
            }
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
        action: async (ctx) => {
            if (ctx.agent) {
                const newId = await ctx.agent.forkContext()
                ctx.toast.show({ variant: 'success', message: `Forked to new session: ${newId}` })
            }
        },
    },
    {
        name: 'grill-me',
        description: 'Align on a plan through an interactive interview',
        value: '/grill-me',
        action: (ctx) => {
            // Forwarded to Chat screen
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
        action: async (ctx) => {
            if (ctx.agent) {
                await ctx.agent.newContext()
                ctx.resetChat?.()
                ctx.toast.show({ variant: 'success', message: 'Started a new conversation.' })
            }
        },
    },
    {
        name: 'plan',
        description: 'Toggle planning mode',
        value: '/plan',
        action: (ctx) => {
            // Forwarded to Chat screen
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
            // Forwarded to Chat screen
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
            ctx.dialog.open({
                title: 'Background Tasks',
                children: <TasksDialog toast={ctx.toast} close={ctx.dialog.close} />,
            })
        },
    },
    {
        name: 'update',
        description: 'Update to the latest version',
        value: '/update',
        action: (ctx) => {
            exec('npm install -g @trydecember/cli', (err) => {
                if (err) {
                    // Update failed silently in bg, but we can't easily toast here if app is closed.
                }
            })
            ctx.toast.show({ message: 'Updating CLI in the background. Please restart soon.' })
        },
    },
    {
        name: 'usage',
        description: 'View API and token usage',
        value: '/usage',
        action: (ctx) => {
            ctx.dialog.open({
                title: 'Usage',
                children: <UsageDialog toast={ctx.toast} close={ctx.dialog.close} />,
            })
        },
    },
]
