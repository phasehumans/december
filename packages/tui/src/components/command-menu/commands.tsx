import { exec } from 'child_process'

import clipboard from 'clipboardy'
import React from 'react'

import { SettingsDialog, TasksDialog, UsageDialog } from '../dialogs'

import type { Command } from './types'

export const COMMANDS: Command[] = [
    {
        name: 'context',
        description: 'Visualize current context usage',
        value: '/context',
        action: (ctx) => {
            // Forwarded to Chat screen
        },
    },
    {
        name: 'copy',
        description: 'Copy the last planner response to the clipboard',
        value: '/copy',
        action: (ctx) => {
            if (ctx.agent && ctx.agent.messages.length > 0) {
                try {
                    const plannerMessages = ctx.agent.messages.filter((m) => m.role === 'assistant')
                    const lastMsg =
                        plannerMessages.length > 0
                            ? plannerMessages[plannerMessages.length - 1]
                            : null
                    if (lastMsg && lastMsg.content) {
                        clipboard.writeSync(lastMsg.content)
                        ctx.toast.show({
                            variant: 'success',
                            message: 'Copied last planner response to clipboard!',
                        })
                    } else {
                        ctx.toast.show({
                            variant: 'error',
                            message: 'No planner response found to copy.',
                        })
                    }
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
        description: 'Exit the CLI',
        value: '/exit',
        action: (ctx) => {
            ctx.exit()
        },
    },
    {
        name: 'fork',
        description: 'Create a branch of the current conversation at this point',
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
        description: 'Interview me to align on a plan',
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
            // Forwarded to Chat screen
        },
    },
    {
        name: 'login',
        description: 'Configure API keys or log in to December',
        value: '/login',
        action: (ctx) => {
            ctx.toast.show({ message: 'Opening browser to sign in...' })
        },
    },
    {
        name: 'logout',
        description: 'Clear stored credentials',
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
        description: 'Switch AI model',
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
        description: 'Create an implementation plan',
        value: '/plan',
        action: (ctx) => {
            // Forwarded to Chat screen
        },
    },
    {
        name: 'resume',
        description: 'Restore a previous conversation',
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
        description: 'Adjust application settings',
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
