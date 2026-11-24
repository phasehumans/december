export type SlashScope = 'home' | 'session'

/**
 * what a command does when it is picked
 * - model, effort, switch, skills, check: the menu shows a list of choices or facts
 * - plan: turns on "Plan first" and shows a chip
 * - help: opens the help panel
 * - navigate: opens a page in the app
 * - external: opens a new tab
 * - action: runs now
 */
export type SlashCommandKind =
    | 'model'
    | 'effort'
    | 'switch'
    | 'skills'
    | 'check'
    | 'plan'
    | 'help'
    | 'navigate'
    | 'external'
    | 'action'

export interface SlashCommand {
    name: string
    args?: string
    /** a few words, shown at the right of the row */
    description: string
    scopes: readonly SlashScope[]
    kind: SlashCommandKind
    /** path or link for navigate and external commands */
    to?: string
    /** the server cannot do this yet, so only demo mode lists it */
    demoOnly?: boolean
    /** Fast and Deep exist only on December credits */
    creditsOnly?: boolean
    /** the tab the help panel opens on */
    helpTab?: 'commands' | 'shortcuts'
}

const BOTH = ['home', 'session'] as const
const SESSION = ['session'] as const

export const FEEDBACK_URL = 'https://github.com/phasehumans/december/issues/new/choose'

// names match the cli commands in packages/tui/src/commands/commands.ts. the order is by
// group: run, session, customize, help. commands that need new server routes are not
// listed yet: compact, context, fork, rewind, clear, btw, codesearch, learn, permissions,
// open, review (issues 632 and 633).
export const SLASH_COMMANDS: readonly SlashCommand[] = [
    // run
    {
        name: 'plan',
        args: '[goal]',
        description: 'Plan first',
        scopes: BOTH,
        kind: 'plan',
        demoOnly: true,
    },
    {
        name: 'effort',
        description: 'Fast or Deep',
        scopes: BOTH,
        kind: 'effort',
        creditsOnly: true,
    },
    { name: 'model', description: 'Pick a model', scopes: BOTH, kind: 'model' },
    { name: 'switch', description: 'Credits or your key', scopes: BOTH, kind: 'switch' },
    { name: 'voice', description: 'Speak a prompt', scopes: BOTH, kind: 'action' },

    // session
    { name: 'new', description: 'New session', scopes: SESSION, kind: 'action' },
    { name: 'resume', description: 'Past sessions', scopes: BOTH, kind: 'action' },
    {
        name: 'rename',
        args: '<title>',
        description: 'Rename session',
        scopes: SESSION,
        kind: 'action',
    },
    { name: 'copy', description: 'Copy last answer', scopes: SESSION, kind: 'action' },
    { name: 'diff', description: 'View changes', scopes: SESSION, kind: 'action' },
    { name: 'tasks', description: 'Open the shell', scopes: SESSION, kind: 'action' },
    { name: 'usage', description: 'Token usage', scopes: BOTH, kind: 'action' },
    { name: 'exit', description: 'Leave session', scopes: SESSION, kind: 'action' },

    // customize
    {
        name: 'mcp',
        description: 'MCP servers',
        scopes: BOTH,
        kind: 'navigate',
        to: '/settings/connections/mcps',
    },
    {
        name: 'plugin',
        description: 'Plugins',
        scopes: BOTH,
        kind: 'navigate',
        to: '/settings/connections/plugins',
    },
    {
        name: 'skills',
        description: 'Your skills',
        scopes: BOTH,
        kind: 'skills',
        demoOnly: true,
    },
    {
        name: 'hooks',
        description: 'Hooks',
        scopes: BOTH,
        kind: 'navigate',
        to: '/settings/connections/hooks',
    },
    {
        name: 'memory',
        description: 'Memory',
        scopes: BOTH,
        kind: 'navigate',
        to: '/settings/connections/memory',
    },
    {
        name: 'github',
        description: 'GitHub setup',
        scopes: BOTH,
        kind: 'navigate',
        to: '/settings/connections/apps/github',
    },
    {
        name: 'settings',
        description: 'Settings',
        scopes: BOTH,
        kind: 'navigate',
        to: '/settings',
    },
    {
        name: 'login',
        description: 'API keys',
        scopes: BOTH,
        kind: 'navigate',
        to: '/settings/models',
    },
    {
        name: 'keybindings',
        description: 'Shortcuts',
        scopes: BOTH,
        kind: 'help',
        helpTab: 'shortcuts',
    },

    // help
    {
        name: 'help',
        description: 'Commands and shortcuts',
        scopes: BOTH,
        kind: 'help',
        helpTab: 'commands',
    },
    { name: 'check', description: 'Check your setup', scopes: BOTH, kind: 'check' },
    { name: 'docs', description: 'Docs', scopes: BOTH, kind: 'external', to: '/docs' },
    {
        name: 'changelog',
        description: 'Changelog',
        scopes: BOTH,
        kind: 'external',
        to: '/docs/changelog',
    },
    {
        name: 'feedback',
        description: 'Report an issue',
        scopes: BOTH,
        kind: 'external',
        to: FEEDBACK_URL,
    },
    { name: 'update', description: 'Reload the app', scopes: BOTH, kind: 'action' },
]
