import { COMMAND_LIST, type CommandName } from '@december/shared/commands'

import { writeToClipboard } from '../utils/clipboard'

import type { Command } from './types'

// most commands are forwarded to the differential screen (voice goes to the input bar),
// so their handler does nothing here
const forwarded = () => {
    // forwarded to differential screen
}

const ACTIONS: Partial<Record<CommandName, NonNullable<Command['action']>>> = {
    clear: async (ctx) => {
        if (ctx.agent) {
            await ctx.agent.clearContext()
            ctx.resetChat?.()
            ctx.toast.show({ variant: 'success', message: 'Cleared conversation history.' })
        }
    },
    copy: (ctx) => {
        if (ctx.agent && ctx.agent.messages.length > 0) {
            try {
                const plannerMessages = ctx.agent.messages.filter(
                    (m: any) => m.role === 'assistant'
                )
                const lastMsg =
                    plannerMessages.length > 0 ? plannerMessages[plannerMessages.length - 1] : null
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
    exit: (ctx) => {
        ctx.exit()
    },
    fork: async (ctx) => {
        if (ctx.agent) {
            const target = ctx.args ? ctx.args.trim() : undefined
            const newId = await ctx.agent.forkContext(target)
            const label = ctx.agent.sessionTitle || newId
            ctx.toast.show({ variant: 'success', message: `Forked to new session: ${label}` })
        }
    },
    model: (ctx) => {
        ctx.toast.show({ message: 'Use arrow keys to select a model.' })
    },
    new: async (ctx) => {
        if (ctx.agent) {
            await ctx.agent.newContext()
            ctx.resetChat?.()
            ctx.toast.show({ variant: 'success', message: 'Started a new conversation.' })
        }
    },
}

// names, descriptions and argument hints come from the shared list in @december/shared/commands
// a web-only command (/review) is left out
export const COMMANDS: Command[] = COMMAND_LIST.filter(
    (info) => !('webOnly' in info && info.webOnly)
).map((info) => {
    const command: Command = {
        name: info.name,
        description: info.description,
        value: `/${info.name}`,
        action: ACTIONS[info.name] ?? forwarded,
    }
    if ('args' in info) command.args = info.args
    return command
})
