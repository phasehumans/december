import { getCommandInfo, type ShortCommandName } from '@december/shared/commands'

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
    /** the tab the help panel opens on */
    helpTab?: 'commands' | 'shortcuts'
}

/**
 * the web fields of a command. the description is the short description from the
 * shared list in @december/shared/commands. args is set here because the web takes
 * arguments for fewer commands than the cli, and rename needs a title on the web.
 */
type SlashCommandSpec = Omit<SlashCommand, 'name' | 'description'> & { name: ShortCommandName }

const BOTH = ['home', 'session'] as const
const SESSION = ['session'] as const

const FEEDBACK_URL = 'https://github.com/phasehumans/december/issues/new/choose'

// names and descriptions come from the shared list in packages/shared/src/commands, which
// the cli uses too. the order is by group: run, session, customize, help.
const SLASH_COMMAND_SPECS: readonly SlashCommandSpec[] = [
    // run
    {
        name: 'plan',
        args: '[goal]',
        scopes: BOTH,
        kind: 'plan',
    },
    { name: 'effort', scopes: BOTH, kind: 'effort' },
    { name: 'model', scopes: BOTH, kind: 'model' },
    { name: 'switch', scopes: BOTH, kind: 'switch' },
    { name: 'voice', scopes: BOTH, kind: 'action' },
    { name: 'review', args: '<link>', scopes: ['home'] as const, kind: 'action' },
    { name: 'btw', args: '<question>', scopes: SESSION, kind: 'action' },

    // session
    { name: 'new', scopes: SESSION, kind: 'action' },
    { name: 'resume', scopes: BOTH, kind: 'action' },
    { name: 'rename', args: '[title]', scopes: SESSION, kind: 'action' },
    { name: 'copy', scopes: SESSION, kind: 'action' },
    { name: 'diff', scopes: SESSION, kind: 'action' },
    { name: 'open', args: '<file>', scopes: SESSION, kind: 'action' },
    { name: 'codesearch', args: '<text>', scopes: SESSION, kind: 'action' },
    { name: 'tasks', scopes: SESSION, kind: 'action' },
    { name: 'context', scopes: SESSION, kind: 'action' },
    { name: 'compact', args: '[focus]', scopes: SESSION, kind: 'action' },
    { name: 'clear', scopes: SESSION, kind: 'action' },
    { name: 'rewind', scopes: SESSION, kind: 'action' },
    { name: 'fork', scopes: SESSION, kind: 'action' },
    { name: 'usage', scopes: BOTH, kind: 'action' },
    { name: 'exit', scopes: SESSION, kind: 'action' },

    // customize
    {
        name: 'mcp',
        scopes: BOTH,
        kind: 'navigate',
        to: '/settings/connections/mcps',
    },
    {
        name: 'plugin',
        scopes: BOTH,
        kind: 'navigate',
        to: '/settings/connections/plugins',
    },
    { name: 'skills', scopes: BOTH, kind: 'skills' },
    {
        name: 'hooks',
        scopes: BOTH,
        kind: 'navigate',
        to: '/settings/connections/hooks',
    },
    { name: 'learn', args: '[lesson]', scopes: SESSION, kind: 'action' },
    { name: 'permissions', args: '[rule]', scopes: SESSION, kind: 'action' },
    {
        name: 'memory',
        scopes: BOTH,
        kind: 'navigate',
        to: '/settings/connections/memory',
    },
    {
        name: 'github',
        scopes: BOTH,
        kind: 'navigate',
        to: '/settings/connections/apps/github',
    },
    {
        name: 'settings',
        scopes: BOTH,
        kind: 'navigate',
        to: '/settings',
    },
    {
        name: 'login',
        scopes: BOTH,
        kind: 'navigate',
        to: '/settings/models',
    },
    {
        name: 'keybindings',
        scopes: BOTH,
        kind: 'help',
        helpTab: 'shortcuts',
    },

    // help
    {
        name: 'help',
        scopes: BOTH,
        kind: 'help',
        helpTab: 'commands',
    },
    { name: 'check', scopes: BOTH, kind: 'check' },
    { name: 'docs', scopes: BOTH, kind: 'external', to: '/docs' },
    {
        name: 'changelog',
        scopes: BOTH,
        kind: 'external',
        to: '/docs/changelog',
    },
    {
        name: 'feedback',
        scopes: BOTH,
        kind: 'external',
        to: FEEDBACK_URL,
    },
    { name: 'update', scopes: BOTH, kind: 'action' },
]

export const SLASH_COMMANDS: readonly SlashCommand[] = SLASH_COMMAND_SPECS.map((spec) => ({
    ...spec,
    description: getCommandInfo(spec.name).shortDescription ?? '',
}))
