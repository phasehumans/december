import { exec } from 'child_process'
import fs from 'node:fs'
import path from 'node:path'

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
        description: 'Hand off a task to a remote December session (cloud)',
        value: '/handoff',
        action: (ctx) => {
            ctx.toast.show({ message: 'Command /handoff coming soon...' })
        },
    },

    {
        name: 'hooks',
        description: 'Manage hook configurations for tool events',
        value: '/hooks',
        action: (ctx) => {
            // Forwarded to Chat screen
        },
    },
    {
        name: 'init',
        description: 'Create a .december folder with initial agent rules',
        value: '/init',
        action: (ctx) => {
            try {
                const rootDir = process.cwd()
                const decDir = path.join(rootDir, '.december')

                if (fs.existsSync(decDir)) {
                    ctx.toast.show({ message: 'December workspace is already initialized.' })
                    return
                }

                fs.mkdirSync(decDir)

                const mdFile = path.join(decDir, 'DECEMBER.md')
                const rulesDir = path.join(decDir, 'rules')
                const rulesReadme = path.join(rulesDir, 'README.md')
                const skillsDir = path.join(decDir, 'skills')
                const skillsReadme = path.join(skillsDir, 'README.md')
                const ignoreFile = path.join(decDir, '.decemberignore')

                fs.writeFileSync(mdFile, '# December Configuration\n')

                fs.mkdirSync(rulesDir)
                fs.writeFileSync(
                    rulesReadme,
                    '# Rules\n\nDrop Markdown files here (e.g., `database.md` or `styling.md`) with specific instructions. December will automatically read these modular rules when working on related files.\n'
                )

                fs.mkdirSync(skillsDir)
                fs.writeFileSync(
                    skillsReadme,
                    '# Skills\n\nAdd executable scripts or custom tool definitions here. December will be able to run these skills as custom tools to perform specific actions in your workspace.\n'
                )

                if (!fs.existsSync(ignoreFile)) {
                    fs.writeFileSync(
                        ignoreFile,
                        '# Ignore these files and directories when searching or reading\nnode_modules\n.git\ndist\nbuild\n.env\n.next\n'
                    )
                }

                ctx.toast.show({
                    variant: 'success',
                    message: 'Initialized December workspace successfully!',
                })
            } catch (err) {
                ctx.toast.show({
                    variant: 'error',
                    message: 'Failed to initialize December workspace',
                })
            }
        },
    },
    {
        name: 'login',
        description: 'Configure API keys or Connect via December Cloud',
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
        name: 'model',
        description: 'Select a model',
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
        description: 'Switch to plan mode',
        value: '/plan',
        action: (ctx) => {
            // Forwarded to Chat screen
        },
    },
    {
        name: 'resume',
        description: 'Browse and resume past conversations',
        value: '/resume',
        action: (ctx) => {
            ctx.toast.show({ message: 'Command /resume coming soon...' })
        },
    },

    {
        name: 'settings',
        description: 'Open settings',
        value: '/settings',
        action: (ctx) => {
            // Forwarded to Chat screen
        },
    },

    {
        name: 'tasks',
        description: 'View background tasks',
        value: '/tasks',
        action: (ctx) => {
            // Forwarded to Chat screen
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
        description: 'View quota usage',
        value: '/usage',
        action: (ctx) => {
            // Forwarded to Chat screen
        },
    },
]
