import type { DiscoveredSkill } from './types'

export function formatOneLineSkillDescription(description: string): string {
    if (!description) return ''
    const firstLine =
        description
            .split(/\r?\n/)
            .map((l) => l.trim())
            .filter(Boolean)[0] || ''
    const sentenceMatch = firstLine.match(/^(.*?\.)(?:\s|$)/)
    const singleSentence = sentenceMatch && sentenceMatch[1] ? sentenceMatch[1].trim() : firstLine
    if (singleSentence.length > 140) {
        return singleSentence.slice(0, 137).trim() + '...'
    }
    return singleSentence
}

export function formatSkillsCatalog(skills: DiscoveredSkill[]): string {
    if (!skills || skills.length === 0) return ''

    const lines = [
        '<skills>',
        "You can use specialized 'skills' to help you with complex tasks. Each skill has a name and a description listed below.",
        '',
        'Skills are folders of instructions, scripts, and resources that extend your capabilities for specialized tasks. Each skill folder contains:',
        '- **SKILL.md** (required): The main instruction file with YAML frontmatter (name, description) and detailed markdown instructions',
        '',
        'If a skill seems relevant to your current task, use the `run_skill` tool to delegate the procedural work to an isolated subagent, or inspect its `SKILL.md` instructions using `read_file` before proceeding. Delegating to `run_skill` keeps the conversation context clean.',
        '',
        'When calling `read_file` on these skill paths, always use the exact path provided in the "Available skills" list below.',
        '',
        'Available skills:',
    ]

    for (const skill of skills) {
        const desc = formatOneLineSkillDescription(skill.metadata.description)
        lines.push(`- ${skill.name} (${skill.entryFilePath}): ${desc}`)
    }

    lines.push('</skills>')
    return lines.join('\n')
}
