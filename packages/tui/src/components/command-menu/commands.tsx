import { writeToClipboard } from '../../utils/clipboard'

import type { Command } from './types'

export const COMMANDS: Command[] = [
    {
        name: 'artifacts',
        description: 'View and review session artifacts, plans, and architectural specs',
        value: '/artifacts',
        action: (ctx) => {
            // forwarded to chat screen / session handler
        },
    },
    {
        name: 'artifact',
        description: 'Inspect, approve, refine, or reject waiting session artifacts',
        value: '/artifact',
        action: (ctx) => {
            // forwarded to chat screen / session handler
        },
    },
    {
        name: 'ask',
        description: 'Ask a question about the codebase (read-only Q&A mode)',
        value: '/ask',
        action: (ctx) => {
            // forwarded to chat screen
        },
    },
    {
        name: 'btw',
        description: 'Ask an ephemeral side question without polluting history or breaking cache',
        value: '/btw',
        action: (ctx) => {
            // forwarded to chat screen
        },
    },
    {
        name: 'changelog',
        description: 'Open December changelog in your browser',
        value: '/changelog',
        action: (ctx) => {
            // forwarded to chat screen
        },
    },
    {
        name: 'clear',
        description: 'Clear conversation history',
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
        description: 'Search code in workspace (usage: /codesearch <query>)',
        value: '/codesearch',
        action: (ctx) => {
            // forwarded to chat screen
        },
    },
    {
        name: 'context',
        description: 'Visualize current context usage',
        value: '/context',
        action: (ctx) => {
            // forwarded to chat screen
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
        action: (ctx) => {
            // forwarded to chat screen
        },
    },
    {
        name: 'docs',
        description: 'Open December documentation in your browser',
        value: '/docs',
        action: (ctx) => {
            // forwarded to chat screen
        },
    },
    {
        name: 'effort',
        description: 'Set model reasoning depth (alias for /reasoning)',
        value: '/effort',
        action: (ctx) => {
            // forwarded to chat screen
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
        name: 'feedback',
        description: 'Submit feedback, report a bug, or request a feature',
        value: '/feedback',
        action: (ctx) => {
            // forwarded to chat screen
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
        name: 'help',
        description: 'Show available commands, keybindings, and CLI info',
        value: '/help',
        action: (ctx) => {
            // forwarded to chat screen / session handler
        },
    },
    {
        name: 'login',
        description: 'Configure API keys or Connect via December Cloud',
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
        description: 'Inspect connected MCP servers and tools',
        value: '/mcp',
        action: (ctx) => {
            // forwarded to chat screen
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
        description: 'Open a file or workspace in your default editor',
        value: '/open',
        action: (ctx) => {
            // forwarded to chat screen
        },
    },
    {
        name: 'reasoning',
        description: 'Set model reasoning depth (auto, off, low, medium, high)',
        value: '/reasoning',
        action: (ctx) => {
            // forwarded to chat screen
        },
    },
    {
        name: 'resume',
        description: 'Browse and resume past conversations',
        value: '/resume',
        action: (ctx) => {
            // forwarded to chat screen
        },
    },
    {
        name: 'rewind',
        description: 'Rollback files and conversation history to any previous turn',
        value: '/rewind',
        action: (ctx) => {
            // forwarded to chat screen
        },
    },
    {
        name: 'settings',
        description: 'Open settings',
        value: '/settings',
        action: (ctx) => {
            // forwarded to chat screen
        },
    },
    {
        name: 'switch',
        description: 'Switch active LLM provider and model',
        value: '/switch',
        action: (ctx) => {
            // forwarded to chat screen
        },
    },
    {
        name: 'tasks',
        description: 'View background tasks',
        value: '/tasks',
        action: (ctx) => {
            // forwarded to chat screen
        },
    },
    {
        name: 'update',
        description: 'Update to the latest version',
        value: '/update',
        action: (ctx) => {
            // forwarded to chat screen
        },
    },
    {
        name: 'undo',
        description: 'Revert file changes and conversation from the last agent turn',
        value: '/undo',
        action: (ctx) => {
            // forwarded to chat screen
        },
    },
    {
        name: 'usage',
        description: 'View quota usage',
        value: '/usage',
        action: (ctx) => {
            // forwarded to chat screen
        },
    },
    {
        name: 'voice',
        description: 'Dictate a prompt using your microphone (Deepgram)',
        value: '/voice',
        action: (ctx) => {
            // forwarded to input bar
        },
    },
]
