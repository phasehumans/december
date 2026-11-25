import { writeToClipboard } from '../utils/clipboard'

import type { Command } from './types'

export const COMMANDS: Command[] = [
    {
        name: 'btw',
        description: 'Ask a side question. It is not saved.',
        args: '<question>',
        value: '/btw',
        action: () => {
            // forwarded to differential screen
        },
    },
    {
        name: 'changelog',
        description: 'Open the changelog in your browser',
        value: '/changelog',
        action: () => {
            // forwarded to differential screen
        },
    },
    {
        name: 'check',
        description: 'Check keys, settings, MCP servers, skills',
        value: '/check',
        action: () => {
            // forwarded to differential screen
        },
    },
    {
        name: 'clear',
        description: 'Clear the conversation',
        value: '/clear',
        action: async (ctx) => {
            if (ctx.agent) {
                await ctx.agent.clearContext()
                ctx.resetChat?.()
                ctx.toast.show({ variant: 'success', message: 'Cleared conversation history.' })
            }
        },
    },
    {
        name: 'codesearch',
        description: 'Search code in the workspace',
        args: '<query>',
        value: '/codesearch',
        action: () => {
            // forwarded to differential screen
        },
    },
    {
        name: 'compact',
        description: 'Summarize the chat to free up context',
        args: '[focus]',
        value: '/compact',
        action: () => {
            // forwarded to differential screen
        },
    },
    {
        name: 'context',
        description: 'Show how much context is in use',
        value: '/context',
        action: () => {
            // forwarded to differential screen
        },
    },
    {
        name: 'copy',
        description: 'Copy the last response to the clipboard',
        value: '/copy',
        action: (ctx) => {
            if (ctx.agent && ctx.agent.messages.length > 0) {
                try {
                    const plannerMessages = ctx.agent.messages.filter(
                        (m: any) => m.role === 'assistant'
                    )
                    const lastMsg =
                        plannerMessages.length > 0
                            ? plannerMessages[plannerMessages.length - 1]
                            : null
                    if (lastMsg && lastMsg.content) {
                        writeToClipboard(lastMsg.content)
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
        name: 'diff',
        description: 'View git diff and workspace changes',
        value: '/diff',
        action: () => {
            // forwarded to differential screen
        },
    },
    {
        name: 'docs',
        description: 'Open December documentation in your browser',
        value: '/docs',
        action: () => {
            // forwarded to differential screen
        },
    },
    {
        name: 'effort',
        description: 'Set model reasoning depth (fast, deep)',
        value: '/effort',
        action: () => {
            // forwarded to differential screen
        },
    },
    {
        name: 'exit',
        description: 'Exit December',
        value: '/exit',
        action: (ctx) => {
            ctx.exit()
        },
    },
    {
        name: 'feedback',
        description: 'Report a bug or ask for a feature',
        value: '/feedback',
        action: () => {
            // forwarded to differential screen
        },
    },
    {
        name: 'fork',
        description: 'Branch the conversation at this point',
        value: '/fork',
        action: async (ctx) => {
            if (ctx.agent) {
                const target = ctx.args ? ctx.args.trim() : undefined
                const newId = await ctx.agent.forkContext(target)
                const label = ctx.agent.sessionTitle || newId
                ctx.toast.show({ variant: 'success', message: `Forked to new session: ${label}` })
            }
        },
    },
    {
        name: 'github',
        description: 'Show the December GitHub App for this repo',
        value: '/github',
        action: () => {
            // forwarded to differential screen
        },
    },
    {
        name: 'help',
        description: 'Show commands, keybindings, and CLI info',
        value: '/help',
        action: () => {
            // forwarded to differential screen
        },
    },
    {
        name: 'hooks',
        description: 'View active hooks from hooks.json',
        value: '/hooks',
        action: () => {
            // forwarded to differential screen
        },
    },
    {
        name: 'keybindings',
        description: 'Open your keyboard shortcuts file',
        value: '/keybindings',
        action: () => {
            // forwarded to differential screen
        },
    },
    {
        name: 'learn',
        description: 'Save a lesson to AGENTS.md or a skill',
        value: '/learn',
        action: () => {
            // forwarded to differential screen
        },
    },
    {
        name: 'login',
        description: 'Set up API keys or connect December Cloud',
        value: '/login',
        action: () => {},
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
        name: 'mcp',
        description: 'Manage MCP servers and their tools',
        value: '/mcp',
        action: () => {
            // forwarded to differential screen
        },
    },
    {
        name: 'plugin',
        description: 'Install and manage plugins and marketplaces',
        value: '/plugin',
        action: () => {
            // forwarded to differential screen
        },
    },
    {
        name: 'memory',
        description: 'View project rules (AGENTS.md)',
        value: '/memory',
        action: () => {
            // forwarded to differential screen
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
        name: 'open',
        description: 'View a file in the workspace viewer',
        args: '<file>',
        value: '/open',
        action: () => {
            // forwarded to differential screen
        },
    },
    {
        name: 'permissions',
        description: 'Manage allow and deny rules for tools',
        value: '/permissions',
        action: () => {
            // forwarded to differential screen
        },
    },
    {
        name: 'plan',
        description: 'Plan first. No goal toggles plan mode',
        args: '[goal]',
        value: '/plan',
        action: () => {
            // forwarded to differential screen
        },
    },
    {
        name: 'rename',
        description: 'Rename the session (no title: make one)',
        args: '[title]',
        value: '/rename',
        action: () => {
            // forwarded to differential screen
        },
    },
    {
        name: 'resume',
        description: 'Browse and resume past conversations',
        value: '/resume',
        action: () => {
            // forwarded to differential screen
        },
    },
    {
        name: 'rewind',
        description: 'Roll back files and chat to an earlier turn',
        value: '/rewind',
        action: () => {
            // forwarded to differential screen
        },
    },
    {
        name: 'settings',
        description: 'Open settings',
        value: '/settings',
        action: () => {
            // forwarded to differential screen
        },
    },
    {
        name: 'skills',
        description: 'List skills, or reload to scan again',
        args: '[reload]',
        value: '/skills',
        action: () => {
            // forwarded to differential screen
        },
    },
    {
        name: 'switch',
        description: 'Switch active LLM provider and model',
        value: '/switch',
        action: () => {
            // forwarded to differential screen
        },
    },
    {
        name: 'tasks',
        description: 'View background tasks',
        value: '/tasks',
        action: () => {
            // forwarded to differential screen
        },
    },
    {
        name: 'update',
        description: 'Update to the latest version',
        value: '/update',
        action: () => {
            // forwarded to differential screen
        },
    },
    {
        name: 'usage',
        description: 'View token usage and history',
        value: '/usage',
        action: () => {
            // forwarded to differential screen
        },
    },
    {
        name: 'voice',
        description: 'Dictate a prompt with your microphone',
        value: '/voice',
        action: () => {
            // forwarded to input bar
        },
    },
]
