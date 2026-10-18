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
    return clean.slice(0, maxLen - 1).trimEnd() + '…'
}

export function getAllAvailableCommands(workspaceDir: string = process.cwd()): Command[] {
    const skillCommands: Command[] = []
    try {
        const engine = new SkillDiscoveryEngine({ workspaceDir })
        const skills = engine.discoverAllSkills()
        for (const s of skills) {
            const desc = formatSingleLineDescription(s.metadata.description)
            skillCommands.push({
                name: s.name,
                description: desc,
                value: `/${s.name}`,
            })
            skillCommands.push({
                name: `skill:${s.name}`,
                description: desc,
                value: `/skill:${s.name}`,
            })
        }
    } catch {
        // Intentionally swallowed: fallback when skills cannot be discovered
    }

    const skillMap = new Map(skillCommands.map((c) => [c.name.toLowerCase(), c]))
    const coreCommands = COMMANDS.map((c) => {
        const nameLower = c.name.toLowerCase()
        if (skillMap.has(nameLower)) {
            return skillMap.get(nameLower)!
        }
        return c
    })

    const coreNames = new Set(coreCommands.map((c) => c.name.toLowerCase()))
    const additionalSkills = skillCommands.filter((s) => !coreNames.has(s.name.toLowerCase()))

    return [...coreCommands, ...additionalSkills]
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
        // If user typed query without "skill:" prefix, also match against the skill name (e.g. "tdd" matches "skill:tdd")
        if (name.startsWith('skill:') && name.slice('skill:'.length).startsWith(cleanQuery)) {
            return true
        }
        return false
    })
}
