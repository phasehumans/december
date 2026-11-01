import { SkillDiscoveryEngine } from '@december/shared'

import { COMMANDS } from './commands'

import type { Command } from './types'

export function formatSingleLineDescription(desc: string, maxLen: number = 70): string {
    if (!desc) return ''
    const clean = desc
        .replace(/\r?\n+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
    if (clean.length <= maxLen) return clean
    const sentenceEnd = clean.indexOf('. ')
    if (sentenceEnd > 15 && sentenceEnd <= maxLen) {
        return clean.slice(0, sentenceEnd + 1)
    }
    return clean.slice(0, maxLen - 1).trimEnd() + '...'
}

export function getAllAvailableCommands(workspaceDir: string = process.cwd()): Command[] {
    const skillCommands: Command[] = []
    const discoveredSkillNames = new Set<string>()
    try {
        const engine = new SkillDiscoveryEngine({ workspaceDir })
        const skills = engine.discoverAllSkills()
        for (const s of skills) {
            discoveredSkillNames.add(s.name.toLowerCase())
            const desc = formatSingleLineDescription(s.metadata.description)
            skillCommands.push({
                name: `skill:${s.name}`,
                description: desc,
                value: `/skill:${s.name}`,
            })
        }
    } catch {
        // Intentionally swallowed: fallback when skills cannot be discovered
    }

    // Core commands come first, excluding any that collide with discovered skills
    const coreCommands = COMMANDS.filter(
        (c) => !discoveredSkillNames.has(c.name.toLowerCase()) && !c.name.startsWith('skill:')
    )

    // Sort skills alphabetically by skill name
    skillCommands.sort((a, b) => a.name.localeCompare(b.name))

    // Core commands come first, all skills come at the end
    return [...coreCommands, ...skillCommands]
}

export function getFilteredCommands(
    query: string,
    workspaceDir: string = process.cwd()
): Command[] {
    const all = getAllAvailableCommands(workspaceDir)
    if (query.length === 0) return all

    const cleanQuery = query.toLowerCase()
    return all.filter((cmd) => {
        const name = cmd.name.toLowerCase()
        if (name.startsWith(cleanQuery)) return true
        // If user typed query without "skill:" prefix, also match against the skill name
        if (name.startsWith('skill:') && name.slice('skill:'.length).startsWith(cleanQuery)) {
            return true
        }
        return false
    })
}
