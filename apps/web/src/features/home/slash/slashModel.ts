import { SLASH_COMMANDS, type SlashCommand, type SlashScope } from './commands'

/** the "/word" the caret is in */
export interface SlashToken {
    query: string
    /** index of the slash in the text */
    start: number
    /** the slash is the first thing in the prompt */
    atStart: boolean
}

export interface SlashSkill {
    name: string
    description: string
    /** set when the skill comes from a plugin */
    plugin?: string
}

export type SlashItem =
    | {
          type: 'command'
          id: string
          name: string
          args?: string
          description: string
          command: SlashCommand
      }
    | { type: 'skill'; id: string; name: string; description: string; plugin?: string }

/**
 * finds the slash word that ends at the caret. the slash must start the prompt or come
 * after a space, so urls and file paths do not open the menu.
 */
export const parseSlashToken = (textBeforeCursor: string): SlashToken | null => {
    const match = /(^|\s)\/([a-z0-9-]*)$/i.exec(textBeforeCursor)
    if (!match) return null
    const start = match.index + match[1].length
    return {
        query: match[2].toLowerCase(),
        start,
        atStart: textBeforeCursor.slice(0, start).trim() === '',
    }
}

const byPrefixFirst =
    (query: string) =>
    <T extends { name: string }>(a: T, b: T) => {
        if (!query) return 0
        return Number(!a.name.startsWith(query)) - Number(!b.name.startsWith(query))
    }

/** the commands a prompt box can run, in menu order */
export const listSlashCommands = (options: {
    scope: SlashScope
    demo: boolean
    onCredits: boolean
}): SlashCommand[] =>
    SLASH_COMMANDS.filter(
        (command) =>
            command.scopes.includes(options.scope) &&
            (options.demo || !command.demoOnly) &&
            (options.onCredits || !command.creditsOnly)
    )

/**
 * the rows of the slash menu: commands first, then the user's skills, then the skills
 * of each plugin. commands need the slash at the start of the prompt, so a slash in the
 * middle of a sentence lists only skills.
 */
export const buildSlashItems = (options: {
    token: SlashToken
    scope: SlashScope
    demo: boolean
    onCredits: boolean
    skills: SlashSkill[]
}): SlashItem[] => {
    const { token, skills } = options
    const matches = (name: string) => name.includes(token.query)
    const sortByPrefix = byPrefixFirst(token.query)
    const items: SlashItem[] = []

    if (token.atStart) {
        listSlashCommands(options)
            .filter((command) => matches(command.name))
            .sort(sortByPrefix)
            .forEach((command) =>
                items.push({
                    type: 'command',
                    id: `command:${command.name}`,
                    name: command.name,
                    args: command.args,
                    description: command.description,
                    command,
                })
            )
    }

    const toItem = (skill: SlashSkill): SlashItem => ({
        type: 'skill',
        id: `skill:${skill.name}`,
        name: skill.name,
        description: skill.description,
        plugin: skill.plugin,
    })

    skills
        .filter((skill) => !skill.plugin && matches(skill.name))
        .sort(sortByPrefix)
        .forEach((skill) => items.push(toItem(skill)))

    // plugin skills stay grouped by plugin, in the order the plugins come in
    const pluginOrder = [...new Set(skills.map((skill) => skill.plugin).filter(Boolean))]
    pluginOrder.forEach((plugin) =>
        skills
            .filter((skill) => skill.plugin === plugin && matches(skill.name))
            .sort(sortByPrefix)
            .forEach((skill) => items.push(toItem(skill)))
    )

    return items
}

/** the grey label above a row: "Commands", "Skills" or a plugin name. null for no label */
export const getSlashGroupLabel = (items: SlashItem[], index: number): string | null => {
    // a list of commands only needs no labels
    if (!items.some((item) => item.type === 'skill')) return null
    const groupOf = (item: SlashItem | undefined) => {
        if (!item) return null
        if (item.type === 'command') return 'Commands'
        return item.plugin || 'Skills'
    }
    const group = groupOf(items[index])
    return group !== groupOf(items[index - 1]) ? group : null
}

/** the text with the slash word taken out, and where the caret goes */
export const replaceSlashToken = (
    value: string,
    cursor: number,
    token: SlashToken,
    replacement = ''
): { value: string; cursor: number } => ({
    value: value.slice(0, token.start) + replacement + value.slice(cursor),
    cursor: token.start + replacement.length,
})

/** "/rename new title" typed in a session and sent with Enter */
export const parseRenameCommand = (text: string): { title: string } | null => {
    const match = /^\s*\/rename(?:\s+([\s\S]*))?$/i.exec(text)
    if (!match) return null
    return { title: (match[1] || '').trim() }
}

/** "1.2M", "84k", "512" */
export const formatTokenCount = (tokens: number): string => {
    if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`
    if (tokens >= 1_000) return `${Math.round(tokens / 1_000)}k`
    return String(tokens)
}
