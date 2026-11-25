/**
 * the one list of slash commands for the cli and the web.
 *
 * each side adds its own fields on top: the cli adds the value and the handler
 * (packages/tui/src/commands/commands.ts), the web adds scopes, kind, links and
 * demo gates (apps/web/src/features/home/slash/commands.ts).
 */
export interface CommandInfo {
    name: string
    /** plain English, 45 characters at most, with no usage text. the cli shows it */
    description: string
    /** a few words for narrow menus. the web slash menu shows it */
    shortDescription?: string
    /** argument hint the cli shows after the name, e.g. "<query>" */
    args?: string
    /** true for a command only the web lists; the cli leaves it out */
    webOnly?: boolean
}

// the cli lists the commands in this order
export const COMMAND_LIST = [
    {
        name: 'btw',
        description: 'Ask a side question. It is not saved.',
        shortDescription: 'Side question',
        args: '<question>',
    },
    {
        name: 'changelog',
        description: 'Open the changelog in your browser',
        shortDescription: 'Changelog',
    },
    {
        name: 'check',
        description: 'Check keys, settings, MCP servers, skills',
        shortDescription: 'Check your setup',
    },
    {
        name: 'clear',
        description: 'Clear the conversation',
        shortDescription: 'Clear context',
    },
    {
        name: 'codesearch',
        description: 'Search code in the workspace',
        shortDescription: 'Search code',
        args: '<query>',
    },
    {
        name: 'compact',
        description: 'Summarize the chat to free up context',
        shortDescription: 'Free up context',
        args: '[focus]',
    },
    {
        name: 'context',
        description: 'Show how much context is in use',
        shortDescription: 'Context in use',
    },
    {
        name: 'copy',
        description: 'Copy the last response to the clipboard',
        shortDescription: 'Copy last answer',
    },
    {
        name: 'diff',
        description: 'View git diff and workspace changes',
        shortDescription: 'View changes',
    },
    {
        name: 'docs',
        description: 'Open December documentation in your browser',
        shortDescription: 'Docs',
    },
    {
        name: 'effort',
        description: 'Set model reasoning depth (fast, deep)',
        shortDescription: 'Fast or Deep',
    },
    {
        name: 'exit',
        description: 'Exit December',
        shortDescription: 'Leave session',
    },
    {
        name: 'feedback',
        description: 'Report a bug or ask for a feature',
        shortDescription: 'Report an issue',
    },
    {
        name: 'fork',
        description: 'Branch the conversation at this point',
        shortDescription: 'Copy this session',
    },
    {
        name: 'github',
        description: 'Show the December GitHub App for this repo',
        shortDescription: 'GitHub setup',
    },
    {
        name: 'help',
        description: 'Show commands, keybindings, and CLI info',
        shortDescription: 'Commands and shortcuts',
    },
    {
        name: 'hooks',
        description: 'View active hooks from hooks.json',
        shortDescription: 'Hooks',
    },
    {
        name: 'keybindings',
        description: 'Open your keyboard shortcuts file',
        shortDescription: 'Shortcuts',
    },
    {
        name: 'learn',
        description: 'Save a lesson to AGENTS.md or a skill',
        shortDescription: 'Save a lesson',
    },
    {
        name: 'login',
        description: 'Set up API keys or connect December Cloud',
        shortDescription: 'API keys',
    },
    {
        name: 'model',
        description: 'Select a model',
        shortDescription: 'Pick a model',
    },
    {
        name: 'mcp',
        description: 'Manage MCP servers and their tools',
        shortDescription: 'MCP servers',
    },
    {
        name: 'plugin',
        description: 'Install and manage plugins and marketplaces',
        shortDescription: 'Plugins',
    },
    {
        name: 'memory',
        description: 'View project rules (AGENTS.md)',
        shortDescription: 'Memory',
    },
    {
        name: 'new',
        description: 'Start a new conversation',
        shortDescription: 'New session',
    },
    {
        name: 'open',
        description: 'View a file in the workspace viewer',
        shortDescription: 'View a file',
        args: '<file>',
    },
    {
        name: 'permissions',
        description: 'Manage allow and deny rules for tools',
        shortDescription: 'Blocked tools',
    },
    {
        name: 'plan',
        description: 'Plan first. No goal toggles plan mode',
        shortDescription: 'Plan first',
        args: '[goal]',
    },
    {
        name: 'rename',
        description: 'Rename the session (no title: make one)',
        shortDescription: 'Rename session',
        args: '[title]',
    },
    {
        name: 'resume',
        description: 'Browse and resume past conversations',
        shortDescription: 'Past sessions',
    },
    {
        name: 'review',
        description: 'Review a pull request in a new session',
        shortDescription: 'Review a pull request',
        args: '<link>',
        webOnly: true,
    },
    {
        name: 'rewind',
        description: 'Roll back files and chat to an earlier turn',
        shortDescription: 'Go back a turn',
    },
    {
        name: 'settings',
        description: 'Open settings',
        shortDescription: 'Settings',
    },
    {
        name: 'skills',
        description: 'List skills, or reload to scan again',
        shortDescription: 'Your skills',
        args: '[reload]',
    },
    {
        name: 'switch',
        description: 'Switch active LLM provider and model',
        shortDescription: 'Credits or your key',
    },
    {
        name: 'tasks',
        description: 'View background tasks',
        shortDescription: 'Running tasks',
    },
    {
        name: 'update',
        description: 'Update to the latest version',
        shortDescription: 'Reload the app',
    },
    {
        name: 'usage',
        description: 'View token usage and history',
        shortDescription: 'Token usage',
    },
    {
        name: 'voice',
        description: 'Dictate a prompt with your microphone',
        shortDescription: 'Speak a prompt',
    },
] as const satisfies readonly CommandInfo[]

type CommandEntry = (typeof COMMAND_LIST)[number]

export type CommandName = CommandEntry['name']

/** commands that have a short description, so a narrow menu can list them */
export type ShortCommandName = Extract<CommandEntry, { shortDescription: string }>['name']

const byName = new Map<string, CommandInfo>(COMMAND_LIST.map((command) => [command.name, command]))

export const getCommandInfo = (name: CommandName): CommandInfo => byName.get(name) as CommandInfo
